"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Card, SectionTitle } from "@/components/ui";
import { downloadFile } from "@/lib/download";
import { STORAGE_PREFIX } from "@/lib/data/localStore";

/**
 * Standalone, read-only storage diagnostics page — deliberately placed
 * OUTSIDE the `(app)` route group (no AppDataProvider/AppShell) so it is
 * reachable no matter what state the main app's storage gate is in
 * (loading, onboarding, a recovery screen, or normal). This page never
 * calls any localStorage write function — it only inspects.
 */

interface KeyInfo {
  key: string;
  length: number;
  isAppKey: boolean;
  parse: "ok" | "invalid" | "empty";
  raw: string;
  fields?: {
    hasBrokerQuantity: boolean;
    hasBrokerAvgPriceUsd: boolean;
    buyLotsCount: number | null;
    sellTransactionsCount: number | null;
  };
}

function inspectKey(key: string): KeyInfo {
  const raw = window.localStorage.getItem(key) ?? "";
  const isAppKey = key.startsWith(STORAGE_PREFIX) || key.startsWith("nvda-simulator-backup-");

  if (raw.length === 0) {
    return { key, length: 0, isAppKey, parse: "empty", raw };
  }

  try {
    const parsed = JSON.parse(raw);
    const obj = typeof parsed === "object" && parsed !== null ? (parsed as Record<string, unknown>) : null;
    const portfolioSettings =
      obj && typeof obj.portfolioSettings === "object" && obj.portfolioSettings !== null
        ? (obj.portfolioSettings as Record<string, unknown>)
        : obj;
    const buyLots = obj?.buyLots ?? (Array.isArray(parsed) && key.includes("buyLots") ? parsed : undefined);
    const sellTransactions =
      obj?.sellTransactions ??
      (Array.isArray(parsed) && key.includes("sellTransactions") ? parsed : undefined);

    return {
      key,
      length: raw.length,
      isAppKey,
      parse: "ok",
      raw,
      fields: {
        hasBrokerQuantity: typeof portfolioSettings?.brokerQuantity === "number",
        hasBrokerAvgPriceUsd: typeof portfolioSettings?.brokerAvgPriceUsd === "number",
        buyLotsCount: Array.isArray(buyLots) ? buyLots.length : null,
        sellTransactionsCount: Array.isArray(sellTransactions) ? sellTransactions.length : null,
      },
    };
  } catch {
    return { key, length: raw.length, isAppKey, parse: "invalid", raw };
  }
}

export default function DiagnosticsPage() {
  const [origin, setOrigin] = useState("");
  const [keys, setKeys] = useState<KeyInfo[]>([]);
  const [revealedKey, setRevealedKey] = useState<string | null>(null);
  const [copyMessage, setCopyMessage] = useState<string | null>(null);

  function refresh() {
    setOrigin(window.location.origin);
    let allKeys: string[] = [];
    try {
      allKeys = Object.keys(window.localStorage);
    } catch {
      allKeys = [];
    }
    setKeys(allKeys.map(inspectKey).sort((a, b) => a.key.localeCompare(b.key)));
  }

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    refresh();
  }, []);

  async function handleCopy(raw: string) {
    try {
      await navigator.clipboard.writeText(raw);
      setCopyMessage("복사되었습니다.");
    } catch {
      setCopyMessage("클립보드 복사에 실패했습니다. 다운로드를 이용하세요.");
    }
    setTimeout(() => setCopyMessage(null), 2000);
  }

  function handleDownload(key: string, raw: string) {
    downloadFile(`${key.replace(/[:]/g, "_")}.json`, raw, "application/json");
  }

  function handleDownloadAll() {
    const dump: Record<string, string> = {};
    for (const k of keys) dump[k.key] = k.raw;
    downloadFile(
      `nvda-simulator-storage-dump-${new Date().toISOString().replace(/[:.]/g, "-")}.json`,
      JSON.stringify(dump, null, 2),
      "application/json"
    );
  }

  const appKeys = keys.filter((k) => k.isAppKey);
  const otherKeys = keys.filter((k) => !k.isAppKey);

  return (
    <div className="mx-auto w-full max-w-lg space-y-4 px-4 py-6">
      <div>
        <p className="text-xs font-medium tracking-wide text-emerald-400">READ ONLY</p>
        <h1 className="mt-1 text-xl font-semibold text-white">저장 데이터 진단</h1>
        <p className="mt-2 text-sm text-neutral-400">
          이 화면은 브라우저 localStorage를 읽기만 합니다. 아무 값도 수정하거나 삭제하지
          않습니다.
        </p>
      </div>

      <Card>
        <SectionTitle>현재 origin</SectionTitle>
        <p className="break-all text-sm text-white">{origin}</p>
        <p className="mt-1 text-xs text-neutral-500">
          localStorage는 origin(스킴+호스트+포트)별로 분리되어 있습니다. 배포 URL이 바뀌면
          (예: 프리뷰 배포마다 새 주소) 이전 데이터는 그 주소에만 남아 있고 새 주소에서는
          보이지 않습니다.
        </p>
      </Card>

      <Card>
        <div className="mb-2 flex items-center justify-between">
          <SectionTitle>NVDA 앱 관련 key ({appKeys.length}개)</SectionTitle>
          <button
            onClick={handleDownloadAll}
            className="text-xs text-emerald-400 underline underline-offset-2"
          >
            전체 백업 다운로드
          </button>
        </div>
        {appKeys.length === 0 ? (
          <p className="text-sm text-neutral-500">
            이 origin에는 NVDA 앱 관련 key가 하나도 없습니다.
          </p>
        ) : (
          <div className="space-y-3">
            {appKeys.map((info) => (
              <KeyCard
                key={info.key}
                info={info}
                revealed={revealedKey === info.key}
                onToggleReveal={() => setRevealedKey(revealedKey === info.key ? null : info.key)}
                onCopy={() => handleCopy(info.raw)}
                onDownload={() => handleDownload(info.key, info.raw)}
              />
            ))}
          </div>
        )}
      </Card>

      {otherKeys.length > 0 && (
        <Card>
          <SectionTitle>기타 localStorage key ({otherKeys.length}개)</SectionTitle>
          <p className="mb-2 text-xs text-neutral-500">
            이 origin의 다른 key들입니다. NVDA 앱과 관련 없어 보이지만, 참고용으로 함께
            표시합니다.
          </p>
          <div className="space-y-1 text-xs text-neutral-400">
            {otherKeys.map((info) => (
              <p key={info.key} className="break-all">
                {info.key} ({info.length}자)
              </p>
            ))}
          </div>
        </Card>
      )}

      {copyMessage && (
        <p className="text-center text-xs text-emerald-400">{copyMessage}</p>
      )}

      <button
        onClick={refresh}
        className="w-full rounded-xl bg-neutral-800 py-2.5 text-sm font-medium text-neutral-300 ring-1 ring-neutral-700"
      >
        다시 읽기
      </button>

      <Link href="/" className="block text-center text-xs text-neutral-500 underline underline-offset-2">
        앱으로 돌아가기
      </Link>
    </div>
  );
}

