"use client";

import { useMemo, useState } from "react";
import TopBar from "../TopBar";
import { useAppData } from "@/lib/data/AppDataContext";
import { usePriceFx } from "@/lib/data/usePriceFx";
import { Card, GainText, NumberField, PillButton, SectionTitle, StatRow } from "@/components/ui";
import { formatDate, formatKrw, formatShares, formatUsd } from "@/lib/format";
import {
  computeSimulatedYearlyTaxImpact,
  computeYearlyTaxSummaryForYear,
  simulateSell,
  type SellSimulationResult,
} from "@/lib/simulate";
import { findSharesForTargetCash } from "@/lib/reverseCalc";
import type { TaxSettings } from "@/lib/types";

type Mode = "sell" | "goal" | "compare";

export default function SimulatorPage() {
  const [mode, setMode] = useState<Mode>("sell");

  return (
    <>
      <TopBar title="시뮬레이터" />
      <div className="space-y-4 p-4">
        <PriceFxCard />
        <div className="flex gap-2">
          <PillButton active={mode === "sell"} onClick={() => setMode("sell")}>
            매도 시뮬레이션
          </PillButton>
          <PillButton active={mode === "goal"} onClick={() => setMode("goal")}>
            목표현금 역산
          </PillButton>
          <PillButton active={mode === "compare"} onClick={() => setMode("compare")}>
            빠른비교
          </PillButton>
        </div>
        {mode === "sell" && <SellSimulatorPanel />}
        {mode === "goal" && <GoalSeekPanel />}
        {mode === "compare" && <QuickComparePanel />}
      </div>
    </>
  );
}

function PriceFxCard() {
  const { priceInput, setPriceInput, fxInput, setFxInput, ready } = usePriceFx();
  return (
    <Card>
      <SectionTitle>현재가 · 환율</SectionTitle>
      <div className="grid grid-cols-2 gap-3">
        <NumberField label="현재가 (USD)" value={priceInput} onChange={setPriceInput} placeholder="180.00" suffix="USD" />
        <NumberField label="USD/KRW 환율" value={fxInput} onChange={setFxInput} placeholder="1400" suffix="원" />
      </div>
      {!ready && <p className="mt-2 text-xs text-neutral-500">현재가와 환율을 모두 입력해주세요.</p>}
    </Card>
  );
}

function useTaxSettings(): TaxSettings {
  const { simulationSettings } = useAppData();
  return {
    annualDeductionKrw: simulationSettings.annualDeductionKrw,
    taxRatePercent: simulationSettings.taxRatePercent,
  };
}

function FifoBreakdown({ result }: { result: SellSimulationResult }) {
  if (result.fifo.consumptions.length === 0) return null;
  const touchesAdjustment = result.fifo.consumptions.some((c) => c.isAdjustment);
  return (
    <div className="mt-3 space-y-1.5 border-t border-neutral-800 pt-3">
      <p className="mb-1 text-xs font-medium text-neutral-400">FIFO 소진 내역</p>
      {touchesAdjustment && (
        <p className="mb-2 rounded-lg bg-amber-500/10 px-3 py-2 text-xs text-amber-300 ring-1 ring-amber-500/20">
          이 매도는 실제 매수일·매수가가 확인되지 않은 미확인 조정분까지 포함합니다. 해당
          부분의 취득원가는 추정값이므로 실현이익·세금 계산의 정확도가 제한적입니다.
        </p>
      )}
      {result.fifo.consumptions.map((c, i) => (
        <div key={`${c.lotId}-${i}`} className="flex items-center justify-between text-xs">
          <span className={c.isAdjustment ? "text-amber-400" : "text-neutral-400"}>
            {c.isAdjustment ? "미확인 조정분" : formatDate(c.lotDate)}
          </span>
          <span className="tabular-nums text-neutral-300">
            {formatShares(c.quantity)} × {formatUsd(c.pricePerShareUsd)}
          </span>
        </div>
      ))}
    </div>
  );
}

function TaxExplainer() {
  return (
    <Card className="text-xs leading-relaxed text-neutral-500">
      <p className="mb-1 font-medium text-neutral-400">계산 방식 (예상치)</p>
      <p>
        과세표준 = 연간 누적 실현이익 − 기본공제(연 250만원). 세금 = 과세표준 × 예상세율(기본
        22%). 매수 시점의 세법상 원화 환율 기록이 없어, 현재 입력한 환율을 일괄 적용한 간편
        추정 방식입니다. 실제 신고 세액과 차이가 있을 수 있습니다.
      </p>
    </Card>
  );
}

const TAX_YEAR_CHOICES_AHEAD = 2;

