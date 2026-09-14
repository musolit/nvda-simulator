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
