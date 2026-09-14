import { describe, expect, it } from "vitest";
import { calculateTax, DEFAULT_TAX_SETTINGS } from "../tax";

describe("calculateTax", () => {
  it("is tax-free when gain is fully within the annual deduction", () => {
    const result = calculateTax(2_000_000, 0);
    expect(result.taxableBaseKrw).toBe(0);
    expect(result.taxKrw).toBe(0);
    expect(result.cumulativeRealizedGainKrw).toBe(2_000_000);
  });

  it("taxes only the amount above the deduction", () => {
    const result = calculateTax(10_000_000, 0);
    // 10,000,000 - 2,500,000 = 7,500,000 taxable
    expect(result.taxableBaseKrw).toBe(7_500_000);
    expect(result.taxKrw).toBeCloseTo(7_500_000 * 0.22, 6);
  });

  it("accounts for the deduction already being used up by prior sales this year", () => {
    const result = calculateTax(5_000_000, 3_000_000, DEFAULT_TAX_SETTINGS);
    // prior 3,000,000 already used the full 2,500,000 deduction, so this
    // entire 5,000,000 gain is taxable.
    expect(result.taxableBaseKrw).toBe(5_000_000);
    expect(result.taxKrw).toBeCloseTo(5_000_000 * 0.22, 6);
  });

  it("splits the deduction correctly when prior gains partially used it", () => {
    // prior 1,000,000 used 1,000,000 of the 2,500,000 deduction, leaving
    // 1,500,000 of headroom for this sale's 4,000,000 gain.
    const result = calculateTax(4_000_000, 1_000_000, DEFAULT_TAX_SETTINGS);
    expect(result.taxableBaseKrw).toBe(4_000_000 - 1_500_000);
    expect(result.taxKrw).toBeCloseTo((4_000_000 - 1_500_000) * 0.22, 6);
  });

  it("floors taxable base at 0 for a loss", () => {
    const result = calculateTax(-1_000_000, 0);
    expect(result.taxableBaseKrw).toBe(0);
    expect(result.taxKrw).toBe(0);
  });

  it("handles a loss on top of prior gains without going negative", () => {
    const result = calculateTax(-1_000_000, 5_000_000, DEFAULT_TAX_SETTINGS);
    // cumulative gain drops but this function only reports THIS sale's
    // marginal tax, which cannot be negative.
    expect(result.taxableBaseKrw).toBe(0);
    expect(result.taxKrw).toBe(0);
    expect(result.cumulativeRealizedGainKrw).toBe(4_000_000);
  });

  it("respects custom deduction/rate settings", () => {
    const result = calculateTax(10_000_000, 0, {
      annualDeductionKrw: 0,
      taxRatePercent: 0.1,
    });
    expect(result.taxableBaseKrw).toBe(10_000_000);
    expect(result.taxKrw).toBeCloseTo(1_000_000, 6);
  });
});
