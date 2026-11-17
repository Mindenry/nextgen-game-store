import "server-only";
import { decryptSecret } from "@/lib/crypto";
import { getSettings } from "@/lib/settings";
import { readUploadBytes } from "@/lib/uploads";
import { interpretSlipOkResponse, type SlipOutcome } from "@/lib/slipok";
import { interpretEasySlipResponse } from "@/lib/slip-verify/easyslip";
import { namesMatch } from "@/lib/slip-verify/name-match";

export type SlipProvider = "slipok" | "easyslip";

export interface SlipConfig {
  provider: SlipProvider;
  enabled: boolean;
  autoApprove: boolean;
  branchId: string;
  hasApiKey: boolean;
  hasEasySlipKey: boolean;
  receiverName: string;
}

function hasKey(raw: string): boolean {
  if (!raw) return false;
  try {
    return Boolean(decryptSecret(raw));
  } catch {
    return false;
  }
}

export async function getSlipConfig(): Promise<SlipConfig> {
  const settings = await getSettings();
  const provider: SlipProvider = settings["slip.provider"] === "easyslip" ? "easyslip" : "slipok";
  return {
    provider,
    enabled: Boolean(settings["slip.enabled"]),
    autoApprove: settings["slip.auto_approve"] !== false,
    branchId: String(settings["slip.slipok_branch_id"] ?? ""),
    hasApiKey: hasKey(String(settings["slip.slipok_api_key"] ?? "")),
    hasEasySlipKey: hasKey(String(settings["slip.easyslip_api_key"] ?? "")),
    receiverName: String(settings["slip.receiver_name"] ?? "").trim(),
  };
}

export interface SlipVerificationResult extends SlipOutcome {
  provider: SlipProvider;
  notConfigured?: boolean;
}

function providerLabel(provider: SlipProvider): string {
  return provider === "easyslip" ? "EasySlip" : "SlipOK";
}

/**
 * Real slip verification against the bank through a verification provider.
 *
 *  - SlipOK: verifies the slip, the receiving branch account and duplicates.
 *  - EasySlip: verifies the slip, amount and returns the receiver account name,
 *    which is compared with the shop's configured account name.
 *
 * Without configured credentials nothing is ever reported as verified.
 */
export async function verifySlipImage(input: {
  evidenceRef: string;
  amountMinor: number;
}): Promise<SlipVerificationResult> {
  const settings = await getSettings();
  const config = await getSlipConfig();
  const provider = config.provider;
  const label = providerLabel(provider);

  if (provider === "easyslip") {
    if (!config.enabled || !config.hasEasySlipKey) {
      return {
        provider,
        status: "not_configured",
        notConfigured: true,
        message:
          "Automatic slip verification is not configured. A staff member must verify this slip against the bank statement.",
      };
    }
    if (!config.receiverName) {
      return {
        provider,
        status: "not_configured",
        notConfigured: true,
        message:
          "The receiving account name is not configured, so the slip receiver cannot be checked. Add it under Payment Settings.",
      };
    }

    let apiKey: string;
    try {
      apiKey = decryptSecret(String(settings["slip.easyslip_api_key"] ?? ""));
    } catch (error) {
      console.error("[slip] failed to decrypt EasySlip key", error);
      return { provider, status: "error", message: "Slip verification credentials are misconfigured." };
    }

    const upload = await readUploadBytes(input.evidenceRef);
    if (!upload) return { provider, status: "error", message: "The uploaded slip could not be read." };
    if (upload.bytes.length > 4 * 1024 * 1024) {
      return { provider, status: "error", message: "The slip image is larger than 4 MB for verification." };
    }

    let response: Response;
    try {
      response = await fetch("https://api.easyslip.com/v2/verify/bank", {
        method: "POST",
        headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          base64: upload.bytes.toString("base64"),
          checkDuplicate: true,
          matchAmount: Number((input.amountMinor / 100).toFixed(2)),
        }),
        signal: AbortSignal.timeout(25_000),
      });
    } catch (error) {
      console.error("[slip] EasySlip request failed", error);
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

    const outcome = interpretEasySlipResponse(response.status, payload);

    if (outcome.status === "verified") {
      if (outcome.amount === undefined || Math.round(outcome.amount * 100) !== input.amountMinor) {
        return {
          provider,
          status: "rejected",
          message: `The slip amount (${outcome.amount ?? "unknown"}) does not match this payment.`,
          transRef: outcome.transRef,
          amount: outcome.amount,
          receiverName: outcome.receiverName,
          receiverBank: outcome.receiverBank,
          raw: outcome.raw as SlipOutcome["raw"],
        };
      }

      const nameCheck = namesMatch(config.receiverName, outcome.receiverName);
      if (!nameCheck.match) {
        return {
          provider,
          status: "rejected",
          message: `The slip was paid to a different account (receiver: ${outcome.receiverName ?? "unknown"}).`,
          transRef: outcome.transRef,
          amount: outcome.amount,
          receiverName: outcome.receiverName,
          receiverBank: outcome.receiverBank,
          raw: outcome.raw as SlipOutcome["raw"],
        };
      }

      const maxAgeDays = Number(settings["slip.max_age_days"] ?? 30);
      if (outcome.slipDate) {
        const slipTime = new Date(outcome.slipDate).getTime();
        if (Number.isFinite(slipTime)) {
          const ageHours = (Date.now() - slipTime) / 3_600_000;
          if (ageHours > maxAgeDays * 24) {
            return {
              provider,
              status: "rejected",
              message: `The slip is older than ${maxAgeDays} days.`,
              transRef: outcome.transRef,
              amount: outcome.amount,
              receiverName: outcome.receiverName,
              raw: outcome.raw as SlipOutcome["raw"],
            };
          }
          if (ageHours < -0.25) {
            return {
              provider,
              status: "rejected",
              message: "The slip date is in the future.",
              transRef: outcome.transRef,
              amount: outcome.amount,
              receiverName: outcome.receiverName,
              raw: outcome.raw as SlipOutcome["raw"],
            };
          }
        }
      }

      return {
        provider,
        status: "verified",
        message: `${label} verified the transfer and the receiver name matches.`,
        transRef: outcome.transRef,
        amount: outcome.amount,
        receiverName: outcome.receiverName,
        receiverBank: outcome.receiverBank,
        raw: outcome.raw as SlipOutcome["raw"],
      };
    }

    return {
      provider,
      status: outcome.status === "duplicate" ? "rejected" : outcome.status,
      message: outcome.message,
      transRef: outcome.transRef,
      amount: outcome.amount,
      receiverName: outcome.receiverName,
      receiverBank: outcome.receiverBank,
      raw: outcome.raw as SlipOutcome["raw"],
    };
  }

  // ---------------------------------------------------------------- SlipOK
  const branchId = config.branchId.trim();
  const encryptedKey = String(settings["slip.slipok_api_key"] ?? "");

  if (!config.enabled || !branchId || !encryptedKey) {
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
    if (config.receiverName && !namesMatch(config.receiverName, outcome.receiverName).match) {
      return {
        provider,
        status: "rejected",
        code: 1014,
        message: `The slip was paid to a different account (receiver: ${outcome.receiverName ?? "unknown"}).`,
        transRef: outcome.transRef,
        amount: outcome.amount,
        receiverName: outcome.receiverName,
        raw: outcome.raw,
      };
    }
    return { provider, ...outcome };
  }
  return { provider, ...outcome };
}
