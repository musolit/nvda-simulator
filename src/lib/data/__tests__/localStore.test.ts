import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { BuyLot, PortfolioSettings } from "@/lib/types";

/** Minimal Web Storage polyfill so these tests can run under Node (no jsdom dependency needed). */
class MemoryStorage implements Storage {
  private store = new Map<string, string>();
  get length() {
    return this.store.size;
  }
  clear() {
    this.store.clear();
  }
  getItem(key: string) {
    return this.store.has(key) ? this.store.get(key)! : null;
  }
  key(index: number) {
    return Array.from(this.store.keys())[index] ?? null;
  }
  removeItem(key: string) {
    this.store.delete(key);
  }
  setItem(key: string, value: string) {
    this.store.set(key, value);
  }
}

beforeEach(() => {
  vi.stubGlobal("window", { localStorage: new MemoryStorage() });
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("localStore", () => {
  it("round-trips buy lots through save/load", async () => {
    const { loadBuyLots, saveBuyLots } = await import("../localStore");
    const lots: BuyLot[] = [
      {
        id: "lot-1",
        date: "2024-01-01",
        quantity: 10,
        pricePerShareUsd: 100,
        acquisitionFxRate: null,
        isAdjustment: false,
        source: "manual",
      },
    ];
    expect(loadBuyLots()).toEqual([]);
    saveBuyLots(lots);
    expect(loadBuyLots()).toEqual(lots);
  });

  it("round-trips portfolio settings through save/load", async () => {
    const { loadPortfolioSettings, savePortfolioSettings, EMPTY_PORTFOLIO_SETTINGS } =
      await import("../localStore");
    expect(loadPortfolioSettings()).toEqual(EMPTY_PORTFOLIO_SETTINGS);
    const settings: PortfolioSettings = { brokerQuantity: 500, brokerAvgPriceUsd: 150.25 };
    savePortfolioSettings(settings);
    expect(loadPortfolioSettings()).toEqual(settings);
  });

  it("tracks the initialized flag separately from data", async () => {
    const { isInitialized, markInitialized } = await import("../localStore");
    expect(isInitialized()).toBe(false);
    markInitialized();
    expect(isInitialized()).toBe(true);
  });

  it("clearAll wipes every key this app owns", async () => {
    const { clearAll, isInitialized, loadBuyLots, markInitialized, saveBuyLots } = await import(
      "../localStore"
    );
    markInitialized();
    saveBuyLots([
      {
        id: "lot-1",
        date: "2024-01-01",
        quantity: 10,
        pricePerShareUsd: 100,
        acquisitionFxRate: null,
        isAdjustment: false,
        source: "manual",
      },
    ]);
    expect(isInitialized()).toBe(true);
    expect(loadBuyLots()).toHaveLength(1);

    clearAll();

    expect(isInitialized()).toBe(false);
    expect(loadBuyLots()).toEqual([]);
  });

  it("returns a safe fallback instead of throwing on corrupt stored JSON", async () => {
    const { loadBuyLots } = await import("../localStore");
    window.localStorage.setItem("nvda-sim:v1:buyLots", "{not valid json");
    expect(loadBuyLots()).toEqual([]);
  });

  it("generateId produces unique, non-empty ids", async () => {
    const { generateId } = await import("../localStore");
    const ids = new Set(Array.from({ length: 20 }, () => generateId("lot")));
    expect(ids.size).toBe(20);
    for (const id of ids) {
      expect(id.startsWith("lot-")).toBe(true);
    }
  });
});

describe("getStartupStorageStatus", () => {
  it("reports 'normal' for a genuinely fresh browser (never auto-creates data)", async () => {
    const { getStartupStorageStatus } = await import("../localStore");
    expect(getStartupStorageStatus()).toEqual({ kind: "normal" });
    // Must not have written anything just by checking.
    expect(window.localStorage.length).toBe(0);
  });

  it("reports 'normal' for the ordinary already-initialized-with-data case", async () => {
    const { getStartupStorageStatus, markInitialized, saveBuyLots } = await import(
      "../localStore"
    );
    markInitialized();
    saveBuyLots([
      {
        id: "lot-1",
        date: "2024-01-01",
        quantity: 10,
        pricePerShareUsd: 100,
        acquisitionFxRate: null,
        isAdjustment: false,
        source: "manual",
      },
    ]);
    expect(getStartupStorageStatus()).toEqual({ kind: "normal" });
  });

  it("reports 'legacy-found' when real data exists but the initialized flag is missing", async () => {
    const { getStartupStorageStatus, saveBuyLots } = await import("../localStore");
    // initialized is never set here — mirrors the flag being lost while the
    // data keys stayed intact.
    saveBuyLots([
      {
        id: "lot-1",
        date: "2024-01-01",
        quantity: 10,
        pricePerShareUsd: 100,
        acquisitionFxRate: null,
        isAdjustment: false,
        source: "manual",
      },
    ]);
    expect(getStartupStorageStatus()).toEqual({
      kind: "legacy-found",
      hasBuyLots: true,
      hasSellTransactions: false,
      hasPortfolioSettings: false,
    });
  });

  it("does NOT report 'legacy-found' for a brokerQuantity of 0 alone (no false positive)", async () => {
    const { getStartupStorageStatus, savePortfolioSettings } = await import("../localStore");
    savePortfolioSettings({ brokerQuantity: 0, brokerAvgPriceUsd: 0 });
    expect(getStartupStorageStatus()).toEqual({ kind: "normal" });
  });

  it("reports 'corrupt' (not 'normal' or 'legacy-found') when a data key has unparseable JSON", async () => {
    const { getStartupStorageStatus } = await import("../localStore");
    window.localStorage.setItem("nvda-sim:v1:buyLots", "{not valid json");
    const status = getStartupStorageStatus();
    expect(status.kind).toBe("corrupt");
    if (status.kind === "corrupt") {
      expect(status.issues).toHaveLength(1);
      expect(status.issues[0].key).toBe("nvda-sim:v1:buyLots");
      expect(status.issues[0].raw).toBe("{not valid json");
    }
  });

  it("never mutates existing data just by being called (read-only)", async () => {
    const { getStartupStorageStatus, saveBuyLots } = await import("../localStore");
    const lots = [
      {
        id: "lot-1",
        date: "2024-01-01",
        quantity: 10,
        pricePerShareUsd: 100,
        acquisitionFxRate: null,
        isAdjustment: false,
        source: "manual" as const,
      },
    ];
    saveBuyLots(lots);
    const before = window.localStorage.getItem("nvda-sim:v1:buyLots");
    getStartupStorageStatus();
    getStartupStorageStatus();
    expect(window.localStorage.getItem("nvda-sim:v1:buyLots")).toBe(before);
  });
});

describe("writeStorageBackupSnapshot / clearCorruptKeyWithBackup", () => {
  it("backs up existing data under a separate timestamped key without touching the originals", async () => {
    const { writeStorageBackupSnapshot, saveBuyLots, loadBuyLots, markInitialized } =
      await import("../localStore");
    markInitialized();
    saveBuyLots([
      {
        id: "lot-1",
        date: "2024-01-01",
        quantity: 10,
        pricePerShareUsd: 100,
        acquisitionFxRate: null,
        isAdjustment: false,
        source: "manual",
      },
    ]);

    const backupKey = writeStorageBackupSnapshot();
    expect(backupKey).toMatch(/^nvda-simulator-backup-\d{8}-\d{6}$/);
    expect(loadBuyLots()).toHaveLength(1); // originals untouched
    const backupRaw = window.localStorage.getItem(backupKey!);
    expect(backupRaw).toBeTruthy();
    const backup = JSON.parse(backupRaw!);
    expect(backup.buyLots.kind).toBe("ok");
    expect(JSON.parse(backup.buyLots.raw)).toHaveLength(1);
  });

  it("clearCorruptKeyWithBackup backs up everything first, then removes only the named key", async () => {
    const { clearCorruptKeyWithBackup, saveBuyLots } = await import("../localStore");
    saveBuyLots([
      {
        id: "lot-1",
        date: "2024-01-01",
        quantity: 10,
        pricePerShareUsd: 100,
        acquisitionFxRate: null,
        isAdjustment: false,
        source: "manual",
      },
    ]);
    window.localStorage.setItem("nvda-sim:v1:sellTransactions", "{broken");

    const backupKey = clearCorruptKeyWithBackup("nvda-sim:v1:sellTransactions");
    expect(backupKey).toBeTruthy();
    expect(window.localStorage.getItem("nvda-sim:v1:sellTransactions")).toBeNull();
    // The unrelated, still-valid key is untouched.
    expect(window.localStorage.getItem("nvda-sim:v1:buyLots")).toBeTruthy();
    // The corrupt raw value survives inside the backup.
    const backup = JSON.parse(window.localStorage.getItem(backupKey!)!);
    expect(backup.sellTransactions.raw).toBe("{broken");
  });
});

describe("replaceBuyLotsAndSellTransactions", () => {
  it("backs up the pre-replace state, then wholesale-replaces buyLots and sellTransactions (not a merge)", async () => {
    const { replaceBuyLotsAndSellTransactions, saveBuyLots, loadBuyLots, loadSellTransactions } =
      await import("../localStore");

    saveBuyLots([
      { id: "old-net-lot", date: "2024-06-01", quantity: 50, pricePerShareUsd: 999, acquisitionFxRate: null, isAdjustment: false, source: "manual" },
    ]);

    const newBuyLots = [
      { id: "gross-lot-1", date: "2024-01-01", quantity: 100, pricePerShareUsd: 10, acquisitionFxRate: null, isAdjustment: false, source: "manual" as const },
      { id: "gross-lot-2", date: "2024-02-01", quantity: 100, pricePerShareUsd: 12, acquisitionFxRate: null, isAdjustment: false, source: "manual" as const },
    ];
    const newSells = [
      { id: "sell-1", date: "2024-03-01", quantity: 60, pricePerShareUsd: 20, fxRate: 1300, note: null },
    ];

    const { backupKey } = replaceBuyLotsAndSellTransactions(newBuyLots, newSells);
    expect(backupKey).toMatch(/^nvda-simulator-backup-\d{8}-\d{6}$/);

    // The old lot is GONE, not merged alongside the new ones.
    expect(loadBuyLots()).toEqual(newBuyLots);
    expect(loadSellTransactions()).toEqual(newSells);

    // But it's recoverable from the backup taken just before the replace.
    const backup = JSON.parse(window.localStorage.getItem(backupKey!)!);
    expect(JSON.parse(backup.buyLots.raw)).toEqual([
      { id: "old-net-lot", date: "2024-06-01", quantity: 50, pricePerShareUsd: 999, acquisitionFxRate: null, isAdjustment: false, source: "manual" },
    ]);
  });

  it("never touches portfolioSettings, simulationSettings, or the initialized flag", async () => {
    const {
      replaceBuyLotsAndSellTransactions,
      markInitialized,
      savePortfolioSettings,
      saveSimulationSettings,
      loadPortfolioSettings,
      loadSimulationSettings,
      isInitialized,
    } = await import("../localStore");

    markInitialized();
    savePortfolioSettings({ brokerQuantity: 2105, brokerAvgPriceUsd: 150 });
    saveSimulationSettings({
      annualDeductionKrw: 2_500_000,
      taxRatePercent: 0.22,
      priorRealizedGainKrw: 1_000_000,
      lastPriceUsd: 180,
      lastFxRate: 1400,
    });

    replaceBuyLotsAndSellTransactions([], []);

    expect(isInitialized()).toBe(true);
    expect(loadPortfolioSettings()).toEqual({ brokerQuantity: 2105, brokerAvgPriceUsd: 150 });
    expect(loadSimulationSettings().priorRealizedGainKrw).toBe(1_000_000);
  });

  it(
    "avoids the double-FIFO-deduction bug: replacing a net snapshot with the true gross lots + sells " +
      "reproduces the pre-loss remaining quantity, instead of under-counting if the sells were added on top of the net snapshot",
    async () => {
      const { replaceBuyLotsAndSellTransactions, loadBuyLots, loadSellTransactions } = await import(
        "../localStore"
      );
      const { applyRealizedSells } = await import("@/lib/fifo");

      // Simulates exactly the recovered scenario: only a net-of-sales total
      // could be restored (sells already subtracted), so the gross lots +
      // the real sells must replace it wholesale.
      const grossLots = [
        { id: "lot-1", date: "2024-01-01", quantity: 100, pricePerShareUsd: 10, acquisitionFxRate: null, isAdjustment: false, source: "manual" as const },
        { id: "lot-2", date: "2024-02-01", quantity: 100, pricePerShareUsd: 12, acquisitionFxRate: null, isAdjustment: false, source: "manual" as const },
      ];
      const realSells = [
        { id: "sell-1", date: "2024-03-01", quantity: 60, pricePerShareUsd: 20, fxRate: 1300, note: null },
      ];

      replaceBuyLotsAndSellTransactions(grossLots, realSells);

      const remaining = applyRealizedSells(loadBuyLots(), loadSellTransactions());
      const remainingTotal = remaining.reduce((sum, l) => sum + l.quantity, 0);
      // 200 gross - 60 sold = 140, matching what the net snapshot should
      // have shown — NOT 200 - 60 - 60 = 80, which is what would happen if
      // the 60-share sell were applied on top of an already-net buyLots set.
      expect(remainingTotal).toBe(140);
    }
  );
});
