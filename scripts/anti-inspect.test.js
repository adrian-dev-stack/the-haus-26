import test from "node:test";
import assert from "node:assert/strict";
import { isAntiInspectActive } from "../lib/anti-inspect.js";

test("anti-inspect is disabled on localhost and local IPs by default", () => {
  const localHosts = ["localhost", "127.0.0.1", "[::1]", "macbook.local", "laptop.local"];
  for (const host of localHosts) {
    assert.equal(
      isAntiInspectActive({ hostname: host, nodeEnv: "production" }),
      false,
      `Expected anti-inspect to be inactive on ${host} in production`
    );
  }
});

test("anti-inspect is disabled when nodeEnv is development or test", () => {
  assert.equal(
    isAntiInspectActive({ hostname: "thehaus26.com", nodeEnv: "development" }),
    false,
    "Expected anti-inspect to be inactive in development"
  );
  assert.equal(
    isAntiInspectActive({ hostname: "thehaus26.com", nodeEnv: "test" }),
    false,
    "Expected anti-inspect to be inactive in test environment"
  );
});

test("anti-inspect is active on production deployment domains", () => {
  const prodHosts = ["thehaus26.com", "www.thehaus26.com", "haus26.vercel.app"];
  for (const host of prodHosts) {
    assert.equal(
      isAntiInspectActive({ hostname: host, nodeEnv: "production" }),
      true,
      `Expected anti-inspect to be active on ${host} in production`
    );
  }
});

test("anti-inspect supports explicit URL query parameter overrides", () => {
  assert.equal(
    isAntiInspectActive({ hostname: "localhost", search: "?anti_inspect=true", nodeEnv: "development" }),
    true,
    "Query param ?anti_inspect=true should activate anti-inspect on localhost"
  );
  assert.equal(
    isAntiInspectActive({ hostname: "thehaus26.com", search: "?anti_inspect=false", nodeEnv: "production" }),
    false,
    "Query param ?anti_inspect=false should disable anti-inspect on production domain"
  );
});

test("anti-inspect supports environment variable overrides", () => {
  assert.equal(
    isAntiInspectActive({ hostname: "localhost", envOverride: "true", nodeEnv: "development" }),
    true,
    "NEXT_PUBLIC_ANTI_INSPECT=true should activate anti-inspect anywhere"
  );
  assert.equal(
    isAntiInspectActive({ hostname: "thehaus26.com", envOverride: "false", nodeEnv: "production" }),
    false,
    "NEXT_PUBLIC_ANTI_INSPECT=false should deactivate anti-inspect anywhere"
  );
});
