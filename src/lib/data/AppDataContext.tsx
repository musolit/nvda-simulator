"use client";

import { createContext, useContext, useEffect, useMemo, useState } from "react";
import { applyRealizedSells, totalQuantity } from "@/lib/fifo";
import { computeRealizedSellHistory, sumRealizedGainKrwForYear } from "@/lib/simulate";
import type { BuyLot, PortfolioSettings, SellTransaction } from "@/lib/types";
import {
  clearAll,
  DEFAULT_SIMULATION_SETTINGS,
  EMPTY_PORTFOLIO_SETTINGS,
  generateId,
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
  type SimulationSettingsRow,
} from "./localStore";

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
  const [allBuyLots, setAllBuyLots] = useState<BuyLot[]>([]);
  const [sellTransactions, setSellTransactions] = useState<SellTransaction[]>([]);
  const [portfolioSettings, setPortfolioSettings] =
    useState<PortfolioSettings>(EMPTY_PORTFOLIO_SETTINGS);
  const [simulationSettings, setSimulationSettings] =
    useState<SimulationSettingsRow>(DEFAULT_SIMULATION_SETTINGS);

  // One-time client-side read of localStorage on mount. This can't run during
  // the initial render (server-rendered HTML and the client's first hydration
  // pass both need to show the same "loading" defaults above, since
  // localStorage doesn't exist on the server) — an effect is the standard,
  // SSR-safe place to pull in browser-only storage.
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setInitialized(loadIsInitialized());
    setAllBuyLots(loadBuyLots());
    setSellTransactions(loadSellTransactions());
    setPortfolioSettings(loadPortfolioSettings());
    setSimulationSettings(loadSimulationSettings());
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
    allBuyLots,
    sellTransactions,
    remainingLots,
    remainingQuantity,
    portfolioSettings,
    simulationSettings,
    yearRealizedGainFromSalesKrw,
    effectivePriorRealizedGainKrw,
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
