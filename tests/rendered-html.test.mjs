import assert from "node:assert/strict";
import { access, readFile } from "node:fs/promises";
import test from "node:test";

const root = new URL("../", import.meta.url);

async function render() {
  const workerUrl = new URL("../dist/server/index.js", import.meta.url);
  workerUrl.searchParams.set("test", `${process.pid}-${Date.now()}`);
  const { default: worker } = await import(workerUrl.href);

  return worker.fetch(
    new Request("http://localhost/", { headers: { accept: "text/html" } }),
    { ASSETS: { fetch: async () => new Response("Not found", { status: 404 }) } },
    { waitUntil() {}, passThroughOnException() {} },
  );
}

test("server-renders the Golden Gate flight experience shell", async () => {
  const response = await render();
  assert.equal(response.status, 200);
  const html = await response.text();

  assert.match(html, /<title>Golden Gate Flight/);
  assert.match(html, /Golden Gate/);
  assert.match(html, /Explore the span/);
  assert.match(html, /Environment controls/);
  assert.doesNotMatch(html, /codex-preview|Your site is taking shape/i);
});

test("includes free-flight and environmental controls", async () => {
  const [experience, scene, packageJson] = await Promise.all([
    readFile(new URL("app/components/BridgeExperience.tsx", root), "utf8"),
    readFile(new URL("app/components/GoldenGateScene.tsx", root), "utf8"),
    readFile(new URL("package.json", root), "utf8"),
  ]);

  assert.match(experience, /timeOfDay/);
  assert.match(experience, /fogLevel/);
  assert.match(experience, /data-testid="sunlight-control"/);
  assert.match(experience, /data-testid="fog-control"/);
  assert.match(scene, /pointerLockElement/);
  assert.match(scene, /KeyW|KeyA|KeyS|KeyD/);
  assert.match(scene, /GoldenGateBridge/);
  assert.match(scene, /Water/);
  assert.match(scene, /Stars/);
  assert.match(packageJson, /"three"/);
  assert.doesNotMatch(packageJson, /react-loading-skeleton/);

  await assert.rejects(access(new URL("app/_sites-preview", root)));
});
