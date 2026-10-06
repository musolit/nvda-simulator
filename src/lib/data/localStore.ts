import { DEFAULT_ANNUAL_DEDUCTION_KRW, DEFAULT_TAX_RATE_PERCENT } from "@/lib/tax";
import type { BuyLot, PortfolioSettings, SellTransaction } from "@/lib/types";

/**
 * Single place that reads/writes this app's browser localStorage. Nothing
 * else in the app should touch `window.localStorage` directly — go through
 * these functions (or, for React state, through AppDataContext which wraps
 * them) so storage and in-memory state never drift apart.
 */

export const STORAGE_PREFIX = "nvda-sim:v1:";
const PREFIX = STORAGE_PREFIX;

export const KEYS = {
  initialized: `${PREFIX}initialized`,
  buyLots: `${PREFIX}buyLots`,
  sellTransactions: `${PREFIX}sellTransactions`,
  portfolioSettings: `${PREFIX}portfolioSettings`,
  simulationSettings: `${PREFIX}simulationSettings`,
} as const;

export interface SimulationSettingsRow {
  annualDeductionKrw: number;
  taxRatePercent: number;
  priorRealizedGainKrw: number;
  lastPriceUsd: number | null;
  lastFxRate: number | null;
}

/** No personal figures ship in source: a fresh browser starts fully empty. */
export const EMPTY_PORTFOLIO_SETTINGS: PortfolioSettings = {
  brokerQuantity: 0,
  brokerAvgPriceUsd: 0,
};

export const DEFAULT_SIMULATION_SETTINGS: SimulationSettingsRow = {
  annualDeductionKrw: DEFAULT_ANNUAL_DEDUCTION_KRW,
  taxRatePercent: DEFAULT_TAX_RATE_PERCENT,
  priorRealizedGainKrw: 0,
  lastPriceUsd: null,
  lastFxRate: null,
};

function isBrowser(): boolean {
  return typeof window !== "undefined";
}

