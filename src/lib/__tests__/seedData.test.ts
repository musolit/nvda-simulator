import { describe, expect, it } from "vitest";
import {
  ADJUSTMENT_LOT,
  ADJUSTMENT_QUANTITY,
  BROKER_PORTFOLIO_SETTINGS,
  CONFIRMED_BUY_LOTS,
  CONFIRMED_TOTAL_QUANTITY,
  SEED_LOTS,
} from "../seedData";
import { totalQuantity } from "../fifo";

describe("seed data reconciliation", () => {
  it("confirmed lots sum to 2,604 shares", () => {
    expect(CONFIRMED_TOTAL_QUANTITY).toBe(2604);
    expect(totalQuantity(CONFIRMED_BUY_LOTS)).toBe(2604);
  });

  it("adjustment quantity is 27 shares", () => {
    expect(ADJUSTMENT_QUANTITY).toBe(27);
    expect(ADJUSTMENT_LOT?.quantity).toBe(27);
  });

  it("confirmed + adjustment equals the broker's reported 2,631 shares", () => {
    expect(totalQuantity(SEED_LOTS)).toBe(BROKER_PORTFOLIO_SETTINGS.brokerQuantity);
    expect(totalQuantity(SEED_LOTS)).toBe(2631);
  });

  it("broker reference values are used as-is (source of truth)", () => {
    expect(BROKER_PORTFOLIO_SETTINGS.brokerQuantity).toBe(2631);
    expect(BROKER_PORTFOLIO_SETTINGS.brokerAvgPriceUsd).toBe(139.84);
  });

  it("adjustment lot is clearly flagged and has no known date", () => {
    expect(ADJUSTMENT_LOT?.isAdjustment).toBe(true);
    expect(ADJUSTMENT_LOT?.date).toBeNull();
    expect(ADJUSTMENT_LOT?.note).toMatch(/미확인/);
  });

  it("no confirmed lot is marked as adjustment", () => {
    expect(CONFIRMED_BUY_LOTS.every((lot) => lot.isAdjustment === false)).toBe(true);
  });
});
