/**
 * Bank statement parsing for real reconciliation.
 *
 * No bank offers a free public API to confirm a slip image, so the honest way to
 * verify that a transfer really happened is to compare the payment intent with
 * the merchant's own bank statement. This module turns exported statement files
 * (CSV / TSV, Thai or English headers) into normalized incoming-credit rows.
 */
import { createHash } from "node:crypto";

export type StatementDirection = "credit" | "debit";

export interface ParsedStatementRow {
  occurredAt: string;
  amount: number;
  direction: StatementDirection;
  description: string | null;
  counterparty: string | null;
  reference: string | null;
  /** Payment reference (NG…) found in the description, if any. */
  paymentReference: string | null;
  externalId: string;
  raw: string;
}

export interface StatementParseResult {
  rows: ParsedStatementRow[];
  skipped: number;
  warnings: string[];
  columns: Record<string, string | null>;
  delimiter: string;
  header: string[];
}

const HEADER_SYNONYMS: Record<string, string[]> = {
  date: [
    "date",
    "transactiondate",
    "transdate",
    "valuedate",
    "posteddate",
    "datetime",
    "วันที่",
    "วันที่ทำรายการ",
    "วันที่รายการ",
    "วันที่และเวลา",
  ],
  time: ["time", "เวลา", "เวลาโอน", "เวลาทำรายการ"],
  amount: [
    "amount",
    "credit",
    "creditamount",
    "deposit",
    "incoming",
    "moneyin",
    "ยอดเงินเข้า",
    "เงินเข้า",
    "จำนวนเงิน",
    "จำนวน",
    "ยอดเงิน",
  ],
  debit: ["debit", "debitamount", "withdrawal", "moneyout", "เงินออก", "ถอน", "จำนวนเงินออก"],
  description: [
    "description",
    "details",
    "detail",
    "narrative",
    "memo",
    "note",
    "remark",
    "รายละเอียด",
    "รายการ",
    "หมายเหตุ",
    "รายละเอียดรายการ",
  ],
  reference: [
    "reference",
    "ref",
    "refno",
    "transactionid",
    "transactionref",
    "txnid",
    "docno",
    "chequeno",
    "เลขอ้างอิง",
    "เลขที่",
    "เลขที่รายการ",
    "รหัสอ้างอิง",
    "เลขที่เอกสาร",
  ],
  counterparty: [
    "counterparty",
    "from",
    "sender",
    "payer",
    "source",
    "accountname",
    "ผู้โอน",
    "ชื่อผู้โอน",
    "ต้นทาง",
    "จาก",
  ],
};

const PAYMENT_REF_RE = /\bNG\d{6}[A-Z0-9]{6,12}\b/i;

function normalizeHeader(value: string): string {
  return value
    .replace(/^\ufeff/, "")
    .toLowerCase()
    .replace(/[\s_:.\-()/]/g, "")
    .replace(/จำนวนเงิน|บาท/g, (match) => match)
    .trim();
}

function detectDelimiter(text: string): string {
  const sample = text.split(/\r?\n/).filter((line) => line.trim()).slice(0, 10);
  const candidates = [",", ";", "\t", "|"];
  let best = ",";
  let bestScore = -1;
  for (const candidate of candidates) {
    const score = sample.reduce((total, line) => total + (line.split(candidate).length - 1), 0);
    if (score > bestScore) {
      bestScore = score;
      best = candidate;
    }
  }
  return best;
}

/** RFC4180-ish CSV reader that understands quoted fields and embedded newlines. */
export function parseCsvRecords(text: string, delimiter: string): string[][] {
  const source = text.replace(/^\ufeff/, "");
  const records: string[][] = [];
  let row: string[] = [];
  let field = "";
  let quoted = false;
  for (let i = 0; i < source.length; i += 1) {
    const char = source[i];
    if (quoted) {
      if (char === '"') {
        if (source[i + 1] === '"') {
          field += '"';
          i += 1;
        } else {
          quoted = false;
        }
      } else {
        field += char;
      }
      continue;
    }
    if (char === '"') {
      quoted = true;
      continue;
    }
    if (char === delimiter) {
      row.push(field);
      field = "";
      continue;
    }
    if (char === "\n" || char === "\r") {
      if (char === "\r" && source[i + 1] === "\n") i += 1;
      row.push(field);
      field = "";
      if (row.some((cell) => cell.trim() !== "")) records.push(row);
      row = [];
      continue;
    }
    field += char;
  }
  row.push(field);
  if (row.some((cell) => cell.trim() !== "")) records.push(row);
  return records;
}

