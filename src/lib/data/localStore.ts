import { DEFAULT_ANNUAL_DEDUCTION_KRW, DEFAULT_TAX_RATE_PERCENT } from "@/lib/tax";
import type { BuyLot, PortfolioSettings, SellTransaction } from "@/lib/types";

/**
 * Single place that reads/writes this app's browser localStorage. Nothing
 * else in the app should touch `window.localStorage` directly — go through
 * these functions (or, for React state, through AppDataContext which wraps
 * them) so storage and in-memory state never drift apart.
 */

const PREFIX = "nvda-sim:v1:";

const KEYS = {
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
