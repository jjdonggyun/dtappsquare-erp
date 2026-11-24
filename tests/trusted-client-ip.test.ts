import { describe, expect, it } from "vitest";
import { trustedClientIp } from "../src/modules/attendance/domain/trusted-client-ip";

describe("self-hosted trusted ingress", () => {
  const request = (value: string) => new Request("http://erp.test", { headers: { "x-dts-client-ip": value } });
  it("does not trust caller-controlled headers without a server opt-in", () => {
    expect(trustedClientIp(request("192.168.1.20"), { NODE_ENV: "production" })).toBeNull();
  });
  it("accepts one IPv4 or IPv6 address from the configured private ingress", () => {
    const env = { NODE_ENV: "production", TRUSTED_CLIENT_IP_HEADER: "x-dts-client-ip" };
    expect(trustedClientIp(request("192.168.1.20"), env)).toBe("192.168.1.20");
    expect(trustedClientIp(request("2001:db8::1"), env)).toBe("2001:db8::1");
    for (const value of ["", "invalid", "192.168.1.20, 192.168.1.21"]) expect(trustedClientIp(request(value), env)).toBeNull();
  });
  it("retains the Vercel ingress contract", () => {
    const req = new Request("https://erp.test", { headers: { "x-forwarded-for": "203.0.113.8" } });
    expect(trustedClientIp(req, { VERCEL: "1", VERCEL_ENV: "production" })).toBe("203.0.113.8");
    expect(trustedClientIp(req, { VERCEL: "1", VERCEL_ENV: "development" })).toBeNull();
  });
});