function SellSimulatorPanel() {
  const { remainingLots, remainingQuantity, allBuyLots, sellTransactions } = useAppData();
  const { price, fxRate, ready } = usePriceFx();
  const taxSettings = useTaxSettings();
  const [qtyInput, setQtyInput] = useState("");
  const currentYear = new Date().getFullYear();
  const [taxYear, setTaxYear] = useState(currentYear);
  const taxYearChoices = Array.from(
    { length: TAX_YEAR_CHOICES_AHEAD + 1 },
    (_, i) => currentYear + i
  );

  const qty = Math.max(0, Math.floor(Number(qtyInput) || 0));

  // A: this tax year's real sells only — never simulation results.
  const yearlyActual = useMemo(
    () => computeYearlyTaxSummaryForYear(allBuyLots, sellTransactions, taxYear, taxSettings),
    [allBuyLots, sellTransactions, taxYear, taxSettings]
  );

  const result = useMemo(() => {
    if (!ready || qtyInput === "") return null;
    return simulateSell({
      lots: remainingLots,
      sellQuantity: qty,
      currentPriceUsd: price,
      fxRate,
      // Scoped to the selected tax year's actual sells (A), not "this year
      // + other stocks" — see computeYearlyTaxSummaryForYear's docs.
      priorRealizedGainKrw: yearlyActual.totalRealizedGainKrw,
      taxSettings,
    });
  }, [ready, qtyInput, qty, remainingLots, price, fxRate, yearlyActual.totalRealizedGainKrw, taxSettings]);

  // A vs. B (A + this simulated sale) for the selected tax year.
  const yearlyImpact = useMemo(() => {
    if (!result) return null;
    return computeSimulatedYearlyTaxImpact(
      allBuyLots,
      sellTransactions,
      taxYear,
      result.realizedGainKrw,
      taxSettings
    );
  }, [result, allBuyLots, sellTransactions, taxYear, taxSettings]);

  return (
    <div className="space-y-4">
      <Card>
        <SectionTitle>매도수량</SectionTitle>
        <NumberField label="매도할 주식수" value={qtyInput} onChange={setQtyInput} placeholder="200" suffix="주" step="1" />
        <p className="mt-2 text-xs text-neutral-500">현재 보유: {formatShares(remainingQuantity)}</p>
        <p className="mb-1.5 mt-3 text-xs font-medium text-neutral-400">매도 예정 연도</p>
        <div className="flex gap-2">
          {taxYearChoices.map((year) => (
            <PillButton key={year} active={year === taxYear} onClick={() => setTaxYear(year)}>
              {year}년
            </PillButton>
          ))}
        </div>
      </Card>

      {result && yearlyImpact && (
        <Card>
          <SectionTitle>시뮬레이션 결과</SectionTitle>
          {result.insufficientShares && (
            <p className="mb-3 rounded-lg bg-amber-500/10 px-3 py-2 text-xs text-amber-300 ring-1 ring-amber-500/20">
              보유 수량({formatShares(remainingQuantity)})을 초과하여, 보유한 만큼만 계산했습니다.
            </p>
          )}
          <StatRow label="매도 주식수" value={formatShares(result.fifo.consumedQuantity)} />
          <StatRow label="매도대금" value={formatUsd(result.proceedsUsd)} sub={formatKrw(result.proceedsKrw)} />
          <StatRow label="FIFO 취득원가" value={formatUsd(result.fifoCostUsd)} />
          <StatRow
            label="예상 실현이익"
            value={
              <GainText value={result.realizedGainUsd}>
                {result.realizedGainUsd >= 0 ? "+" : ""}
                {formatUsd(result.realizedGainUsd)}
              </GainText>
            }
            sub={formatKrw(result.realizedGainKrw)}
          />

          <div className="my-2 border-t border-neutral-800" />
          <p className="mb-1 text-xs text-neutral-500">
            {yearlyImpact.taxYear}년 귀속 · {yearlyImpact.paymentYear}년 5월 납부 예상
          </p>
          <StatRow
            label={`${yearlyImpact.taxYear}년 실제 매도 기준 예상 세금`}
            value={formatKrw(yearlyImpact.actualTaxKrw)}
          />
          <StatRow
            label={`이번 매도까지 실행 시 ${yearlyImpact.paymentYear}년 총 예상 세금`}
            value={formatKrw(yearlyImpact.combinedTaxKrw)}
            valueClassName="text-red-400"
          />
          <StatRow
            label="이번 매도로 증가하는 세금"
            value={`+${formatKrw(yearlyImpact.incrementalTaxKrw)}`}
            valueClassName="text-red-400"
          />
          <StatRow label="세후 확보 예상금액" value={formatKrw(result.netCashKrw)} valueClassName="text-emerald-400" />
          <div className="my-2 border-t border-neutral-800" />
          <StatRow label="매도 후 남은 수량" value={formatShares(result.remainingQuantity)} />
          <StatRow label="매도 후 평가금액" value={formatUsd(result.remainingValueUsd)} sub={formatKrw(result.remainingValueKrw)} />
          <FifoBreakdown result={result} />
        </Card>
      )}

      <TaxExplainer />
    </div>
  );
}

