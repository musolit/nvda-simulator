"use client";

import { useState } from "react";
import { Card, SectionTitle } from "@/components/ui";
import { useAppData } from "@/lib/data/AppDataContext";
import { addBuyLot, addSellTransaction } from "@/lib/data/repository";
import { parseKakaoFillText, suggestedDefaultSelection, type ParsedFill } from "@/lib/kakaoParser";

interface DraftRow extends ParsedFill {
  included: boolean;
  editedFxRate: string;
}

export default function KakaoImport() {
  const { user, refresh } = useAppData();
  const [text, setText] = useState("");
  const [rows, setRows] = useState<DraftRow[] | null>(null);
  const [saving, setSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState<string | null>(null);

  function handleParse() {
    const parsed = parseKakaoFillText(text);
    const defaultSelected = suggestedDefaultSelection(parsed);
    setRows(
      parsed.map((fill) => ({
        ...fill,
        included: defaultSelected.has(fill.key),
        editedFxRate: "",
      }))
    );
    setSaveMessage(null);
  }

  function updateRow(key: string, patch: Partial<DraftRow>) {
    setRows((prev) => prev?.map((r) => (r.key === key ? { ...r, ...patch } : r)) ?? null);
  }

  async function handleSave() {
    if (!rows || !user) return;
    const toSave = rows.filter((r) => r.included);
    const problems: string[] = [];
    for (const r of toSave) {
      if (r.side === "unknown") problems.push("매수/매도가 확인되지 않은 항목이 있습니다.");
      if (!r.date) problems.push("날짜가 없는 항목이 있습니다.");
      if (!r.quantity || r.quantity <= 0) problems.push("수량이 없는 항목이 있습니다.");
      if (!r.pricePerShareUsd || r.pricePerShareUsd <= 0) problems.push("체결가가 없는 항목이 있습니다.");
      if (r.side === "sell" && (!Number(r.editedFxRate) || Number(r.editedFxRate) <= 0)) {
        problems.push("매도 항목에는 당시 환율을 입력해야 합니다.");
      }
    }
    if (problems.length > 0) {
      setSaveMessage(Array.from(new Set(problems)).join(" / "));
      return;
    }

    setSaving(true);
    setSaveMessage(null);
    try {
      for (const r of toSave) {
        if (r.side === "buy") {
          await addBuyLot(user.id, {
            date: r.date,
            quantity: r.quantity!,
            pricePerShareUsd: r.pricePerShareUsd!,
            source: "kakao_import",
          });
        } else if (r.side === "sell") {
          await addSellTransaction(user.id, {
            date: r.date!,
            quantity: r.quantity!,
            pricePerShareUsd: r.pricePerShareUsd!,
            fxRate: Number(r.editedFxRate),
          });
        }
      }
      await refresh();
      setSaveMessage(`${toSave.length}건 저장했습니다.`);
      setRows(null);
      setText("");
    } catch (e) {
      setSaveMessage(e instanceof Error ? e.message : "저장 중 오류가 발생했습니다.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Card>
      <SectionTitle>카카오톡 체결알림 가져오기</SectionTitle>
      <p className="mb-3 text-xs text-neutral-500">
        키움증권 체결 알림 텍스트를 붙여넣고 파싱하세요. 바로 저장되지 않고, 미리보기에서 확인 후
        선택한 항목만 저장됩니다. 부분체결/중복은 자동으로 경고 표시되며 직접 확인해야 합니다.
      </p>
      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        rows={6}
        placeholder={"[키움증권 체결 안내]\n▶종목명: 엔비디아(NVDA)\n▶매수수량: 77주\n▶잔량: 0주\n▶체결단가: USD 176.0100"}
        className="w-full rounded-xl bg-neutral-800/70 p-3 text-xs text-white ring-1 ring-neutral-700 outline-none focus:ring-emerald-500"
      />
      <button
        onClick={handleParse}
        disabled={!text.trim()}
        className="mt-2 w-full rounded-xl bg-neutral-700 py-2.5 text-sm font-medium text-white disabled:opacity-40"
      >
        텍스트 파싱
      </button>

      {rows && (
        <div className="mt-4 space-y-2">
          {rows.length === 0 && (
            <p className="text-sm text-neutral-500">인식할 수 있는 체결 알림을 찾지 못했습니다.</p>
          )}
          {rows.map((r) => (
            <div key={r.key} className="rounded-lg bg-neutral-800/50 p-3">
              <label className="flex items-start gap-2">
                <input
                  type="checkbox"
                  checked={r.included}
                  onChange={(e) => updateRow(r.key, { included: e.target.checked })}
                  className="mt-1"
                />
                <div className="flex-1 text-xs">
                  <div className="flex items-center gap-2 text-sm text-white">
                    <span>{r.side === "buy" ? "매수" : r.side === "sell" ? "매도" : "확인필요"}</span>
                    <span className="text-neutral-500">·</span>
                    <span>{r.kind === "final" ? "최종체결" : r.kind === "partial" ? "부분체결" : "확인필요"}</span>
                  </div>
                  <div className="mt-1 grid grid-cols-2 gap-x-3 gap-y-1 text-neutral-400">
                    <span>날짜: {r.date ?? "미확인"}</span>
                    <span>수량: {r.quantity ?? "-"}주</span>
                    <span>체결가: {r.pricePerShareUsd ?? "-"} USD</span>
                    <span>잔량: {r.remainingQuantity ?? "-"}주</span>
                  </div>
                  {r.side === "sell" && (
                    <input
                      type="number"
                      placeholder="당시 환율 입력 (예: 1400)"
                      value={r.editedFxRate}
                      onChange={(e) => updateRow(r.key, { editedFxRate: e.target.value })}
                      className="mt-2 w-full rounded-lg bg-neutral-900 px-2 py-1.5 text-xs text-white ring-1 ring-neutral-700"
                    />
                  )}
                  {r.warnings.length > 0 && (
                    <ul className="mt-1.5 space-y-0.5">
                      {r.warnings.map((w, i) => (
                        <li key={i} className="text-amber-400">
                          ⚠ {w}
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </label>
            </div>
          ))}
          {rows.length > 0 && (
            <button
              onClick={handleSave}
              disabled={saving || rows.every((r) => !r.included)}
              className="w-full rounded-xl bg-emerald-500 py-2.5 text-sm font-medium text-neutral-950 disabled:opacity-40"
            >
              {saving ? "저장 중..." : `선택한 항목 최종 저장 (${rows.filter((r) => r.included).length}건)`}
            </button>
          )}
        </div>
      )}
      {saveMessage && <p className="mt-2 text-xs text-neutral-300">{saveMessage}</p>}
    </Card>
  );
}
