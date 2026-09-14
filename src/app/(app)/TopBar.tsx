export default function TopBar({ title }: { title: string }) {
  return (
    <header className="sticky top-0 z-30 border-b border-neutral-800 bg-neutral-950/95 px-4 py-3 backdrop-blur">
      <p className="text-[11px] font-medium tracking-wide text-emerald-400">NVIDIA · NVDA</p>
      <h1 className="text-lg font-semibold text-white">{title}</h1>
    </header>
  );
}
