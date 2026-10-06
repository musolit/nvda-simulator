"use client";

import { createContext, useContext, useEffect, useMemo, useState } from "react";
import { applyRealizedSells, totalQuantity } from "@/lib/fifo";
import { computeRealizedSellHistory, sumRealizedGainKrwForYear } from "@/lib/simulate";
import type { BuyLot, PortfolioSettings, SellTransaction } from "@/lib/types";
import {
  clearAll,
  clearCorruptKeyWithBackup,
  DEFAULT_SIMULATION_SETTINGS,
  EMPTY_PORTFOLIO_SETTINGS,
  generateId,
  getStartupStorageStatus,
  isInitialized as loadIsInitialized,
  loadBuyLots,
  loadPortfolioSettings,
  loadSellTransactions,
  loadSimulationSettings,
  markInitialized,
  saveBuyLots,
  savePortfolioSettings,
  saveSellTransactions,
  saveSimulationSettings,
  writeStorageBackupSnapshot,
  type SimulationSettingsRow,
  type StartupStorageStatus,
} from "./localStore";

export type { StartupStorageStatus };

export type { SimulationSettingsRow };

export interface NewBuyLotInput {
  date: string | null;
  quantity: number;
  pricePerShareUsd: number;
  source?: BuyLot["source"];
  note?: string | null;
}

export interface BuyLotPatch {
  date?: string | null;
  quantity?: number;
  pricePerShareUsd?: number;
  note?: string | null;
}

export interface NewSellTxInput {
  date: string;
  quantity: number;
  pricePerShareUsd: number;
  fxRate: number;
  note?: string | null;
}

export interface SellTxPatch {
  date?: string;
  quantity?: number;
  pricePerShareUsd?: number;
  fxRate?: number;
  note?: string | null;
}

export interface BackupData {
  exportedAt: string;
  buyLots: BuyLot[];
  sellTransactions: SellTransaction[];
  portfolioSettings: PortfolioSettings;
  simulationSettings: SimulationSettingsRow;
}

interface AppDataState {
  /** True until the initial client-side localStorage read has completed. */
  loading: boolean;
  /** True once the user has completed (or skipped) the first-run data import. */
  initialized: boolean;
  /**
   * Result of the one-time, read-only startup storage check (see
   * getStartupStorageStatus). "legacy-found"/"corrupt" must be resolved
   * (via recoverLegacyData / retryStorageRead / clearCorruptKeyAndContinue)
   * before falling through to the normal initialized/onboarding branch —
   * see AppShell.
   */
  storageStatus: StartupStorageStatus;
  /** Backs up all owned keys, then marks the found data as the active data (no destructive writes). */
  recoverLegacyData: () => void;
  /** Re-runs the read-only startup check again (e.g. after a transient error). */
  retryStorageRead: () => void;
  /** Explicit, user-initiated: backs up everything, then clears just the one unreadable key. */
  clearCorruptKeyAndContinue: (key: string) => void;
  allBuyLots: BuyLot[];
  sellTransactions: SellTransaction[];
  /** Buy lots remaining after applying every recorded real sell, FIFO. */
  remainingLots: BuyLot[];
  remainingQuantity: number;
  portfolioSettings: PortfolioSettings;
  simulationSettings: SimulationSettingsRow;
  /** This calendar year's realized gain from recorded real NVDA sells (auto-derived, KRW). */
  yearRealizedGainFromSalesKrw: number;
  /**
   * simulationSettings.priorRealizedGainKrw (manual, e.g. other overseas
   * stock gains this app doesn't track) + yearRealizedGainFromSalesKrw.
   * Use this as the "already realized this year" baseline for tax calcs.
   */
  effectivePriorRealizedGainKrw: number;

  /**
   * Shared current-price / FX-rate text input state (see lib/data/usePriceFx.ts).
   * Lives here, not in a per-component useState, so every consumer on the
   * page (dashboard, and the simulator's price card + whichever mode panel
   * is active) reads and writes the exact same value — typing in one place
   * is instantly reflected everywhere else that reads it.
   */
  priceInput: string;
  setPriceInput: (value: string) => void;
  fxInput: string;
  setFxInput: (value: string) => void;

  addBuyLot: (input: NewBuyLotInput) => void;
  updateBuyLot: (id: string, patch: BuyLotPatch) => void;
  deleteBuyLot: (id: string) => void;
  addSellTransaction: (input: NewSellTxInput) => void;
  updateSellTransaction: (id: string, patch: SellTxPatch) => void;
  deleteSellTransaction: (id: string) => void;
  updatePortfolioSettings: (patch: Partial<PortfolioSettings>) => void;
  updateSimulationSettings: (patch: Partial<SimulationSettingsRow>) => void;
  /** Merges imported buy lots/sells by id (skips duplicates), replaces settings. */
  importData: (data: BackupData) => void;
  exportData: () => BackupData;
  /** Marks first-run setup done without importing anything (start empty, add manually). */
  skipInitialImport: () => void;
  /** Wipes all local data and returns to the first-run import screen. */
  resetAll: () => void;
}

