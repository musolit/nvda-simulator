import { describe, expect, it } from "vitest";
import {
  BASELINE_BUY_LOTS,
  BASELINE_SELL_TRANSACTIONS,
  cloneBaselineBuyLots,
  cloneBaselinePortfolioSettings,
  cloneBaselineSellTransactions,
} from "../nvdaBaseline";
import { applyRealizedSells, sortLotsFifo, summarizeHoldings, totalQuantity } from "@/lib/fifo";
import { computeYearlyTaxSummaryForYear } from "@/lib/simulate";
import { DEFAULT_TAX_SETTINGS } from "@/lib/tax";

describe("nvdaBaseline", () => {
  it("gross buyLots total 2,631 shares (2,604 confirmed + 27 adjustment)", () => {
    expect(totalQuantity(BASELINE_BUY_LOTS as never)).toBe(2631);
    const confirmed = BASELINE_BUY_LOTS.filter((l) => !l.isAdjustment);
    const adjustment = BASELINE_BUY_LOTS.filter((l) => l.isAdjustment);
    expect(totalQuantity(confirmed)).toBe(2604);
    expect(totalQuantity(adjustment)).toBe(27);
  });

  it("the two real sells total 526 shares", () => {
    expect(BASELINE_SELL_TRANSACTIONS.reduce((sum, s) => sum + s.quantity, 0)).toBe(526);
  });

  it("FIFO consumption against the baseline reproduces the confirmed production-verified result", () => {
    const remaining = applyRealizedSells(BASELINE_BUY_LOTS as never, BASELINE_SELL_TRANSACTIONS as never);
    expect(totalQuantity(remaining)).toBe(2105);

    const ordered = sortLotsFifo(remaining);
    expect(ordered[0]).toMatchObject({
      id: "lot-20250328-02",
      quantity: 100,
      pricePerShareUsd: 110.2077,
    });

    const holdings = summarizeHoldings(remaining);
    expect(holdings.totalQuantity).toBe(2105);
    expect(holdings.confirmedQuantity).toBe(2078);
    expect(holdings.adjustmentQuantity).toBe(27);
    expect(holdings.averageCostUsd).toBeCloseTo(146.9399, 3);
  });

  it("2026 realized gain and estimated tax match the production-verified figures", () => {
    const summary = computeYearlyTaxSummaryForYear(
      BASELINE_BUY_LOTS as never,
      BASELINE_SELL_TRANSACTIONS as never,
      2026,
      DEFAULT_TAX_SETTINGS
    );
    expect(summary.totalRealizedGainKrw).toBeCloseTo(82_106_688.28, 1);
    expect(summary.taxKrw).toBeCloseTo(17_513_471.42, 1);
    expect(summary.paymentYear).toBe(2027);
  });

  it("clone helpers return independent deep copies — mutating a clone never touches the frozen baseline", () => {
    const lots = cloneBaselineBuyLots();
    lots[0].quantity = 999999;
    lots.push({ ...lots[0], id: "injected" });
    expect(BASELINE_BUY_LOTS[0].quantity).not.toBe(999999);
    expect(BASELINE_BUY_LOTS.some((l) => l.id === "injected")).toBe(false);

    const sells = cloneBaselineSellTransactions();
    sells[0].quantity = 1;
    expect(BASELINE_SELL_TRANSACTIONS[0].quantity).not.toBe(1);

    const portfolio = cloneBaselinePortfolioSettings();
    portfolio.brokerQuantity = 0;
    expect(portfolio.brokerQuantity).toBe(0);
  });

  it("the baseline arrays themselves are frozen (defense in depth against accidental mutation)", () => {
    expect(Object.isFrozen(BASELINE_BUY_LOTS)).toBe(true);
    expect(Object.isFrozen(BASELINE_BUY_LOTS[0])).toBe(true);
    expect(Object.isFrozen(BASELINE_SELL_TRANSACTIONS)).toBe(true);
  });

  it("baseline portfolio settings carry the current broker quantity", () => {
    expect(cloneBaselinePortfolioSettings().brokerQuantity).toBe(2105);
  });
});
