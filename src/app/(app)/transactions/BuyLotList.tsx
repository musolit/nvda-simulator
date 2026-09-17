"use client";

import { useState } from "react";
import { Card, NumberField, SectionTitle } from "@/components/ui";
import { useAppData } from "@/lib/data/AppDataContext";
import { computeLotStatuses } from "@/lib/fifo";
import { formatDate, formatShares, formatUsd } from "@/lib/format";
import type { BuyLot, LotStatus } from "@/lib/types";

const SOURCE_LABEL: Record<BuyLot["source"], string> = {
  confirmed: "확정(카톡 체결내역)",
  kakao_import: "카톡 가져오기",
  manual: "직접 입력",
};

export default function BuyLotList() {
  const { allBuyLots, remainingLots, deleteBuyLot } = useAppData();
  const [editingId, setEditingId] = useState<string | null>(null);

  // FIFO order (dated lots ascending, adjustment lot always last) — same
  // order the app actually consumes lots in, so this list doubles as the
  // "잔여 매수 물량 확인" detail view.
  const statuses = computeLotStatuses(allBuyLots, remainingLots);

  return (
    <Card>
      <SectionTitle>매수 lot 목록 ({allBuyLots.length}건)</SectionTitle>
      <div className="space-y-2">
        {statuses.map((status) =>
          editingId === status.lot.id ? (
            <EditBuyLotRow key={status.lot.id} lot={status.lot} onDone={() => setEditingId(null)} />
          ) : (
            <LotRow
              key={status.lot.id}
              status={status}
              onEdit={() => setEditingId(status.lot.id)}
              onDelete={() => {
                if (!confirm("이 매수 lot을 삭제하시겠습니까?")) return;
                deleteBuyLot(status.lot.id);
              }}
            />
          )
        )}
        {statuses.length === 0 && <p className="text-sm text-neutral-500">등록된 매수 lot이 없습니다.</p>}
      </div>
    </Card>
  );
}

function LotRow({
  status,
  onEdit,
  onDelete,
}: {
  status: LotStatus;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const { lot, originalQuantity, soldQuantity, remainingQuantity, isExhausted } = status;

  return (
    <div className="rounded-lg bg-neutral-800/40 px-3 py-2 text-sm">
      <div className="flex items-center justify-between">
        <div>
          <p className={lot.isAdjustment ? "text-amber-400" : "text-white"}>
            {lot.isAdjustment ? "미확인 조정분" : formatDate(lot.date)}
          </p>
          <p className="text-xs text-neutral-500">
            {formatShares(lot.quantity)} × {formatUsd(lot.pricePerShareUsd)} · {SOURCE_LABEL[lot.source]}
          </p>
        </div>
        <div className="flex gap-2 text-xs">
          <button onClick={onEdit} className="rounded-full px-2.5 py-1 text-neutral-400 ring-1 ring-neutral-700">
            수정
          </button>
          <button onClick={onDelete} className="rounded-full px-2.5 py-1 text-red-400 ring-1 ring-red-500/30">
            삭제
          </button>
        </div>
      </div>

      <div className="mt-2 flex items-center gap-2 border-t border-neutral-800 pt-2 text-xs text-neutral-400">
        <span>
          최초 {formatShares(originalQuantity)} · 매도 차감 {formatShares(soldQuantity)} · 잔여{" "}
          <span className="font-medium text-neutral-200">{formatShares(remainingQuantity)}</span>
        </span>
        {isExhausted && (
          <span className="shrink-0 rounded-full bg-neutral-700 px-2 py-0.5 text-[11px] text-neutral-300">
            소진됨
          </span>
        )}
      </div>

      {lot.isAdjustment && (
        <p className="mt-2 text-[11px] leading-relaxed text-amber-300/80">
          이 {formatShares(originalQuantity)}는 실제 취득일·취득가가 확인되지 않은 조정분입니다.
          FIFO 계산상 항상 맨 뒤에 배치되는 것은 &quot;실제 체결 순서가 가장 나중&quot;이라는
          확정된 사실이 아니라 계산상의 가정이며, 표시된 단가도 역산된 추정값입니다.
          {soldQuantity > 0 && (
            <>
              {" "}
              이미 {formatShares(soldQuantity)}가 매도로 차감되어, 해당 매도의 취득원가·실현이익
              계산 결과도 이 추정에 의존합니다. 정확한 계산을 위해서는 이 물량의 실제 매수일과
              매수가(체결내역)를 확인해 직접 입력해주세요.
            </>
          )}
        </p>
      )}
    </div>
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
