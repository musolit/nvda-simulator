"use client";

import Link from "next/link";
import TopBar from "../TopBar";
import PortfolioSettingsForm from "./PortfolioSettingsForm";
import TaxSettingsForm from "./TaxSettingsForm";
import BackupSection from "./BackupSection";
import RestoreBaselineButton from "./RestoreBaselineButton";
import DangerZone from "./DangerZone";

export default function SettingsPage() {
  return (
    <>
      <TopBar title="설정" />
      <div className="space-y-4 p-4">
        <PortfolioSettingsForm />
        <TaxSettingsForm />
        <BackupSection />
        <RestoreBaselineButton />
        <Link
          href="/diagnostics"
          className="block text-center text-xs text-neutral-500 underline underline-offset-2"
        >
          저장 데이터 진단 (read only)
        </Link>
        <DangerZone />
      </div>
    </>
  );
}
