"use client";

import { useState } from "react";
import Link from "next/link";
import { Card, SectionTitle, StatRow } from "@/components/ui";
import { downloadFile } from "@/lib/download";
import { formatKrw, formatShares, formatUsd } from "@/lib/format";
import { applyRealizedSells, summarizeHoldings, totalQuantity } from "@/lib/fifo";
import { computeYearlyTaxSummaryForYear } from "@/lib/simulate";
import {
  loadSimulationSettings,
  replaceBuyLotsAndSellTransactions,
  saveSimulationSettings,
  writeStorageBackupSnapshot,
} from "@/lib/data/localStore";
import type { BuyLot, SellTransaction } from "@/lib/types";

/**
 * Standalone, disaster-recovery page for when the CURRENTLY stored buyLots
 * no longer represent the true pre-sale (gross) lot set (e.g. only a
 * net-of-sales snapshot could be recovered after a storage loss). Unlike
 * the normal "JSON 백업 파일로 복구" import in Settings — which additively
 * merges by id and would double-count on top of a net snapshot — this page
 * WHOLESALE REPLACES buyLots + sellTransactions after a mandatory preview
 * and backup. Deliberately placed outside the `(app)` route group so it's
 * reachable no matter what state the main app's storage gate is in, same
 * as /diagnostics.
 */

interface ParsedInput {
  buyLots: BuyLot[];
  sellTransactions: SellTransaction[];
}

function parseRestoreJson(text: string): ParsedInput {
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    throw new Error("올바른 JSON 형식이 아닙니다.");
  }
  if (typeof raw !== "object" || raw === null) throw new Error("JSON 객체 형식이어야 합니다.");
  const data = raw as { buyLots?: unknown; sellTransactions?: unknown };

  if (!Array.isArray(data.buyLots)) throw new Error("buyLots 배열이 필요합니다.");
  const buyLots: BuyLot[] = data.buyLots.map((lot, i) => {
    const l = lot as Partial<BuyLot>;
    if (typeof l.id !== "string" || typeof l.quantity !== "number" || typeof l.pricePerShareUsd !== "number") {
      throw new Error(`buyLots[${i}]에 id, quantity, pricePerShareUsd가 필요합니다.`);
    }
    return {
      id: l.id,
      date: l.date ?? null,
      quantity: l.quantity,
      pricePerShareUsd: l.pricePerShareUsd,
      acquisitionFxRate: l.acquisitionFxRate ?? null,
      isAdjustment: Boolean(l.isAdjustment),
      source: l.source ?? "manual",
      note: l.note ?? null,
    };
  });

  if (!Array.isArray(data.sellTransactions)) throw new Error("sellTransactions 배열이 필요합니다.");
  const sellTransactions: SellTransaction[] = data.sellTransactions.map((tx, i) => {
    const t = tx as Partial<SellTransaction>;
    if (
      typeof t.id !== "string" ||
      typeof t.date !== "string" ||
      typeof t.quantity !== "number" ||
      typeof t.pricePerShareUsd !== "number" ||
      typeof t.fxRate !== "number"
    ) {
      throw new Error(`sellTransactions[${i}]에 id, date, quantity, pricePerShareUsd, fxRate가 필요합니다.`);
    }
    return { id: t.id, date: t.date, quantity: t.quantity, pricePerShareUsd: t.pricePerShareUsd, fxRate: t.fxRate, note: t.note ?? null };
  });

  return { buyLots, sellTransactions };
}

