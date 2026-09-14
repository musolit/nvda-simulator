"use client";

import { useState } from "react";
import { Card, SectionTitle } from "@/components/ui";
import { useAppData } from "@/lib/data/AppDataContext";

export default function DangerZone() {
  const { resetAll } = useAppData();
  const [confirmText, setConfirmText] = useState("");
  const CONFIRM_WORD = "초기화";

  function handleReset() {
    resetAll();
  }

  return (
    <Card className="ring-red-500/30">
      <SectionTitle>위험 구역</SectionTitle>
      <p className="mb-3 text-xs text-neutral-500">
        이 기기에 저장된 모든 매수/매도 기록과 설정을 삭제합니다. 백업 파일이 없다면 복구할 수
        없습니다. 되돌릴 수 없으니 먼저 JSON 백업을 다운로드하는 것을 권장합니다.
      </p>
      <label className="mb-2 block text-xs text-neutral-400">
        확인을 위해 &quot;{CONFIRM_WORD}&quot;를 입력하세요
      </label>
      <input
        value={confirmText}
        onChange={(e) => setConfirmText(e.target.value)}
        placeholder={CONFIRM_WORD}
        className="mb-3 w-full rounded-xl bg-neutral-800/70 px-3 py-2.5 text-sm text-white ring-1 ring-neutral-700 outline-none focus:ring-red-500"
      />
      <button
        onClick={handleReset}
        disabled={confirmText !== CONFIRM_WORD}
        className="w-full rounded-xl bg-red-600 py-2.5 text-sm font-medium text-white disabled:opacity-40"
      >
        전체 데이터 초기화
      </button>
    </Card>
  );
}
