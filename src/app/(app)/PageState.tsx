"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAppData } from "@/lib/data/AppDataContext";

/** Wrap page content: shows a loading/error state and guards against a missing session. */
export default function PageState({ children }: { children: React.ReactNode }) {
  const { loading, error, user, refresh } = useAppData();
  const router = useRouter();

  useEffect(() => {
    if (!loading && !user) {
      router.replace("/login");
    }
  }, [loading, user, router]);

  if (loading) {
    return (
      <div className="flex flex-1 items-center justify-center py-24 text-sm text-neutral-500">
        불러오는 중...
      </div>
    );
  }

  if (error) {
    return (
      <div className="mx-4 mt-6 rounded-xl bg-red-500/10 p-4 text-sm text-red-300 ring-1 ring-red-500/20">
        <p className="mb-2 font-medium">데이터를 불러오지 못했습니다.</p>
        <p className="mb-3 text-red-300/80">{error}</p>
        <button
          onClick={() => refresh()}
          className="rounded-lg bg-red-500/20 px-3 py-1.5 text-xs font-medium"
        >
          다시 시도
        </button>
      </div>
    );
  }

  if (!user) return null;

  return <>{children}</>;
}
