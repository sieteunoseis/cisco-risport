const assert = require("assert");
const fs = require("fs");
const path = require("path");
const os = require("os");

let passed = 0, failed = 0, total = 0;
function describe(name, fn) { console.log(`  ${name}`); fn(); }
function it(name, fn) {
  total++;
  try { fn(); console.log(`    \u2713 ${name}`); passed++; }
  catch (e) { console.log(`    \u2717 ${name}: ${e.message}`); failed++; }
}

const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "cisco-risport-test-conn-"));
process.env.CISCO_RISPORT_CONFIG_DIR = tmpDir;

const { saveConfig } = require("../../cli/utils/config.js");
const { resolveConfig } = require("../../cli/utils/connection.js");

// Save env vars to restore later
const savedHost = process.env.CUCM_HOST;
const savedHostname = process.env.CUCM_HOSTNAME;
const savedUsername = process.env.CUCM_USERNAME;
const savedPassword = process.env.CUCM_PASSWORD;

function clearEnv() {
  delete process.env.CUCM_HOST;
  delete process.env.CUCM_HOSTNAME;
  delete process.env.CUCM_USERNAME;
  delete process.env.CUCM_PASSWORD;
}

function restoreEnv() {
  if (savedHost !== undefined) process.env.CUCM_HOST = savedHost; else delete process.env.CUCM_HOST;
  if (savedHostname !== undefined) process.env.CUCM_HOSTNAME = savedHostname; else delete process.env.CUCM_HOSTNAME;
  if (savedUsername !== undefined) process.env.CUCM_USERNAME = savedUsername; else delete process.env.CUCM_USERNAME;
  if (savedPassword !== undefined) process.env.CUCM_PASSWORD = savedPassword; else delete process.env.CUCM_PASSWORD;
}

describe("resolveConfig — throws when nothing configured", () => {
  it("throws when no flags, env, or config exist", () => {
    clearEnv();
    saveConfig({ activeCluster: null, clusters: {} });
    assert.throws(() => resolveConfig({}), /No cluster configured/);
  });
});

describe("resolveConfig — config file source", () => {
  it("reads from config file when no flags or env set", () => {
    clearEnv();
    saveConfig({ activeCluster: "lab", clusters: { lab: { host: "config-host", username: "config-user", password: "config-pass" } } });
    const result = resolveConfig({});
    assert.strictEqual(result.host, "config-host");
    assert.strictEqual(result.username, "config-user");
    assert.strictEqual(result.password, "config-pass");
  });

  it("includes insecure from config", () => {
    clearEnv();
    saveConfig({ activeCluster: "lab", clusters: { lab: { host: "h", username: "u", password: "p", insecure: true } } });
    const result = resolveConfig({});
    assert.strictEqual(result.insecure, true);
  });
});

describe("resolveConfig — env vars override config", () => {
  it("CUCM_HOST overrides config host", () => {
    saveConfig({ activeCluster: "lab", clusters: { lab: { host: "config-host", username: "config-user", password: "config-pass" } } });
    clearEnv();
    process.env.CUCM_HOST = "env-host";
    process.env.CUCM_USERNAME = "env-user";
    process.env.CUCM_PASSWORD = "env-pass";
    const result = resolveConfig({});
    assert.strictEqual(result.host, "env-host");
    assert.strictEqual(result.username, "env-user");
    assert.strictEqual(result.password, "env-pass");
  });

  it("CUCM_HOSTNAME also works as host env var", () => {
    clearEnv();
    process.env.CUCM_HOSTNAME = "hostname-env";
    process.env.CUCM_USERNAME = "u";
    process.env.CUCM_PASSWORD = "p";
    saveConfig({ activeCluster: null, clusters: {} });
    const result = resolveConfig({});
    assert.strictEqual(result.host, "hostname-env");
  });
});

describe("resolveConfig — flags override env and config", () => {
  it("flag values take highest precedence", () => {
    clearEnv();
    process.env.CUCM_HOST = "env-host";
    process.env.CUCM_USERNAME = "env-user";
    process.env.CUCM_PASSWORD = "env-pass";
    saveConfig({ activeCluster: "lab", clusters: { lab: { host: "config-host", username: "config-user", password: "config-pass" } } });
    const result = resolveConfig({ host: "flag-host", username: "flag-user", password: "flag-pass" });
    assert.strictEqual(result.host, "flag-host");
    assert.strictEqual(result.username, "flag-user");
    assert.strictEqual(result.password, "flag-pass");
  });

  it("flags can partially override (mix sources)", () => {
    clearEnv();
    process.env.CUCM_USERNAME = "env-user";
    saveConfig({ activeCluster: "lab", clusters: { lab: { host: "config-host", username: "config-user", password: "config-pass" } } });
    const result = resolveConfig({ host: "flag-host" });
    assert.strictEqual(result.host, "flag-host");
    assert.strictEqual(result.username, "env-user");
    assert.strictEqual(result.password, "config-pass");
  });
});

describe("resolveConfig — named cluster override", () => {
  it("uses --cluster flag to select a specific cluster", () => {
    clearEnv();
    saveConfig({
      activeCluster: "prod",
      clusters: {
        prod: { host: "prod-host", username: "prod-user", password: "prod-pass" },
        lab: { host: "lab-host", username: "lab-user", password: "lab-pass" },
      },
    });
    const result = resolveConfig({ cluster: "lab" });
    assert.strictEqual(result.host, "lab-host");
    assert.strictEqual(result.username, "lab-user");
  });
});

describe("resolveConfig — insecure defaults to false", () => {
  it("insecure is false when not set anywhere", () => {
    clearEnv();
    saveConfig({ activeCluster: "lab", clusters: { lab: { host: "h", username: "u", password: "p" } } });
    const result = resolveConfig({});
    assert.strictEqual(result.insecure, false);
  });

  it("insecure flag overrides config", () => {
    clearEnv();
    saveConfig({ activeCluster: "lab", clusters: { lab: { host: "h", username: "u", password: "p" } } });
    const result = resolveConfig({ insecure: true });
    assert.strictEqual(result.insecure, true);
  });
});

// Restore env and cleanup
restoreEnv();
fs.rmSync(tmpDir, { recursive: true, force: true });

console.log(`\n  connection.test.js: ${total} tests, ${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
