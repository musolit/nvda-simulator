"use client";

import Link from "next/link";
import TopBar from "../TopBar";
import { useAppData } from "@/lib/data/AppDataContext";
import { usePriceFx } from "@/lib/data/usePriceFx";
import { Card, GainText, InfoNote, NumberField, SectionTitle, StatRow } from "@/components/ui";
import { formatKrw, formatManwon, formatPercent, formatShares, formatUsd } from "@/lib/format";
import { summarizeHoldings } from "@/lib/fifo";
import { computeYearlyTaxSummaryForYear } from "@/lib/simulate";

export default function DashboardPage() {
  return (
    <>
      <TopBar title="대시보드" />
      <DashboardContent />
    </>
  );
}

function DashboardContent() {
  const { remainingLots, allBuyLots, sellTransactions, simulationSettings } = useAppData();
  const { priceInput, setPriceInput, fxInput, setFxInput, price, fxRate, ready } = usePriceFx();

  // Live holdings, derived from the buy/sell ledger — this is what stays in
  // sync automatically as real buy/sell transactions are added, edited, or
  // deleted.
  const holdings = summarizeHoldings(remainingLots);
  const qty = holdings.totalQuantity;
  const avgCost = holdings.averageCostUsd;

  const valueUsd = ready ? qty * price : 0;
  const valueKrw = ready ? valueUsd * fxRate : 0;
  const unrealizedGainUsd = ready ? (price - avgCost) * qty : 0;
  const unrealizedGainKrw = ready ? unrealizedGainUsd * fxRate : 0;
  const returnPercent = avgCost > 0 && ready ? ((price - avgCost) / avgCost) * 100 : 0;

  // Estimated tax on this year's ACTUAL sells only — never simulation
  // results. Recomputed fresh from the ledger every render, so recording,
  // editing, or deleting a real sell updates this automatically.
  const currentTaxYear = new Date().getFullYear();
  const yearlyTax = computeYearlyTaxSummaryForYear(allBuyLots, sellTransactions, currentTaxYear, {
    annualDeductionKrw: simulationSettings.annualDeductionKrw,
    taxRatePercent: simulationSettings.taxRatePercent,
  });

  return (
    <div className="space-y-4 p-4">
      <Card>
        <div className="mb-4 flex items-center justify-between">
          <div>
            <p className="text-xs text-neutral-500">NVIDIA Corporation</p>
            <p className="text-base font-semibold text-white">NVDA</p>
          </div>
          <div className="text-right">
            <p className="text-xs text-neutral-500">현재 보유</p>
            <p className="text-xl font-bold text-white tabular-nums">{formatShares(qty)}</p>
          </div>
        </div>

        <StatRow
          label={
            <span>
              FIFO 잔여 평균취득가
              {holdings.hasUnverifiedRemaining && (
                <InfoNote>
                  실제 매수일·매수가가 확인되지 않은 미확인 조정분{" "}
                  {formatShares(holdings.adjustmentQuantity)}가 포함되어 있어 이 평균취득가는
                  추정치입니다. 확정 매수분만의 평균취득가는{" "}
                  {formatUsd(holdings.confirmedAverageCostUsd)}입니다.{" "}
                  <Link href="/transactions" className="underline underline-offset-2">
                    매수 lot별 상세 보기
                  </Link>
                </InfoNote>
              )}
            </span>
          }
          value={formatUsd(avgCost)}
        />
      </Card>

      <Card>
        <SectionTitle>현재가 · 환율 입력</SectionTitle>
        <div className="grid grid-cols-2 gap-3">
          <NumberField
            label="현재가 (USD)"
            value={priceInput}
            onChange={setPriceInput}
            placeholder="180.00"
            suffix="USD"
          />
          <NumberField
            label="USD/KRW 환율"
            value={fxInput}
            onChange={setFxInput}
            placeholder="1400"
            suffix="원"
          />
        </div>
      </Card>

      <Card>
        <SectionTitle>평가 현황</SectionTitle>
        {!ready ? (
          <p className="py-4 text-center text-sm text-neutral-500">
            현재가와 환율을 입력하면 평가금액이 계산됩니다.
          </p>
        ) : (
          <>
            <StatRow label="NVDA 주식 평가금액" value={formatUsd(valueUsd)} sub={formatKrw(valueKrw)} />
            <StatRow
              label="평가손익"
              value={
                <GainText value={unrealizedGainUsd}>
                  {unrealizedGainUsd >= 0 ? "+" : ""}
                  {formatUsd(unrealizedGainUsd)}
                </GainText>
              }
              sub={
                <GainText value={unrealizedGainKrw}>
                  {unrealizedGainKrw >= 0 ? "+" : ""}
                  {formatKrw(unrealizedGainKrw)}
                </GainText>
              }
            />
            <StatRow
              label="수익률"
              value={<GainText value={returnPercent}>{formatPercent(returnPercent)}</GainText>}
            />
          </>
        )}
      </Card>

      <Link href="/tax">
        <Card className="active:opacity-80">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs text-neutral-500">{yearlyTax.paymentYear}년 5월 납부 예상</p>
              <p className="text-sm font-semibold text-white">
                양도소득세 {formatManwon(yearlyTax.taxKrw)}
              </p>
            </div>
            <p className="text-xs text-neutral-500">{yearlyTax.taxYear}년 실제 매도 기준 ›</p>
          </div>
        </Card>
      </Link>

      <Card className="text-xs text-neutral-500">
        <p>
          보유 lot: 확정 {formatShares(holdings.confirmedQuantity)}
          {holdings.hasUnverifiedRemaining && ` + 미확인 조정분 ${formatShares(holdings.adjustmentQuantity)}`} = 총{" "}
          {formatShares(holdings.totalQuantity)}
        </p>
        <p className="mt-1">
          평가금액은 현재 보유 중인 주식만 반영하며, 매도로 확보한 현금은 포함하지 않습니다.
          평가손익/평가금액의 원화 환산은 위에 입력한 환율을 일괄 적용한 예상치입니다.
        </p>
        <Link href="/transactions" className="mt-2 inline-block text-emerald-400 underline underline-offset-2">
          매수 lot별 잔여 수량 상세 보기 →
        </Link>
      </Card>
    </div>
  );
}
