const krwFormatter = new Intl.NumberFormat("ko-KR", {
  style: "currency",
  currency: "KRW",
  maximumFractionDigits: 0,
});

const usdFormatter = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  maximumFractionDigits: 2,
});

const shareFormatter = new Intl.NumberFormat("ko-KR", {
  maximumFractionDigits: 0,
});

export function formatKrw(value: number): string {
  return krwFormatter.format(Math.round(value));
}

export function formatUsd(value: number): string {
  return usdFormatter.format(value);
}

export function formatShares(value: number): string {
  return `${shareFormatter.format(value)}주`;
}

export function formatPercent(value: number, fractionDigits = 2): string {
  return `${value >= 0 ? "+" : ""}${value.toFixed(fractionDigits)}%`;
}

export function formatDate(date: string | null): string {
  return date ?? "미확인";
}

/** Rounded, human-scale KRW for a concise headline (e.g. "약 1,900만원"). */
export function formatManwon(value: number): string {
  const manwon = Math.round(value / 10_000);
  return `약 ${manwon.toLocaleString("ko-KR")}만원`;
}
