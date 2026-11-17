/**
 * EasySlip bank-slip verification mapping.
 *
 * Docs: https://document.easyslip.com/en/v2/verify/bank/base64
 *
 * A successful response is a real bank-side lookup: EasySlip returns the slip's
 * transaction reference, amount, sender and the receiver account name, plus a
 * duplicate flag. A slip image alone is never trusted without this response.
 */
export type EasySlipPayload = {
  success?: boolean;
  message?: string;
  data?: {
    isDuplicate?: boolean;
    matchedAccount?: { id?: string; name?: string } | null;
    amountInOrder?: number;
    amountInSlip?: number;
    isAmountMatched?: boolean;
    rawSlip?: {
      payload?: string;
      transRef?: string;
      date?: string;
      amount?: { amount?: number; currency?: string };
      sender?: {
        bank?: { id?: string; name?: string; short?: string };
        account?: { name?: { th?: string; en?: string } };
      };
      receiver?: {
        bank?: { id?: string; name?: string; short?: string };
        account?: { name?: { th?: string; en?: string } };
      };
    };
  };
  error?: { code?: string; message?: string };
};

export type EasySlipStatus = "verified" | "duplicate" | "rejected" | "pending" | "error";

export interface EasySlipOutcome {
  status: EasySlipStatus;
  message: string;
  code?: string;
  transRef?: string;
  amount?: number;
  slipDate?: string;
  senderName?: string;
  receiverName?: string;
  receiverBank?: string;
  duplicate?: boolean;
  raw?: unknown;
}

function receiverNameOf(slip: NonNullable<NonNullable<EasySlipPayload["data"]>["rawSlip"]>): string | undefined {
  const name = slip.receiver?.account?.name;
  return name?.th || name?.en || undefined;
}

export function interpretEasySlipResponse(httpStatus: number, payload: unknown): EasySlipOutcome {
  const body = (payload ?? {}) as EasySlipPayload;
  const data = body.data;
  const slip = data?.rawSlip;

  if (httpStatus >= 200 && httpStatus < 300 && body.success === true && data && slip?.transRef) {
    const amount = slip.amount?.amount === undefined ? undefined : Number(slip.amount.amount);
    const result: EasySlipOutcome = {
      status: "verified",
      message: body.message || "Slip verified",
      transRef: slip.transRef,
      amount,
      slipDate: slip.date,
      senderName: slip.sender?.account?.name?.th || slip.sender?.account?.name?.en,
      receiverName: receiverNameOf(slip),
      receiverBank: slip.receiver?.bank?.short || slip.receiver?.bank?.name,
      duplicate: data.isDuplicate === true,
      raw: data,
    };
    if (data.isDuplicate === true) {
      return {
        ...result,
        status: "duplicate",
        message: "This slip has already been used with EasySlip.",
      };
    }
    if (data.isAmountMatched === false) {
      return {
        ...result,
        status: "rejected",
        code: "AMOUNT_MISMATCH",
        message: "The slip amount does not match the requested amount.",
      };
    }
    return result;
  }

  const code = body.error?.code;
  const message = body.error?.message || body.message || "Slip verification failed";

  if (code === "SLIP_PENDING") return { status: "pending", code, message, raw: body };
  if (code === "SLIP_NOT_FOUND" || code === "SLIP_EXPIRED" || code === "INVALID_SLIP") {
    return { status: "rejected", code, message, raw: body };
  }
  if (httpStatus === 401 || httpStatus === 403) return { status: "error", code: code ?? "UNAUTHORIZED", message, raw: body };
  if (httpStatus === 429) return { status: "error", code: code ?? "RATE_LIMITED", message, raw: body };
  return { status: "error", code, message, raw: body };
}
