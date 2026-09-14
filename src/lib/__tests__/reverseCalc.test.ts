import { describe, expect, it } from "vitest";
import { findSharesForTargetCash } from "../reverseCalc";
import { SEED_LOTS } from "../seedData";
import { simulateSell } from "../simulate";
import { totalQuantity } from "../fifo";

describe("findSharesForTargetCash", () => {
  it("finds the minimum share count meeting a target net cash", () => {
    const target = 50_000_000;
    const result = findSharesForTargetCash({
      lots: SEED_LOTS,
      targetNetCashKrw: target,
      currentPriceUsd: 180,
      fxRate: 1400,
      priorRealizedGainKrw: 0,
    });

    expect(result.achievable).toBe(true);
    if (!result.achievable) return;

    expect(result.simulation.netCashKrw).toBeGreaterThanOrEqual(target);

    // One fewer share must fall short (minimality).
    const oneLess = simulateSell({
      lots: SEED_LOTS,
      sellQuantity: result.sellQuantity - 1,
      currentPriceUsd: 180,
      fxRate: 1400,
      priorRealizedGainKrw: 0,
    });
    if (result.sellQuantity > 0) {
      expect(oneLess.netCashKrw).toBeLessThan(target);
    }
  });

  it("returns achievable: false when even selling everything falls short", () => {
    const total = totalQuantity(SEED_LOTS);
    const maxSim = simulateSell({
      lots: SEED_LOTS,
      sellQuantity: total,
      currentPriceUsd: 180,
      fxRate: 1400,
      priorRealizedGainKrw: 0,
    });

    const result = findSharesForTargetCash({
      lots: SEED_LOTS,
      targetNetCashKrw: maxSim.netCashKrw + 1_000_000_000,
      currentPriceUsd: 180,
      fxRate: 1400,
      priorRealizedGainKrw: 0,
    });

    expect(result.achievable).toBe(false);
    if (result.achievable) return;
    expect(result.maxQuantity).toBe(total);
  });

  it("returns 0 shares for a target of 0 or less", () => {
    const result = findSharesForTargetCash({
      lots: SEED_LOTS,
      targetNetCashKrw: 0,
      currentPriceUsd: 180,
      fxRate: 1400,
      priorRealizedGainKrw: 0,
    });
    expect(result.achievable).toBe(true);
    if (!result.achievable) return;
    expect(result.sellQuantity).toBe(0);
  });
});
