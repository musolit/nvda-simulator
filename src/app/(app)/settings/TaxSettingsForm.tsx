"use client";

import { useState } from "react";
import { Card, NumberField, SectionTitle } from "@/components/ui";
import { useAppData } from "@/lib/data/AppDataContext";
import { updateSimulationSettings } from "@/lib/data/repository";
import { formatKrw } from "@/lib/format";

export default function TaxSettingsForm() {
  const { user, simulationSettings, yearRealizedGainFromSalesKrw, refresh } = useAppData();
  const [deduction, setDeduction] = useState(String(simulationSettings.annualDeductionKrw));
  const [taxRate, setTaxRate] = useState(String(simulationSettings.taxRatePercent * 100));
  const [otherGain, setOtherGain] = useState(String(simulationSettings.priorRealizedGainKrw));
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  async function handleSave() {
    if (!user) return;
    setSaving(true);
    setSaved(false);
    try {
      await updateSimulationSettings(user.id, {
        annualDeductionKrw: Number(deduction),
        taxRatePercent: Number(taxRate) / 100,
        priorRealizedGainKrw: Number(otherGain),
      });
      await refresh();
      setSaved(true);
    } finally {
      setSaving(false);
    }
  }

  return (
    <Card>
      <SectionTitle>세금 · 공제 설정</SectionTitle>
      <div className="grid grid-cols-2 gap-3">
        <NumberField label="연간 기본공제" value={deduction} onChange={setDeduction} suffix="원" />
        <NumberField label="예상 세율" value={taxRate} onChange={setTaxRate} suffix="%" />
      </div>
      <div className="mt-3">
        <NumberField
          label="올해 기타 실현손익 (NVDA 외, 직접 입력)"
          value={otherGain}
          onChange={setOtherGain}
          suffix="원"
        />
        <p className="mt-1 text-xs text-neutral-500">
          앱에 기록된 NVDA 매도의 올해 실현손익({formatKrw(yearRealizedGainFromSalesKrw)})은 자동
          합산됩니다. 이 항목은 앱에 기록하지 않은 다른 해외주식 실현손익이 있을 때만 입력하세요.
          2026년 기본값은 0원입니다.
        </p>
      </div>
      <button
        onClick={handleSave}
        disabled={saving}
        className="mt-3 w-full rounded-xl bg-neutral-700 py-2.5 text-sm font-medium text-white disabled:opacity-40"
      >
        {saving ? "저장 중..." : saved ? "저장됨" : "저장"}
      </button>
    </Card>
  );
}
