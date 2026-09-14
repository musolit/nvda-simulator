import type { BackupData } from "./AppDataContext";

/**
 * Example/fictional data only — never real transaction history. Downloaded
 * so a non-technical user can see the exact JSON shape the app expects and
 * fill in their own real numbers in a text editor before pasting/uploading.
 */
export const IMPORT_TEMPLATE: BackupData = {
  exportedAt: new Date(0).toISOString(),
  portfolioSettings: {
    brokerQuantity: 110,
    brokerAvgPriceUsd: 125.5,
  },
  buyLots: [
    {
      id: "lot-example-1",
      date: "2024-01-15",
      quantity: 60,
      pricePerShareUsd: 120.0,
      acquisitionFxRate: null,
      isAdjustment: false,
      source: "confirmed",
      note: null,
    },
    {
      id: "lot-example-2",
      date: "2024-03-20",
      quantity: 40,
      pricePerShareUsd: 130.0,
      acquisitionFxRate: null,
      isAdjustment: false,
      source: "confirmed",
      note: null,
    },
    {
      id: "lot-example-adjustment",
      date: null,
      quantity: 10,
      pricePerShareUsd: 133.75,
      acquisitionFxRate: null,
      isAdjustment: true,
      source: "confirmed",
      note: "미확인 조정분 예시 (실제 체결 내역을 확인할 수 없는 수량 차이)",
    },
  ],
  sellTransactions: [],
  simulationSettings: {
    annualDeductionKrw: 2_500_000,
    taxRatePercent: 0.22,
    priorRealizedGainKrw: 0,
    lastPriceUsd: null,
    lastFxRate: null,
  },
};
