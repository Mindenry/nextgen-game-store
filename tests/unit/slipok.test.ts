import { describe, expect, it } from "vitest";
import { interpretSlipOkResponse } from "@/lib/slipok";

const success = {
  success: true,
  data: {
    success: true,
    message: "✅",
    transRef: "010092101507665143",
    amount: 1,
    receivingBank: "006",
    receiver: { displayName: "NEXTGEN", account: { type: "BANKAC", value: "xxx-x-x3109-x" } },
  },
};

describe("SlipOK response mapping", () => {
  it("accepts a bank-verified slip with a transaction reference", () => {
    const result = interpretSlipOkResponse(200, success);
    expect(result.status).toBe("verified");
    expect(result.transRef).toBe("010092101507665143");
    expect(result.amount).toBe(1);
    expect(result.receiverName).toBe("NEXTGEN");
  });

  it("rejects duplicate slips", () => {
    const result = interpretSlipOkResponse(400, { code: 1012, message: "สลิปซ้ำ" });
    expect(result.status).toBe("rejected");
    expect(result.code).toBe(1012);
  });

  it("rejects amount mismatches and wrong receivers", () => {
    expect(interpretSlipOkResponse(400, { code: 1013, message: "ยอดไม่ตรง" }).status).toBe("rejected");
    expect(interpretSlipOkResponse(400, { code: 1014, message: "บัญชีผู้รับไม่ตรง" }).status).toBe("rejected");
  });

  it("marks bank delay as pending", () => {
    const result = interpretSlipOkResponse(400, { code: 1010, message: "กรุณารอ 8 นาที" });
    expect(result.status).toBe("pending");
  });

  it("treats auth/configuration failures as errors, not success", () => {
    expect(interpretSlipOkResponse(401, { code: 1002, message: "Authorization Header ไม่ถูกต้อง" }).status).toBe("error");
    expect(interpretSlipOkResponse(200, { success: false, message: "no" }).status).toBe("error");
  });
});
