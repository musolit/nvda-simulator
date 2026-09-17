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
      <SectionTitle>계좌 기준값 (최초 설정 시점 참고값)</SectionTitle>
      <p className="mb-3 text-xs text-neutral-500">
        이 값은 최초 설정 당시 키움증권 화면을 보고 입력한 참고값으로, 미확인 조정분 lot을
        만들 때 기준으로 사용됩니다. 대시보드의 현재 보유수량·평균매입가는 이 값이 아니라
        매수·매도 거래내역을 기준으로 자동 계산되어 실시간으로 반영되므로, 실제 매매 후에는
        이 값을 갱신하지 않아도 됩니다.
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
