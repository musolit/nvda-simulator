import { consumeLotsFifo, sortLotsFifo, totalQuantity } from "./fifo";
import { calculateTax, DEFAULT_TAX_SETTINGS } from "./tax";
import type { BuyLot, FifoConsumeResult, SellTransaction, TaxCalcResult, TaxSettings } from "./types";

export interface SellSimulationInput {
  /** Current remaining lots (already net of any real, recorded sells). */
  lots: BuyLot[];
  sellQuantity: number;
  currentPriceUsd: number;
  fxRate: number;
  /** Realized gain already booked this calendar year from real sells. */
  priorRealizedGainKrw: number;
  taxSettings?: TaxSettings;
}

export interface SellSimulationResult {
  sellQuantity: number;
  /** True if `sellQuantity` exceeded total holdings; fewer shares than requested were simulated. */
  insufficientShares: boolean;
  proceedsUsd: number;
  proceedsKrw: number;
  fifo: FifoConsumeResult;
  fifoCostUsd: number;
  realizedGainUsd: number;
  realizedGainKrw: number;
  tax: TaxCalcResult;
  netCashKrw: number;
  remainingQuantity: number;
  remainingValueUsd: number;
  remainingValueKrw: number;
}

export function simulateSell(input: SellSimulationInput): SellSimulationResult {
  const { lots, sellQuantity, currentPriceUsd, fxRate, priorRealizedGainKrw } = input;
  const taxSettings = input.taxSettings ?? DEFAULT_TAX_SETTINGS;

  const fifo = consumeLotsFifo(lots, sellQuantity);
  const proceedsUsd = fifo.consumedQuantity * currentPriceUsd;
  const proceedsKrw = proceedsUsd * fxRate;

  const realizedGainUsd = proceedsUsd - fifo.totalCostUsd;
  // Simplified estimation model (see docs in lib/types.ts on acquisitionFxRate):
  // convert the USD gain to KRW using the user-entered current FX rate for
  // both legs, since per-lot acquisition FX rates aren't available yet.
  const realizedGainKrw = realizedGainUsd * fxRate;

  const tax = calculateTax(realizedGainKrw, priorRealizedGainKrw, taxSettings);
  const netCashKrw = proceedsKrw - tax.taxKrw;

  const remainingQuantity = totalQuantity(fifo.remainingLots);
  const remainingValueUsd = remainingQuantity * currentPriceUsd;

  return {
    sellQuantity,
    insufficientShares: fifo.shortfall > 0,
    proceedsUsd,
    proceedsKrw,
    fifo,
    fifoCostUsd: fifo.totalCostUsd,
    realizedGainUsd,
    realizedGainKrw,
    tax,
    netCashKrw,
    remainingQuantity,
    remainingValueUsd,
    remainingValueKrw: remainingValueUsd * fxRate,
  };
}

export interface RealizedSaleRecord {
  sellTransactionId: string;
  date: string;
  quantity: number;
  fifo: FifoConsumeResult;
  proceedsUsd: number;
  realizedGainUsd: number;
  realizedGainKrw: number;
}

/**
 * Replays every recorded real sell against the full original lot set in
 * chronological order (FIFO), using each sell's own price and FX rate, and
 * returns the realized gain of each. Used to keep the year's cumulative
 * realized gain in sync with the actual recorded transaction history
 * (recomputed from scratch, so edits/deletes never drift).
 */
export function computeRealizedSellHistory(
  allBuyLots: BuyLot[],
  sells: SellTransaction[]
): RealizedSaleRecord[] {
  const orderedSells = [...sells].sort((a, b) => a.date.localeCompare(b.date));
  let currentLots = sortLotsFifo(allBuyLots);
  const history: RealizedSaleRecord[] = [];

  for (const sell of orderedSells) {
    const fifo = consumeLotsFifo(currentLots, sell.quantity);
    const proceedsUsd = fifo.consumedQuantity * sell.pricePerShareUsd;
    const realizedGainUsd = proceedsUsd - fifo.totalCostUsd;
    const realizedGainKrw = realizedGainUsd * sell.fxRate;
    history.push({
      sellTransactionId: sell.id,
      date: sell.date,
      quantity: sell.quantity,
      fifo,
      proceedsUsd,
      realizedGainUsd,
      realizedGainKrw,
    });
    currentLots = fifo.remainingLots;
  }

  return history;
}

/** Sums realized KRW gain for sales whose date falls within `year` (e.g. 2026). */
export function sumRealizedGainKrwForYear(history: RealizedSaleRecord[], year: number): number {
  const prefix = String(year);
  return history
    .filter((h) => h.date.startsWith(prefix))
    .reduce((sum, h) => sum + h.realizedGainKrw, 0);
}
