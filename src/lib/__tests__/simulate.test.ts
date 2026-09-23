import { describe, expect, it } from "vitest";
import {
  computeRealizedSellHistory,
  computeSimulatedYearlyTaxImpact,
  computeYearlyTaxSummaries,
  computeYearlyTaxSummaryForYear,
  simulateSell,
  sumRealizedGainKrwForYear,
} from "../simulate";
import { calculateTax, DEFAULT_TAX_SETTINGS } from "../tax";
import { FIXTURE_CONFIRMED_LOTS, FIXTURE_SEED_LOTS, TWO_LOT_SCENARIO } from "./fixtures";
import { totalQuantity } from "../fifo";
import type { SellTransaction } from "../types";

describe("simulateSell", () => {
  it("computes the full result set for a 200-share sale", () => {
    const result = simulateSell({
      lots: FIXTURE_CONFIRMED_LOTS,
      sellQuantity: 200,
      currentPriceUsd: 180,
      fxRate: 1400,
      priorRealizedGainKrw: 0,
    });

    expect(result.insufficientShares).toBe(false);
    expect(result.proceedsUsd).toBeCloseTo(200 * 180, 6);
    expect(result.proceedsKrw).toBeCloseTo(200 * 180 * 1400, 6);

    const expectedCost = 154 * 100 + 46 * 105;
    expect(result.fifoCostUsd).toBeCloseTo(expectedCost, 6);
    expect(result.realizedGainUsd).toBeCloseTo(200 * 180 - expectedCost, 6);
    expect(result.realizedGainKrw).toBeCloseTo((200 * 180 - expectedCost) * 1400, 6);

    expect(result.tax.cumulativeRealizedGainKrw).toBeCloseTo(result.realizedGainKrw, 6);
    expect(result.netCashKrw).toBeCloseTo(result.proceedsKrw - result.tax.taxKrw, 6);

    expect(result.remainingQuantity).toBe(totalQuantity(FIXTURE_CONFIRMED_LOTS) - 200);
  });

  it("selling zero shares yields zero proceeds/tax and unchanged holdings", () => {
    const result = simulateSell({
      lots: FIXTURE_SEED_LOTS,
      sellQuantity: 0,
      currentPriceUsd: 180,
      fxRate: 1400,
      priorRealizedGainKrw: 0,
    });
    expect(result.proceedsUsd).toBe(0);
    expect(result.tax.taxKrw).toBe(0);
    expect(result.netCashKrw).toBe(0);
    expect(result.remainingQuantity).toBe(totalQuantity(FIXTURE_SEED_LOTS));
  });

  it("selling the full holding empties remaining quantity", () => {
    const total = totalQuantity(FIXTURE_SEED_LOTS);
    const result = simulateSell({
      lots: FIXTURE_SEED_LOTS,
      sellQuantity: total,
      currentPriceUsd: 180,
      fxRate: 1400,
      priorRealizedGainKrw: 0,
    });
    expect(result.remainingQuantity).toBe(0);
    expect(result.remainingValueUsd).toBe(0);
    expect(result.insufficientShares).toBe(false);
  });

  it("flags oversell requests beyond total holdings", () => {
    const total = totalQuantity(FIXTURE_SEED_LOTS);
    const result = simulateSell({
      lots: FIXTURE_SEED_LOTS,
      sellQuantity: total + 500,
      currentPriceUsd: 180,
      fxRate: 1400,
      priorRealizedGainKrw: 0,
    });
    expect(result.insufficientShares).toBe(true);
    expect(result.fifo.consumedQuantity).toBe(total);
    expect(result.remainingQuantity).toBe(0);
  });
});

describe("computeRealizedSellHistory / sumRealizedGainKrwForYear", () => {
  it("computes realized gain per recorded sell using that sell's own fx rate", () => {
    const history = computeRealizedSellHistory(FIXTURE_CONFIRMED_LOTS, [
      { id: "s1", date: "2026-08-01", quantity: 200, pricePerShareUsd: 180, fxRate: 1400 },
    ]);
    expect(history).toHaveLength(1);
    const expectedCost = 154 * 100 + 46 * 105;
    const expectedGainUsd = 200 * 180 - expectedCost;
    expect(history[0].realizedGainUsd).toBeCloseTo(expectedGainUsd, 6);
    expect(history[0].realizedGainKrw).toBeCloseTo(expectedGainUsd * 1400, 6);
  });

  it("sums only sells within the requested year", () => {
    const history = computeRealizedSellHistory(FIXTURE_CONFIRMED_LOTS, [
      { id: "s1", date: "2025-12-01", quantity: 100, pricePerShareUsd: 200, fxRate: 1300 },
      { id: "s2", date: "2026-01-15", quantity: 100, pricePerShareUsd: 200, fxRate: 1400 },
    ]);
    const sum2026 = sumRealizedGainKrwForYear(history, 2026);
    expect(sum2026).toBeCloseTo(history[1].realizedGainKrw, 6);
  });

  it("processes sells chronologically regardless of input array order", () => {
    const historyA = computeRealizedSellHistory(FIXTURE_CONFIRMED_LOTS, [
      { id: "s1", date: "2026-08-01", quantity: 100, pricePerShareUsd: 200, fxRate: 1400 },
      { id: "s2", date: "2026-07-01", quantity: 100, pricePerShareUsd: 200, fxRate: 1400 },
    ]);
    const historyB = computeRealizedSellHistory(FIXTURE_CONFIRMED_LOTS, [
      { id: "s2", date: "2026-07-01", quantity: 100, pricePerShareUsd: 200, fxRate: 1400 },
      { id: "s1", date: "2026-08-01", quantity: 100, pricePerShareUsd: 200, fxRate: 1400 },
    ]);
    expect(historyA.find((h) => h.sellTransactionId === "s1")).toEqual(
      historyB.find((h) => h.sellTransactionId === "s1")
    );
  });
});

