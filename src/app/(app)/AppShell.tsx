"use client";

import { useAppData } from "@/lib/data/AppDataContext";
import BottomNav from "./BottomNav";
import InitialImportScreen from "./InitialImportScreen";

/**
 * Gates the whole app on localStorage having loaded and the first-run
 * import (or skip) having happened. Individual pages don't need their own
 * loading/initialized checks — by the time they render, both are true.
 */
export default function AppShell({ children }: { children: React.ReactNode }) {
  const { loading, initialized } = useAppData();

  if (loading) {
    return (
      <div className="flex min-h-dvh items-center justify-center text-sm text-neutral-500">
        불러오는 중...
      </div>
    );
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
