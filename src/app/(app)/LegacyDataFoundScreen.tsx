"use client";

import { useState } from "react";
import Link from "next/link";
import { Card } from "@/components/ui";
import { useAppData } from "@/lib/data/AppDataContext";
import { downloadFile } from "@/lib/download";
import { formatShares, formatUsd } from "@/lib/format";

/**
 * Shown when the app detects it was never marked "initialized" but real
 * data already exists under this app's own storage keys (see
 * getStartupStorageStatus's "legacy-found" case in localStore.ts) — e.g. the
 * initialized flag alone was lost while buyLots/sellTransactions/
 * portfolioSettings stayed intact. Never auto-recovers; the user explicitly
 * chooses what happens next, and nothing is written until they do.
 */
export default function LegacyDataFoundScreen() {
  const { allBuyLots, sellTransactions, portfolioSettings, exportData, recoverLegacyData } =
    useAppData();
  const [showPreview, setShowPreview] = useState(false);

  function handleDownloadBackup() {
    const backup = exportData();
    downloadFile(
      `nvda-simulator-backup-${new Date().toISOString().slice(0, 10)}.json`,
      JSON.stringify(backup, null, 2),
      "application/json"
    );
  }

  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-lg flex-col justify-center px-4 py-10">
      <div className="mb-6 text-center">
        <p className="text-xs font-medium tracking-wide text-amber-400">데이터 확인 필요</p>
        <h1 className="mt-1 text-xl font-semibold text-white">기존 데이터가 발견되었습니다.</h1>
        <p className="mt-2 text-sm text-neutral-400">
          이 브라우저에 이미 저장된 매수/매도 기록이 있지만, 앱이 &quot;설정 완료&quot; 상태로
          표시되어 있지 않았습니다. 기존 데이터는 그대로 보존되어 있으며, 아무것도 자동으로
          덮어쓰지 않았습니다.
        </p>
      </div>

      <Card>
        <p className="mb-2 text-xs font-medium text-neutral-400">발견된 데이터 요약</p>
        <div className="space-y-1 text-sm text-neutral-300">
          <p>매수 lot {allBuyLots.length}건</p>
          <p>매도 기록 {sellTransactions.length}건</p>
          <p>
            설정값: 보유수량 {formatShares(portfolioSettings.brokerQuantity)}, 평균매입가{" "}
            {formatUsd(portfolioSettings.brokerAvgPriceUsd)}
          </p>
        </div>

        {showPreview && (
          <div className="mt-3 max-h-48 overflow-y-auto rounded-lg bg-neutral-800/60 p-3 text-xs text-neutral-300">
            <p className="mb-1 font-medium text-neutral-400">매수 lot</p>
            {allBuyLots.length === 0 ? (
              <p className="text-neutral-500">없음</p>
            ) : (
              allBuyLots.map((lot) => (
                <p key={lot.id}>
                  {lot.date ?? "날짜 미확인"} · {formatShares(lot.quantity)} ·{" "}
                  {formatUsd(lot.pricePerShareUsd)}
                </p>
              ))
            )}
            <p className="mt-2 mb-1 font-medium text-neutral-400">매도 기록</p>
            {sellTransactions.length === 0 ? (
              <p className="text-neutral-500">없음</p>
            ) : (
              sellTransactions.map((tx) => (
                <p key={tx.id}>
                  {tx.date} · {formatShares(tx.quantity)} · {formatUsd(tx.pricePerShareUsd)}
                </p>
              ))
            )}
          </div>
        )}

        <div className="mt-4 grid grid-cols-2 gap-2">
          <button
            onClick={() => setShowPreview((v) => !v)}
            className="rounded-xl bg-neutral-800 py-2.5 text-sm font-medium text-neutral-300 ring-1 ring-neutral-700"
          >
            {showPreview ? "미리보기 닫기" : "기존 데이터 미리보기"}
          </button>
          <button
            onClick={handleDownloadBackup}
            className="rounded-xl bg-neutral-700 py-2.5 text-sm font-medium text-white"
          >
            JSON 백업 다운로드
          </button>
        </div>

        <button
          onClick={recoverLegacyData}
          className="mt-3 w-full rounded-xl bg-emerald-500 py-2.5 text-sm font-medium text-neutral-950"
        >
          이 데이터를 현재 형식으로 복구
        </button>
        <p className="mt-2 text-center text-xs text-neutral-500">
          복구 전에 현재 저장된 모든 데이터를 별도의 타임스탬프 백업 key로 먼저 저장합니다.
        </p>
      </Card>

      <Link
        href="/diagnostics"
        className="mt-4 text-center text-xs text-neutral-500 underline underline-offset-2"
      >
        저장 데이터 진단 화면에서 자세히 보기 (취소하고 둘러보기)
      </Link>
    </div>
  );
}
