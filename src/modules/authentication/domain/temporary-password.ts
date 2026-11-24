import { randomBytes } from "node:crypto";

export function createTemporaryPassword() {
  return `Ds!9${randomBytes(12).toString("base64url")}`;
}
