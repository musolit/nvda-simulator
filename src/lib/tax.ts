import type { TaxCalcResult, TaxSettings } from "./types";

/** 해외주식 양도소득 기본공제 (연 1회, 모든 해외주식 합산). */
export const DEFAULT_ANNUAL_DEDUCTION_KRW = 2_500_000;

/** 예상 세율: 양도소득세 20% + 지방소득세 2% = 22%. 실제 신고 시 세율과 다를 수 있음. */
export const DEFAULT_TAX_RATE_PERCENT = 0.22;

export const DEFAULT_TAX_SETTINGS: TaxSettings = {
  annualDeductionKrw: DEFAULT_ANNUAL_DEDUCTION_KRW,
  taxRatePercent: DEFAULT_TAX_RATE_PERCENT,
};

/**
 * Computes the marginal tax attributable to one sale, given how much
 * realized gain has already been booked this calendar year.
 *
 * The annual basic deduction is shared across every sale in the year, so a
 * sale's own tax depends on order: gains up to the deduction are tax-free
 * only once per year. This function computes just the *incremental* taxable
 * base this sale adds on top of `priorRealizedGainKrw`, so calling it
 * repeatedly with an increasing `priorRealizedGainKrw` (e.g. for the "quick
 * comparison" feature) gives each sale's own correct marginal tax.
 */
export function calculateTax(
  realizedGainKrw: number,
  priorRealizedGainKrw: number,
  settings: TaxSettings = DEFAULT_TAX_SETTINGS
): TaxCalcResult {
  const cumulativeRealizedGainKrw = priorRealizedGainKrw + realizedGainKrw;

  const priorTaxableBase = Math.max(0, priorRealizedGainKrw - settings.annualDeductionKrw);
  const cumulativeTaxableBase = Math.max(
    0,
    cumulativeRealizedGainKrw - settings.annualDeductionKrw
  );
  // Taxable base this sale alone adds, given the deduction may already be
  // partially or fully used up by prior sales this year. Floored at 0: a
  // loss on this sale never retroactively refunds tax already assessed on
  // an earlier sale in the same year.
  const taxableBaseKrw = Math.max(0, cumulativeTaxableBase - priorTaxableBase);

  const taxKrw = taxableBaseKrw * settings.taxRatePercent;

  return {
    realizedGainKrw,
    priorRealizedGainKrw,
    cumulativeRealizedGainKrw,
    taxableBaseKrw,
    taxKrw,
  };
}
