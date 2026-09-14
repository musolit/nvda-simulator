import { describe, expect, it } from "vitest";
import { parseKakaoFillText, suggestedDefaultSelection } from "../kakaoParser";

describe("parseKakaoFillText", () => {
  it("parses a single final-fill notification with a preceding date separator", () => {
    const text = `
2026년 3월 9일 월요일
[키움증권 체결 안내]
▶종목명: 엔비디아(NVDA)
▶매수수량: 77주
▶잔량: 0주
▶체결단가: USD 176.0100
`;
    const fills = parseKakaoFillText(text);
    expect(fills).toHaveLength(1);
    expect(fills[0]).toMatchObject({
      side: "buy",
      kind: "final",
      date: "2026-03-09",
      quantity: 77,
      remainingQuantity: 0,
      pricePerShareUsd: 176.01,
      stockMatched: true,
    });
    expect(fills[0].warnings).toHaveLength(0);
  });

  it("flags a partial-fill notification with a warning", () => {
    const text = `
2026년 3월 9일 월요일
[키움증권 부분체결 안내]
▶종목명: 엔비디아(NVDA)
▶매수수량: 40주
▶잔량: 37주
▶체결단가: USD 176.0100
`;
    const fills = parseKakaoFillText(text);
    expect(fills).toHaveLength(1);
    expect(fills[0].kind).toBe("partial");
    expect(fills[0].warnings.some((w) => w.includes("부분체결"))).toBe(true);
  });

  it("parses multiple blocks under the same date header", () => {
    const text = `
2025년 3월 27일 목요일
[키움증권 체결 안내]
▶종목명: 엔비디아(NVDA)
▶매수수량: 154주
▶잔량: 0주
▶체결단가: USD 113.1000

[키움증권 체결 안내]
▶종목명: 엔비디아(NVDA)
▶매도수량: 10주
▶잔량: 0주
▶체결단가: USD 200.0000
`;
    const fills = parseKakaoFillText(text);
    expect(fills).toHaveLength(2);
    expect(fills[0]).toMatchObject({ side: "buy", quantity: 154, date: "2025-03-27" });
    expect(fills[1]).toMatchObject({ side: "sell", quantity: 10, date: "2025-03-27" });
  });

  it("flags missing date when no date separator precedes the block", () => {
    const text = `
[키움증권 체결 안내]
▶종목명: 엔비디아(NVDA)
▶매수수량: 77주
▶잔량: 0주
▶체결단가: USD 176.0100
`;
    const fills = parseKakaoFillText(text);
    expect(fills[0].date).toBeNull();
    expect(fills[0].warnings.some((w) => w.includes("날짜"))).toBe(true);
  });

  it("flags duplicate blocks with identical date/side/quantity/price", () => {
    const text = `
2026년 3월 9일 월요일
[키움증권 체결 안내]
▶종목명: 엔비디아(NVDA)
▶매수수량: 77주
▶잔량: 0주
▶체결단가: USD 176.0100

[키움증권 체결 안내]
▶종목명: 엔비디아(NVDA)
▶매수수량: 77주
▶잔량: 0주
▶체결단가: USD 176.0100
`;
    const fills = parseKakaoFillText(text);
    expect(fills).toHaveLength(2);
    expect(fills[1].warnings.some((w) => w.includes("중복"))).toBe(true);
  });

  it("returns an empty array for text with no recognizable notification", () => {
    expect(parseKakaoFillText("그냥 아무 텍스트입니다.")).toHaveLength(0);
  });
});

describe("suggestedDefaultSelection", () => {
  it("selects only clean, final, non-duplicate fills by default", () => {
    const text = `
2026년 3월 9일 월요일
[키움증권 부분체결 안내]
▶종목명: 엔비디아(NVDA)
▶매수수량: 40주
▶잔량: 37주
▶체결단가: USD 176.0100

[키움증권 체결 안내]
▶종목명: 엔비디아(NVDA)
▶매수수량: 77주
▶잔량: 0주
▶체결단가: USD 176.0100
`;
    const fills = parseKakaoFillText(text);
    const selected = suggestedDefaultSelection(fills);
    expect(selected.size).toBe(1);
    expect(selected.has(fills[1].key)).toBe(true);
  });
});