function matchHeader(cells: string[]): { index: number; columns: Record<string, number> } | null {
  const normalized = cells.map(normalizeHeader);
  const columns: Record<string, number> = {};
  for (const [key, synonyms] of Object.entries(HEADER_SYNONYMS)) {
    const index = normalized.findIndex((cell) => synonyms.includes(cell));
    if (index >= 0) columns[key] = index;
  }
  if (columns.date === undefined && columns.amount === undefined) return null;
  const recognized = Object.keys(columns).length;
  return recognized >= 3 ? { index: 0, columns } : null;
}

export function parseAmount(value: string | undefined): number | null {
  if (!value) return null;
  const cleaned = value
    .replace(/\u00a0/g, " ")
    .replace(/(THB|บาท|฿|Baht)/gi, "")
    .replace(/\s/g, "")
    .replace(/,/g, "");
  if (!cleaned) return null;
  // Reject text that is not a plain number (dates, refs, descriptions).
  if (!/^[-+(]?\d+(\.\d+)?[)]?$/.test(cleaned)) return null;
  const negative = /^\(.*\)$/.test(cleaned) || cleaned.startsWith("-");
  const numeric = cleaned.replace(/[()+-]/g, "");
  const amount = Number(numeric);
  if (!Number.isFinite(amount)) return null;
  return negative ? -amount : amount;
}

function parseDateParts(value: string): { year: number; month: number; day: number; hour: number; minute: number; second: number } | null {
  const text = value.trim().replace(/\s+/g, " ");
  if (!text) return null;

  const iso = /^(\d{4})-(\d{2})-(\d{2})(?:[T ](\d{2}):(\d{2})(?::(\d{2}))?)?/.exec(text);
  if (iso) {
    return {
      year: Number(iso[1]),
      month: Number(iso[2]),
      day: Number(iso[3]),
      hour: Number(iso[4] ?? 0),
      minute: Number(iso[5] ?? 0),
      second: Number(iso[6] ?? 0),
    };
  }

  const dmy = /^(\d{1,2})[/.\-](\d{1,2})[/.\-](\d{2,4})(?:[ T](\d{1,2}):(\d{2})(?::(\d{2}))?)?/.exec(text);
  if (dmy) {
    const first = Number(dmy[1]);
    const second = Number(dmy[2]);
    const year = Number(dmy[3]);
    // Bank exports are day/month/year; fall back to month/day when the first
    // component cannot be a day but the second can.
    const dayFirst = first > 12 ? true : second > 12 ? false : true;
    return {
      year,
      month: dayFirst ? second : first,
      day: dayFirst ? first : second,
      hour: Number(dmy[4] ?? 0),
      minute: Number(dmy[5] ?? 0),
      second: Number(dmy[6] ?? 0),
    };
  }
  return null;
}

function normalizeYear(year: number): number {
  let value = year;
  if (value < 100) value += 2000;
  if (value > 2400) value -= 543; // Thai Buddhist era (2569 -> 2026)
  return value;
}

export function parseStatementDate(dateValue: string, timeValue?: string): string | null {
  const parts = parseDateParts(`${dateValue} ${timeValue ?? ""}`.trim());
  if (!parts) return null;
  const year = normalizeYear(parts.year);
  if (year < 2000 || year > 2100) return null;
  if (parts.month < 1 || parts.month > 12) return null;
  if (parts.day < 1 || parts.day > 31) return null;
  const pad = (value: number) => String(value).padStart(2, "0");
  const stamp = `${year}-${pad(parts.month)}-${pad(parts.day)}T${pad(parts.hour)}:${pad(parts.minute)}:${pad(parts.second)}+07:00`;
  const parsed = new Date(stamp);
  return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString();
}

