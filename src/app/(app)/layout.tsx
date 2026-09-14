import { AppDataProvider } from "@/lib/data/AppDataContext";
import AppShell from "./AppShell";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <AppDataProvider>
      <AppShell>{children}</AppShell>
    </AppDataProvider>
  );
}
