/**
 * Parser for Kiwoom Securities KakaoTalk fill-notification text.
 *
 * This never auto-saves anything: it only extracts candidate fills and
 * attaches warnings so the user can review, edit, include/exclude, and
 * confirm each row before anything is written to the database (see the
 * transactions page's import flow).
 */

export type ParsedFillSide = "buy" | "sell" | "unknown";
export type ParsedFillKind = "final" | "partial" | "unknown";

export interface ParsedFill {
  /** Stable key for React lists / dedup, not a DB id. */
  key: string;
  side: ParsedFillSide;
  kind: ParsedFillKind;
  /** ISO date if one could be associated with this block, else null. */
  date: string | null;
  quantity: number | null;
  remainingQuantity: number | null;
  pricePerShareUsd: number | null;
  stockMatched: boolean;
  rawBlock: string;
  warnings: string[];
}

const HEADER_RE = /\[\s*키움증권\s*([^\]]*?)안내\s*\]/g;
const FULL_DATE_RE =
  /(\d{4})\s*[.\-/년]\s*(\d{1,2})\s*[.\-/월]\s*(\d{1,2})\s*일?/;
const QUANTITY_BUY_RE = /매수수량\s*[:：]\s*([\d,]+)\s*주/;
const QUANTITY_SELL_RE = /매도수량\s*[:：]\s*([\d,]+)\s*주/;
const REMAINING_RE = /잔량\s*[:：]\s*([\d,]+)\s*주/;
const PRICE_RE = /체결단가\s*[:：]\s*(?:USD|USDT)?\s*\$?\s*([\d,]+\.?\d*)/i;
const STOCK_RE = /(엔비디아|NVDA|NVIDIA)/i;

function parseNumber(raw: string | undefined): number | null {
  if (!raw) return null;
  const n = Number(raw.replace(/,/g, ""));
  return Number.isFinite(n) ? n : null;
}

function toIsoDate(match: RegExpMatchArray): string {
  const [, y, m, d] = match;
  return `${y.padStart(4, "0")}-${m.padStart(2, "0")}-${d.padStart(2, "0")}`;
}

/**
 * Parses raw pasted KakaoTalk text into candidate fills.
 *
 * Strategy: scan line by line, tracking the most recent recognizable date
 * line as "current date context" (KakaoTalk chat exports show date
 * separators like "2026년 3월 9일 월요일" above the messages of that day).
 * Each `[키움증권 ... 안내]` header starts a new block that runs until the
 * next header (or end of text); fields are extracted from that block's
 * text with the date context captured at the header's position.
 */