function KeyCard({
  info,
  revealed,
  onToggleReveal,
  onCopy,
  onDownload,
}: {
  info: KeyInfo;
  revealed: boolean;
  onToggleReveal: () => void;
  onCopy: () => void;
  onDownload: () => void;
}) {
  return (
    <div className="rounded-xl bg-neutral-800/50 p-3 ring-1 ring-neutral-800">
      <p className="break-all text-sm font-medium text-white">{info.key}</p>
      <div className="mt-1 flex flex-wrap gap-x-3 gap-y-0.5 text-xs text-neutral-400">
        <span>길이: {info.length}자</span>
        <span>
          JSON:{" "}
          {info.parse === "ok" ? (
            <span className="text-emerald-400">파싱 가능</span>
          ) : info.parse === "empty" ? (
            <span className="text-neutral-500">비어 있음</span>
          ) : (
            <span className="text-red-400">파싱 실패</span>
          )}
        </span>
      </div>

      {info.fields && (
        <div className="mt-1 flex flex-wrap gap-x-3 gap-y-0.5 text-xs text-neutral-500">
          <span>brokerQuantity: {info.fields.hasBrokerQuantity ? "있음" : "없음"}</span>
          <span>brokerAvgPriceUsd: {info.fields.hasBrokerAvgPriceUsd ? "있음" : "없음"}</span>
          <span>
            buyLots:{" "}
            {info.fields.buyLotsCount !== null ? `${info.fields.buyLotsCount}건` : "없음"}
          </span>
          <span>
            sellTransactions:{" "}
            {info.fields.sellTransactionsCount !== null
              ? `${info.fields.sellTransactionsCount}건`
              : "없음"}
          </span>
        </div>
      )}

      <div className="mt-2 grid grid-cols-3 gap-2">
        <button
          onClick={onToggleReveal}
          className="rounded-lg bg-neutral-800 py-1.5 text-xs text-neutral-300 ring-1 ring-neutral-700"
        >
          {revealed ? "원본 숨기기" : "원본 미리보기"}
        </button>
        <button
          onClick={onCopy}
          className="rounded-lg bg-neutral-800 py-1.5 text-xs text-neutral-300 ring-1 ring-neutral-700"
        >
          원본 JSON 복사
        </button>
        <button
          onClick={onDownload}
          className="rounded-lg bg-neutral-700 py-1.5 text-xs font-medium text-white"
        >
          백업 다운로드
        </button>
      </div>

      {revealed && (
        <pre className="mt-2 max-h-40 overflow-y-auto whitespace-pre-wrap break-all rounded-lg bg-neutral-950 p-2 text-[10px] text-neutral-400">
          {info.raw.slice(0, 5000)}
          {info.raw.length > 5000 ? "\n... (5000자 이후 생략, 다운로드로 전체 확인)" : ""}
        </pre>
      )}
    </div>
  );
}
