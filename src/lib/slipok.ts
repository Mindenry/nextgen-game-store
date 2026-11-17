/**
 * Pure mapping for SlipOK responses. Kept free of server-only imports so the
 * decision logic can be unit tested without making a network request.
 *
 * Docs: https://slipok.com/api-documentation/check-slip
 */
export type SlipOkPayload = {
  success?: boolean;
  code?: number;
  message?: string;
  data?: {
    success?: boolean;
    message?: string;
    transRef?: string;
    transDate?: string;
    transTime?: string;
    amount?: number | string;
    receivingBank?: string;
    sendingBank?: string;
    receiver?: {
      displayName?: string;
      name?: string;
      account?: { type?: string; value?: string };
      proxy?: { type?: string; value?: string };
    };
    sender?: {
      displayName?: string;
      name?: string;
      account?: { type?: string; value?: string };
    };
    ref1?: string;
    ref2?: string;
    ref3?: string;
  };
};

export type SlipOutcomeStatus = "verified" | "rejected" | "pending" | "error" | "not_configured";

export interface SlipOutcome {
  status: SlipOutcomeStatus;
  code?: number;
  message: string;
  transRef?: string;
  amount?: number;
  receiverName?: string;
  receiverAccount?: string;
  receiverBank?: string;
  raw?: SlipOkPayload["data"];
}

export function interpretSlipOkResponse(httpStatus: number, payload: unknown): SlipOutcome {
  const body = (payload ?? {}) as SlipOkPayload;
  const data = body.data;
  const code = Number(body.code ?? 0);

  if (
    httpStatus >= 200 &&
    httpStatus < 300 &&
    body.success === true &&
    data?.success === true &&
    data.transRef
  ) {
    return {
      status: "verified",
      message: data.message || "Slip verified",
      transRef: data.transRef,
      amount: data.amount === undefined ? undefined : Number(data.amount),
      receiverName: data.receiver?.displayName || data.receiver?.name,
      receiverAccount: data.receiver?.account?.value,
      receiverBank: data.receivingBank,
      raw: data,
    };
  }

  const message = body.message || data?.message || "Slip verification failed";

  // 1012 = slip already used, 1013 = amount mismatch, 1014 = wrong receiver,
  // 1007 = QR expired/not found, 1008 = not a payment slip.
  if ([1007, 1008, 1012, 1013, 1014].includes(code)) {
    return { status: "rejected", code, message, raw: data };
  }
  // 1010 = BBL/SCB slip delay; retry after the bank posts the transaction.
  if (code === 1010) {
    return { status: "pending", code, message, raw: data };
  }
  return { status: "error", code, message, raw: data };
}
