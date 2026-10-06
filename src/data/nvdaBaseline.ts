import type { BuyLot, PortfolioSettings, SellTransaction } from "@/lib/types";

/**
 * Confirmed real NVDA portfolio baseline, stored in source by explicit user
 * request (overriding this app's earlier "no personal data in source"
 * default) after repeated browser-storage data loss made localStorage alone
 * an unreliable source of truth. This is gross (pre-sale) buyLots + every
 * real sellTransaction — the same dataset already verified end-to-end
 * against the production FIFO/tax pipeline: gross 2,631 shares, two real
 * sells totaling 526 shares, remaining 2,105 shares, FIFO average cost
 * ≈$146.94, 2026 realized gain ≈82,106,688 KRW, 2027-payment tax
 * ≈17,513,471 KRW.
 *
 * Treat these arrays as immutable. Never mutate them or their elements —
 * always go through cloneBaselineBuyLots()/cloneBaselineSellTransactions(),
 * which deep-clone before handing out a copy.
 */

function deepFreeze<T>(value: T): T {
  if (value !== null && typeof value === "object" && !Object.isFrozen(value)) {
    Object.values(value as object).forEach(deepFreeze);
    Object.freeze(value);
  }
  return value;
}

export const BASELINE_BUY_LOTS: readonly BuyLot[] = deepFreeze([
  { id: "lot-20250327-01", date: "2025-03-27", quantity: 154, pricePerShareUsd: 113.1, acquisitionFxRate: null, isAdjustment: false, source: "confirmed", note: null },
  { id: "lot-20250328-01", date: "2025-03-28", quantity: 154, pricePerShareUsd: 111.48, acquisitionFxRate: null, isAdjustment: false, source: "confirmed", note: null },
  { id: "lot-20250328-02", date: "2025-03-28", quantity: 318, pricePerShareUsd: 110.2077, acquisitionFxRate: null, isAdjustment: false, source: "confirmed", note: null },
  { id: "lot-20250331-01", date: "2025-03-31", quantity: 162, pricePerShareUsd: 105.0, acquisitionFxRate: null, isAdjustment: false, source: "confirmed", note: null },
  { id: "lot-20250404-01", date: "2025-04-04", quantity: 170, pricePerShareUsd: 100.0, acquisitionFxRate: null, isAdjustment: false, source: "confirmed", note: null },
  { id: "lot-20250404-02", date: "2025-04-04", quantity: 181, pricePerShareUsd: 95.0, acquisitionFxRate: null, isAdjustment: false, source: "confirmed", note: null },
  { id: "lot-20250407-01", date: "2025-04-07", quantity: 190, pricePerShareUsd: 90.0, acquisitionFxRate: null, isAdjustment: false, source: "confirmed", note: null },
  { id: "lot-20250902-01", date: "2025-09-02", quantity: 125, pricePerShareUsd: 169.7, acquisitionFxRate: null, isAdjustment: false, source: "confirmed", note: null },
  { id: "lot-20250902-02", date: "2025-09-02", quantity: 1, pricePerShareUsd: 169.99, acquisitionFxRate: null, isAdjustment: false, source: "confirmed", note: null },
  { id: "lot-20250918-01", date: "2025-09-18", quantity: 43, pricePerShareUsd: 169.56, acquisitionFxRate: null, isAdjustment: false, source: "confirmed", note: null },
  { id: "lot-20251107-01", date: "2025-11-07", quantity: 107, pricePerShareUsd: 190.73, acquisitionFxRate: null, isAdjustment: false, source: "confirmed", note: null },
  { id: "lot-20251107-02", date: "2025-11-07", quantity: 1, pricePerShareUsd: 190.76, acquisitionFxRate: null, isAdjustment: false, source: "confirmed", note: null },
  { id: "lot-20251108-01", date: "2025-11-08", quantity: 56, pricePerShareUsd: 181.23, acquisitionFxRate: null, isAdjustment: false, source: "confirmed", note: null },
  { id: "lot-20251108-02", date: "2025-11-08", quantity: 1, pricePerShareUsd: 181.17, acquisitionFxRate: null, isAdjustment: false, source: "confirmed", note: null },
  { id: "lot-20251113-01", date: "2025-11-13", quantity: 53, pricePerShareUsd: 190.78, acquisitionFxRate: null, isAdjustment: false, source: "confirmed", note: null },
  { id: "lot-20251114-01", date: "2025-11-14", quantity: 11, pricePerShareUsd: 181.2, acquisitionFxRate: null, isAdjustment: false, source: "confirmed", note: null },
  { id: "lot-20251122-01", date: "2025-11-22", quantity: 39, pricePerShareUsd: 175.51, acquisitionFxRate: null, isAdjustment: false, source: "confirmed", note: null },
  { id: "lot-20251126-01", date: "2025-11-26", quantity: 39, pricePerShareUsd: 171.64, acquisitionFxRate: null, isAdjustment: false, source: "confirmed", note: null },
  { id: "lot-20251126-02", date: "2025-11-26", quantity: 40, pricePerShareUsd: 171.7637, acquisitionFxRate: null, isAdjustment: false, source: "confirmed", note: null },
  { id: "lot-20251218-01", date: "2025-12-18", quantity: 78, pricePerShareUsd: 171.4903, acquisitionFxRate: null, isAdjustment: false, source: "confirmed", note: null },
  { id: "lot-20251218-02", date: "2025-12-18", quantity: 1, pricePerShareUsd: 171.5, acquisitionFxRate: null, isAdjustment: false, source: "confirmed", note: null },
  { id: "lot-20260205-01", date: "2026-02-05", quantity: 77, pricePerShareUsd: 176.01, acquisitionFxRate: null, isAdjustment: false, source: "confirmed", note: null },
  { id: "lot-20260309-01", date: "2026-03-09", quantity: 77, pricePerShareUsd: 173.98, acquisitionFxRate: null, isAdjustment: false, source: "confirmed", note: null },
  { id: "lot-20260319-01", date: "2026-03-19", quantity: 74, pricePerShareUsd: 178.24, acquisitionFxRate: null, isAdjustment: false, source: "confirmed", note: null },
  { id: "lot-20260323-01", date: "2026-03-23", quantity: 78, pricePerShareUsd: 170.54, acquisitionFxRate: null, isAdjustment: false, source: "confirmed", note: null },
  { id: "lot-20260327-01", date: "2026-03-27", quantity: 78, pricePerShareUsd: 167.96, acquisitionFxRate: null, isAdjustment: false, source: "confirmed", note: null },
  { id: "lot-20260327-02", date: "2026-03-27", quantity: 1, pricePerShareUsd: 167.93, acquisitionFxRate: null, isAdjustment: false, source: "confirmed", note: null },
  { id: "lot-20260330-01", date: "2026-03-30", quantity: 77, pricePerShareUsd: 169.03, acquisitionFxRate: null, isAdjustment: false, source: "confirmed", note: null },
  { id: "lot-20260330-02", date: "2026-03-30", quantity: 1, pricePerShareUsd: 169.04, acquisitionFxRate: null, isAdjustment: false, source: "confirmed", note: null },
  { id: "lot-20260331-01", date: "2026-03-31", quantity: 79, pricePerShareUsd: 163.22, acquisitionFxRate: null, isAdjustment: false, source: "confirmed", note: null },
  { id: "lot-20260331-02", date: "2026-03-31", quantity: 1, pricePerShareUsd: 163.2, acquisitionFxRate: null, isAdjustment: false, source: "confirmed", note: null },
  { id: "lot-20260626-01", date: "2026-06-26", quantity: 66, pricePerShareUsd: 194.66, acquisitionFxRate: null, isAdjustment: false, source: "confirmed", note: null },
  { id: "lot-20260730-01", date: "2026-07-30", quantity: 71, pricePerShareUsd: 192.26, acquisitionFxRate: null, isAdjustment: false, source: "confirmed", note: null },
  {
    id: "lot-adjustment-27",
    date: null,
    quantity: 27,
    pricePerShareUsd: 180.3196,
    acquisitionFxRate: null,
    isAdjustment: true,
    source: "confirmed",
    note: "미확인 조정분 27주. 실제 체결가가 아니라, 실제 키움 보유수량 2,631주와 표시 평균매입가 $139.84에 맞추기 위해 역산한 조정단가입니다.",
  },
]) as readonly BuyLot[];

