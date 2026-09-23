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

/**
 * One calendar year's estimated capital-gains tax, computed ONLY from
 * recorded real sell transactions — never simulation results. Korean
 * overseas-stock capital gains for `taxYear` are filed and paid in May of
 * `paymentYear` (taxYear + 1). The annual deduction is applied exactly once
 * regardless of how many real sales fall in the year, since `calculateTax`
 * is called with the year's full total and `priorRealizedGainKrw: 0`.
 */
export interface YearlyTaxSummary {
  taxYear: number;
  paymentYear: number;
  /** This year's real sells, FIFO-costed, oldest first. */
  sales: RealizedSaleRecord[];
  /** Sum of `sales[].realizedGainKrw`. */
  totalRealizedGainKrw: number;
  annualDeductionKrw: number;
  /** max(0, totalRealizedGainKrw - annualDeductionKrw). */
  taxableBaseKrw: number;
  /** Estimated tax (transfer income tax + local income tax combined, per taxSettings.taxRatePercent). */
  taxKrw: number;
}

/** Yearly tax summary for one specific year (0/empty if no real sells fell in it). */
export function computeYearlyTaxSummaryForYear(
  allBuyLots: BuyLot[],
  sells: SellTransaction[],
  taxYear: number,
  taxSettings: TaxSettings = DEFAULT_TAX_SETTINGS
): YearlyTaxSummary {
  const prefix = String(taxYear);
  const sales = computeRealizedSellHistory(allBuyLots, sells).filter((h) => h.date.startsWith(prefix));
  const totalRealizedGainKrw = sales.reduce((sum, s) => sum + s.realizedGainKrw, 0);
  const tax = calculateTax(totalRealizedGainKrw, 0, taxSettings);
  return {
    taxYear,
    paymentYear: taxYear + 1,
    sales,
    totalRealizedGainKrw,
    annualDeductionKrw: taxSettings.annualDeductionKrw,
    taxableBaseKrw: tax.taxableBaseKrw,
    taxKrw: tax.taxKrw,
  };
}

/** Yearly tax summaries for every year that has at least one real sell, oldest first. */
export function computeYearlyTaxSummaries(
  allBuyLots: BuyLot[],
  sells: SellTransaction[],
  taxSettings: TaxSettings = DEFAULT_TAX_SETTINGS
): YearlyTaxSummary[] {
  const history = computeRealizedSellHistory(allBuyLots, sells);
  const years = Array.from(new Set(history.map((h) => Number(h.date.slice(0, 4))))).sort(
    (a, b) => a - b
  );
  return years.map((year) => computeYearlyTaxSummaryForYear(allBuyLots, sells, year, taxSettings));
}

/**
 * Compares "already realized this tax year from real sells" (A) against "A
 * plus one more hypothetical sale" (B), so a simulation can show the
 * marginal tax it alone would add on top of what's already locked in for
 * `taxYear` — without double-applying the annual deduction. Pass the
 * simulated sale's own `realizedGainKrw` (from `simulateSell`) as
 * `simulatedRealizedGainKrw`; this function never touches FIFO lots itself.
 */
export interface SimulatedYearlyTaxImpact {
  taxYear: number;
  paymentYear: number;
  /** A: realized gain from real sells recorded in `taxYear` only. */
  actualRealizedGainKrw: number;
  /** A's estimated tax. */
  actualTaxKrw: number;
  /** This simulated (not-yet-executed) sale's own realized gain. */
  simulatedRealizedGainKrw: number;
  /** B's realized gain: actualRealizedGainKrw + simulatedRealizedGainKrw. */
  combinedRealizedGainKrw: number;
  /** B: estimated tax if the simulated sale were also executed in `taxYear`. */
  combinedTaxKrw: number;
  /** B - A: the tax this simulated sale alone would add. */
  incrementalTaxKrw: number;
}

export function computeSimulatedYearlyTaxImpact(
  allBuyLots: BuyLot[],
  sells: SellTransaction[],
  taxYear: number,
  simulatedRealizedGainKrw: number,
  taxSettings: TaxSettings = DEFAULT_TAX_SETTINGS
): SimulatedYearlyTaxImpact {
  const actual = computeYearlyTaxSummaryForYear(allBuyLots, sells, taxYear, taxSettings);
  // calculateTax's own "prior" mechanism already handles the shared annual
  // deduction correctly (see its docs): this gives exactly B - A.
  const incrementalTax = calculateTax(simulatedRealizedGainKrw, actual.totalRealizedGainKrw, taxSettings);
  return {
    taxYear,
    paymentYear: taxYear + 1,
    actualRealizedGainKrw: actual.totalRealizedGainKrw,
    actualTaxKrw: actual.taxKrw,
    simulatedRealizedGainKrw,
    combinedRealizedGainKrw: actual.totalRealizedGainKrw + simulatedRealizedGainKrw,
    combinedTaxKrw: actual.taxKrw + incrementalTax.taxKrw,
    incrementalTaxKrw: incrementalTax.taxKrw,
  };
}
