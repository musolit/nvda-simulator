import type { BuyLot } from "../types";

/**
 * Synthetic fixture data for tests only — NOT anyone's real transaction
 * history (this app no longer ships any personal seed data; users provide
 * their own via the initial JSON import screen). Mirrors the shape the app
 * is built around: several confirmed lots plus one "미확인 조정분"
 * (unverified adjustment) lot reconciling to a broker-reported total, with
 * round numbers chosen to exercise FIFO edge cases like a 200-share sell
 * spanning exactly two lots.
 */
export const FIXTURE_CONFIRMED_LOTS: BuyLot[] = [
  {
    id: "fixture-lot-1",
    date: "2020-01-01",
    quantity: 154,
    pricePerShareUsd: 100,
    acquisitionFxRate: null,
    isAdjustment: false,
    source: "confirmed",
  },
  {
    id: "fixture-lot-2",
    date: "2020-01-02",
    quantity: 500,
    pricePerShareUsd: 105,
    acquisitionFxRate: null,
    isAdjustment: false,
    source: "confirmed",
  },
  {
    id: "fixture-lot-3",
    date: "2020-01-03",
    quantity: 1950,
    pricePerShareUsd: 110,
    acquisitionFxRate: null,
    isAdjustment: false,
    source: "confirmed",
  },
];

export const FIXTURE_CONFIRMED_TOTAL_QUANTITY = FIXTURE_CONFIRMED_LOTS.reduce(
  (sum, lot) => sum + lot.quantity,
  0
);

export const FIXTURE_ADJUSTMENT_LOT: BuyLot = {
  id: "fixture-adjustment",
  date: null,
  quantity: 27,
  pricePerShareUsd: 120,
  acquisitionFxRate: null,
  isAdjustment: true,
  source: "confirmed",
  note: "미확인 조정분 (fixture)",
};

export const FIXTURE_SEED_LOTS: BuyLot[] = [...FIXTURE_CONFIRMED_LOTS, FIXTURE_ADJUSTMENT_LOT];
