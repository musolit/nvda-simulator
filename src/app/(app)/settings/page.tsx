"use client";

import TopBar from "../TopBar";
import PortfolioSettingsForm from "./PortfolioSettingsForm";
import TaxSettingsForm from "./TaxSettingsForm";
import BackupSection from "./BackupSection";
import DangerZone from "./DangerZone";

export default function SettingsPage() {
  return (
    <>
      <TopBar title="설정" />
      <div className="space-y-4 p-4">
        <PortfolioSettingsForm />
        <TaxSettingsForm />
        <BackupSection />
        <DangerZone />
      </div>
    </>
  );
}