function readJson<T>(key: string, fallback: T): T {
  if (!isBrowser()) return fallback;
  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return fallback;
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

function writeJson(key: string, value: unknown): void {
  if (!isBrowser()) return;
  window.localStorage.setItem(key, JSON.stringify(value));
}

/**
 * Read outcomes that never silently collapse "never had this key" into the
 * same bucket as "key exists but we failed to read/parse it" — the
 * conflation that `readJson` above does on purpose for everyday, low-stakes
 * reads. Anything that decides whether the user has existing data (the
 * startup gate in AppDataContext) must use these instead, so a parse
 * failure or a storage-access exception is never silently treated as "no
 * data" — see getStartupStorageStatus() below.
 */
export type RawReadOutcome =
  | { kind: "absent" }
  | { kind: "ok"; raw: string }
  | { kind: "inaccessible"; error: string };

export type JsonReadOutcome<T> =
  | { kind: "absent" }
  | { kind: "ok"; value: T }
  | { kind: "inaccessible"; error: string }
  | { kind: "corrupt"; raw: string; error: string };

/** Read-only: gets a key's raw string, distinguishing "missing" from "storage access threw." Never writes. */
export function readRawOutcome(key: string): RawReadOutcome {
  if (!isBrowser()) return { kind: "absent" };
  try {
    const raw = window.localStorage.getItem(key);
    if (raw === null) return { kind: "absent" };
    return { kind: "ok", raw };
  } catch (e) {
    return { kind: "inaccessible", error: e instanceof Error ? e.message : String(e) };
  }
}

/** Read-only: parses a key's JSON, distinguishing "missing" from "unparseable" from "storage access threw." Never writes. */
export function readJsonOutcome<T>(key: string): JsonReadOutcome<T> {
  const raw = readRawOutcome(key);
  if (raw.kind !== "ok") return raw;
  try {
    return { kind: "ok", value: JSON.parse(raw.raw) as T };
  } catch (e) {
    return { kind: "corrupt", raw: raw.raw, error: e instanceof Error ? e.message : String(e) };
  }
}

/** Read-only: every localStorage key that currently exists (not just the ones this app knows about). */
export function listAllStorageKeys(): string[] {
  if (!isBrowser()) return [];
  try {
    return Object.keys(window.localStorage);
  } catch {
    return [];
  }
}

export type StartupStorageStatus =
  | { kind: "normal" }
  | {
      /**
       * `initialized` is false/absent, but one or more of the data keys this
       * app owns contains meaningful, successfully-parsed content. This is
       * the "flag went missing/false but the real data is intact" scenario —
       * never route this straight to the empty onboarding screen.
       */
      kind: "legacy-found";
      hasBuyLots: boolean;
      hasSellTransactions: boolean;
      hasPortfolioSettings: boolean;
    }
  | {
      /**
       * At least one of this app's own keys exists but could not be safely
       * read (unparseable JSON, or the storage API itself threw). The
       * existing data has NOT been touched — only flagged for the user to
       * decide what to do next.
       */
      kind: "corrupt";
      issues: Array<{ key: string; raw: string | null; error: string }>;
    };

/**
 * Pure, read-only decision used once on app startup (see AppDataContext's
 * mount effect) to decide whether to show the normal app/onboarding flow, or
 * one of the data-preserving recovery screens. Never writes anything.
 */
export function getStartupStorageStatus(): StartupStorageStatus {
  const initializedOutcome = readJsonOutcome<boolean>(KEYS.initialized);
  const buyLotsOutcome = readJsonOutcome<BuyLot[]>(KEYS.buyLots);
  const sellTransactionsOutcome = readJsonOutcome<SellTransaction[]>(KEYS.sellTransactions);
  const portfolioSettingsOutcome = readJsonOutcome<PortfolioSettings>(KEYS.portfolioSettings);
  const simulationSettingsOutcome = readJsonOutcome<SimulationSettingsRow>(KEYS.simulationSettings);

  const issues: Array<{ key: string; raw: string | null; error: string }> = [];
  for (const [key, outcome] of [
    [KEYS.initialized, initializedOutcome],
    [KEYS.buyLots, buyLotsOutcome],
    [KEYS.sellTransactions, sellTransactionsOutcome],
    [KEYS.portfolioSettings, portfolioSettingsOutcome],
    [KEYS.simulationSettings, simulationSettingsOutcome],
  ] as const) {
    if (outcome.kind === "corrupt") issues.push({ key, raw: outcome.raw, error: outcome.error });
    else if (outcome.kind === "inaccessible") issues.push({ key, raw: null, error: outcome.error });
  }
  if (issues.length > 0) return { kind: "corrupt", issues };

  const isInitializedNow = initializedOutcome.kind === "ok" && initializedOutcome.value === true;
  if (!isInitializedNow) {
    const buyLots = buyLotsOutcome.kind === "ok" ? buyLotsOutcome.value : [];
    const sellTransactions =
      sellTransactionsOutcome.kind === "ok" ? sellTransactionsOutcome.value : [];
    const portfolioSettings =
      portfolioSettingsOutcome.kind === "ok" ? portfolioSettingsOutcome.value : null;

    const hasBuyLots = Array.isArray(buyLots) && buyLots.length > 0;
    const hasSellTransactions = Array.isArray(sellTransactions) && sellTransactions.length > 0;
    const hasPortfolioSettings = Boolean(
      portfolioSettings &&
        (portfolioSettings.brokerQuantity > 0 || portfolioSettings.brokerAvgPriceUsd > 0)
    );

    if (hasBuyLots || hasSellTransactions || hasPortfolioSettings) {
      return { kind: "legacy-found", hasBuyLots, hasSellTransactions, hasPortfolioSettings };
    }
  }

  return { kind: "normal" };
}

/**
 * Snapshots everything currently under this app's keys into a separate,
 * timestamped backup key — WITHOUT modifying or removing the originals.
 * Call this before any recovery/migration write. Returns the backup key
 * name, or null if storage isn't available.
 */
export function writeStorageBackupSnapshot(): string | null {
  if (!isBrowser()) return null;
  const now = new Date();
  const stamp = [
    now.getFullYear(),
    String(now.getMonth() + 1).padStart(2, "0"),
    String(now.getDate()).padStart(2, "0"),
  ].join("") + "-" + [
    String(now.getHours()).padStart(2, "0"),
    String(now.getMinutes()).padStart(2, "0"),
    String(now.getSeconds()).padStart(2, "0"),
  ].join("");
  const backupKey = `nvda-simulator-backup-${stamp}`;
  const snapshot = {
    backedUpAt: now.toISOString(),
    initialized: readRawOutcome(KEYS.initialized),
    buyLots: readRawOutcome(KEYS.buyLots),
    sellTransactions: readRawOutcome(KEYS.sellTransactions),
    portfolioSettings: readRawOutcome(KEYS.portfolioSettings),
    simulationSettings: readRawOutcome(KEYS.simulationSettings),
  };
  window.localStorage.setItem(backupKey, JSON.stringify(snapshot));
  return backupKey;
}

/**
 * Explicit, user-initiated recovery step for a single key that failed to
 * read (see StartupStorageStatus "corrupt"). Always backs up every key this
 * app owns first (writeStorageBackupSnapshot), then removes ONLY the one
 * named key so the app can fall back to defaults for that key alone. Never
 * called automatically — only from a user clicking a clearly-labeled button
 * after being shown the raw unreadable value.
 */
export function clearCorruptKeyWithBackup(key: string): string | null {
  if (!isBrowser()) return null;
  const backupKey = writeStorageBackupSnapshot();
  window.localStorage.removeItem(key);
  return backupKey;
}

export function isInitialized(): boolean {
  return readJson(KEYS.initialized, false);
}

export function markInitialized(): void {
  writeJson(KEYS.initialized, true);
}

export function loadBuyLots(): BuyLot[] {
  return readJson(KEYS.buyLots, []);
}
export function saveBuyLots(lots: BuyLot[]): void {
  writeJson(KEYS.buyLots, lots);
}

export function loadSellTransactions(): SellTransaction[] {
  return readJson(KEYS.sellTransactions, []);
}
export function saveSellTransactions(transactions: SellTransaction[]): void {
  writeJson(KEYS.sellTransactions, transactions);
}

export function loadPortfolioSettings(): PortfolioSettings {
  return readJson(KEYS.portfolioSettings, EMPTY_PORTFOLIO_SETTINGS);
}
export function savePortfolioSettings(settings: PortfolioSettings): void {
  writeJson(KEYS.portfolioSettings, settings);
}

export function loadSimulationSettings(): SimulationSettingsRow {
  return readJson(KEYS.simulationSettings, DEFAULT_SIMULATION_SETTINGS);
}
export function saveSimulationSettings(settings: SimulationSettingsRow): void {
  writeJson(KEYS.simulationSettings, settings);
}

/** Wipes every key this app owns. Does not touch unrelated localStorage data. */
export function clearAll(): void {
  if (!isBrowser()) return;
  Object.values(KEYS).forEach((key) => window.localStorage.removeItem(key));
}

let idCounter = 0;
/** Locally-unique id for a new record (no backend to assign one). */
export function generateId(prefix: string): string {
  idCounter += 1;
  return `${prefix}-${Date.now().toString(36)}-${idCounter}-${Math.random().toString(36).slice(2, 8)}`;
}
