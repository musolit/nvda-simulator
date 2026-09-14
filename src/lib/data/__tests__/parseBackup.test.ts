import { describe, expect, it } from "vitest";
import { parseBackupJson } from "../parseBackup";
import { IMPORT_TEMPLATE } from "../importTemplate";

describe("parseBackupJson", () => {
  it("parses the downloadable example template successfully", () => {
    const data = parseBackupJson(JSON.stringify(IMPORT_TEMPLATE));
    expect(data.portfolioSettings).toEqual(IMPORT_TEMPLATE.portfolioSettings);
    expect(data.buyLots).toHaveLength(IMPORT_TEMPLATE.buyLots.length);
  });

  it("defaults sellTransactions and simulationSettings when omitted", () => {
    const data = parseBackupJson(
      JSON.stringify({
        portfolioSettings: { brokerQuantity: 10, brokerAvgPriceUsd: 100 },
        buyLots: [{ id: "l1", quantity: 10, pricePerShareUsd: 100 }],
      })
    );
    expect(data.sellTransactions).toEqual([]);
    expect(data.simulationSettings.annualDeductionKrw).toBe(2_500_000);
    expect(data.simulationSettings.priorRealizedGainKrw).toBe(0);
  });

  it("throws a Korean error on invalid JSON text", () => {
    expect(() => parseBackupJson("not json")).toThrow(/JSON/);
  });

  it("throws when portfolioSettings is missing", () => {
    expect(() => parseBackupJson(JSON.stringify({ buyLots: [] }))).toThrow();
  });

  it("throws when buyLots is not an array", () => {
    expect(() =>
      parseBackupJson(
        JSON.stringify({
          portfolioSettings: { brokerQuantity: 1, brokerAvgPriceUsd: 1 },
          buyLots: "nope",
        })
      )
    ).toThrow();
  });

  it("throws when a buy lot is missing required fields", () => {
    expect(() =>
      parseBackupJson(
        JSON.stringify({
          portfolioSettings: { brokerQuantity: 1, brokerAvgPriceUsd: 1 },
          buyLots: [{ id: "l1" }],
        })
      )
    ).toThrow();
  });
});
