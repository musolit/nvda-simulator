import { AppDataProvider } from "@/lib/data/AppDataContext";
import BottomNav from "./BottomNav";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <AppDataProvider>
      <div className="mx-auto flex w-full max-w-lg flex-1 flex-col pb-20">{children}</div>
      <BottomNav />
    </AppDataProvider>
  );
}
