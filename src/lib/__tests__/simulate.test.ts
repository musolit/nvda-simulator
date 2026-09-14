import { describe, expect, it } from "vitest";
import { computeRealizedSellHistory, simulateSell, sumRealizedGainKrwForYear } from "../simulate";
import { CONFIRMED_BUY_LOTS, SEED_LOTS } from "../seedData";
import { totalQuantity } from "../fifo";

describe("simulateSell", () => {
  it("computes the full result set for a 200-share sale", () => {
    const result = simulateSell({
      lots: CONFIRMED_BUY_LOTS,
      sellQuantity: 200,
      currentPriceUsd: 180,
      fxRate: 1400,
      priorRealizedGainKrw: 0,
    });

    expect(result.insufficientShares).toBe(false);
    expect(result.proceedsUsd).toBeCloseTo(200 * 180, 6);
    expect(result.proceedsKrw).toBeCloseTo(200 * 180 * 1400, 6);

    const expectedCost = 154 * 113.1 + 46 * 111.48;
    expect(result.fifoCostUsd).toBeCloseTo(expectedCost, 6);
    expect(result.realizedGainUsd).toBeCloseTo(200 * 180 - expectedCost, 6);
    expect(result.realizedGainKrw).toBeCloseTo((200 * 180 - expectedCost) * 1400, 6);

    expect(result.tax.cumulativeRealizedGainKrw).toBeCloseTo(result.realizedGainKrw, 6);
    expect(result.netCashKrw).toBeCloseTo(result.proceedsKrw - result.tax.taxKrw, 6);

    expect(result.remainingQuantity).toBe(totalQuantity(CONFIRMED_BUY_LOTS) - 200);
  });

  it("selling zero shares yields zero proceeds/tax and unchanged holdings", () => {
    const result = simulateSell({
      lots: SEED_LOTS,
      sellQuantity: 0,
      currentPriceUsd: 180,
      fxRate: 1400,
      priorRealizedGainKrw: 0,
    });
    expect(result.proceedsUsd).toBe(0);
    expect(result.tax.taxKrw).toBe(0);
    expect(result.netCashKrw).toBe(0);
    expect(result.remainingQuantity).toBe(totalQuantity(SEED_LOTS));
  });

  it("selling the full holding empties remaining quantity", () => {
    const total = totalQuantity(SEED_LOTS);
    const result = simulateSell({
      lots: SEED_LOTS,
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
    const total = totalQuantity(SEED_LOTS);
    const result = simulateSell({
      lots: SEED_LOTS,
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
    const history = computeRealizedSellHistory(CONFIRMED_BUY_LOTS, [
      { id: "s1", date: "2026-08-01", quantity: 200, pricePerShareUsd: 180, fxRate: 1400 },
    ]);
    expect(history).toHaveLength(1);
    const expectedCost = 154 * 113.1 + 46 * 111.48;
    const expectedGainUsd = 200 * 180 - expectedCost;
    expect(history[0].realizedGainUsd).toBeCloseTo(expectedGainUsd, 6);
    expect(history[0].realizedGainKrw).toBeCloseTo(expectedGainUsd * 1400, 6);
  });

  it("sums only sells within the requested year", () => {
    const history = computeRealizedSellHistory(CONFIRMED_BUY_LOTS, [
      { id: "s1", date: "2025-12-01", quantity: 100, pricePerShareUsd: 200, fxRate: 1300 },
      { id: "s2", date: "2026-01-15", quantity: 100, pricePerShareUsd: 200, fxRate: 1400 },
    ]);
    const sum2026 = sumRealizedGainKrwForYear(history, 2026);
    expect(sum2026).toBeCloseTo(history[1].realizedGainKrw, 6);
  });

  it("processes sells chronologically regardless of input array order", () => {
    const historyA = computeRealizedSellHistory(CONFIRMED_BUY_LOTS, [
      { id: "s1", date: "2026-08-01", quantity: 100, pricePerShareUsd: 200, fxRate: 1400 },
      { id: "s2", date: "2026-07-01", quantity: 100, pricePerShareUsd: 200, fxRate: 1400 },
    ]);
    const historyB = computeRealizedSellHistory(CONFIRMED_BUY_LOTS, [
      { id: "s2", date: "2026-07-01", quantity: 100, pricePerShareUsd: 200, fxRate: 1400 },
      { id: "s1", date: "2026-08-01", quantity: 100, pricePerShareUsd: 200, fxRate: 1400 },
    ]);
    expect(historyA.find((h) => h.sellTransactionId === "s1")).toEqual(
      historyB.find((h) => h.sellTransactionId === "s1")
    );
  });
});
