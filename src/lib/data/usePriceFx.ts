"use client";

import { useState } from "react";
import { useAppData } from "./AppDataContext";

/**
 * Shared current-price / FX-rate input state, persisted to
 * simulation_settings (localStorage) so it's remembered across the
 * dashboard, simulator, and across reloads.
 *
 * Only used inside pages rendered under <AppShell>, which withholds
 * rendering until localStorage has finished loading — so the initial
 * useState below always sees the real stored value, never a stale default.
 */
export function usePriceFx() {
  const { simulationSettings, updateSimulationSettings } = useAppData();
  const [priceInput, setPriceInputState] = useState(
    simulationSettings.lastPriceUsd !== null ? String(simulationSettings.lastPriceUsd) : ""
  );
  const [fxInput, setFxInputState] = useState(
    simulationSettings.lastFxRate !== null ? String(simulationSettings.lastFxRate) : ""
  );

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
