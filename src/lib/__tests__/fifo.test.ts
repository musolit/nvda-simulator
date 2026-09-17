import { describe, expect, it } from "vitest";
import {
  applyRealizedSells,
  averageCost,
  computeLotStatuses,
  consumeLotsFifo,
  sortLotsFifo,
  summarizeHoldings,
  totalQuantity,
} from "../fifo";
import { FIXTURE_ADJUSTMENT_LOT, FIXTURE_CONFIRMED_LOTS, FIXTURE_SEED_LOTS, TWO_LOT_SCENARIO } from "./fixtures";
import type { BuyLot } from "../types";

describe("consumeLotsFifo", () => {
  it("consumes the oldest lot first, splitting the second lot as needed (200 shares)", () => {
    const result = consumeLotsFifo(FIXTURE_CONFIRMED_LOTS, 200);

    expect(result.consumptions).toHaveLength(2);

    expect(result.consumptions[0]).toMatchObject({
      lotDate: "2020-01-01",
      quantity: 154,
      pricePerShareUsd: 100,
    });
    expect(result.consumptions[1]).toMatchObject({
      lotDate: "2020-01-02",
      quantity: 46,
      pricePerShareUsd: 105,
    });

    expect(result.consumedQuantity).toBe(200);
    expect(result.shortfall).toBe(0);

    const expectedCost = 154 * 100 + 46 * 105;
    expect(result.totalCostUsd).toBeCloseTo(expectedCost, 6);
  });

  it("leaves the remainder of a partially-consumed lot in remainingLots", () => {
    const result = consumeLotsFifo(FIXTURE_CONFIRMED_LOTS, 200);
    const secondLotRemaining = result.remainingLots.find(
      (lot) => lot.id === FIXTURE_CONFIRMED_LOTS[1].id
    );
    expect(secondLotRemaining?.quantity).toBe(500 - 46);
    // total remaining should equal total held minus consumed
    expect(totalQuantity(result.remainingLots)).toBe(
      totalQuantity(FIXTURE_CONFIRMED_LOTS) - 200
    );
  });

  it("never touches the adjustment lot when selling within confirmed totals (2,604 shares)", () => {
    const result = consumeLotsFifo(FIXTURE_SEED_LOTS, 2604);
    expect(result.consumptions.every((c) => !c.isAdjustment)).toBe(true);
    expect(result.consumedQuantity).toBe(2604);
    // only the adjustment lot (27 shares) should remain
    expect(totalQuantity(result.remainingLots)).toBe(27);
    expect(result.remainingLots.every((lot) => lot.isAdjustment)).toBe(true);
  });

  it("only reaches the adjustment lot once confirmed lots are exhausted", () => {
    const result = consumeLotsFifo(FIXTURE_SEED_LOTS, 2610);
    const adjustmentConsumption = result.consumptions.find((c) => c.isAdjustment);
    expect(adjustmentConsumption?.quantity).toBe(6);
    expect(result.shortfall).toBe(0);
  });

  it("reports a shortfall when selling more than total holdings", () => {
    const result = consumeLotsFifo(FIXTURE_SEED_LOTS, 3000);
    expect(result.consumedQuantity).toBe(2631);
    expect(result.shortfall).toBe(369);
    expect(result.remainingLots).toHaveLength(0);
  });

  it("handles selling zero shares", () => {
    const result = consumeLotsFifo(FIXTURE_CONFIRMED_LOTS, 0);
    expect(result.consumedQuantity).toBe(0);
    expect(result.consumptions).toHaveLength(0);
    expect(result.totalCostUsd).toBe(0);
    expect(totalQuantity(result.remainingLots)).toBe(totalQuantity(FIXTURE_CONFIRMED_LOTS));
  });

  it("handles selling the entire holding exactly (full liquidation)", () => {
    const result = consumeLotsFifo(FIXTURE_SEED_LOTS, totalQuantity(FIXTURE_SEED_LOTS));
    expect(result.shortfall).toBe(0);
    expect(result.remainingLots).toHaveLength(0);
    expect(result.consumedQuantity).toBe(totalQuantity(FIXTURE_SEED_LOTS));
  });

  it("rejects non-integer or negative quantities", () => {
    expect(() => consumeLotsFifo(FIXTURE_CONFIRMED_LOTS, -1)).toThrow();
    expect(() => consumeLotsFifo(FIXTURE_CONFIRMED_LOTS, 1.5)).toThrow();
  });

  it("does not mutate the input lots array or its objects", () => {
    const lotsCopy: BuyLot[] = FIXTURE_CONFIRMED_LOTS.map((lot) => ({ ...lot }));
    consumeLotsFifo(FIXTURE_CONFIRMED_LOTS, 200);
    expect(FIXTURE_CONFIRMED_LOTS).toEqual(lotsCopy);
  });
});

