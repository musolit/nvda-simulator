"use client";

import { useMemo, useState } from "react";
import { Card, NumberField, SectionTitle } from "@/components/ui";
import { useAppData } from "@/lib/data/AppDataContext";
import { deleteSellTransaction, updateSellTransaction } from "@/lib/data/repository";
import { formatKrw, formatShares, formatUsd } from "@/lib/format";
import { computeRealizedSellHistory } from "@/lib/simulate";
import type { SellTransaction } from "@/lib/types";

export default function SellTxList() {
  const { allBuyLots, sellTransactions, refresh } = useAppData();
  const [editingId, setEditingId] = useState<string | null>(null);

  const history = useMemo(
    () => computeRealizedSellHistory(allBuyLots, sellTransactions),
    [allBuyLots, sellTransactions]
  );
  const gainById = new Map(history.map((h) => [h.sellTransactionId, h]));

  const sorted = [...sellTransactions].sort((a, b) => b.date.localeCompare(a.date));

  return (
    <Card>
      <SectionTitle>실제 매도 기록 ({sellTransactions.length}건)</SectionTitle>
      <div className="space-y-2">
        {sorted.map((tx) =>
          editingId === tx.id ? (
            <EditSellTxRow key={tx.id} tx={tx} onDone={() => setEditingId(null)} />
          ) : (
            <div key={tx.id} className="flex items-center justify-between rounded-lg bg-neutral-800/40 px-3 py-2 text-sm">
              <div>
                <p className="text-white">{tx.date}</p>
                <p className="text-xs text-neutral-500">
                  {formatShares(tx.quantity)} × {formatUsd(tx.pricePerShareUsd)} · 환율 {tx.fxRate}
                </p>
                {gainById.has(tx.id) && (
                  <p className="text-xs text-neutral-400">
                    실현손익 {formatKrw(gainById.get(tx.id)!.realizedGainKrw)}
                  </p>
                )}
              </div>
              <div className="flex gap-2 text-xs">
                <button
                  onClick={() => setEditingId(tx.id)}
                  className="rounded-full px-2.5 py-1 text-neutral-400 ring-1 ring-neutral-700"
                >
                  수정
                </button>
                <button
                  onClick={async () => {
                    if (!confirm("이 매도 기록을 삭제하시겠습니까? 보유 lot이 복원됩니다.")) return;
                    await deleteSellTransaction(tx.id);
                    await refresh();
                  }}
                  className="rounded-full px-2.5 py-1 text-red-400 ring-1 ring-red-500/30"
                >
                  삭제
                </button>
              </div>
            </div>
          )
        )}
        {sorted.length === 0 && <p className="text-sm text-neutral-500">등록된 매도 기록이 없습니다.</p>}
      </div>
    </Card>
  );
}

function EditSellTxRow({ tx, onDone }: { tx: SellTransaction; onDone: () => void }) {
  const { refresh } = useAppData();
  const [date, setDate] = useState(tx.date);
  const [quantity, setQuantity] = useState(String(tx.quantity));
  const [price, setPrice] = useState(String(tx.pricePerShareUsd));
  const [fx, setFx] = useState(String(tx.fxRate));
  const [saving, setSaving] = useState(false);

  async function handleSave() {
    setSaving(true);
    try {
      await updateSellTransaction(tx.id, {
        date,
        quantity: Math.floor(Number(quantity)),
        pricePerShareUsd: Number(price),
        fxRate: Number(fx),
      });
      await refresh();
      onDone();
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-2 rounded-lg bg-neutral-800/60 p-3">
      <input
        type="date"
        value={date}
        onChange={(e) => setDate(e.target.value)}
        className="w-full rounded-lg bg-neutral-900 px-3 py-2 text-sm text-white ring-1 ring-neutral-700"
      />
      <div className="grid grid-cols-3 gap-2">
        <NumberField label="수량" value={quantity} onChange={setQuantity} step="1" />
        <NumberField label="체결가" value={price} onChange={setPrice} />
        <NumberField label="환율" value={fx} onChange={setFx} />
      </div>
      <div className="flex gap-2">
        <button
          onClick={handleSave}
          disabled={saving}
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
