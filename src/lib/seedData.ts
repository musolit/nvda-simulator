import type { BuyLot, PortfolioSettings } from "./types";

/**
 * 실제 키움증권 계좌 기준값 (항상 최우선 정답).
 * 대시보드 등 계좌 현황 표시는 lot 합산값이 아니라 반드시 이 값을 사용한다.
 */
export const BROKER_PORTFOLIO_SETTINGS: PortfolioSettings = {
  brokerQuantity: 2631,
  brokerAvgPriceUsd: 139.84,
};

/**
 * 키움증권 카카오톡 체결알림에서 추출한, 부분체결 중복을 제거한 확정 매수 lot.
 * 총 2,604주. (출처: 사용자가 제공한 체결 내역)
 */
export const CONFIRMED_BUY_LOTS: BuyLot[] = [
  { date: "2025-03-27", quantity: 154, pricePerShareUsd: 113.1 },
  { date: "2025-03-28", quantity: 154, pricePerShareUsd: 111.48 },
  { date: "2025-03-28", quantity: 318, pricePerShareUsd: 110.2077 },
  { date: "2025-03-31", quantity: 162, pricePerShareUsd: 105.0 },
  { date: "2025-04-04", quantity: 170, pricePerShareUsd: 100.0 },
  { date: "2025-04-04", quantity: 181, pricePerShareUsd: 95.0 },
  { date: "2025-04-07", quantity: 190, pricePerShareUsd: 90.0 },
  { date: "2025-09-02", quantity: 125, pricePerShareUsd: 169.7 },
  { date: "2025-09-02", quantity: 1, pricePerShareUsd: 169.99 },
  { date: "2025-09-18", quantity: 43, pricePerShareUsd: 169.56 },
  { date: "2025-11-07", quantity: 107, pricePerShareUsd: 190.73 },
  { date: "2025-11-07", quantity: 1, pricePerShareUsd: 190.76 },
  { date: "2025-11-08", quantity: 56, pricePerShareUsd: 181.23 },
  { date: "2025-11-08", quantity: 1, pricePerShareUsd: 181.17 },
  { date: "2025-11-13", quantity: 53, pricePerShareUsd: 190.78 },
  { date: "2025-11-14", quantity: 11, pricePerShareUsd: 181.2 },
  { date: "2025-11-22", quantity: 39, pricePerShareUsd: 175.51 },
  { date: "2025-11-26", quantity: 39, pricePerShareUsd: 171.64 },
  { date: "2025-11-26", quantity: 40, pricePerShareUsd: 171.7637 },
  { date: "2025-12-18", quantity: 78, pricePerShareUsd: 171.4903 },
  { date: "2025-12-18", quantity: 1, pricePerShareUsd: 171.5 },
  { date: "2026-02-05", quantity: 77, pricePerShareUsd: 176.01 },
  { date: "2026-03-09", quantity: 77, pricePerShareUsd: 173.98 },
  { date: "2026-03-19", quantity: 74, pricePerShareUsd: 178.24 },
  { date: "2026-03-23", quantity: 78, pricePerShareUsd: 170.54 },
  { date: "2026-03-27", quantity: 78, pricePerShareUsd: 167.96 },
  { date: "2026-03-27", quantity: 1, pricePerShareUsd: 167.93 },
  { date: "2026-03-30", quantity: 77, pricePerShareUsd: 169.03 },
  { date: "2026-03-30", quantity: 1, pricePerShareUsd: 169.04 },
  { date: "2026-03-31", quantity: 79, pricePerShareUsd: 163.22 },
  { date: "2026-03-31", quantity: 1, pricePerShareUsd: 163.2 },
  { date: "2026-06-26", quantity: 66, pricePerShareUsd: 194.66 },
  { date: "2026-07-30", quantity: 71, pricePerShareUsd: 192.26 },
].map((lot, index) => ({
  id: `confirmed-${index + 1}`,
  date: lot.date,
  quantity: lot.quantity,
  pricePerShareUsd: lot.pricePerShareUsd,
  acquisitionFxRate: null,
  isAdjustment: false,
  source: "confirmed",
}));

export const CONFIRMED_TOTAL_QUANTITY = CONFIRMED_BUY_LOTS.reduce(
  (sum, lot) => sum + lot.quantity,
  0
);

export const ADJUSTMENT_QUANTITY =
  BROKER_PORTFOLIO_SETTINGS.brokerQuantity - CONFIRMED_TOTAL_QUANTITY;

const confirmedTotalCostUsd = CONFIRMED_BUY_LOTS.reduce(
  (sum, lot) => sum + lot.quantity * lot.pricePerShareUsd,
  0
);
const impliedTotalCostUsd =
  BROKER_PORTFOLIO_SETTINGS.brokerAvgPriceUsd * BROKER_PORTFOLIO_SETTINGS.brokerQuantity;

/**
 * "미확인 조정분" lot: 27주. 실제 개별 체결 내역을 확인할 수 없어 단가는
 * 키움 계좌의 평균매입가($139.84)와 확정 lot 합계가 정확히 들어맞도록
 * 역산한 추정값일 뿐, 실제 체결가가 아니다. 화면에서는 항상 "미확인
 * 조정분"으로 명확히 표시하고, 실제 거래처럼 보이지 않게 한다. FIFO
 * 정렬상 모든 확정 lot보다 뒤에 위치하므로 2,604주 이하를 매도하는
 * 일반적인 시뮬레이션에는 영향을 주지 않는다.
 */
export const ADJUSTMENT_LOT: BuyLot | null =
  ADJUSTMENT_QUANTITY > 0
    ? {
        id: "adjustment-1",
        date: null,
        quantity: ADJUSTMENT_QUANTITY,
        pricePerShareUsd:
          Math.round(
            ((impliedTotalCostUsd - confirmedTotalCostUsd) / ADJUSTMENT_QUANTITY) * 10000
          ) / 10000,
        acquisitionFxRate: null,
        isAdjustment: true,
        source: "confirmed",
        note: "미확인 조정분 (키움 계좌 수량과의 차이, 개별 체결 내역 확인 불가)",
      }
    : null;

export const SEED_LOTS: BuyLot[] = ADJUSTMENT_LOT
  ? [...CONFIRMED_BUY_LOTS, ADJUSTMENT_LOT]
  : CONFIRMED_BUY_LOTS;