describe("sortLotsFifo", () => {
  it("always places adjustment lots after dated lots regardless of date value", () => {
    const sorted = sortLotsFifo(FIXTURE_SEED_LOTS);
    const adjustmentIndex = sorted.findIndex((lot) => lot.isAdjustment);
    expect(adjustmentIndex).toBe(sorted.length - 1);
  });

  it("sorts dated lots ascending by date", () => {
    const sorted = sortLotsFifo(FIXTURE_CONFIRMED_LOTS);
    for (let i = 1; i < sorted.length; i++) {
      expect(sorted[i].date! >= sorted[i - 1].date!).toBe(true);
    }
  });
});

describe("averageCost", () => {
  it("computes the confirmed-lot weighted average (differs from broker avg due to the unverified adjustment lot)", () => {
    const avg = averageCost(FIXTURE_CONFIRMED_LOTS);
    const expected =
      FIXTURE_CONFIRMED_LOTS.reduce((sum, lot) => sum + lot.quantity * lot.pricePerShareUsd, 0) /
      totalQuantity(FIXTURE_CONFIRMED_LOTS);
    expect(avg).toBeCloseTo(expected, 6);
  });

  it("returns 0 for an empty lot list", () => {
    expect(averageCost([])).toBe(0);
  });
});

describe("applyRealizedSells", () => {
  it("reduces holdings FIFO after a recorded real sell", () => {
    const remaining = applyRealizedSells(FIXTURE_CONFIRMED_LOTS, [
      { date: "2026-08-01", quantity: 200 },
    ]);
    expect(totalQuantity(remaining)).toBe(totalQuantity(FIXTURE_CONFIRMED_LOTS) - 200);
    expect(remaining[0].id).toBe(FIXTURE_CONFIRMED_LOTS[1].id);
    expect(remaining[0].quantity).toBe(500 - 46);
  });

  it("applies multiple sells in chronological order", () => {
    const remaining = applyRealizedSells(FIXTURE_CONFIRMED_LOTS, [
      { date: "2026-08-01", quantity: 100 },
      { date: "2026-07-01", quantity: 100 },
    ]);
    // Combined 200 shares consumed in date order regardless of input array order
    expect(totalQuantity(remaining)).toBe(totalQuantity(FIXTURE_CONFIRMED_LOTS) - 200);
  });
});

describe("two-equal-lot real-sell scenario (154 + 154 shares, sell 263)", () => {
  it("exhausts the first lot entirely and leaves 45 shares in the second", () => {
    const remaining = applyRealizedSells(TWO_LOT_SCENARIO, [
      { date: "2026-09-01", quantity: 263 },
    ]);
    expect(remaining).toHaveLength(1);
    expect(remaining[0].id).toBe(TWO_LOT_SCENARIO[1].id);
    expect(remaining[0].quantity).toBe(45);
    expect(totalQuantity(remaining)).toBe(154 + 154 - 263);
  });

  it("a later sell simulation starts from the 45 remaining shares, never re-touching the consumed 154 + 109", () => {
    const remaining = applyRealizedSells(TWO_LOT_SCENARIO, [
      { date: "2026-09-01", quantity: 263 },
    ]);
    // Simulate selling the rest (45 shares): must come entirely from lot 2's
    // remaining balance, at lot 2's price, never lot 1 (already exhausted).
    const nextSale = consumeLotsFifo(remaining, 45);
    expect(nextSale.consumptions).toEqual([
      expect.objectContaining({ lotId: TWO_LOT_SCENARIO[1].id, quantity: 45, pricePerShareUsd: 95 }),
    ]);
    expect(nextSale.remainingLots).toHaveLength(0);
  });

  it("editing the sell (reducing it to 100 shares) recomputes remaining lots instead of double-subtracting", () => {
    // Simulates a user correcting a previously-recorded sell's quantity: the
    // ledger is replayed from scratch, so there's no leftover deduction from
    // the old 263-share value.
    const remaining = applyRealizedSells(TWO_LOT_SCENARIO, [
      { date: "2026-09-01", quantity: 100 },
    ]);
    expect(totalQuantity(remaining)).toBe(154 + 154 - 100);
    expect(remaining.find((l) => l.id === TWO_LOT_SCENARIO[0].id)?.quantity).toBe(54);
  });

  it("deleting the sell entirely restores full original holdings", () => {
    const remaining = applyRealizedSells(TWO_LOT_SCENARIO, []);
    expect(remaining).toEqual(TWO_LOT_SCENARIO);
    expect(totalQuantity(remaining)).toBe(308);
  });
});