export default function RestorePage() {
  const [text, setText] = useState("");
  const [parsed, setParsed] = useState<ParsedInput | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [applied, setApplied] = useState<{ backupKey: string | null } | null>(null);
  const [resetPriorGain, setResetPriorGain] = useState(false);

  const currentSimSettings = loadSimulationSettings();

  function handlePreview() {
    setError(null);
    setApplied(null);
    try {
      setParsed(parseRestoreJson(text));
    } catch (e) {
      setParsed(null);
      setError(e instanceof Error ? e.message : "파싱에 실패했습니다.");
    }
  }

  function handleApply() {
    if (!parsed) return;
    const result = replaceBuyLotsAndSellTransactions(parsed.buyLots, parsed.sellTransactions);
    if (resetPriorGain) {
      saveSimulationSettings({ ...currentSimSettings, priorRealizedGainKrw: 0 });
    }
    setApplied(result);
  }

  function handleBackupNow() {
    const key = writeStorageBackupSnapshot();
    if (key) {
      const raw = window.localStorage.getItem(key) ?? "";
      downloadFile(`${key}.json`, raw, "application/json");
    }
  }

  const preview = parsed
    ? (() => {
        const grossTotal = totalQuantity(parsed.buyLots);
        const sellTotal = parsed.sellTransactions.reduce((s, t) => s + t.quantity, 0);
        const sellTransactionsCount = parsed.sellTransactions.length;
        const remainingLots = applyRealizedSells(parsed.buyLots, parsed.sellTransactions);
        const holdings = summarizeHoldings(remainingLots);
        const taxByYear = new Map<number, number>();
        for (const tx of parsed.sellTransactions) {
          const year = Number(tx.date.slice(0, 4));
          if (!taxByYear.has(year)) {
            const summary = computeYearlyTaxSummaryForYear(parsed.buyLots, parsed.sellTransactions, year, {
              annualDeductionKrw: currentSimSettings.annualDeductionKrw,
              taxRatePercent: currentSimSettings.taxRatePercent,
            });
            taxByYear.set(year, summary.taxKrw);
          }
        }
        return { grossTotal, sellTotal, sellTransactionsCount, remainingLots, holdings, taxByYear };
      })()
    : null;

  return (
    <div className="mx-auto w-full max-w-lg space-y-4 px-4 py-6">
      <div>
        <p className="text-xs font-medium tracking-wide text-red-400">전체 교체 복구 (위험)</p>
        <h1 className="mt-1 text-xl font-semibold text-white">매수 lot · 매도 기록 전체 교체</h1>
        <p className="mt-2 text-sm text-neutral-400">
          Settings의 &quot;JSON 백업 파일로 복구&quot;는 기존 항목에 추가(병합)만 합니다. 이
          페이지는 그와 달리 buyLots와 sellTransactions를 통째로 교체합니다 — 현재 저장된
          buyLots가 이미 매도 차감된 net 상태라 실제 매도 기록을 추가하면 FIFO가 이중으로
          차감되는 경우에만 사용하세요. 적용 전 항상 전체 백업을 먼저 생성합니다.
          portfolioSettings는 건드리지 않습니다.
        </p>
      </div>

      <Card>
        <SectionTitle>1. 지금 바로 백업</SectionTitle>
        <p className="mb-2 text-xs text-neutral-500">
          교체 전에 현재 저장된 전체 데이터를 타임스탬프 key로 백업하고 다운로드합니다.
        </p>
        <button
          onClick={handleBackupNow}
          className="w-full rounded-xl bg-neutral-700 py-2.5 text-sm font-medium text-white"
        >
          지금 백업 다운로드
        </button>
      </Card>

      <Card>
        <SectionTitle>2. 교체할 데이터 붙여넣기</SectionTitle>
        <p className="mb-2 text-xs text-neutral-500">
          형식: {"{"} &quot;buyLots&quot;: [...], &quot;sellTransactions&quot;: [...] {"}"}
        </p>
        <textarea
          value={text}
          onChange={(e) => {
            setText(e.target.value);
            setParsed(null);
            setApplied(null);
          }}
          rows={10}
          placeholder='{"buyLots": [...], "sellTransactions": [...]}'
          className="w-full rounded-xl bg-neutral-800/70 p-3 text-xs text-white ring-1 ring-neutral-700 outline-none focus:ring-emerald-500"
        />
        {error && <p className="mt-2 text-xs text-red-400">{error}</p>}
        <button
          onClick={handlePreview}
          disabled={!text.trim()}
          className="mt-3 w-full rounded-xl bg-neutral-800 py-2.5 text-sm font-medium text-neutral-300 ring-1 ring-neutral-700 disabled:opacity-40"
        >
          미리보기 계산
        </button>
      </Card>

      {preview && (
        <Card>
          <SectionTitle>3. 미리보기 (아직 저장되지 않음)</SectionTitle>
          <StatRow label="gross buyLots 합계" value={formatShares(preview.grossTotal)} />
          <StatRow label="sellTransactions" value={`${preview.sellTransactionsCount}건, ${formatShares(preview.sellTotal)}`} />
          <StatRow label="적용 후 예상 보유량" value={formatShares(totalQuantity(preview.remainingLots))} />
          <StatRow label="예상 FIFO 잔여 평균취득가" value={formatUsd(preview.holdings.averageCostUsd)} />
          {Array.from(preview.taxByYear.entries()).map(([year, tax]) => (
            <StatRow key={year} label={`${year}년 실제 매도 기준 예상세금 (현재 설정의 공제/세율 적용)`} value={formatKrw(tax)} />
          ))}

          <label className="mt-3 flex items-center gap-2 text-xs text-neutral-400">
            <input type="checkbox" checked={resetPriorGain} onChange={(e) => setResetPriorGain(e.target.checked)} />
            simulationSettings.priorRealizedGainKrw를 0으로 재설정 (현재 저장값:{" "}
            {formatKrw(currentSimSettings.priorRealizedGainKrw)}) — sellTransactions로 실현이익이
            자동 계산되므로, 복구 과정에서 임시로 넣어둔 값이 있다면 중복 반영을 막기 위해
            체크하세요.
          </label>

          {!applied ? (
            <button
              onClick={handleApply}
              className="mt-4 w-full rounded-xl bg-red-600 py-2.5 text-sm font-medium text-white"
            >
              백업 후 이 데이터로 교체 적용
            </button>
          ) : (
            <div className="mt-4 rounded-lg bg-emerald-950/40 p-3 text-xs text-emerald-300 ring-1 ring-emerald-900">
              <p>적용되었습니다.</p>
              {applied.backupKey && <p className="mt-1">교체 전 데이터 백업 key: {applied.backupKey}</p>}
              <Link href="/" className="mt-2 inline-block underline underline-offset-2">
                앱으로 돌아가서 확인하기 →
              </Link>
            </div>
          )}
        </Card>
      )}

      <Link href="/diagnostics" className="block text-center text-xs text-neutral-500 underline underline-offset-2">
        저장 데이터 진단으로 돌아가기
      </Link>
    </div>
  );
}
