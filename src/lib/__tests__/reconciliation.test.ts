import { describe, expect, it } from "vitest";
import { totalQuantity } from "../fifo";
import {
  FIXTURE_ADJUSTMENT_LOT,
  FIXTURE_CONFIRMED_LOTS,
  FIXTURE_CONFIRMED_TOTAL_QUANTITY,
  FIXTURE_SEED_LOTS,
} from "./fixtures";

/**
 * Verifies the core "confirmed lots + unverified adjustment lot = broker
 * total" structure the app is built around, using fixture data (real
 * account numbers are never checked into source — see the initial JSON
 * import screen instead).
 */
describe("confirmed + adjustment lot reconciliation", () => {
  it("confirmed lots sum to 2,604 shares", () => {
    expect(FIXTURE_CONFIRMED_TOTAL_QUANTITY).toBe(2604);
    expect(totalQuantity(FIXTURE_CONFIRMED_LOTS)).toBe(2604);
  });

  it("adjustment lot is 27 shares", () => {
    expect(FIXTURE_ADJUSTMENT_LOT.quantity).toBe(27);
  });

  it("confirmed + adjustment reconciles to a 2,631-share total", () => {
    expect(totalQuantity(FIXTURE_SEED_LOTS)).toBe(2631);
  });

  it("adjustment lot is clearly flagged and has no known date", () => {
    expect(FIXTURE_ADJUSTMENT_LOT.isAdjustment).toBe(true);
    expect(FIXTURE_ADJUSTMENT_LOT.date).toBeNull();
    expect(FIXTURE_ADJUSTMENT_LOT.note).toMatch(/미확인/);
  });

  it("no confirmed lot is marked as adjustment", () => {
    expect(FIXTURE_CONFIRMED_LOTS.every((lot) => lot.isAdjustment === false)).toBe(true);
  });
});
