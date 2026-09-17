"use client";

import { useState, type ReactNode } from "react";

export function Card({ children, className = "" }: { children: ReactNode; className?: string }) {
  return (
    <div className={`rounded-2xl bg-neutral-900 p-4 ring-1 ring-neutral-800 ${className}`}>
      {children}
    </div>
  );
}

export function SectionTitle({ children }: { children: ReactNode }) {
  return <h2 className="mb-3 text-sm font-medium text-neutral-400">{children}</h2>;
}

export function StatRow({
  label,
  value,
  valueClassName = "text-white",
  sub,
}: {
  label: ReactNode;
  value: ReactNode;
  valueClassName?: string;
  sub?: ReactNode;
}) {
  return (
    <div className="flex items-baseline justify-between py-1.5">
      <span className="text-sm text-neutral-400">{label}</span>
      <div className="text-right">
        <div className={`text-sm font-semibold tabular-nums ${valueClassName}`}>{value}</div>
        {sub && <div className="text-xs text-neutral-500">{sub}</div>}
      </div>
    </div>
  );
}

export function NumberField({
  label,
  value,
  onChange,
  placeholder,
  suffix,
  step,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  suffix?: string;
  step?: string;
}) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-medium text-neutral-400">{label}</span>
      <div className="flex items-center gap-2 rounded-xl bg-neutral-800/70 px-3 py-2.5 ring-1 ring-neutral-700 focus-within:ring-emerald-500">
        <input
          type="number"
          inputMode="decimal"
          value={value}
          step={step ?? "any"}
          placeholder={placeholder}
          onChange={(e) => onChange(e.target.value)}
          className="w-full bg-transparent text-base text-white outline-none [appearance:textfield]"
        />
        {suffix && <span className="shrink-0 text-xs text-neutral-500">{suffix}</span>}
      </div>
    </label>
  );
}

export function PillButton({
  children,
  onClick,
  active,
  className = "",
}: {
  children: ReactNode;
  onClick?: () => void;
  active?: boolean;
  className?: string;
}) {
  return (
    <button
      onClick={onClick}
      className={`rounded-full px-3.5 py-1.5 text-xs font-medium transition active:scale-95 ${
        active
          ? "bg-emerald-500 text-neutral-950"
          : "bg-neutral-800 text-neutral-300 ring-1 ring-neutral-700"
      } ${className}`}
    >
      {children}
    </button>
  );
}

export function GainText({ value, children }: { value: number; children: ReactNode }) {
  const cls = value > 0 ? "text-emerald-400" : value < 0 ? "text-red-400" : "text-neutral-300";
  return <span className={cls}>{children}</span>;
}

/**
 * Small tap-to-toggle info icon (ⓘ) that reveals a short explanatory note.
 * For details someone may want once, not a warning that should always be
 * visible — keeps the surrounding card uncluttered by default.
 */
export function InfoNote({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false);
  return (
    <span className="relative inline-block align-middle">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-label="설명 보기"
        aria-expanded={open}
        className="ml-1 inline-flex h-4 w-4 items-center justify-center rounded-full bg-neutral-700 text-[10px] leading-none text-neutral-300"
      >
        i
      </button>
      {open && (
        <span className="absolute left-1/2 top-6 z-20 w-[min(16rem,calc(100vw-2.5rem))] -translate-x-1/2 rounded-lg bg-neutral-800 p-3 text-left text-xs font-normal leading-relaxed text-neutral-300 shadow-lg ring-1 ring-neutral-700">
          {children}
        </span>
      )}
    </span>
  );
}
