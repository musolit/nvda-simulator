"use client";

import { useEffect, useState } from "react";
import { useAppData } from "./AppDataContext";
import { updateSimulationSettings } from "./repository";

/**
 * Shared current-price / FX-rate input state, persisted (debounced) to
 * simulation_settings so it's remembered across the dashboard, simulator,
 * and across devices/sessions.
 *
 * Only used inside components rendered under <PageState>, which withholds
 * rendering until simulationSettings has finished loading — so the initial
 * useState below always sees the real fetched value, never a stale default.
 */
export function usePriceFx() {
  const { user, simulationSettings, setSimulationSettingsLocal } = useAppData();
  const [priceInput, setPriceInput] = useState(
    simulationSettings.lastPriceUsd !== null ? String(simulationSettings.lastPriceUsd) : ""
  );
  const [fxInput, setFxInput] = useState(
    simulationSettings.lastFxRate !== null ? String(simulationSettings.lastFxRate) : ""
  );

  useEffect(() => {
    if (!user) return;
    const price = Number(priceInput);
    const fx = Number(fxInput);
    const timer = setTimeout(() => {
      const patch: { lastPriceUsd?: number; lastFxRate?: number } = {};
      if (priceInput !== "" && Number.isFinite(price) && price > 0) patch.lastPriceUsd = price;
      if (fxInput !== "" && Number.isFinite(fx) && fx > 0) patch.lastFxRate = fx;
      if (Object.keys(patch).length === 0) return;
      setSimulationSettingsLocal(patch);
      updateSimulationSettings(user.id, patch).catch(() => {
        // Best-effort persistence; local state still reflects the input.
      });
    }, 500);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [priceInput, fxInput, user]);

  const price = Number(priceInput);
  const fxRate = Number(fxInput);
  const priceValid = priceInput !== "" && Number.isFinite(price) && price > 0;
  const fxValid = fxInput !== "" && Number.isFinite(fxRate) && fxRate > 0;

  return {
    priceInput,
    setPriceInput,
    fxInput,
    setFxInput,
    price: priceValid ? price : 0,
    fxRate: fxValid ? fxRate : 0,
    ready: priceValid && fxValid,
  };
}
