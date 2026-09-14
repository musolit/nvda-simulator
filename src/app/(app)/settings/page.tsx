"use client";

import PageState from "../PageState";
import TopBar from "../TopBar";
import { useAppData } from "@/lib/data/AppDataContext";
import { Card } from "@/components/ui";
import PortfolioSettingsForm from "./PortfolioSettingsForm";
import TaxSettingsForm from "./TaxSettingsForm";
import BackupSection from "./BackupSection";

export default function SettingsPage() {
  return (
    <>
      <TopBar title="설정" />
      <PageState>
        <div className="space-y-4 p-4">
          <AccountCard />
          <PortfolioSettingsForm />
          <TaxSettingsForm />
          <BackupSection />
        </div>
      </PageState>
    </>
  );
}

function AccountCard() {
  const { user } = useAppData();
  return (
    <Card className="text-sm">
      <p className="text-neutral-500">로그인 계정</p>
      <p className="mt-1 text-white">{user?.email}</p>
    </Card>
  );
}
