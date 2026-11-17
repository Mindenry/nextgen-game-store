/**
 * Fuzzy matching for Thai personal/company names as printed on a bank slip.
 *
 * Slips show the receiver name exactly as the bank stores it (often with a title
 * prefix and inconsistent spacing), while the merchant configures a normal name.
 * This keeps the comparison strict enough to catch a different account but
 * tolerant enough for titles, dots and spacing.
 */

const TITLE_PREFIXES = [
  "นาย",
  "นางสาว",
  "นาง",
  "น.ส.",
  "ด.ช.",
  "ด.ญ.",
  "mr",
  "mrs",
  "ms",
  "miss",
];

const COMPANY_WORDS = ["บริษัท", "จำกัด", "มหาชน", "ห้างหุ้นส่วนจำกัด", "company", "limited", "co", "ltd", "public"];

export function normalizePersonName(value: string | null | undefined): string {
  if (!value) return "";
  let text = value.normalize("NFKC").toLowerCase();
  text = text.replace(/[\u200b-\u200d\ufeff]/g, "");
  text = text.replace(/[.,()\-_/\\'"“”‘’]/g, " ");
  text = text.replace(/\s+/g, " ").trim();

  let changed = true;
  while (changed) {
    changed = false;
    for (const prefix of TITLE_PREFIXES) {
      if (text === prefix) return "";
      if (text.startsWith(`${prefix} `)) {
        text = text.slice(prefix.length).trim();
        changed = true;
      }
    }
  }

  const words = text.split(" ").filter((word) => word && !COMPANY_WORDS.includes(word));
  return words.join(" ").trim();
}

export interface NameMatch {
  match: boolean;
  score: number;
  reason: "exact" | "contains" | "tokens" | "missing" | "different";
}

/**
 * Compares the configured receiving-account name with the name printed on the
 * slip. Returns match=true only when the names clearly refer to the same party.
 */
export function namesMatch(expected: string | null | undefined, actual: string | null | undefined): NameMatch {
  const a = normalizePersonName(expected);
  const b = normalizePersonName(actual);
  if (!a || !b) return { match: false, score: 0, reason: "missing" };
  if (a === b) return { match: true, score: 1, reason: "exact" };

  if (b.includes(a) || a.includes(b)) {
    return { match: true, score: 0.95, reason: "contains" };
  }

  const expectedTokens = a.split(" ").filter(Boolean);
  const actualTokens = b.split(" ").filter(Boolean);
  if (expectedTokens.length === 0 || actualTokens.length === 0) {
    return { match: false, score: 0, reason: "different" };
  }

  let matched = 0;
  for (const token of expectedTokens) {
    if (actualTokens.some((other) => other === token || other.includes(token) || token.includes(other))) {
      matched += 1;
    }
  }
  const score = matched / expectedTokens.length;
  if (score >= 0.75) return { match: true, score, reason: "tokens" };
  return { match: false, score, reason: "different" };
}
