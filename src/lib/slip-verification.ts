import "server-only";
import { decryptSecret } from "@/lib/crypto";
import { getSettings } from "@/lib/settings";
import { readUploadBytes } from "@/lib/uploads";
import { interpretSlipOkResponse, type SlipOutcome } from "@/lib/slipok";

export interface SlipConfig {
  enabled: boolean;
  autoApprove: boolean;
  branchId: string;
  hasApiKey: boolean;
}

export async function getSlipConfig(): Promise<SlipConfig> {
  const settings = await getSettings();
  const rawKey = String(settings["slip.slipok_api_key"] ?? "");
  let hasApiKey = false;
  if (rawKey) {
    try {
      hasApiKey = Boolean(decryptSecret(rawKey));
    } catch {
      hasApiKey = false;
    }
  }
  return {
    enabled: Boolean(settings["slip.enabled"]),
    autoApprove: settings["slip.auto_approve"] !== false,
    branchId: String(settings["slip.slipok_branch_id"] ?? ""),
    hasApiKey,
  };
}

export interface SlipVerificationResult extends SlipOutcome {
  provider: "slipok";
  notConfigured?: boolean;
}

/**
 * Calls SlipOK's bank-slip verification API. This is a real bank-side check:
 * SlipOK reads the slip QR, verifies it against the bank, checks the receiving
 * account registered to the branch, detects reused slips and compares amount.
 * Without configured credentials we never pretend a slip is verified.
 */
export async function verifySlipImage(input: {
  evidenceRef: string;
  amountMinor: number;
}): Promise<SlipVerificationResult> {
  const settings = await getSettings();
  const enabled = Boolean(settings["slip.enabled"]);
  const branchId = String(settings["slip.slipok_branch_id"] ?? "").trim();
  const encryptedKey = String(settings["slip.slipok_api_key"] ?? "");
  const provider = "slipok" as const;

  if (!enabled || !branchId || !encryptedKey) {
    return {
      provider,
      status: "not_configured",
      notConfigured: true,
      message:
        "Automatic slip verification is not configured. A staff member must verify this slip against the bank statement.",
    };
  }

  let apiKey: string;
  try {
    apiKey = decryptSecret(encryptedKey);
  } catch (error) {
    console.error("[slip] failed to decrypt SlipOK key", error);
    return {
      provider,
      status: "error",
      message: "Slip verification credentials are misconfigured. Contact the store owner.",
    };
  }

  const upload = await readUploadBytes(input.evidenceRef);
  if (!upload) {
    return { provider, status: "error", message: "The uploaded slip could not be read." };
  }

  const extension =
    upload.contentType === "image/png" ? "png" : upload.contentType === "image/webp" ? "webp" : "jpg";
  const form = new FormData();
  form.append("files", new Blob([new Uint8Array(upload.bytes)], { type: upload.contentType }), `slip.${extension}`);
  form.append("amount", (input.amountMinor / 100).toFixed(2));
  form.append("log", "true");

  let response: Response;
  try {
    response = await fetch(`https://api.slipok.com/api/line/apikey/${encodeURIComponent(branchId)}`, {
      method: "POST",
      headers: { "x-authorization": apiKey },
      body: form,
      signal: AbortSignal.timeout(25_000),
    });
  } catch (error) {
    console.error("[slip] SlipOK request failed", error);
    return {
      provider,
      status: "error",
      message: "Could not reach the slip verification service. Please try again or review manually.",
    };
  }

  let payload: unknown = null;
  try {
    payload = await response.json();
  } catch {
    payload = null;
  }

  const outcome = interpretSlipOkResponse(response.status, payload);
  if (outcome.status === "verified") {
    if (outcome.amount === undefined || Math.round(outcome.amount * 100) !== input.amountMinor) {
      return {
        provider,
        status: "rejected",
        code: 1013,
        message: "The slip amount does not match this payment.",
        transRef: outcome.transRef,
        amount: outcome.amount,
        raw: outcome.raw,
      };
    }
    return { provider, ...outcome };
  }
  return { provider, ...outcome };
}
