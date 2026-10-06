"use client";

import { useAppData } from "@/lib/data/AppDataContext";
import BottomNav from "./BottomNav";
import InitialImportScreen from "./InitialImportScreen";
import LegacyDataFoundScreen from "./LegacyDataFoundScreen";
import StorageErrorScreen from "./StorageErrorScreen";

/**
 * Gates the whole app on localStorage having loaded and the first-run
 * import (or skip) having happened. Individual pages don't need their own
 * loading/initialized checks — by the time they render, both are true.
 */
export default function AppShell({ children }: { children: React.ReactNode }) {
  const { loading, initialized, storageStatus } = useAppData();

  if (loading) {
    return (
      <div className="flex min-h-dvh items-center justify-center text-sm text-neutral-500">
        불러오는 중...
      </div>
    );
  }

  // A storage read error, or real data found with only the "initialized"
  // flag missing, must be resolved explicitly before falling through to the
  // plain onboarding check below — never silently treat either as "no
  // data" (see getStartupStorageStatus in lib/data/localStore.ts).
  if (storageStatus.kind === "corrupt") {
    return <StorageErrorScreen issues={storageStatus.issues} />;
  }
  if (storageStatus.kind === "legacy-found") {
    return <LegacyDataFoundScreen />;
  }

  if (!initialized) {
    return <InitialImportScreen />;
  }

  return (
    <>
      <div className="mx-auto flex w-full max-w-lg flex-1 flex-col pb-20">{children}</div>
      <BottomNav />
    </>
  );
}
