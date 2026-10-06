"use client";

import { Card, SectionTitle } from "@/components/ui";
import {
  cloneBaselineBuyLots,
  cloneBaselinePortfolioSettings,
  cloneBaselineSellTransactions,
} from "@/data/nvdaBaseline";
import { markInitialized, saveBuyLots, savePortfolioSettings, saveSellTransactions, writeStorageBackupSnapshot } from "@/lib/data/localStore";

/**
 * Secondary/manual escape hatch back to the known-good baseline (see
 * src/data/nvdaBaseline.ts) — not required for normal use, since a fresh or
 * wiped browser already auto-adopts the baseline on load (AppDataContext).
 * This is for the case where storage ISN'T empty but has drifted wrong and
 * the user wants to manually snap back. Always backs up first, then forces
 * a full reload so AppDataContext mounts fresh against the new data.
 */
export default function RestoreBaselineButton() {
  function handleRestore() {
    if (
      !confirm(
        "현재 데이터를 백업한 뒤, 코드에 저장된 기준 데이터(gross 2,631주 + 실제 매도 2건)로 되돌립니다. 계속할까요?"
      )
    ) {
      return;
    }
    writeStorageBackupSnapshot();
    saveBuyLots(cloneBaselineBuyLots());
    saveSellTransactions(cloneBaselineSellTransactions());
    savePortfolioSettings(cloneBaselinePortfolioSettings());
    markInitialized();
    window.location.replace("/");
  }

  return (
    <Card>
      <SectionTitle>기준 데이터로 복원</SectionTitle>
      <p className="mb-3 text-xs text-neutral-500">
        코드에 저장된 확정 기준 데이터(gross 매수 2,631주 + 실제 매도 2건, 현재 보유 2,105주
        상태)로 되돌립니다. 적용 전 현재 데이터를 자동 백업합니다.
      </p>
      <button
        onClick={handleRestore}
        className="w-full rounded-xl bg-neutral-700 py-2.5 text-sm font-medium text-white"
      >
        코드에 저장된 기준 데이터로 복원
      </button>
    </Card>
  );
}
