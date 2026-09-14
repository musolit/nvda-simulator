"use client";

import { useState } from "react";
import { Card, NumberField, SectionTitle } from "@/components/ui";
import { useAppData } from "@/lib/data/AppDataContext";

export default function BuyLotForm() {
  const { addBuyLot } = useAppData();
  const [date, setDate] = useState("");
  const [quantity, setQuantity] = useState("");
  const [price, setPrice] = useState("");
  const [saved, setSaved] = useState(false);

  const qty = Math.floor(Number(quantity));
  const priceNum = Number(price);
  const valid = date && qty > 0 && Number.isFinite(priceNum) && priceNum > 0;

  function handleSubmit() {
    if (!valid) return;
    addBuyLot({ date, quantity: qty, pricePerShareUsd: priceNum, source: "manual" });
    setDate("");
    setQuantity("");
    setPrice("");
    setSaved(true);
    setTimeout(() => setSaved(false), 1500);
  }

  return (
    <Card>
      <SectionTitle>매수 lot 추가</SectionTitle>
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
        <div className="grid grid-cols-2 gap-3">
          <NumberField label="수량" value={quantity} onChange={setQuantity} placeholder="10" suffix="주" step="1" />
          <NumberField label="체결가" value={price} onChange={setPrice} placeholder="50.00" suffix="USD" />
        </div>
        <button
          disabled={!valid}
          onClick={handleSubmit}
          className="w-full rounded-xl bg-emerald-500 py-2.5 text-sm font-medium text-neutral-950 disabled:opacity-40"
        >
          {saved ? "저장됨" : "매수 lot 저장"}
        </button>
      </div>
    </Card>
  );
}