function clean(value: string | undefined): string | null {
  const text = (value ?? "").replace(/\s+/g, " ").trim();
  return text ? text : null;
}

function rowFingerprint(parts: Array<string | null>, index: number): string {
  const base = parts.filter(Boolean).join("|");
  return createHash("sha256").update(`${index}|${base}`).digest("hex").slice(0, 32);
}

export function parseBankStatement(text: string): StatementParseResult {
  const warnings: string[] = [];
  const delimiter = detectDelimiter(text);
  const records = parseCsvRecords(text, delimiter);
  if (records.length === 0) {
    return { rows: [], skipped: 0, warnings: ["The file is empty."], columns: {}, delimiter, header: [] };
  }

  let headerIndex = -1;
  let mapping: Record<string, number> | null = null;
  for (let i = 0; i < Math.min(records.length, 30); i += 1) {
    const found = matchHeader(records[i]);
    if (found) {
      headerIndex = i;
      mapping = found.columns;
      break;
    }
  }
  if (!mapping) {
    return {
      rows: [],
      skipped: 0,
      warnings: [
        "Could not find a header row. The file needs columns for date, amount (or credit) and description/reference.",
      ],
      columns: {},
      delimiter,
      header: records[0].map((cell) => cell.trim()),
    };
  }

  const header = records[headerIndex].map((cell) => cell.trim());
  const rows: ParsedStatementRow[] = [];
  let skipped = 0;

  for (let i = headerIndex + 1; i < records.length; i += 1) {
    const cells = records[i];
    const pick = (key: string): string | undefined => {
      const index = mapping?.[key];
      return index === undefined ? undefined : cells[index];
    };
    if (cells.every((cell) => cell.trim() === "")) continue;
    // A row whose column count does not match the header would silently shift
    // amounts into the wrong field, so refuse it instead of guessing.
    if (cells.length !== header.length) {
      skipped += 1;
      warnings.push(`Row ${i + 1} skipped: expected ${header.length} columns but found ${cells.length}.`);
      continue;
    }

    const occurredAt = parseStatementDate(pick("date") ?? "", pick("time"));
    const credit = parseAmount(pick("amount"));
    const debit = parseAmount(pick("debit"));

    if (!occurredAt) {
      skipped += 1;
      continue;
    }
    let amount = credit;
    let direction: StatementDirection = "credit";
    if (amount === null || amount === 0) {
      if (debit !== null && debit !== 0) {
        amount = Math.abs(debit);
        direction = "debit";
      }
    } else if (amount < 0) {
      amount = Math.abs(amount);
      direction = "debit";
    }
    if (amount === null || !Number.isFinite(amount) || amount === 0) {
      skipped += 1;
      continue;
    }

    const description = clean(pick("description"));
    const counterparty = clean(pick("counterparty"));
    const rawReference = clean(pick("reference"));
    const paymentReference = description?.match(PAYMENT_REF_RE)?.[0]?.toUpperCase() ?? null;

    rows.push({
      occurredAt,
      amount: Math.round(amount * 100) / 100,
      direction,
      description,
      counterparty,
      reference: rawReference,
      paymentReference,
      externalId: rawReference
        ? `ref:${rawReference}`
        : `h:${rowFingerprint([occurredAt, String(amount), description, counterparty], i)}`,
      raw: cells.join(delimiter),
    });
  }

  const credits = rows.filter((row) => row.direction === "credit").length;
  if (rows.length === 0) {
    warnings.push("No transaction rows could be read. Check that dates and amounts are formatted correctly.");
  } else {
    warnings.push(`${rows.length} rows read (${credits} incoming credits, ${rows.length - credits} debits).`);
  }
  if (skipped > 0) warnings.push(`${skipped} rows skipped because the date or amount was missing.`);

  const columns: Record<string, string | null> = {};
  for (const key of Object.keys(HEADER_SYNONYMS)) {
    const index = mapping[key];
    columns[key] = index === undefined ? null : header[index] ?? null;
  }

  return { rows, skipped, warnings, columns, delimiter, header };
}
