import { describe, expect, it } from "vitest";
import { applyRealizedSells, averageCost, consumeLotsFifo, sortLotsFifo, totalQuantity } from "../fifo";
import { CONFIRMED_BUY_LOTS, SEED_LOTS } from "../seedData";
import type { BuyLot } from "../types";

describe("consumeLotsFifo", () => {
  it("consumes the oldest lot first, splitting the second lot as needed (200 shares)", () => {
    const result = consumeLotsFifo(CONFIRMED_BUY_LOTS, 200);

    expect(result.consumptions).toHaveLength(2);

    expect(result.consumptions[0]).toMatchObject({
      lotDate: "2025-03-27",
      quantity: 154,
      pricePerShareUsd: 113.1,
    });
    expect(result.consumptions[1]).toMatchObject({
      lotDate: "2025-03-28",
      quantity: 46,
      pricePerShareUsd: 111.48,
    });

    expect(result.consumedQuantity).toBe(200);
    expect(result.shortfall).toBe(0);

    const expectedCost = 154 * 113.1 + 46 * 111.48;
    expect(result.totalCostUsd).toBeCloseTo(expectedCost, 6);
  });

  it("leaves the remainder of a partially-consumed lot in remainingLots", () => {
    const result = consumeLotsFifo(CONFIRMED_BUY_LOTS, 200);
    const secondLotRemaining = result.remainingLots.find(
      (lot) => lot.id === CONFIRMED_BUY_LOTS[1].id
    );
    expect(secondLotRemaining?.quantity).toBe(154 - 46);
    // total remaining should equal total held minus consumed
    expect(totalQuantity(result.remainingLots)).toBe(
      totalQuantity(CONFIRMED_BUY_LOTS) - 200
    );
  });

  it("never touches the adjustment lot when selling within confirmed totals", () => {
    const result = consumeLotsFifo(SEED_LOTS, 2604);
    expect(result.consumptions.every((c) => !c.isAdjustment)).toBe(true);
    expect(result.consumedQuantity).toBe(2604);
    // only the adjustment lot (27 shares) should remain
    expect(totalQuantity(result.remainingLots)).toBe(27);
    expect(result.remainingLots.every((lot) => lot.isAdjustment)).toBe(true);
  });

  it("only reaches the adjustment lot once confirmed lots are exhausted", () => {
    const result = consumeLotsFifo(SEED_LOTS, 2610);
    const adjustmentConsumption = result.consumptions.find((c) => c.isAdjustment);
    expect(adjustmentConsumption?.quantity).toBe(6);
    expect(result.shortfall).toBe(0);
  });

  it("reports a shortfall when selling more than total holdings", () => {
    const result = consumeLotsFifo(SEED_LOTS, 3000);
    expect(result.consumedQuantity).toBe(2631);
    expect(result.shortfall).toBe(369);
    expect(result.remainingLots).toHaveLength(0);
  });

  it("handles selling zero shares", () => {
    const result = consumeLotsFifo(CONFIRMED_BUY_LOTS, 0);
    expect(result.consumedQuantity).toBe(0);
    expect(result.consumptions).toHaveLength(0);
    expect(result.totalCostUsd).toBe(0);
    expect(totalQuantity(result.remainingLots)).toBe(totalQuantity(CONFIRMED_BUY_LOTS));
  });

  it("handles selling the entire holding exactly (full liquidation)", () => {
    const result = consumeLotsFifo(SEED_LOTS, totalQuantity(SEED_LOTS));
    expect(result.shortfall).toBe(0);
    expect(result.remainingLots).toHaveLength(0);
    expect(result.consumedQuantity).toBe(totalQuantity(SEED_LOTS));
  });

  it("rejects non-integer or negative quantities", () => {
    expect(() => consumeLotsFifo(CONFIRMED_BUY_LOTS, -1)).toThrow();
    expect(() => consumeLotsFifo(CONFIRMED_BUY_LOTS, 1.5)).toThrow();
  });

  it("does not mutate the input lots array or its objects", () => {
    const lotsCopy: BuyLot[] = CONFIRMED_BUY_LOTS.map((lot) => ({ ...lot }));
    consumeLotsFifo(CONFIRMED_BUY_LOTS, 200);
    expect(CONFIRMED_BUY_LOTS).toEqual(lotsCopy);
  });
});

describe("sortLotsFifo", () => {
  it("always places adjustment lots after dated lots regardless of date value", () => {
    const sorted = sortLotsFifo(SEED_LOTS);
    const adjustmentIndex = sorted.findIndex((lot) => lot.isAdjustment);
    expect(adjustmentIndex).toBe(sorted.length - 1);
  });

  it("sorts dated lots ascending by date", () => {
    const sorted = sortLotsFifo(CONFIRMED_BUY_LOTS);
    for (let i = 1; i < sorted.length; i++) {
      expect(sorted[i].date! >= sorted[i - 1].date!).toBe(true);
    }
  });
});

describe("averageCost", () => {
  it("computes the confirmed-lot weighted average (differs from broker avg due to unverified 27 shares)", () => {
    const avg = averageCost(CONFIRMED_BUY_LOTS);
    expect(avg).toBeCloseTo(139.42028, 4);
  });

  it("returns 0 for an empty lot list", () => {
    expect(averageCost([])).toBe(0);
  });
});

describe("applyRealizedSells", () => {
  it("reduces holdings FIFO after a recorded real sell", () => {
    const remaining = applyRealizedSells(CONFIRMED_BUY_LOTS, [
      { date: "2026-08-01", quantity: 200 },
    ]);
    expect(totalQuantity(remaining)).toBe(totalQuantity(CONFIRMED_BUY_LOTS) - 200);
    expect(remaining[0].id).toBe(CONFIRMED_BUY_LOTS[1].id);
    expect(remaining[0].quantity).toBe(154 - 46);
  });

  it("applies multiple sells in chronological order", () => {
    const remaining = applyRealizedSells(CONFIRMED_BUY_LOTS, [
      { date: "2026-08-01", quantity: 100 },
      { date: "2026-07-01", quantity: 100 },
    ]);
    // Combined 200 shares consumed in date order regardless of input array order
    expect(totalQuantity(remaining)).toBe(totalQuantity(CONFIRMED_BUY_LOTS) - 200);
  });
});