export function parseKakaoFillText(text: string): ParsedFill[] {
  const lines = text.split(/\r?\n/);

  // Locate header positions first (by line index) so we can slice blocks.
  const headerLineIndexes: { lineIndex: number; label: string }[] = [];
  lines.forEach((line, lineIndex) => {
    HEADER_RE.lastIndex = 0;
    const match = HEADER_RE.exec(line);
    if (match) {
      headerLineIndexes.push({ lineIndex, label: match[1].trim() });
    }
  });

  if (headerLineIndexes.length === 0) return [];

  // Precompute date context per line: the most recent standalone date line
  // at or before each index. A line is treated as a "date line" only if,
  // after stripping the date, little else remains (so we don't pick up a
  // date-shaped substring embedded in an unrelated sentence).
  const dateContextByLine: (string | null)[] = new Array(lines.length).fill(null);
  let currentDate: string | null = null;
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    const match = line.match(FULL_DATE_RE);
    if (match) {
      const withoutDate = line.replace(FULL_DATE_RE, "").trim();
      const looksLikeDateOnlyLine = withoutDate.length <= 6; // allow "월요일" etc.
      if (looksLikeDateOnlyLine) {
        currentDate = toIsoDate(match);
      }
    }
    dateContextByLine[i] = currentDate;
  }

  const results: ParsedFill[] = [];

  headerLineIndexes.forEach((header, idx) => {
    const blockStart = header.lineIndex;
    const blockEnd =
      idx + 1 < headerLineIndexes.length ? headerLineIndexes[idx + 1].lineIndex : lines.length;
    const blockLines = lines.slice(blockStart, blockEnd);
    const blockText = blockLines.join("\n").trim();

    const warnings: string[] = [];

    const isPartialHeader = /부분\s*체결/.test(header.label);
    const buyMatch = blockText.match(QUANTITY_BUY_RE);
    const sellMatch = blockText.match(QUANTITY_SELL_RE);
    const remainingMatch = blockText.match(REMAINING_RE);
    const priceMatch = blockText.match(PRICE_RE);
    const inlineDateMatch = blockText.match(FULL_DATE_RE);

    const side: ParsedFillSide = buyMatch ? "buy" : sellMatch ? "sell" : "unknown";
    const quantity = parseNumber(buyMatch?.[1] ?? sellMatch?.[1]);
    const remainingQuantity = parseNumber(remainingMatch?.[1]);
    const pricePerShareUsd = priceMatch ? parseNumber(priceMatch[1]) : null;
    const stockMatched = STOCK_RE.test(blockText);

    // Prefer an explicit date inside the block; otherwise fall back to the
    // KakaoTalk date-separator context above the header line.
    const date = inlineDateMatch ? toIsoDate(inlineDateMatch) : dateContextByLine[blockStart];

    let kind: ParsedFillKind = "unknown";
    if (isPartialHeader) {
      kind = "partial";
      warnings.push("부분체결 알림입니다. 최종 체결 알림과 중복 합산되지 않도록 확인하세요.");
    } else if (remainingQuantity === 0) {
      kind = "final";
    } else if (remainingQuantity !== null && remainingQuantity > 0) {
      kind = "partial";
      warnings.push("잔량이 남아있어 부분체결일 수 있습니다.");
    }

    if (side === "unknown") {
      warnings.push("매수/매도 여부를 확인할 수 없습니다.");
    }
    if (quantity === null) {
      warnings.push("수량을 확인할 수 없습니다.");
    }
    if (pricePerShareUsd === null) {
      warnings.push("체결단가를 확인할 수 없습니다.");
    }
    if (!date) {
      warnings.push("날짜를 확인할 수 없습니다. 직접 입력해주세요.");
    }
    if (!stockMatched) {
      warnings.push("NVDA(엔비디아) 종목이 명시적으로 확인되지 않았습니다.");
    }

    results.push({
      key: `${blockStart}-${idx}`,
      side,
      kind,
      date,
      quantity,
      remainingQuantity,
      pricePerShareUsd,
      stockMatched,
      rawBlock: blockText,
      warnings,
    });
  });

  // Duplicate detection across the whole batch: identical (date, side,
  // quantity, price) suggests the same fill was pasted or notified twice.
  const seen = new Map<string, number>();
  for (const fill of results) {
    const sig = `${fill.date}|${fill.side}|${fill.quantity}|${fill.pricePerShareUsd}`;
    const count = (seen.get(sig) ?? 0) + 1;
    seen.set(sig, count);
    if (count > 1) {
      fill.warnings.push("동일한 날짜/수량/가격의 체결이 이 텍스트 안에 중복으로 나타납니다.");
    }
  }

  return results;
}

/** Fills that look safe to include by default: final kind, no other warnings. */
export function suggestedDefaultSelection(fills: ParsedFill[]): Set<string> {
  const seenSignatures = new Set<string>();
  const selected = new Set<string>();
  for (const fill of fills) {
    const sig = `${fill.date}|${fill.side}|${fill.quantity}|${fill.pricePerShareUsd}`;
    const isClean =
      fill.kind === "final" &&
      fill.side !== "unknown" &&
      fill.quantity !== null &&
      fill.pricePerShareUsd !== null &&
      fill.date !== null &&
      !seenSignatures.has(sig);
    if (isClean) {
      selected.add(fill.key);
      seenSignatures.add(sig);
    }
  }
  return selected;
}
