import { describe, expect, it } from "vitest";
import { createClientRequestId } from "@/shared/browser/client-request-id";

const uuidV4 = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

describe("client request id", () => {
  it("uses the browser UUID provider when it is available", () => {
    const expected = "11111111-1111-4111-8111-111111111111";
    expect(createClientRequestId({ randomUUID: () => expected })).toBe(expected);
  });

  it("creates UUID v4 idempotency keys without Web Crypto", () => {
    const ids = Array.from({ length: 20 }, () => createClientRequestId(null));
    expect(ids.every((id) => uuidV4.test(id))).toBe(true);
    expect(new Set(ids).size).toBe(ids.length);
  });
});
