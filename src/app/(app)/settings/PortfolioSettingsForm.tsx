"use client";

import { useState } from "react";
import { Card, NumberField, SectionTitle } from "@/components/ui";
import { useAppData } from "@/lib/data/AppDataContext";
import { formatShares } from "@/lib/format";

export default function PortfolioSettingsForm() {
  const { portfolioSettings, remainingQuantity, updatePortfolioSettings } = useAppData();
  const [qty, setQty] = useState(String(portfolioSettings.brokerQuantity));
  const [avgPrice, setAvgPrice] = useState(String(portfolioSettings.brokerAvgPriceUsd));
  const [saved, setSaved] = useState(false);

  function handleSave() {
    updatePortfolioSettings({
      brokerQuantity: Math.floor(Number(qty)),
      brokerAvgPriceUsd: Number(avgPrice),
    });
    setSaved(true);
    setTimeout(() => setSaved(false), 1500);
  }

  return (
    <Card>
      <SectionTitle>계좌 기준값 (키움증권 표시값)</SectionTitle>
      <p className="mb-3 text-xs text-neutral-500">
        대시보드의 현재 보유수량·평균매입가는 항상 이 값을 최우선으로 표시합니다. 실제 매매 후
        키움 화면을 보고 이 값을 갱신해주세요.
      </p>
      <div className="grid grid-cols-2 gap-3">
        <NumberField label="보유수량" value={qty} onChange={setQty} suffix="주" step="1" />
        <NumberField label="평균매입가" value={avgPrice} onChange={setAvgPrice} suffix="USD" />
      </div>
      <p className="mt-2 text-xs text-neutral-500">
        거래내역(lot) 기준 보유수량: {formatShares(remainingQuantity)}
      </p>
      <button
        onClick={handleSave}
        className="mt-3 w-full rounded-xl bg-neutral-700 py-2.5 text-sm font-medium text-white"
      >
        {saved ? "저장됨" : "저장"}
      </button>
    </Card>
  );
}
