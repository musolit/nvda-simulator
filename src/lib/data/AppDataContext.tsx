"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import type { User } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/client";
import { applyRealizedSells, totalQuantity } from "@/lib/fifo";
import { computeRealizedSellHistory, sumRealizedGainKrwForYear } from "@/lib/simulate";
import type { BuyLot, PortfolioSettings, SellTransaction } from "@/lib/types";
import {
  ensureSeeded,
  fetchBuyLots,
  fetchPortfolioSettings,
  fetchSellTransactions,
  fetchSimulationSettings,
  type SimulationSettingsRow,
} from "./repository";

interface AppDataState {
  loading: boolean;
  error: string | null;
  user: User | null;
  /** All buy lots as originally recorded (not net of sells). */
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
  refresh: () => Promise<void>;
  setSimulationSettingsLocal: (patch: Partial<SimulationSettingsRow>) => void;
}

const AppDataContext = createContext<AppDataState | null>(null);

const FALLBACK_PORTFOLIO: PortfolioSettings = {
  brokerQuantity: 2631,
  brokerAvgPriceUsd: 139.84,
};

const FALLBACK_SIM_SETTINGS: SimulationSettingsRow = {
  annualDeductionKrw: 2_500_000,
  taxRatePercent: 0.22,
  priorRealizedGainKrw: 0,
  lastPriceUsd: null,
  lastFxRate: null,
};

export function AppDataProvider({ children }: { children: React.ReactNode }) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [allBuyLots, setAllBuyLots] = useState<BuyLot[]>([]);
  const [sellTransactions, setSellTransactions] = useState<SellTransaction[]>([]);
  const [portfolioSettings, setPortfolioSettings] = useState<PortfolioSettings>(FALLBACK_PORTFOLIO);
  const [simulationSettings, setSimulationSettings] =
    useState<SimulationSettingsRow>(FALLBACK_SIM_SETTINGS);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const supabase = createClient();
      const {
        data: { user: currentUser },
      } = await supabase.auth.getUser();
      setUser(currentUser);
      if (!currentUser) {
        setLoading(false);
        return;
      }

      await ensureSeeded(currentUser.id);

      const [lots, sells, portfolio, simSettings] = await Promise.all([
        fetchBuyLots(),
        fetchSellTransactions(),
        fetchPortfolioSettings(),
        fetchSimulationSettings(),
      ]);

      setAllBuyLots(lots);
      setSellTransactions(sells);
      setPortfolioSettings(portfolio);
      setSimulationSettings(simSettings);
    } catch (e) {
      setError(e instanceof Error ? e.message : "데이터를 불러오지 못했습니다.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    // Standard mount-time data load; `load` manages its own loading/error
    // state internally (including for manual refresh() calls), which this
    // stricter lint rule flags even though it's the intended pattern here.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load();
  }, [load]);

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

  const setSimulationSettingsLocal = useCallback((patch: Partial<SimulationSettingsRow>) => {
    setSimulationSettings((prev) => ({ ...prev, ...patch }));
  }, []);

  const value: AppDataState = {
    loading,
    error,
    user,
    allBuyLots,
    sellTransactions,
    remainingLots,
    remainingQuantity,
    portfolioSettings,
    simulationSettings,
    yearRealizedGainFromSalesKrw,
    effectivePriorRealizedGainKrw,
    refresh: load,
    setSimulationSettingsLocal,
  };

  return <AppDataContext.Provider value={value}>{children}</AppDataContext.Provider>;
}

export function useAppData(): AppDataState {
  const ctx = useContext(AppDataContext);
  if (!ctx) throw new Error("useAppData must be used within AppDataProvider");
  return ctx;
}
