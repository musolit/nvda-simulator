"use client";

import { useState } from "react";
import { Card, NumberField, SectionTitle } from "@/components/ui";
import { useAppData } from "@/lib/data/AppDataContext";
import { formatDate, formatShares, formatUsd } from "@/lib/format";
import type { BuyLot } from "@/lib/types";

const SOURCE_LABEL: Record<BuyLot["source"], string> = {
  confirmed: "확정(카톡 체결내역)",
  kakao_import: "카톡 가져오기",
  manual: "직접 입력",
};

export default function BuyLotList() {
  const { allBuyLots, deleteBuyLot } = useAppData();
  const [editingId, setEditingId] = useState<string | null>(null);

  const sorted = [...allBuyLots].sort((a, b) => {
    if (a.isAdjustment !== b.isAdjustment) return a.isAdjustment ? 1 : -1;
    return (a.date ?? "").localeCompare(b.date ?? "");
  });

  return (
    <Card>
      <SectionTitle>매수 lot 목록 ({allBuyLots.length}건)</SectionTitle>
      <div className="space-y-2">
        {sorted.map((lot) =>
          editingId === lot.id ? (
            <EditBuyLotRow key={lot.id} lot={lot} onDone={() => setEditingId(null)} />
          ) : (
            <div
              key={lot.id}
              className="flex items-center justify-between rounded-lg bg-neutral-800/40 px-3 py-2 text-sm"
            >
              <div>
                <p className={lot.isAdjustment ? "text-amber-400" : "text-white"}>
                  {lot.isAdjustment ? "미확인 조정분" : formatDate(lot.date)}
                </p>
                <p className="text-xs text-neutral-500">
                  {formatShares(lot.quantity)} × {formatUsd(lot.pricePerShareUsd)} ·{" "}
                  {SOURCE_LABEL[lot.source]}
                </p>
              </div>
              <div className="flex gap-2 text-xs">
                <button
                  onClick={() => setEditingId(lot.id)}
                  className="rounded-full px-2.5 py-1 text-neutral-400 ring-1 ring-neutral-700"
                >
                  수정
                </button>
                <button
                  onClick={() => {
                    if (!confirm("이 매수 lot을 삭제하시겠습니까?")) return;
                    deleteBuyLot(lot.id);
                  }}
                  className="rounded-full px-2.5 py-1 text-red-400 ring-1 ring-red-500/30"
                >
                  삭제
                </button>
              </div>
            </div>
          )
        )}
        {sorted.length === 0 && <p className="text-sm text-neutral-500">등록된 매수 lot이 없습니다.</p>}
      </div>
    </Card>
  );
}

function EditBuyLotRow({ lot, onDone }: { lot: BuyLot; onDone: () => void }) {
  const { updateBuyLot } = useAppData();
  const [date, setDate] = useState(lot.date ?? "");
  const [quantity, setQuantity] = useState(String(lot.quantity));
  const [price, setPrice] = useState(String(lot.pricePerShareUsd));

  function handleSave() {
    updateBuyLot(lot.id, {
      date: lot.isAdjustment ? lot.date : date || null,
      quantity: Math.floor(Number(quantity)),
      pricePerShareUsd: Number(price),
    });
    onDone();
  }

  return (
    <div className="space-y-2 rounded-lg bg-neutral-800/60 p-3">
      {!lot.isAdjustment && (
        <input
          type="date"
          value={date}
          onChange={(e) => setDate(e.target.value)}
          className="w-full rounded-lg bg-neutral-900 px-3 py-2 text-sm text-white ring-1 ring-neutral-700"
        />
      )}
      <div className="grid grid-cols-2 gap-2">
        <NumberField label="수량" value={quantity} onChange={setQuantity} step="1" />
        <NumberField label="체결가" value={price} onChange={setPrice} />
      </div>
      <div className="flex gap-2">
        <button
          onClick={handleSave}
          className="flex-1 rounded-lg bg-emerald-500 py-2 text-xs font-medium text-neutral-950"
        >
          저장
        </button>
        <button onClick={onDone} className="flex-1 rounded-lg bg-neutral-700 py-2 text-xs text-neutral-300">
          취소
        </button>
      </div>
    </div>
  );
}
