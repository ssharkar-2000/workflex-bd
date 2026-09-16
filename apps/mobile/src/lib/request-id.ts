/**
 * A fresh key for one money request — see `requestId` on the payment and
 * withdrawal schemas. A retry carrying the same key is recognised by the
 * server as the same request, so a double tap or a dropped connection cannot
 * pay twice.
 *
 * Shaped as a v4 UUID because that is what the server validates. Uniqueness
 * is all it needs, not secrecy, so Math.random is enough and the app does not
 * need a crypto module Hermes lacks.
 */
export function newRequestId(): string {
  const hex = Array.from({ length: 32 }, () =>
    Math.floor(Math.random() * 16).toString(16),
  );
  hex[12] = '4';
  hex[16] = ((Number.parseInt(hex[16]!, 16) & 0x3) | 0x8).toString(16);
  const h = hex.join('');
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`;
}