describe("summarizeHoldings", () => {
  it("computes confirmed vs. adjustment quantities and both average-cost variants", () => {
    const remaining = applyRealizedSells(TWO_LOT_SCENARIO, [
      { date: "2026-09-01", quantity: 263 },
    ]);
    const summary = summarizeHoldings(remaining);
    expect(summary.confirmedQuantity).toBe(45);
    expect(summary.adjustmentQuantity).toBe(0);
    expect(summary.totalQuantity).toBe(45);
    expect(summary.hasUnverifiedRemaining).toBe(false);
    // Only lot 2 (price 95) remains, so both averages equal 95.
    expect(summary.averageCostUsd).toBeCloseTo(95, 6);
    expect(summary.confirmedAverageCostUsd).toBeCloseTo(95, 6);
  });

  it("flags hasUnverifiedRemaining and diverges the two averages when an adjustment lot is still held", () => {
    const lots: BuyLot[] = [TWO_LOT_SCENARIO[1], FIXTURE_ADJUSTMENT_LOT];
    const summary = summarizeHoldings(lots);
    expect(summary.confirmedQuantity).toBe(154);
    expect(summary.adjustmentQuantity).toBe(27);
    expect(summary.totalQuantity).toBe(181);
    expect(summary.hasUnverifiedRemaining).toBe(true);
    expect(summary.confirmedAverageCostUsd).toBeCloseTo(95, 6);
    // Blended average must differ from the confirmed-only average once the
    // (differently priced) adjustment lot is mixed in.
    expect(summary.averageCostUsd).not.toBeCloseTo(summary.confirmedAverageCostUsd, 6);
    const expectedBlended = (154 * 95 + 27 * FIXTURE_ADJUSTMENT_LOT.pricePerShareUsd) / 181;
    expect(summary.averageCostUsd).toBeCloseTo(expectedBlended, 6);
  });

  it("returns all zeros for an empty holding (fully sold out)", () => {
    const summary = summarizeHoldings([]);
    expect(summary).toEqual({
      confirmedQuantity: 0,
      adjustmentQuantity: 0,
      totalQuantity: 0,
      averageCostUsd: 0,
      confirmedAverageCostUsd: 0,
      hasUnverifiedRemaining: false,
    });
  });
});

describe("computeLotStatuses", () => {
  it("reports 최초/매도차감/잔여 exactly as described for the two-equal-lot scenario", () => {
    const remaining = applyRealizedSells(TWO_LOT_SCENARIO, [
      { date: "2026-09-01", quantity: 263 },
    ]);
    const statuses = computeLotStatuses(TWO_LOT_SCENARIO, remaining);

    expect(statuses).toHaveLength(2);
    expect(statuses[0]).toMatchObject({
      originalQuantity: 154,
      soldQuantity: 154,
      remainingQuantity: 0,
      isExhausted: true,
    });
    expect(statuses[1]).toMatchObject({
      originalQuantity: 154,
      soldQuantity: 109,
      remainingQuantity: 45,
      isExhausted: false,
    });
  });

  it("marks every lot untouched (soldQuantity 0) when there are no real sells yet", () => {
    const statuses = computeLotStatuses(TWO_LOT_SCENARIO, TWO_LOT_SCENARIO);
    expect(statuses.every((s) => s.soldQuantity === 0 && !s.isExhausted)).toBe(true);
  });

  it("orders statuses FIFO (adjustment lots last) regardless of input order", () => {
    const lots: BuyLot[] = [FIXTURE_ADJUSTMENT_LOT, TWO_LOT_SCENARIO[1], TWO_LOT_SCENARIO[0]];
    const statuses = computeLotStatuses(lots, lots);
    expect(statuses.map((s) => s.lot.id)).toEqual([
      TWO_LOT_SCENARIO[0].id,
      TWO_LOT_SCENARIO[1].id,
      FIXTURE_ADJUSTMENT_LOT.id,
    ]);
  });
});
