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

const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "cisco-risport-test-config-"));
process.env.CISCO_RISPORT_CONFIG_DIR = tmpDir;

const {
  loadConfig, saveConfig, addCluster, useCluster, removeCluster,
  getActiveCluster, listClusters, maskPassword, hasSsPlaceholders,
  getConfigDir, getConfigPath,
} = require("../../cli/utils/config.js");

describe("getConfigDir", () => {
  it("returns the CISCO_RISPORT_CONFIG_DIR env value", () => {
    assert.strictEqual(getConfigDir(), tmpDir);
  });

  it("returns path under home when env is unset", () => {
    const saved = process.env.CISCO_RISPORT_CONFIG_DIR;
    delete process.env.CISCO_RISPORT_CONFIG_DIR;
    const dir = getConfigDir();
    assert.strictEqual(dir, path.join(os.homedir(), ".cisco-risport"));
    process.env.CISCO_RISPORT_CONFIG_DIR = saved;
  });
});

describe("getConfigPath", () => {
  it("returns config.json inside config dir", () => {
    assert.ok(getConfigPath().endsWith("config.json"));
  });
});

describe("loadConfig", () => {
  it("returns defaults when no config file exists", () => {
    const config = loadConfig();
    assert.strictEqual(config.activeCluster, null);
    assert.deepStrictEqual(config.clusters, {});
  });
});

describe("saveConfig / loadConfig round-trip", () => {
  it("writes and reads back the same data", () => {
    const data = { activeCluster: "lab", clusters: { lab: { host: "10.0.0.1", username: "admin", password: "pass" } } };
    saveConfig(data);
    const loaded = loadConfig();
    assert.strictEqual(loaded.activeCluster, "lab");
    assert.strictEqual(loaded.clusters.lab.host, "10.0.0.1");
  });

  it("config file exists on disk after save", () => {
    const configPath = path.join(tmpDir, "config.json");
    assert.ok(fs.existsSync(configPath), "config.json should exist");
  });

  it("config file has restricted permissions (600)", () => {
    const configPath = path.join(tmpDir, "config.json");
    const stats = fs.statSync(configPath);
    const mode = (stats.mode & 0o777).toString(8);
    assert.strictEqual(mode, "600");
  });
});

describe("addCluster", () => {
  // Reset config for these tests
  it("adds a cluster and sets it active if none active", () => {
    saveConfig({ activeCluster: null, clusters: {} });
    addCluster("prod", { host: "cucm.example.com", username: "admin", password: "secret" });
    const config = loadConfig();
    assert.strictEqual(config.activeCluster, "prod");
    assert.strictEqual(config.clusters.prod.host, "cucm.example.com");
  });

  it("adds insecure flag when specified", () => {
    addCluster("lab2", { host: "lab.local", username: "u", password: "p", insecure: true });
    const config = loadConfig();
    assert.strictEqual(config.clusters.lab2.insecure, true);
  });

  it("does not overwrite activeCluster if one already set", () => {
    const config = loadConfig();
    assert.strictEqual(config.activeCluster, "prod");
  });
});

describe("useCluster", () => {
  it("switches the active cluster", () => {
    useCluster("lab2");
    const config = loadConfig();
    assert.strictEqual(config.activeCluster, "lab2");
  });

  it("throws for unknown cluster", () => {
    assert.throws(() => useCluster("nonexistent"), /not found/);
  });
});

describe("removeCluster", () => {
  it("removes a cluster", () => {
    removeCluster("lab2");
    const config = loadConfig();
    assert.strictEqual(config.clusters.lab2, undefined);
  });

  it("reassigns activeCluster when removing the active one", () => {
    saveConfig({ activeCluster: "a", clusters: { a: { host: "h", username: "u", password: "p" }, b: { host: "h2", username: "u2", password: "p2" } } });
    removeCluster("a");
    const config = loadConfig();
    assert.strictEqual(config.activeCluster, "b");
  });

  it("sets activeCluster to null when removing last cluster", () => {
    removeCluster("b");
    const config = loadConfig();
    assert.strictEqual(config.activeCluster, null);
  });

  it("throws for unknown cluster", () => {
    assert.throws(() => removeCluster("nonexistent"), /not found/);
  });
});

describe("getActiveCluster", () => {
  it("returns null when no clusters configured", () => {
    saveConfig({ activeCluster: null, clusters: {} });
    assert.strictEqual(getActiveCluster(), null);
  });

  it("returns the active cluster with name merged in", () => {
    saveConfig({ activeCluster: "prod", clusters: { prod: { host: "h", username: "u", password: "p" } } });
    const cluster = getActiveCluster();
    assert.strictEqual(cluster.name, "prod");
    assert.strictEqual(cluster.host, "h");
  });

  it("returns a specific cluster when name is provided", () => {
    saveConfig({ activeCluster: "prod", clusters: { prod: { host: "h1", username: "u", password: "p" }, lab: { host: "h2", username: "u", password: "p" } } });
    const cluster = getActiveCluster("lab");
    assert.strictEqual(cluster.name, "lab");
    assert.strictEqual(cluster.host, "h2");
  });
});

describe("listClusters", () => {
  it("returns activeCluster and clusters map", () => {
    const result = listClusters();
    assert.ok("activeCluster" in result);
    assert.ok("clusters" in result);
    assert.strictEqual(typeof result.clusters, "object");
  });
});

describe("maskPassword", () => {
  it("masks a plain password with asterisks", () => {
    assert.strictEqual(maskPassword("secret"), "******");
  });

  it("returns empty string for falsy input", () => {
    assert.strictEqual(maskPassword(""), "");
    assert.strictEqual(maskPassword(null), "");
    assert.strictEqual(maskPassword(undefined), "");
  });

  it("preserves ss-cli placeholders unmasked", () => {
    const placeholder = "<ss:123:password>";
    assert.strictEqual(maskPassword(placeholder), placeholder);
  });
});

describe("hasSsPlaceholders", () => {
  it("detects <ss:ID:field> patterns", () => {
    assert.strictEqual(hasSsPlaceholders({ password: "<ss:123:password>" }), true);
  });

  it("returns false for plain strings", () => {
    assert.strictEqual(hasSsPlaceholders({ password: "plaintext" }), false);
  });

  it("returns false for empty object", () => {
    assert.strictEqual(hasSsPlaceholders({}), false);
  });
});

// Cleanup
fs.rmSync(tmpDir, { recursive: true, force: true });

console.log(`\n  config.test.js: ${total} tests, ${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
