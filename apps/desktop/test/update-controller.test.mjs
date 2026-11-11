import test from "node:test";
import assert from "node:assert/strict";
import { createUpdateController } from "../src/update-controller.mjs";
function setup(check, now = () => 100_000_000) {
  const data = new Map();
  const storage = { getItem: (k) => data.get(k) ?? null, setItem: (k, v) => data.set(k, v) };
  return { controller: createUpdateController({ check, storage, now }), data };
}
test("daily background checks are throttled; a manual check always reaches the endpoint", async () => {
  let calls = 0;
  const { controller: c } = setup(async () => { calls++; return null; });
  await c.check(false); await c.check(false); assert.equal(calls, 1);
  await c.check(); assert.equal(calls, 2); assert.equal(c.getSnapshot().phase, "current");
  c.setAutoEnabled(false); await c.check(false); assert.equal(calls, 2);
  await c.check(); assert.equal(calls, 3);
});
test("concurrent checks/downloads coalesce and installation is impossible before verification", async () => {
  let releaseCheck, releaseDownload, downloads = 0, installs = 0;
  const update = { version: "1.0.2", close: async () => {}, download: async (event) => {
    downloads++; event({ event: "Started", data: { contentLength: 12 } });
    event({ event: "Progress", data: { chunkLength: 12 } });
    await new Promise((resolve) => { releaseDownload = resolve; });
  }, install: async () => { installs++; } };
  const { controller: c } = setup(() => new Promise((resolve) => { releaseCheck = () => resolve(update); }));
  const checking = c.check(); await c.check(); releaseCheck(); await checking;
  await c.install(); assert.equal(installs, 0);
  const downloading = c.download(); await c.download(); await c.install();
  assert.equal(downloads, 1); assert.equal(installs, 0);
  releaseDownload(); await downloading;
  assert.equal(c.getSnapshot().phase, "ready"); assert.equal(c.getSnapshot().downloaded, 12);
  await c.install(); assert.equal(installs, 1);
});
test("bad signatures/network failures cannot lead to installation and can be retried", async () => {
  let attempts = 0, installs = 0;
  const { controller: c } = setup(async () => ({ version: "1.0.2", close: async () => {}, download: async () => {
    if (++attempts === 1) throw Error("invalid signature");
  }, install: async () => { installs++; throw Error("installer did not start"); } }));
  await c.check(); await c.download(); await c.install();
  assert.equal(installs, 0); assert.equal(c.getSnapshot().phase, "error");
  await c.download(); assert.equal(c.getSnapshot().phase, "ready");
  await c.install(); assert.equal(c.getSnapshot().phase, "ready"); assert.ok(c.getSnapshot().error);
});
test("a failed manual check keeps a previously discovered update available", async () => {
  let calls = 0;
  const { controller: c } = setup(async () => { if (calls++) throw Error("offline"); return { version: "1.0.2" }; });
  await c.check(); await c.check();
  assert.equal(c.getSnapshot().version, "1.0.2"); assert.equal(c.getSnapshot().phase, "available");
});
test("manual recheck preserves verified bytes for the same version and releases replacement metadata", async () => {
  let calls = 0, metadataClosed = 0, installs = 0;
  const verified = { version: "1.0.2", download: async () => {}, install: async () => { installs++; }, close: async () => {} };
  const { controller: c } = setup(async () => ++calls === 1 ? verified : { version: "1.0.2", close: async () => { metadataClosed++; } });
  await c.check(); await c.download(); await c.check();
  assert.equal(calls, 2); assert.equal(metadataClosed, 1); assert.equal(c.getSnapshot().phase, "ready");
  await c.install(); assert.equal(installs, 1);
});
test("a known update survives restart but must be checked again before downloading", async () => {
  const { controller: first, data } = setup(async () => ({ version: "1.0.2", body: "New release" }));
  await first.check();
  let checks = 0, downloads = 0;
  const restored = createUpdateController({ now: () => 100_000_001,
    storage: { getItem: (k) => data.get(k), setItem: (k,v) => data.set(k,v) },
    check: async () => { checks++; return { version: "1.0.2", download: async () => { downloads++; } }; },
  });
  assert.equal(restored.getSnapshot().phase, "available");
  await restored.check(false); assert.equal(checks, 0);
  await restored.download(); assert.equal(checks, 1); assert.equal(downloads, 1);
  assert.equal(restored.getSnapshot().phase, "ready");
});