const AppDataContext = createContext<AppDataState | null>(null);

export function AppDataProvider({ children }: { children: React.ReactNode }) {
  const [loading, setLoading] = useState(true);
  const [initialized, setInitialized] = useState(false);
  const [storageStatus, setStorageStatus] = useState<StartupStorageStatus>({ kind: "normal" });
  const [allBuyLots, setAllBuyLots] = useState<BuyLot[]>([]);
  const [sellTransactions, setSellTransactions] = useState<SellTransaction[]>([]);
  const [portfolioSettings, setPortfolioSettings] =
    useState<PortfolioSettings>(EMPTY_PORTFOLIO_SETTINGS);
  const [simulationSettings, setSimulationSettings] =
    useState<SimulationSettingsRow>(DEFAULT_SIMULATION_SETTINGS);
  const [priceInput, setPriceInputState] = useState("");
  const [fxInput, setFxInputState] = useState("");

  // One-time client-side read of localStorage on mount. This can't run during
  // the initial render (server-rendered HTML and the client's first hydration
  // pass both need to show the same "loading" defaults above, since
  // localStorage doesn't exist on the server) — an effect is the standard,
  // SSR-safe place to pull in browser-only storage.
  function readStorageIntoState() {
    // Read-only: computes whether the existing data is intact, missing-flag
    // ("legacy-found"), or unreadable ("corrupt") BEFORE deciding what the UI
    // shows — see getStartupStorageStatus's doc comment. Loading each value
    // below always uses the safe-fallback readers regardless of status, since
    // that never writes anything; AppShell is what decides whether to render
    // this data or a recovery screen first.
    const status = getStartupStorageStatus();
    setStorageStatus(status);
    setInitialized(loadIsInitialized());
    setAllBuyLots(loadBuyLots());
    setSellTransactions(loadSellTransactions());
    setPortfolioSettings(loadPortfolioSettings());
    const simSettings = loadSimulationSettings();
    setSimulationSettings(simSettings);
    setPriceInputState(simSettings.lastPriceUsd !== null ? String(simSettings.lastPriceUsd) : "");
    setFxInputState(simSettings.lastFxRate !== null ? String(simSettings.lastFxRate) : "");
  }

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    readStorageIntoState();
    setLoading(false);
  }, []);

  const remainingLots = useMemo(
    () => applyRealizedSells(allBuyLots, sellTransactions),
    [allBuyLots, sellTransactions]
  );
  const remainingQuantity = useMemo(() => totalQuantity(remainingLots), [remainingLots]);

  const yearRealizedGainFromSalesKrw = useMemo(() => {
    const history = computeRealizedSellHistory(allBuyLots, sellTransactions);
    return sumRealizedGainKrwForYear(history, new Date().getFullYear());
  }, [allBuyLots, sellTransactions]);

  const effectivePriorRealizedGainKrw =
    simulationSettings.priorRealizedGainKrw + yearRealizedGainFromSalesKrw;

  function addBuyLot(input: NewBuyLotInput) {
    const lot: BuyLot = {
      id: generateId("lot"),
      date: input.date,
      quantity: input.quantity,
      pricePerShareUsd: input.pricePerShareUsd,
      acquisitionFxRate: null,
      isAdjustment: false,
      source: input.source ?? "manual",
      note: input.note ?? null,
    };
    setAllBuyLots((prev) => {
      const next = [...prev, lot];
      saveBuyLots(next);
      return next;
    });
  }

  function updateBuyLot(id: string, patch: BuyLotPatch) {
    setAllBuyLots((prev) => {
      const next = prev.map((lot) => (lot.id === id ? { ...lot, ...patch } : lot));
      saveBuyLots(next);
      return next;
    });
  }

  function deleteBuyLot(id: string) {
    setAllBuyLots((prev) => {
      const next = prev.filter((lot) => lot.id !== id);
      saveBuyLots(next);
      return next;
    });
  }

  function addSellTransaction(input: NewSellTxInput) {
    const tx: SellTransaction = {
      id: generateId("sell"),
      date: input.date,
      quantity: input.quantity,
      pricePerShareUsd: input.pricePerShareUsd,
      fxRate: input.fxRate,
      note: input.note ?? null,
    };
    setSellTransactions((prev) => {
      const next = [...prev, tx];
      saveSellTransactions(next);
      return next;
    });
  }

  function updateSellTransaction(id: string, patch: SellTxPatch) {
    setSellTransactions((prev) => {
      const next = prev.map((tx) => (tx.id === id ? { ...tx, ...patch } : tx));
      saveSellTransactions(next);
      return next;
    });
  }

  function deleteSellTransaction(id: string) {
    setSellTransactions((prev) => {
      const next = prev.filter((tx) => tx.id !== id);
      saveSellTransactions(next);
      return next;
    });
  }

  function updatePortfolioSettings(patch: Partial<PortfolioSettings>) {
    setPortfolioSettings((prev) => {
      const next = { ...prev, ...patch };
      savePortfolioSettings(next);
      return next;
    });
  }

  function updateSimulationSettings(patch: Partial<SimulationSettingsRow>) {
    setSimulationSettings((prev) => {
      const next = { ...prev, ...patch };
      saveSimulationSettings(next);
      return next;
    });
  }

  function setPriceInput(value: string) {
    setPriceInputState(value);
    const n = Number(value);
    if (value !== "" && Number.isFinite(n) && n > 0) {
      updateSimulationSettings({ lastPriceUsd: n });
    }
  }

  function setFxInput(value: string) {
    setFxInputState(value);
    const n = Number(value);
    if (value !== "" && Number.isFinite(n) && n > 0) {
      updateSimulationSettings({ lastFxRate: n });
    }
  }

  function importData(data: BackupData) {
    setAllBuyLots((prev) => {
      const existingIds = new Set(prev.map((l) => l.id));
      const next = [...prev, ...data.buyLots.filter((l) => !existingIds.has(l.id))];
      saveBuyLots(next);
      return next;
    });
    setSellTransactions((prev) => {
      const existingIds = new Set(prev.map((s) => s.id));
      const next = [...prev, ...data.sellTransactions.filter((s) => !existingIds.has(s.id))];
      saveSellTransactions(next);
      return next;
    });
    setPortfolioSettings(data.portfolioSettings);
    savePortfolioSettings(data.portfolioSettings);
    setSimulationSettings(data.simulationSettings);
    saveSimulationSettings(data.simulationSettings);
    markInitialized();
    setInitialized(true);
  }

  function exportData(): BackupData {
    return {
      exportedAt: new Date().toISOString(),
      buyLots: allBuyLots,
      sellTransactions,
      portfolioSettings,
      simulationSettings,
    };
  }

  function skipInitialImport() {
    markInitialized();
    setInitialized(true);
  }

  function recoverLegacyData() {
    // The data found under this app's own keys already matches the current
    // schema (storageStatus only reports "legacy-found" for THIS app's own
    // keys) — so "recovering" it is just: back up everything first, then
    // flip the initialized flag. The actual buyLots/sellTransactions/
    // portfolioSettings state was already loaded into memory by the mount
    // effect regardless of the flag, so nothing else needs to change.
    writeStorageBackupSnapshot();
    markInitialized();
    setInitialized(true);
    setStorageStatus({ kind: "normal" });
  }

  function retryStorageRead() {
    readStorageIntoState();
  }

  function clearCorruptKeyAndContinue(key: string) {
    clearCorruptKeyWithBackup(key);
    readStorageIntoState();
  }

  function resetAll() {
    clearAll();
    setAllBuyLots([]);
    setSellTransactions([]);
    setPortfolioSettings(EMPTY_PORTFOLIO_SETTINGS);
    setSimulationSettings(DEFAULT_SIMULATION_SETTINGS);
    setInitialized(false);
  }

  const value: AppDataState = {
    loading,
    initialized,
    storageStatus,
    recoverLegacyData,
    retryStorageRead,
    clearCorruptKeyAndContinue,
    allBuyLots,
    sellTransactions,
    remainingLots,
    remainingQuantity,
    portfolioSettings,
    simulationSettings,
    yearRealizedGainFromSalesKrw,
    effectivePriorRealizedGainKrw,
    priceInput,
    setPriceInput,
    fxInput,
    setFxInput,
    addBuyLot,
    updateBuyLot,
    deleteBuyLot,
    addSellTransaction,
    updateSellTransaction,
    deleteSellTransaction,
    updatePortfolioSettings,
    updateSimulationSettings,
    importData,
    exportData,
    skipInitialImport,
    resetAll,
  };

  return <AppDataContext.Provider value={value}>{children}</AppDataContext.Provider>;
}

export function useAppData(): AppDataState {
  const ctx = useContext(AppDataContext);
  if (!ctx) throw new Error("useAppData must be used within AppDataProvider");
  return ctx;
}