function GoalSeekPanel() {
  const { remainingLots, effectivePriorRealizedGainKrw } = useAppData();
  const { price, fxRate, ready } = usePriceFx();
  const taxSettings = useTaxSettings();
  const [targetInput, setTargetInput] = useState("");

  const target = Number(targetInput) || 0;

  const result = useMemo(() => {
    if (!ready || targetInput === "" || target <= 0) return null;
    return findSharesForTargetCash({
      lots: remainingLots,
      targetNetCashKrw: target,
      currentPriceUsd: price,
      fxRate,
      priorRealizedGainKrw: effectivePriorRealizedGainKrw,
      taxSettings,
    });
  }, [ready, targetInput, target, remainingLots, price, fxRate, effectivePriorRealizedGainKrw, taxSettings]);

  return (
    <div className="space-y-4">
      <Card>
        <SectionTitle>세후 얼마의 현금이 필요하세요?</SectionTitle>
        <NumberField label="목표 세후 확보금액" value={targetInput} onChange={setTargetInput} placeholder="50000000" suffix="원" />
      </Card>

      {result && result.achievable && (
        <Card>
          <SectionTitle>역산 결과</SectionTitle>
          <StatRow label="필요 매도수량" value={formatShares(result.sellQuantity)} valueClassName="text-emerald-400" />
          <StatRow label="예상 매도대금" value={formatUsd(result.simulation.proceedsUsd)} sub={formatKrw(result.simulation.proceedsKrw)} />
          <StatRow
            label="예상 실현이익"
            value={formatUsd(result.simulation.realizedGainUsd)}
            sub={formatKrw(result.simulation.realizedGainKrw)}
          />
          <StatRow label="예상세금" value={formatKrw(result.simulation.tax.taxKrw)} valueClassName="text-red-400" />
          <StatRow label="예상 세후 확보금액" value={formatKrw(result.simulation.netCashKrw)} valueClassName="text-emerald-400" />
          <div className="my-2 border-t border-neutral-800" />
          <StatRow label="매도 후 잔여수량" value={formatShares(result.simulation.remainingQuantity)} />
          <FifoBreakdown result={result.simulation} />
        </Card>
      )}

      {result && !result.achievable && (
        <Card>
          <p className="text-sm text-amber-300">
            보유 주식을 전부 매도해도 목표 금액을 달성할 수 없습니다. 최대 세후 확보 가능 금액은{" "}
            <span className="font-semibold">{formatKrw(result.maxNetCashKrw)}</span>입니다 (
            {formatShares(result.maxQuantity)} 전량 매도 기준).
          </p>
        </Card>
      )}

      <TaxExplainer />
    </div>
  );
}

const COMPARE_QUANTITIES = [100, 200, 300, 500, 1000];

function QuickComparePanel() {
  const { remainingLots, remainingQuantity, effectivePriorRealizedGainKrw } = useAppData();
  const { price, fxRate, ready } = usePriceFx();
  const taxSettings = useTaxSettings();
  const [expanded, setExpanded] = useState<number | null>(null);

  const rows = useMemo(() => {
    if (!ready) return [];
    return COMPARE_QUANTITIES.map((qty) =>
      simulateSell({
        lots: remainingLots,
        sellQuantity: qty,
        currentPriceUsd: price,
        fxRate,
        priorRealizedGainKrw: effectivePriorRealizedGainKrw,
        taxSettings,
      })
    );
  }, [ready, remainingLots, price, fxRate, effectivePriorRealizedGainKrw, taxSettings]);

  if (!ready) {
    return (
      <Card>
        <p className="text-sm text-neutral-500">현재가와 환율을 입력하면 비교표가 표시됩니다.</p>
      </Card>
    );
  }

  return (
    <div className="space-y-3">
      {rows.map((r, i) => (
        <Card key={r.sellQuantity} className="cursor-pointer" >
          <button
            className="flex w-full items-center justify-between text-left"
            onClick={() => setExpanded(expanded === i ? null : i)}
          >
            <div>
              <p className="text-sm font-semibold text-white">{formatShares(r.sellQuantity)}</p>
              {r.sellQuantity > remainingQuantity && (
                <p className="text-[11px] text-amber-400">보유수량 부족 · {formatShares(r.fifo.consumedQuantity)}만 가능</p>
              )}
            </div>
            <div className="grid grid-cols-3 gap-3 text-right text-xs">
              <div>
                <p className="text-neutral-500">매도대금</p>
                <p className="tabular-nums text-neutral-200">{formatKrw(r.proceedsKrw)}</p>
              </div>
              <div>
                <p className="text-neutral-500">세금</p>
                <p className="tabular-nums text-red-400">{formatKrw(r.tax.taxKrw)}</p>
              </div>
              <div>
                <p className="text-neutral-500">세후 확보</p>
                <p className="tabular-nums text-emerald-400">{formatKrw(r.netCashKrw)}</p>
              </div>
            </div>
          </button>
          {expanded === i && (
            <div className="mt-3 border-t border-neutral-800 pt-3">
              <StatRow label="예상 실현이익" value={formatUsd(r.realizedGainUsd)} sub={formatKrw(r.realizedGainKrw)} />
              <StatRow label="매도 후 남은 수량" value={formatShares(r.remainingQuantity)} />
              <FifoBreakdown result={r} />
            </div>
          )}
        </Card>
      ))}
      <TaxExplainer />
    </div>
  );
}
