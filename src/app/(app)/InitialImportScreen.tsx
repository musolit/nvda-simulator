"use client";

import { useRef, useState } from "react";
import { Card } from "@/components/ui";
import { useAppData } from "@/lib/data/AppDataContext";
import { parseBackupJson } from "@/lib/data/parseBackup";
import { IMPORT_TEMPLATE } from "@/lib/data/importTemplate";
import { downloadFile } from "@/lib/download";

export default function InitialImportScreen() {
  const { importData, skipInitialImport } = useAppData();
  const [text, setText] = useState("");
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  function handleDownloadTemplate() {
    downloadFile(
      "nvda-simulator-template.json",
      JSON.stringify(IMPORT_TEMPLATE, null, 2),
      "application/json"
    );
  }

  async function handleFileSelected(file: File) {
    const content = await file.text();
    setText(content);
    setError(null);
  }

  function handleImport() {
    setError(null);
    try {
      const data = parseBackupJson(text);
      importData(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : "가져오기에 실패했습니다.");
    }
  }

  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-lg flex-col justify-center px-4 py-10">
      <div className="mb-6 text-center">
        <p className="text-xs font-medium tracking-wide text-emerald-400">NVIDIA · NVDA</p>
        <h1 className="mt-1 text-xl font-semibold text-white">초기 데이터 가져오기</h1>
        <p className="mt-2 text-sm text-neutral-400">
          이 기기의 브라우저에만 데이터가 저장됩니다. 보유수량 · 평균매입가 · 매수 lot 정보를
          JSON으로 붙여넣거나 파일로 불러와 시작하세요.
        </p>
      </div>

      <Card>
        <div className="mb-3 flex items-center justify-between">
          <p className="text-xs font-medium text-neutral-400">JSON 데이터</p>
          <button onClick={handleDownloadTemplate} className="text-xs text-emerald-400 underline underline-offset-2">
            예시 템플릿 다운로드
          </button>
        </div>
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          rows={8}
          placeholder='{"portfolioSettings": {"brokerQuantity": 0, "brokerAvgPriceUsd": 0}, "buyLots": [...]}'
          className="w-full rounded-xl bg-neutral-800/70 p-3 text-xs text-white ring-1 ring-neutral-700 outline-none focus:ring-emerald-500"
        />
        <button
          onClick={() => fileInputRef.current?.click()}
          className="mt-2 w-full rounded-xl bg-neutral-800 py-2.5 text-sm font-medium text-neutral-300 ring-1 ring-neutral-700"
        >
          JSON 파일 선택
        </button>
        <input
          ref={fileInputRef}
          type="file"
          accept="application/json"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) handleFileSelected(file);
          }}
        />

        {error && <p className="mt-3 text-xs text-red-400">{error}</p>}

        <button
          onClick={handleImport}
          disabled={!text.trim()}
          className="mt-4 w-full rounded-xl bg-emerald-500 py-2.5 text-sm font-medium text-neutral-950 disabled:opacity-40"
        >
          가져오기
        </button>
      </Card>

      <button
        onClick={skipInitialImport}
        className="mt-4 text-center text-xs text-neutral-500 underline underline-offset-2"
      >
        나중에 하기 (빈 상태로 시작해서 직접 입력)
      </button>
    </div>
  );
}
