type RandomUuidProvider = {
  randomUUID?: () => string;
};

export function createClientRequestId(
  provider: RandomUuidProvider | null | undefined =
    typeof crypto === "undefined" ? undefined : crypto,
) {
  if (typeof provider?.randomUUID === "function") return provider.randomUUID();

  // This UUID is only an idempotency key, not a secret or authentication token.
  const bytes = Array.from({ length: 16 }, () => Math.floor(Math.random() * 256));
  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = bytes.map((value) => value.toString(16).padStart(2, "0"));
  return `${hex.slice(0, 4).join("")}-${hex.slice(4, 6).join("")}-${hex
    .slice(6, 8)
    .join("")}-${hex.slice(8, 10).join("")}-${hex.slice(10).join("")}`;
}
