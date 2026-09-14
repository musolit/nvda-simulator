"use client";

import TopBar from "../TopBar";
import { useAppData } from "@/lib/data/AppDataContext";
import { usePriceFx } from "@/lib/data/usePriceFx";
import { Card, GainText, NumberField, SectionTitle, StatRow } from "@/components/ui";
import { formatKrw, formatPercent, formatShares, formatUsd } from "@/lib/format";
import { totalQuantity } from "@/lib/fifo";

export default function DashboardPage() {
  return (
    <>
      <TopBar title="대시보드" />
      <DashboardContent />
    </>
  );
}

function DashboardContent() {
  const { portfolioSettings, remainingQuantity, remainingLots } = useAppData();
  const { priceInput, setPriceInput, fxInput, setFxInput, price, fxRate, ready } = usePriceFx();

  const qty = portfolioSettings.brokerQuantity;
  const avgCost = portfolioSettings.brokerAvgPriceUsd;

  const valueUsd = ready ? qty * price : 0;
  const valueKrw = ready ? valueUsd * fxRate : 0;
  const unrealizedGainUsd = ready ? (price - avgCost) * qty : 0;
  const unrealizedGainKrw = ready ? unrealizedGainUsd * fxRate : 0;
  const returnPercent = avgCost > 0 && ready ? ((price - avgCost) / avgCost) * 100 : 0;

  const lotQtyMismatch = remainingQuantity !== qty;

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
        <StatRow label="키움 표시 평균매입가" value={formatUsd(avgCost)} />
        {lotQtyMismatch && (
          <p className="mt-2 rounded-lg bg-amber-500/10 px-3 py-2 text-xs text-amber-300 ring-1 ring-amber-500/20">
            거래내역 기준 보유수량은 {formatShares(remainingQuantity)}입니다. 실제 키움 계좌
            수량과 다르면 설정에서 기준값을 맞춰주세요.
          </p>
        )}
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
            <StatRow label="평가금액" value={formatUsd(valueUsd)} sub={formatKrw(valueKrw)} />
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

      <Card className="text-xs text-neutral-500">
        <p>
          보유 lot: 확정 {remainingLots.filter((l) => !l.isAdjustment).length}건 · 총{" "}
          {formatShares(totalQuantity(remainingLots))} (미확인 조정분 포함)
        </p>
        <p className="mt-1">
          평가손익/평가금액의 원화 환산은 위에 입력한 환율을 일괄 적용한 예상치입니다.
        </p>
      </Card>
    </div>
  );
}
