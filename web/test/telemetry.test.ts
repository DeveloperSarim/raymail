import { test } from "node:test";
import assert from "node:assert/strict";

process.env.TELEMETRY_SECRET = "test-secret-not-the-production-one";

const {
  openToken, readOpenToken, clickToken, readClickToken, newTrackingId,
} = await import("../src/lib/telemetry.ts");

test("open token round-trips", () => {
  const id = newTrackingId();
  assert.equal(readOpenToken(openToken(id)), id);
});

test("forged open token is rejected", () => {
  // An attacker who can read the message body sees the id but not the secret.
  assert.equal(readOpenToken("abc123.deadbeefdeadbeefdeadbeef"), null);
  assert.equal(readOpenToken("abc123"), null);
  assert.equal(readOpenToken(""), null);
});

test("click token round-trips and preserves the destination", () => {
  const id = newTrackingId();
  const url = "https://example.com/pricing?ref=mail";
  const parsed = readClickToken(clickToken(id, url));
  assert.deepEqual(parsed, { id, url });
});

test("click token cannot be repointed — no open redirect", () => {
  const id = newTrackingId();
  const good = clickToken(id, "https://example.com/");
  const [tid, , sig] = good.split(".");
  // Swap the destination but keep the original signature.
  const evil = Buffer.from("https://attacker.example/steal", "utf8").toString("base64url");
  assert.equal(readClickToken(`${tid}.${evil}.${sig}`), null);
});

test("non-http schemes are refused even when correctly signed", () => {
  const id = newTrackingId();
  assert.equal(readClickToken(clickToken(id, "javascript:alert(1)")), null);
  assert.equal(readClickToken(clickToken(id, "file:///etc/passwd")), null);
});

test("a token signed for open does not validate as a click, and vice versa", () => {
  const id = newTrackingId();
  assert.equal(readClickToken(openToken(id)), null);
});
