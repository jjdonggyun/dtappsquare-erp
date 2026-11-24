import { describe, expect, it } from "vitest";
import { createTemporaryPassword } from "../src/modules/authentication/domain/temporary-password";

describe("temporary password", () => {
  it("creates unique passwords with the required complexity and length", () => {
    const first = createTemporaryPassword();
    const second = createTemporaryPassword();

    expect(first).not.toBe(second);
    expect(first.length).toBeGreaterThanOrEqual(16);
    expect(first).toMatch(/[A-Z]/);
    expect(first).toMatch(/[a-z]/);
    expect(first).toMatch(/\d/);
    expect(first).toMatch(/[^A-Za-z0-9]/);
  });
});
