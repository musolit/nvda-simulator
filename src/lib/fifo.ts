import type { BuyLot, FifoConsumeResult, LotConsumption } from "./types";

/**
 * Sorts lots into FIFO consumption order: dated lots ascending by date (ties
 * broken by original array order for determinism), then any adjustment lots
 * (unknown date) last, regardless of the dated lots' range. This guarantees
 * a sale of up to `sum(confirmed lot quantities)` shares never touches the
 * unverified adjustment lot.
 */
export function sortLotsFifo(lots: BuyLot[]): BuyLot[] {
  return lots
    .map((lot, index) => ({ lot, index }))
    .sort((a, b) => {
      if (a.lot.isAdjustment !== b.lot.isAdjustment) {
        return a.lot.isAdjustment ? 1 : -1;
      }
      if (!a.lot.isAdjustment) {
        const dateCompare = (a.lot.date ?? "").localeCompare(b.lot.date ?? "");
        if (dateCompare !== 0) return dateCompare;
      }
      return a.index - b.index;
    })
    .map(({ lot }) => lot);
}

/**
 * Consumes `sellQuantity` shares from `lots` in strict FIFO order.
 *
 * Pure function: never mutates the input array or its lot objects. Lots with
 * `quantity <= 0` are skipped. If `sellQuantity` exceeds total available
 * shares, as many as possible are consumed and the remainder is reported in
 * `shortfall` (remainingLots will be empty in that case).
 */
export function consumeLotsFifo(
  lots: BuyLot[],
  sellQuantity: number
): FifoConsumeResult {
  if (!Number.isFinite(sellQuantity) || sellQuantity < 0) {
    throw new Error("sellQuantity must be a non-negative finite number");
  }
  if (!Number.isInteger(sellQuantity)) {
    throw new Error("sellQuantity must be an integer number of shares");
  }

  const ordered = sortLotsFifo(lots.filter((lot) => lot.quantity > 0));

  const consumptions: LotConsumption[] = [];
  const remainingLots: BuyLot[] = [];
  let remainingToSell = sellQuantity;
  let totalCostUsd = 0;
  let consumedQuantity = 0;

  for (const lot of ordered) {
    if (remainingToSell <= 0) {
      remainingLots.push(lot);
      continue;
    }
    const take = Math.min(lot.quantity, remainingToSell);
    if (take > 0) {
      const costUsd = take * lot.pricePerShareUsd;
      consumptions.push({
        lotId: lot.id,
        lotDate: lot.date,
        isAdjustment: lot.isAdjustment,
        quantity: take,
        pricePerShareUsd: lot.pricePerShareUsd,
        costUsd,
      });
      totalCostUsd += costUsd;
      consumedQuantity += take;
      remainingToSell -= take;
    }
    const leftoverQuantity = lot.quantity - take;
    if (leftoverQuantity > 0) {
      remainingLots.push({ ...lot, quantity: leftoverQuantity });
    }
  }

  return {
    requestedQuantity: sellQuantity,
    consumedQuantity,
    shortfall: Math.max(0, remainingToSell),
    consumptions,
    totalCostUsd,
    averageCostPerShareUsd: consumedQuantity > 0 ? totalCostUsd / consumedQuantity : 0,
    remainingLots,
  };
}

/** Sum of quantities across a list of lots. */
export function totalQuantity(lots: BuyLot[]): number {
  return lots.reduce((sum, lot) => sum + lot.quantity, 0);
}

/** Weighted-average cost per share across a list of lots (0 if empty). */
export function averageCost(lots: BuyLot[]): number {
  const qty = totalQuantity(lots);
  if (qty === 0) return 0;
  const cost = lots.reduce((sum, lot) => sum + lot.quantity * lot.pricePerShareUsd, 0);
  return cost / qty;
}

/**
 * Applies previously-recorded real sell transactions against a set of buy
 * lots in FIFO order, returning what remains. Simplification (documented in
 * lib/types.ts's SellTransaction docs too): consumption walks the lots in
 * FIFO order without checking each sell's date against each lot's date,
 * i.e. it assumes every recorded sell happened after the lots it consumes
 * were bought. That holds for how this app is used (sells are entered as
 * they happen, always against existing holdings) and keeps the model simple.
 */
export function applyRealizedSells(
  lots: BuyLot[],
  sells: SellTransactionLike[]
): BuyLot[] {
  const orderedSells = [...sells].sort((a, b) => a.date.localeCompare(b.date));
  let currentLots = lots;
  for (const sell of orderedSells) {
    const result = consumeLotsFifo(currentLots, sell.quantity);
    currentLots = result.remainingLots;
  }
  return currentLots;
}

interface SellTransactionLike {
  date: string;
  quantity: number;
}