export const BASELINE_SELL_TRANSACTIONS: readonly SellTransaction[] = deepFreeze([
  {
    id: "sell-recovery-20260917-01",
    date: "2026-09-17",
    quantity: 263,
    pricePerShareUsd: 219.62,
    fxRate: 1380,
    note: "실제 매도",
  },
  {
    id: "sell-recovery-20260929-01",
    date: "2026-09-29",
    quantity: 263,
    pricePerShareUsd: 231.3,
    fxRate: 1359,
    note: "실제 매도",
  },
]) as readonly SellTransaction[];

/**
 * Broker (Kiwoom)-reported reference snapshot. brokerQuantity is the
 * current actual holding (2,105 = 2,631 gross − 526 sold). brokerAvgPriceUsd
 * ($139.84) is the broker-displayed average cost at the ORIGINAL 2,631-share
 * setup point (quoted in the adjustment lot's own note above) — it predates
 * the two sells and is NOT the current FIFO average. Per PortfolioSettings'
 * documented semantics, this is a reference snapshot only: never used in any
 * FIFO/holdings calculation (see lib/fifo.ts's summarizeHoldings).
 */
export const BASELINE_PORTFOLIO_SETTINGS: PortfolioSettings = {
  brokerQuantity: 2105,
  brokerAvgPriceUsd: 139.84,
};

export function cloneBaselineBuyLots(): BuyLot[] {
  return structuredClone(BASELINE_BUY_LOTS) as BuyLot[];
}

export function cloneBaselineSellTransactions(): SellTransaction[] {
  return structuredClone(BASELINE_SELL_TRANSACTIONS) as SellTransaction[];
}

export function cloneBaselinePortfolioSettings(): PortfolioSettings {
  return structuredClone(BASELINE_PORTFOLIO_SETTINGS);
}
