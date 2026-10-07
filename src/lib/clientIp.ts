import { createHmac } from "node:crypto";

/** Best guess at the sender's IP from the proxy headers (Netlify first, then the generic ones). */
export function clientIp(request: Request): string | null {
  return (
    request.headers.get("x-nf-client-connection-ip") ??
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    request.headers.get("x-real-ip") ??
    null
  );
}

/**
 * Rate-limit key for something sensitive (an IP address, an email): an HMAC,
 * so the value itself is never stored. The feedback form's IP hashes use this
 * exact function, so changing it would reset those limits.
 */
export function hashKey(value: string): string {
  return createHmac("sha256", process.env.AUTH_SECRET ?? "geodex-feedback")
    .update(value)
    .digest("hex");
}
