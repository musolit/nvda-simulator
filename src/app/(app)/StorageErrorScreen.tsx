"use client";

import { useState } from "react";
import Link from "next/link";
import { Card } from "@/components/ui";
import { useAppData } from "@/lib/data/AppDataContext";
import { downloadFile } from "@/lib/download";

/**
 * Shown when one or more of this app's own storage keys exist but could not
 * be safely read (unparseable JSON, or the storage API itself threw — see
 * getStartupStorageStatus's "corrupt" case in localStore.ts). Replaces the
 * old behavior of silently falling through to the empty onboarding screen
 * on any read error. Nothing is removed automatically — every action here
 * is explicit and backs up first.
 */
export default function StorageErrorScreen({
  issues,
}: {
  issues: Array<{ key: string; raw: string | null; error: string }>;
}) {
  const { retryStorageRead, clearCorruptKeyAndContinue } = useAppData();
  const [confirmingKey, setConfirmingKey] = useState<string | null>(null);

  function handleDownloadRaw(key: string, raw: string | null) {
    downloadFile(
      `${key.replace(/[:]/g, "_")}-raw-${new Date().toISOString().slice(0, 10)}.txt`,
      raw ?? "",
      "text/plain"
    );
  }

  async function handleCopyRaw(raw: string | null) {
    try {
      await navigator.clipboard.writeText(raw ?? "");
    } catch {
      // clipboard API unavailable — download is still offered below
    }
  }

  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-lg flex-col justify-center px-4 py-10">
      <div className="mb-6 text-center">
        <p className="text-xs font-medium tracking-wide text-red-400">저장 데이터 읽기 오류</p>
        <h1 className="mt-1 text-xl font-semibold text-white">
          기존 저장 데이터를 읽는 중 문제가 발생했습니다.
        </h1>
        <p className="mt-2 text-sm text-neutral-400">
          데이터가 삭제된 것은 아닙니다. 아래 항목을 복구하거나, 원본을 내려받은 뒤 직접
          확인할 수 있습니다.
        </p>
      </div>

      <div className="space-y-3">
        {issues.map((issue) => (
          <Card key={issue.key}>
            <p className="text-xs font-medium text-neutral-400">key: {issue.key}</p>
            <p className="mt-1 text-xs text-red-400">{issue.error}</p>
            {issue.raw !== null && (
              <p className="mt-1 text-xs text-neutral-500">원본 길이: {issue.raw.length}자</p>
            )}

            <div className="mt-3 grid grid-cols-2 gap-2">
              <button
                onClick={() => handleCopyRaw(issue.raw)}
                disabled={issue.raw === null}
                className="rounded-xl bg-neutral-800 py-2 text-xs font-medium text-neutral-300 ring-1 ring-neutral-700 disabled:opacity-40"
              >
                원본 JSON 복사
              </button>
              <button
                onClick={() => handleDownloadRaw(issue.key, issue.raw)}
                disabled={issue.raw === null}
                className="rounded-xl bg-neutral-700 py-2 text-xs font-medium text-white disabled:opacity-40"
              >
                백업 JSON 다운로드
              </button>
            </div>

            {confirmingKey === issue.key ? (
              <div className="mt-3 rounded-lg bg-red-950/40 p-3 ring-1 ring-red-900">
                <p className="text-xs text-red-300">
                  이 항목만 백업 후 비우고 진행합니다. 위에서 원본을 먼저 복사/다운로드했는지
                  확인하세요.
                </p>
                <div className="mt-2 grid grid-cols-2 gap-2">
                  <button
                    onClick={() => setConfirmingKey(null)}
                    className="rounded-lg bg-neutral-800 py-2 text-xs text-neutral-300"
                  >
                    취소
                  </button>
                  <button
                    onClick={() => {
                      clearCorruptKeyAndContinue(issue.key);
                      setConfirmingKey(null);
                    }}
                    className="rounded-lg bg-red-600 py-2 text-xs font-medium text-white"
                  >
                    백업 후 이 항목 비우기
                  </button>
                </div>
              </div>
            ) : (
              <button
                onClick={() => setConfirmingKey(issue.key)}
                className="mt-3 w-full text-center text-xs text-neutral-500 underline underline-offset-2"
              >
                이 항목을 비우고 진행 (먼저 백업됨)
              </button>
            )}
          </Card>
        ))}
      </div>

      <button
        onClick={retryStorageRead}
        className="mt-4 w-full rounded-xl bg-emerald-500 py-2.5 text-sm font-medium text-neutral-950"
      >
        다시 시도
      </button>

      <Link
        href="/diagnostics"
        className="mt-4 text-center text-xs text-neutral-500 underline underline-offset-2"
      >
        저장 데이터 진단 화면에서 전체 보기
      </Link>
    </div>
  );
}
