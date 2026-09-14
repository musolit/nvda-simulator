import { totalQuantity } from "./fifo";
import { simulateSell, type SellSimulationResult } from "./simulate";
import type { BuyLot, TaxSettings } from "./types";

export interface ReverseCalcInput {
  lots: BuyLot[];
  targetNetCashKrw: number;
  currentPriceUsd: number;
  fxRate: number;
  priorRealizedGainKrw: number;
  taxSettings?: TaxSettings;
}

export type ReverseCalcResult =
  | { achievable: true; sellQuantity: number; simulation: SellSimulationResult }
  | { achievable: false; maxNetCashKrw: number; maxQuantity: number };

/**
 * Finds the smallest integer share count whose after-tax proceeds meet or
 * exceed `targetNetCashKrw`.
 *
 * Net cash as a function of quantity is non-decreasing for a positive share
 * price: each extra share adds `price * fx` to proceeds and at most that
 * much to tax (tax rate < 100%), so a binary search over the integer range
 * is valid.
 */
export function findSharesForTargetCash(input: ReverseCalcInput): ReverseCalcResult {
  const { lots, targetNetCashKrw, currentPriceUsd, fxRate, priorRealizedGainKrw, taxSettings } =
    input;
  const maxQuantity = totalQuantity(lots);

  const simulate = (qty: number) =>
    simulateSell({
      lots,
      sellQuantity: qty,
      currentPriceUsd,
      fxRate,
      priorRealizedGainKrw,
      taxSettings,
    });

  if (targetNetCashKrw <= 0) {
    return { achievable: true, sellQuantity: 0, simulation: simulate(0) };
  }

  const maxSimulation = simulate(maxQuantity);
  if (maxSimulation.netCashKrw < targetNetCashKrw) {
    return {
      achievable: false,
      maxNetCashKrw: maxSimulation.netCashKrw,
      maxQuantity,
    };
  }

  let low = 0;
  let high = maxQuantity;
  while (low < high) {
    const mid = Math.floor((low + high) / 2);
    const result = simulate(mid);
    if (result.netCashKrw >= targetNetCashKrw) {
      high = mid;
    } else {
      low = mid + 1;
    }
  }

  return { achievable: true, sellQuantity: low, simulation: simulate(low) };
}
