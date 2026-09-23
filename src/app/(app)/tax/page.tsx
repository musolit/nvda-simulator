"use client";

import { useMemo, useState } from "react";
import TopBar from "../TopBar";
import { useAppData } from "@/lib/data/AppDataContext";
import { Card, PillButton, SectionTitle, StatRow } from "@/components/ui";
import { formatDate, formatKrw, formatShares, formatUsd } from "@/lib/format";
import { computeYearlyTaxSummaries, computeYearlyTaxSummaryForYear } from "@/lib/simulate";
import type { TaxSettings } from "@/lib/types";

export default function TaxPage() {
  return (
    <>
      <TopBar title="연도별 실제 매도 세금" />
      <TaxContent />
    </>
  );
}

function TaxContent() {
  const { allBuyLots, sellTransactions, simulationSettings } = useAppData();
  const currentYear = new Date().getFullYear();
  const [selectedYear, setSelectedYear] = useState(currentYear);

  const taxSettings: TaxSettings = {
    annualDeductionKrw: simulationSettings.annualDeductionKrw,
    taxRatePercent: simulationSettings.taxRatePercent,
  };

  const availableYears = useMemo(() => {
    const years = computeYearlyTaxSummaries(allBuyLots, sellTransactions, taxSettings).map(
      (s) => s.taxYear
    );
    const withCurrent = new Set([...years, currentYear]);
    return Array.from(withCurrent).sort((a, b) => b - a);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [allBuyLots, sellTransactions, taxSettings.annualDeductionKrw, taxSettings.taxRatePercent, currentYear]);

  const summary = useMemo(
    () => computeYearlyTaxSummaryForYear(allBuyLots, sellTransactions, selectedYear, taxSettings),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [allBuyLots, sellTransactions, selectedYear, taxSettings.annualDeductionKrw, taxSettings.taxRatePercent]
  );

  return (
    <div className="space-y-4 p-4">
      <div className="flex flex-wrap gap-2">
        {availableYears.map((year) => (
          <PillButton key={year} active={year === selectedYear} onClick={() => setSelectedYear(year)}>
            {year}년
          </PillButton>
        ))}
      </div>

      <Card>
        <SectionTitle>{summary.taxYear}년 귀속 · {summary.paymentYear}년 5월 납부 예상</SectionTitle>
        <StatRow label="연간 실현손익 합계" value={formatKrw(summary.totalRealizedGainKrw)} />
        <StatRow label="기본공제" value={formatKrw(summary.annualDeductionKrw)} />
        <StatRow label="과세표준" value={formatKrw(summary.taxableBaseKrw)} />
        <StatRow
          label="예상 양도소득세 (지방소득세 포함)"
          value={formatKrw(summary.taxKrw)}
          valueClassName="text-red-400"
        />
      </Card>

      <Card>
        <SectionTitle>{summary.taxYear}년 실제 매도 내역 ({summary.sales.length}건)</SectionTitle>
        {summary.sales.length === 0 ? (
          <p className="text-sm text-neutral-500">이 연도에 등록된 실제 매도 기록이 없습니다.</p>
        ) : (
          <div className="space-y-2">
            {summary.sales.map((sale) => (
              <div
                key={sale.sellTransactionId}
                className="flex items-center justify-between rounded-lg bg-neutral-800/40 px-3 py-2 text-sm"
              >
                <div>
                  <p className="text-white">{formatDate(sale.date)}</p>
                  <p className="text-xs text-neutral-500">
                    {formatShares(sale.quantity)} · 매도대금 {formatUsd(sale.proceedsUsd)}
                  </p>
                </div>
                <p className="tabular-nums text-neutral-300">{formatKrw(sale.realizedGainKrw)}</p>
              </div>
            ))}
          </div>
        )}
      </Card>

      <Card className="text-xs text-neutral-500">
        실제 신고 세액과 차이가 날 수 있는 예상치입니다. 매수 시점의 세법상 원화 환율 기록이 없어
        각 매도 당시 입력한 환율을 기준으로 계산됩니다.
      </Card>
    </div>
  );
}
