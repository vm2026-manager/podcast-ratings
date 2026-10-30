import assert from "node:assert/strict";
import { classifyFeedReference } from "./catalogue-feed-quality.mjs";

for (const value of ["apple:12345", "Apple:12345", "  APPLE:12345  "]) {
  const result = classifyFeedReference(value);
  assert.equal(result.status, "supported-apple-reference");
  assert.equal(result.appleShowId, "12345");
  assert.match(result.reason, /not fetched/u);
  assert.equal(Object.hasOwn(result, "feedUrl"), false, "a recognized Apple reference does not itself configure or activate an importer");
}
assert.deepEqual(classifyFeedReference("apple:abc"), { status: "invalid-syntax" });
assert.deepEqual(classifyFeedReference("https://api.dr.dk/podcasts/v1/feeds/genstart").status, "valid-http-feed");
assert.deepEqual(classifyFeedReference("https://feeds.simplecast.com/example").status, "valid-http-feed");
assert.deepEqual(classifyFeedReference(""), { status: "missing" });
assert.deepEqual(classifyFeedReference("   "), { status: "missing" });
assert.deepEqual(classifyFeedReference("https://podcasts.apple.com/dk/podcast/id12345").status, "requires-source-verification");
assert.deepEqual(classifyFeedReference("podimo:show-123").status, "requires-source-verification");
assert.deepEqual(classifyFeedReference("DR RSS"), { status: "invalid-syntax" });
assert.deepEqual(classifyFeedReference("not-a-feed"), { status: "invalid-syntax" });
assert.deepEqual(classifyFeedReference("ftp://example.test/feed.xml").status, "requires-source-verification");

console.log("Catalogue feed quality classifications passed.");
