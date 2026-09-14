"use client";

import { useRef, useState } from "react";
import { Card, SectionTitle } from "@/components/ui";
import { useAppData } from "@/lib/data/AppDataContext";
import type { BackupData } from "@/lib/data/AppDataContext";
import { parseBackupJson } from "@/lib/data/parseBackup";
import { downloadFile } from "@/lib/download";

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
  const { exportData, importData } = useAppData();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [message, setMessage] = useState<string | null>(null);

  function handleExportJson() {
    const backup = exportData();
    downloadFile(
      `nvda-simulator-backup-${new Date().toISOString().slice(0, 10)}.json`,
      JSON.stringify(backup, null, 2),
      "application/json"
    );
  }

  function handleExportCsv() {
    const backup = exportData();
    downloadFile(
      `nvda-simulator-transactions-${new Date().toISOString().slice(0, 10)}.csv`,
      toCsv(backup),
      "text/csv"
    );
  }

  async function handleImportFile(file: File) {
    setMessage(null);
    try {
      const text = await file.text();
      const data = parseBackupJson(text);
      importData(data);
      setMessage("복구가 완료되었습니다. (기존 데이터와 id가 겹치는 항목은 건너뛰었습니다)");
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "복구 중 오류가 발생했습니다.");
    } finally {
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  return (
    <Card>
      <SectionTitle>데이터 백업</SectionTitle>
      <p className="mb-3 text-xs text-neutral-500">
        모든 매수/매도 기록과 설정을 JSON으로 내려받아 이 기기 밖에도 보관하세요 (데이터는
        브라우저에만 저장되어 있어 브라우저 데이터를 지우면 사라집니다). 복구 시 같은 파일을
        다시 업로드하면 됩니다 (이미 있는 항목은 중복 저장되지 않습니다).
      </p>
      <div className="grid grid-cols-2 gap-3">
        <button
          onClick={handleExportJson}
          className="rounded-xl bg-neutral-700 py-2.5 text-sm font-medium text-white"
        >
          JSON 백업 다운로드
        </button>
        <button
          onClick={handleExportCsv}
          className="rounded-xl bg-neutral-700 py-2.5 text-sm font-medium text-white"
        >
          CSV로 내보내기
        </button>
      </div>
      <button
        onClick={() => fileInputRef.current?.click()}
        className="mt-3 w-full rounded-xl bg-neutral-800 py-2.5 text-sm font-medium text-neutral-300 ring-1 ring-neutral-700"
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
