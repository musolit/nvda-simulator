/**
 * Core domain types for the NVDA sell simulator.
 *
 * All monetary "share price" fields are in USD. FX rates are KRW per 1 USD.
 * Dates are ISO strings ("YYYY-MM-DD"). Adjustment lots (see BuyLot.isAdjustment)
 * have `date: null` because the actual fill date is unknown.
 */

export interface BuyLot {
  /** Stable id (uuid from DB, or a deterministic seed id before first save). */
  id: string;
  /** Fill date, or null for the unverified adjustment lot whose date is unknown. */
  date: string | null;
  /** Number of shares bought in this lot (original size, never mutated). */
  quantity: number;
  /** Fill price per share in USD. */
  pricePerShareUsd: number;
  /**
   * KRW/USD exchange rate that applies for Korean capital-gains-tax purposes
   * at the moment of acquisition. Not available for any lot yet (no historical
   * record), so always null today. Kept nullable so a future import of the
   * official rate can be added without changing the data shape.
   */
  acquisitionFxRate: number | null;
  /**
   * True for the single synthetic "미확인 조정분" lot representing the gap
   * between confirmed KakaoTalk fill records and the broker's actual share
   * count. Never treat this as a real, individually-verified trade.
   */
  isAdjustment: boolean;
  /** Where this lot record came from. */
  source: "confirmed" | "kakao_import" | "manual";
  note?: string | null;
}

export interface SellTransaction {
  id: string;
  date: string;
  quantity: number;
  pricePerShareUsd: number;
  /** KRW/USD exchange rate on the sell date, entered by the user. */
  fxRate: number;
  note?: string | null;
}

/** One buy-lot's contribution to a FIFO sell consumption. */
export interface LotConsumption {
  lotId: string;
  lotDate: string | null;
  isAdjustment: boolean;
  quantity: number;
  pricePerShareUsd: number;
  costUsd: number;
}

export interface FifoConsumeResult {
  requestedQuantity: number;
  /** Quantity actually consumed (< requested if holdings are insufficient). */
  consumedQuantity: number;
  /** Requested quantity that could not be filled because holdings ran out. */
  shortfall: number;
  consumptions: LotConsumption[];
  totalCostUsd: number;
  averageCostPerShareUsd: number;
  /** Lots remaining after this consumption (for chaining simulations). */
  remainingLots: BuyLot[];
}

export interface TaxSettings {
  annualDeductionKrw: number;
  taxRatePercent: number;
}

export interface TaxCalcResult {
  /** Realized gain in KRW from this sale alone. */
  realizedGainKrw: number;
  /** Realized gain already booked this year before this sale (default 0). */
  priorRealizedGainKrw: number;
  /** priorRealizedGainKrw + realizedGainKrw. */
  cumulativeRealizedGainKrw: number;
  /** Taxable base after the annual basic deduction, floored at 0. */
  taxableBaseKrw: number;
  /** Tax attributable to just this sale (marginal, accounts for the shared annual deduction). */
  taxKrw: number;
}

export interface PortfolioSettings {
  /** Broker (Kiwoom)-reported share count. Always the source of truth for display. */
  brokerQuantity: number;
  /** Broker (Kiwoom)-reported average cost per share in USD. Source of truth for display. */
  brokerAvgPriceUsd: number;
}
