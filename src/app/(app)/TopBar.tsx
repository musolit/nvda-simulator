"use client";

import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { useAppData } from "@/lib/data/AppDataContext";

export default function TopBar({ title }: { title: string }) {
  const router = useRouter();
  const { user } = useAppData();

  async function handleSignOut() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.replace("/login");
    router.refresh();
  }

  return (
    <header className="sticky top-0 z-30 flex items-center justify-between border-b border-neutral-800 bg-neutral-950/95 px-4 py-3 backdrop-blur">
      <div>
        <p className="text-[11px] font-medium tracking-wide text-emerald-400">NVIDIA · NVDA</p>
        <h1 className="text-lg font-semibold text-white">{title}</h1>
      </div>
      <button
        onClick={handleSignOut}
        className="rounded-full px-3 py-1.5 text-xs text-neutral-400 ring-1 ring-neutral-800 active:scale-95"
        title={user?.email ?? undefined}
      >
        로그아웃
      </button>
    </header>
  );
}
