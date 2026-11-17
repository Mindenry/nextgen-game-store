import { describe, expect, it } from "vitest";
import { parseAmount, parseBankStatement, parseCsvRecords, parseStatementDate } from "@/lib/bank/statement";

describe("bank statement parsing (real reconciliation)", () => {
  it("parses a Thai-header KBank style CSV and keeps only credits", () => {
    const csv = [
      "วันที่,เวลา,รายละเอียด,จำนวนเงิน,เลขที่รายการ",
      '17/11/2569,14:32,"รับโอนเงิน NG261117ABC123 จาก นาย ทดสอบ",1.00,TXN0001',
      '17/11/2569,15:10,"โอนออก ค่าอาหาร",250.00,TXN0002',
      '17/11/2569,16:00,"รับโอนเงิน",50.00,TXN0003',
    ].join("\n");

    const result = parseBankStatement(csv);
    expect(result.rows).toHaveLength(3);
    expect(result.columns.date).toBe("วันที่");
    expect(result.rows[0].amount).toBe(1);
    expect(result.rows[0].direction).toBe("credit");
    expect(result.rows[0].paymentReference).toBe("NG261117ABC123");
    expect(result.rows[0].externalId).toBe("ref:TXN0001");
    // Buddhist year 2569 must become 2026.
    expect(result.rows[0].occurredAt.startsWith("2026-11-17")).toBe(true);
    expect(result.rows[2].direction).toBe("credit");
  });

  it("handles English headers, quoted commas, BOM and thousands separators", () => {
    const csv =
      "\ufeffDate,Description,Amount,Reference\n" +
      '2026-11-17 09:15:00,"Transfer from SOMCHAI, ref NG261117XYZ999","1,250.00",SCB998877\n';
    const result = parseBankStatement(csv);
    expect(result.rows).toHaveLength(1);
    expect(result.rows[0].amount).toBe(1250);
    expect(result.rows[0].paymentReference).toBe("NG261117XYZ999");
    expect(result.rows[0].occurredAt).toBe("2026-11-17T02:15:00.000Z");
  });

  it("treats separate debit columns as outgoing money", () => {
    const csv = ["วันที่,เงินเข้า,เงินออก,รายละเอียด", "17/11/2026,0.00,300.00,ถอนเงิน", "17/11/2026,20.00,0.00,รับโอน"].join("\n");
    const result = parseBankStatement(csv);
    expect(result.rows).toHaveLength(2);
    expect(result.rows[0].direction).toBe("debit");
    expect(result.rows[1].direction).toBe("credit");
    expect(result.rows[1].amount).toBe(20);
  });

  it("generates a stable fingerprint when the statement has no reference column", () => {
    const csv = ["date,amount,description", "2026-11-17,20.00,transfer"].join("\n");
    const first = parseBankStatement(csv).rows[0];
    const second = parseBankStatement(csv).rows[0];
    expect(first.externalId).toBe(second.externalId);
    expect(first.externalId.startsWith("h:")).toBe(true);
  });

  it("reports files it cannot read instead of inventing rows", () => {
    const result = parseBankStatement("hello world\nthis is not a statement");
    expect(result.rows).toHaveLength(0);
    expect(result.warnings.join(" ")).toMatch(/header/i);
  });

  it("parses amounts and dates defensively", () => {
    expect(parseAmount("฿1,234.50")).toBe(1234.5);
    expect(parseAmount("(250.00)")).toBe(-250);
    expect(parseAmount("abc")).toBeNull();
    expect(parseStatementDate("17/11/2569", "08:05")).toBe(new Date("2026-11-17T08:05:00+07:00").toISOString());
    expect(parseStatementDate("not a date")).toBeNull();
  });

  it("reads semicolon-delimited exports", () => {
    const records = parseCsvRecords("a;b;c\n1;2;3", ";");
    expect(records).toEqual([
      ["a", "b", "c"],
      ["1", "2", "3"],
    ]);
  });
});
