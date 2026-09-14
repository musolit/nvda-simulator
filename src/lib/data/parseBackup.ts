import { DEFAULT_SIMULATION_SETTINGS } from "./localStore";
import type { BackupData } from "./AppDataContext";

/** Parses and lightly validates a pasted/uploaded backup JSON string. Throws with a Korean, user-facing message on failure. */
export function parseBackupJson(text: string): BackupData {
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    throw new Error("올바른 JSON 형식이 아닙니다.");
  }

  if (typeof raw !== "object" || raw === null) {
    throw new Error("JSON 객체 형식이어야 합니다.");
  }
  const data = raw as Partial<BackupData>;

  if (!data.portfolioSettings || typeof data.portfolioSettings.brokerQuantity !== "number") {
    throw new Error("portfolioSettings.brokerQuantity 값이 필요합니다.");
  }
  if (typeof data.portfolioSettings.brokerAvgPriceUsd !== "number") {
    throw new Error("portfolioSettings.brokerAvgPriceUsd 값이 필요합니다.");
  }
  if (!Array.isArray(data.buyLots)) {
    throw new Error("buyLots 배열이 필요합니다.");
  }
  for (const lot of data.buyLots) {
    if (
      typeof lot.id !== "string" ||
      typeof lot.quantity !== "number" ||
      typeof lot.pricePerShareUsd !== "number"
    ) {
      throw new Error("buyLots의 각 항목에는 id, quantity, pricePerShareUsd가 필요합니다.");
    }
  }

  return {
    exportedAt: typeof data.exportedAt === "string" ? data.exportedAt : new Date().toISOString(),
    portfolioSettings: {
      brokerQuantity: data.portfolioSettings.brokerQuantity,
      brokerAvgPriceUsd: data.portfolioSettings.brokerAvgPriceUsd,
    },
    buyLots: data.buyLots.map((lot) => ({
      id: lot.id,
      date: lot.date ?? null,
      quantity: lot.quantity,
      pricePerShareUsd: lot.pricePerShareUsd,
      acquisitionFxRate: lot.acquisitionFxRate ?? null,
      isAdjustment: Boolean(lot.isAdjustment),
      source: lot.source ?? "manual",
      note: lot.note ?? null,
    })),
    sellTransactions: Array.isArray(data.sellTransactions)
      ? data.sellTransactions.map((tx) => ({
          id: tx.id,
          date: tx.date,
          quantity: tx.quantity,
          pricePerShareUsd: tx.pricePerShareUsd,
          fxRate: tx.fxRate,
          note: tx.note ?? null,
        }))
      : [],
    simulationSettings: data.simulationSettings
      ? {
          annualDeductionKrw:
            data.simulationSettings.annualDeductionKrw ?? DEFAULT_SIMULATION_SETTINGS.annualDeductionKrw,
          taxRatePercent:
            data.simulationSettings.taxRatePercent ?? DEFAULT_SIMULATION_SETTINGS.taxRatePercent,
          priorRealizedGainKrw: data.simulationSettings.priorRealizedGainKrw ?? 0,
          lastPriceUsd: data.simulationSettings.lastPriceUsd ?? null,
          lastFxRate: data.simulationSettings.lastFxRate ?? null,
        }
      : DEFAULT_SIMULATION_SETTINGS,
  };
}
