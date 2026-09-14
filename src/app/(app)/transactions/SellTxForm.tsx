"use client";

import { useState } from "react";
import { Card, NumberField, SectionTitle } from "@/components/ui";
import { useAppData } from "@/lib/data/AppDataContext";
import { formatShares } from "@/lib/format";

export default function SellTxForm() {
  const { addSellTransaction, remainingQuantity } = useAppData();
  const [date, setDate] = useState("");
  const [quantity, setQuantity] = useState("");
  const [price, setPrice] = useState("");
  const [fx, setFx] = useState("");
  const [saved, setSaved] = useState(false);

  const qty = Math.floor(Number(quantity));
  const priceNum = Number(price);
  const fxNum = Number(fx);
  const exceedsHoldings = qty > remainingQuantity;
  const valid =
    date && qty > 0 && Number.isFinite(priceNum) && priceNum > 0 && Number.isFinite(fxNum) && fxNum > 0;

  function handleSubmit() {
    if (!valid) return;
    addSellTransaction({ date, quantity: qty, pricePerShareUsd: priceNum, fxRate: fxNum });
    setDate("");
    setQuantity("");
    setPrice("");
    setFx("");
    setSaved(true);
    setTimeout(() => setSaved(false), 1500);
  }

  return (
    <Card>
      <SectionTitle>실제 매도 기록</SectionTitle>
      <p className="mb-3 text-xs text-neutral-500">
        시뮬레이션이 아닌, 실제로 체결된 매도만 기록하세요. 저장 시 FIFO 기준으로 보유 lot이
        차감되고 올해 실현손익에 반영됩니다.
      </p>
      <div className="space-y-3">
        <label className="block">
          <span className="mb-1 block text-xs font-medium text-neutral-400">체결일</span>
          <input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className="w-full rounded-xl bg-neutral-800/70 px-3 py-2.5 text-sm text-white ring-1 ring-neutral-700 outline-none focus:ring-emerald-500"
          />
        </label>
        <div className="grid grid-cols-3 gap-3">
          <NumberField label="수량" value={quantity} onChange={setQuantity} placeholder="200" suffix="주" step="1" />
          <NumberField label="체결가" value={price} onChange={setPrice} placeholder="180" suffix="USD" />
          <NumberField label="당시 환율" value={fx} onChange={setFx} placeholder="1400" suffix="원" />
        </div>
        {exceedsHoldings && qty > 0 && (
          <p className="text-xs text-amber-400">
            현재 보유량({formatShares(remainingQuantity)})을 초과합니다.
          </p>
        )}
        <button
          disabled={!valid || exceedsHoldings}
          onClick={handleSubmit}
          className="w-full rounded-xl bg-red-500 py-2.5 text-sm font-medium text-white disabled:opacity-40"
        >
          {saved ? "저장됨" : "매도 기록 저장"}
        </button>
      </div>
    </Card>
  );
}
