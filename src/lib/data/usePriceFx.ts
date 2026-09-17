"use client";

import { useAppData } from "./AppDataContext";

/**
 * Shared current-price / FX-rate input state, persisted to
 * simulation_settings (localStorage). The actual string state lives in
 * AppDataContext (see priceInput/fxInput there) so every consumer on a
 * page — e.g. the simulator's price card plus whichever mode panel is
 * active — reads and writes the exact same value; this hook is just a
 * thin derived view over it (parses to numbers, computes `ready`).
 */
export function usePriceFx() {
  const { priceInput, setPriceInput, fxInput, setFxInput } = useAppData();

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