describe("computeYearlyTaxSummaryForYear / computeYearlyTaxSummaries", () => {
  const sellsTwoIn2026: SellTransaction[] = [
    { id: "s1", date: "2026-03-01", quantity: 100, pricePerShareUsd: 150, fxRate: 1400 },
    { id: "s2", date: "2026-06-01", quantity: 54, pricePerShareUsd: 150, fxRate: 1400 },
  ];

  it("applies the annual deduction exactly once across multiple real sells in the same year", () => {
    const summary = computeYearlyTaxSummaryForYear(TWO_LOT_SCENARIO, sellsTwoIn2026, 2026);

    expect(summary.sales).toHaveLength(2);
    const expectedGainKrw = summary.sales.reduce((sum, s) => sum + s.realizedGainKrw, 0);
    expect(summary.totalRealizedGainKrw).toBeCloseTo(expectedGainKrw, 6);

    // Deduction applied once, not once per sale.
    const expectedTaxableBase = Math.max(0, expectedGainKrw - DEFAULT_TAX_SETTINGS.annualDeductionKrw);
    expect(summary.taxableBaseKrw).toBeCloseTo(expectedTaxableBase, 6);
    expect(summary.taxKrw).toBeCloseTo(expectedTaxableBase * DEFAULT_TAX_SETTINGS.taxRatePercent, 6);

    // Sanity: applying the deduction separately to each sale (the bug this
    // guards against) would shelter 2.5M twice instead of once, so it would
    // *under*-tax relative to the correct once-per-year result.
    const buggyDoubleDeductionTax = summary.sales.reduce(
      (sum, s) =>
        sum +
        Math.max(0, s.realizedGainKrw - DEFAULT_TAX_SETTINGS.annualDeductionKrw) *
          DEFAULT_TAX_SETTINGS.taxRatePercent,
      0
    );
    expect(summary.taxKrw).toBeGreaterThan(buggyDoubleDeductionTax);
  });

  it("reports payment year as tax year + 1", () => {
    const summary = computeYearlyTaxSummaryForYear(TWO_LOT_SCENARIO, sellsTwoIn2026, 2026);
    expect(summary.taxYear).toBe(2026);
    expect(summary.paymentYear).toBe(2027);
  });

  it("returns an empty, zero-tax summary for a year with no real sells", () => {
    const summary = computeYearlyTaxSummaryForYear(TWO_LOT_SCENARIO, sellsTwoIn2026, 2030);
    expect(summary.sales).toHaveLength(0);
    expect(summary.totalRealizedGainKrw).toBe(0);
    expect(summary.taxableBaseKrw).toBe(0);
    expect(summary.taxKrw).toBe(0);
  });

  it("keeps different tax years separate instead of pooling them", () => {
    const sells: SellTransaction[] = [
      { id: "s1", date: "2026-01-10", quantity: 154, pricePerShareUsd: 150, fxRate: 1400 }, // consumes lot 1 (154 @ 90)
      { id: "s2", date: "2027-01-10", quantity: 100, pricePerShareUsd: 150, fxRate: 1400 }, // must come from lot 2 (154 @ 95)
    ];

    const y2026 = computeYearlyTaxSummaryForYear(TWO_LOT_SCENARIO, sells, 2026);
    const y2027 = computeYearlyTaxSummaryForYear(TWO_LOT_SCENARIO, sells, 2027);

    expect(y2026.sales.map((s) => s.sellTransactionId)).toEqual(["s1"]);
    expect(y2027.sales.map((s) => s.sellTransactionId)).toEqual(["s2"]);

    // The 2027 sale must be FIFO-costed against lot 2 (95/share) — proof
    // that lot 1, already consumed by the 2026 sale, isn't reused.
    expect(y2027.sales[0].fifo.consumptions).toEqual([
      expect.objectContaining({ lotId: TWO_LOT_SCENARIO[1].id, quantity: 100, pricePerShareUsd: 95 }),
    ]);

    // A 2026-vs-2027 mix-up would show one year's gain inside the other.
    expect(y2026.totalRealizedGainKrw).not.toBeCloseTo(y2027.totalRealizedGainKrw + y2026.totalRealizedGainKrw, 0);
    expect(y2026.sales).not.toEqual(y2027.sales);
  });

  it("computeYearlyTaxSummaries lists every year with a real sell, oldest first, matching the per-year function", () => {
    const sells: SellTransaction[] = [
      { id: "s1", date: "2027-01-10", quantity: 50, pricePerShareUsd: 150, fxRate: 1400 },
      { id: "s2", date: "2026-01-10", quantity: 50, pricePerShareUsd: 150, fxRate: 1400 },
    ];
    const summaries = computeYearlyTaxSummaries(TWO_LOT_SCENARIO, sells);
    expect(summaries.map((s) => s.taxYear)).toEqual([2026, 2027]);
    expect(summaries[0]).toEqual(computeYearlyTaxSummaryForYear(TWO_LOT_SCENARIO, sells, 2026));
    expect(summaries[1]).toEqual(computeYearlyTaxSummaryForYear(TWO_LOT_SCENARIO, sells, 2027));
  });
});

