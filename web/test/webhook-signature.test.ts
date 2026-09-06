import { test } from "node:test";
import assert from "node:assert/strict";

const { signPayload, verifySignature } = await import("../src/lib/webhook-signature.ts");

const SECRET = "whsec_test_not_a_real_secret";
const BODY = JSON.stringify({ id: "evt_1", type: "message.opened", data: { trackedId: "abc" } });
const NOW = 1_700_000_000;

test("a signature this code produces verifies", () => {
  const sig = signPayload(SECRET, BODY, NOW);
  assert.equal(verifySignature(SECRET, BODY, sig, 300, NOW), true);
});

test("a tampered body is rejected", () => {
  const sig = signPayload(SECRET, BODY, NOW);
  const tampered = BODY.replace("abc", "xyz");
  assert.equal(verifySignature(SECRET, tampered, sig, 300, NOW), false);
});

test("the wrong secret is rejected", () => {
  const sig = signPayload(SECRET, BODY, NOW);
  assert.equal(verifySignature("whsec_someone_elses", BODY, sig, 300, NOW), false);
});

test("a replayed request outside the window is rejected", () => {
  const sig = signPayload(SECRET, BODY, NOW);
  // Same valid signature, presented an hour later.
  assert.equal(verifySignature(SECRET, BODY, sig, 300, NOW + 3600), false);
  // And still accepted inside the window.
  assert.equal(verifySignature(SECRET, BODY, sig, 300, NOW + 120), true);
});

test("a forged timestamp does not help an attacker", () => {
  const sig = signPayload(SECRET, BODY, NOW);
  const mac = sig.split("v1=")[1];
  // Move the timestamp into the window but keep the original mac.
  const forged = `t=${NOW + 3600},v1=${mac}`;
  assert.equal(verifySignature(SECRET, BODY, forged, 300, NOW + 3600), false);
});

test("malformed headers are rejected rather than throwing", () => {
  for (const bad of ["", "garbage", "t=,v1=", "v1=abc", `t=${NOW}`, "t=abc,v1=def"]) {
    assert.equal(verifySignature(SECRET, BODY, bad, 300, NOW), false);
  }
});
