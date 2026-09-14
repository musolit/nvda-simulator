"use client";

import { useRef, useState } from "react";
import { Card, SectionTitle } from "@/components/ui";
import { useAppData } from "@/lib/data/AppDataContext";
import { exportBackup, importBackup, type BackupData } from "@/lib/data/repository";

function downloadFile(filename: string, content: string, mime: string) {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

function toCsv(backup: BackupData): string {
  const header = "type,date,quantity,price_usd,fx_rate,is_adjustment,source,note";
  const lines = [
    ...backup.buyLots.map((l) =>
      [
        "buy",
        l.date ?? "",
        l.quantity,
        l.pricePerShareUsd,
        "",
        l.isAdjustment ? "true" : "false",
        l.source,
        (l.note ?? "").replace(/,/g, " "),
      ].join(",")
    ),
    ...backup.sellTransactions.map((s) =>
      ["sell", s.date, s.quantity, s.pricePerShareUsd, s.fxRate, "false", "manual", (s.note ?? "").replace(/,/g, " ")].join(",")
    ),
  ];
  return [header, ...lines].join("\n");
}

export default function BackupSection() {
  const { user, refresh } = useAppData();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  async function handleExportJson() {
    setBusy(true);
    try {
      const backup = await exportBackup();
      downloadFile(
        `nvda-simulator-backup-${new Date().toISOString().slice(0, 10)}.json`,
        JSON.stringify(backup, null, 2),
        "application/json"
      );
    } finally {
      setBusy(false);
    }
  }

  async function handleExportCsv() {
    setBusy(true);
    try {
      const backup = await exportBackup();
      downloadFile(
        `nvda-simulator-transactions-${new Date().toISOString().slice(0, 10)}.csv`,
        toCsv(backup),
        "text/csv"
      );
    } finally {
      setBusy(false);
    }
  }

  async function handleImportFile(file: File) {
    if (!user) return;
    setBusy(true);
    setMessage(null);
    try {
      const text = await file.text();
      const data = JSON.parse(text) as BackupData;
      if (!Array.isArray(data.buyLots) || !Array.isArray(data.sellTransactions)) {
        throw new Error("올바른 백업 파일이 아닙니다.");
      }
      await importBackup(user.id, data);
      await refresh();
      setMessage("복구가 완료되었습니다. (기존 데이터와 id가 겹치는 항목은 건너뛰었습니다)");
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "복구 중 오류가 발생했습니다.");
    } finally {
      setBusy(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  return (
    <Card>
      <SectionTitle>데이터 백업</SectionTitle>
      <p className="mb-3 text-xs text-neutral-500">
        모든 매수/매도 기록과 설정을 JSON으로 내려받아 보관하세요. 복구 시 같은 파일을 다시
        업로드하면 됩니다 (이미 있는 항목은 중복 저장되지 않습니다).
      </p>
      <div className="grid grid-cols-2 gap-3">
        <button
          onClick={handleExportJson}
          disabled={busy}
          className="rounded-xl bg-neutral-700 py-2.5 text-sm font-medium text-white disabled:opacity-40"
        >
          JSON 백업 다운로드
        </button>
        <button
          onClick={handleExportCsv}
          disabled={busy}
          className="rounded-xl bg-neutral-700 py-2.5 text-sm font-medium text-white disabled:opacity-40"
        >
          CSV로 내보내기
        </button>
      </div>
      <button
        onClick={() => fileInputRef.current?.click()}
        disabled={busy}
        className="mt-3 w-full rounded-xl bg-neutral-800 py-2.5 text-sm font-medium text-neutral-300 ring-1 ring-neutral-700 disabled:opacity-40"
      >
        JSON 백업 파일로 복구
      </button>
      <input
        ref={fileInputRef}
        type="file"
        accept="application/json"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) handleImportFile(file);
        }}
      />
      {message && <p className="mt-2 text-xs text-neutral-300">{message}</p>}
    </Card>
  );
}