describe("computeSimulatedYearlyTaxImpact", () => {
  it("computes A (actual only) and B (actual + simulated) without double-applying the deduction", () => {
    const actualSells: SellTransaction[] = [
      { id: "s1", date: "2026-03-01", quantity: 100, pricePerShareUsd: 150, fxRate: 1400 },
    ];
    const simulatedGainKrw = 20_000_000;

    const impact = computeSimulatedYearlyTaxImpact(TWO_LOT_SCENARIO, actualSells, 2026, simulatedGainKrw);

    // B must equal a from-scratch calculation on the combined total with the
    // deduction applied exactly once — never actualTax + a second full
    // deduction's worth of tax on the simulated portion alone.
    const expectedCombinedTax = calculateTax(
      impact.combinedRealizedGainKrw,
      0,
      DEFAULT_TAX_SETTINGS
    ).taxKrw;
    expect(impact.combinedTaxKrw).toBeCloseTo(expectedCombinedTax, 6);
    expect(impact.combinedTaxKrw).toBeCloseTo(impact.actualTaxKrw + impact.incrementalTaxKrw, 6);
    expect(impact.combinedRealizedGainKrw).toBeCloseTo(
      impact.actualRealizedGainKrw + simulatedGainKrw,
      6
    );
  });

  it("incremental tax equals the full combined tax when there are no actual sells yet this year", () => {
    const impact = computeSimulatedYearlyTaxImpact(TWO_LOT_SCENARIO, [], 2026, 10_000_000);
    expect(impact.actualRealizedGainKrw).toBe(0);
    expect(impact.actualTaxKrw).toBe(0);
    expect(impact.incrementalTaxKrw).toBeCloseTo(impact.combinedTaxKrw, 6);
  });

  it("keeps the simulated tax year independent of actual sells recorded in a different year", () => {
    const actualSells: SellTransaction[] = [
      { id: "s1", date: "2026-03-01", quantity: 154, pricePerShareUsd: 150, fxRate: 1400 },
    ];
    // Simulate selling in 2027: must not see the 2026 actual sale as "prior".
    const impact2027 = computeSimulatedYearlyTaxImpact(TWO_LOT_SCENARIO, actualSells, 2027, 5_000_000);
    expect(impact2027.actualRealizedGainKrw).toBe(0);
    expect(impact2027.actualTaxKrw).toBe(0);
  });

  it("is pure: repeated simulated calls never mutate the real sells it was given", () => {
    const actualSells: SellTransaction[] = [
      { id: "s1", date: "2026-03-01", quantity: 100, pricePerShareUsd: 150, fxRate: 1400 },
    ];
    const snapshot = JSON.parse(JSON.stringify(actualSells));

    computeSimulatedYearlyTaxImpact(TWO_LOT_SCENARIO, actualSells, 2026, 5_000_000);
    computeSimulatedYearlyTaxImpact(TWO_LOT_SCENARIO, actualSells, 2026, 50_000_000);
    computeSimulatedYearlyTaxImpact(TWO_LOT_SCENARIO, actualSells, 2026, 0);

    expect(actualSells).toEqual(snapshot);
  });

  it("a loss-making simulated sale never produces negative incremental tax", () => {
    const actualSells: SellTransaction[] = [
      { id: "s1", date: "2026-03-01", quantity: 100, pricePerShareUsd: 150, fxRate: 1400 },
    ];
    const impact = computeSimulatedYearlyTaxImpact(TWO_LOT_SCENARIO, actualSells, 2026, -5_000_000);
    expect(impact.incrementalTaxKrw).toBeGreaterThanOrEqual(0);
    expect(impact.combinedTaxKrw).toBeGreaterThanOrEqual(0);
  });
});
