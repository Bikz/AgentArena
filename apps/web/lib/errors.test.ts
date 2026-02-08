import { describe, expect, it } from "vitest";
import { normalizeError } from "@/lib/errors";
import { HttpError } from "@/lib/http";

describe("normalizeError", () => {
  it("maps user rejected to friendly text", () => {
    const n = normalizeError(new Error("User rejected the request."));
    expect(n.title).toContain("Request");
    expect(n.message).toContain("cancel");
  });

  it("maps WalletConnect reset to friendly text", () => {
    const n = normalizeError(
      new Error(
        "User rejected the request. Details: Connection request reset. Please try again. Version: viem@2.45.1",
      ),
    );
    expect(n.title).toContain("Wallet");
    expect(n.message).toContain("cancelled");
  });

  it("maps http 401 to sign-in required", () => {
    const err = new HttpError({
      message: "HTTP 401",
      status: 401,
      url: "https://example.com/auth/me",
      requestId: "req-123",
      bodyText: null,
      bodyJson: { error: { code: "missing" } },
    });
    const n = normalizeError(err);
    expect(n.title).toContain("Sign");
  });
});

