# Implementation Plan: cisco-risport CLI & Skills

**Goal:** Add `cisco-risport` CLI to the npm package, wrapping `risPortService` with multi-cluster config, audit logging, and four output formats.
**Architecture:** CJS `cli/` directory; imports library from `main.js`; plain Commander.js program.
**Tech Stack:** commander, cli-table3, @toon-format/toon, csv-stringify, update-notifier; tests in node:test.

---

## File Map

```
cli/
  index.js
  commands/config.js
  commands/query.js
  commands/cti.js
  commands/models.js
  commands/status-reasons.js
  commands/summary.js
  formatters/table.js
  formatters/json.js
  formatters/toon.js
  formatters/csv.js
  utils/config.js
  utils/connection.js
  utils/audit.js
  utils/output.js
skills/cisco-risport-cli/SKILL.md
test/cli/utils/config.test.js
test/cli/utils/connection.test.js
test/cli/utils/audit.test.js
test/cli/utils/output.test.js
test/cli/query.test.js
test/cli/cti.test.js
test/cli/models.test.js
test/cli/summary.test.js
```

---

## Tasks

### Task 1: Dependencies & package.json

Add to `package.json`:

```json
{
  "bin": { "cisco-risport": "./cli/index.js" },
  "dependencies": {
    "commander": "^12.0.0",
    "cli-table3": "^0.6.3",
    "@toon-format/toon": "^1.0.0",
    "csv-stringify": "^6.0.0",
    "update-notifier": "^7.0.0"
  }
}
```

Run: `npm install`

Add shebang to `cli/index.js`: `#!/usr/bin/env node`

---

### Task 2: Utilities — config.js

**Test first:** `test/cli/utils/config.test.js`

```js
const { test } = require("node:test");
const assert = require("node:assert/strict");
const os = require("node:os");
const path = require("node:path");
const fs = require("node:fs");

function withTempDir(fn) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "risport-test-"));
  try { return fn(dir); } finally { fs.rmSync(dir, { recursive: true, force: true }); }
}

test("addCluster and getActiveCluster round-trip", () => {
  withTempDir((dir) => {
    process.env.CISCO_RISPORT_CONFIG_DIR = dir;
    const c = require("../../../cli/utils/config.js");
    c.addCluster("lab", { host: "10.0.0.1", username: "admin", password: "secret" });
    const cluster = c.getActiveCluster();
    assert.equal(cluster.host, "10.0.0.1");
    assert.equal(cluster.name, "lab");
    delete process.env.CISCO_RISPORT_CONFIG_DIR;
  });
});

test("useCluster switches active cluster", () => {
  withTempDir((dir) => {
    process.env.CISCO_RISPORT_CONFIG_DIR = dir;
    const c = require("../../../cli/utils/config.js");
    c.addCluster("a", { host: "1.1.1.1", username: "u", password: "p" });
    c.addCluster("b", { host: "2.2.2.2", username: "u", password: "p" });
    c.useCluster("b");
    assert.equal(c.getActiveCluster().name, "b");
    delete process.env.CISCO_RISPORT_CONFIG_DIR;
  });
});

test("removeCluster updates active", () => {
  withTempDir((dir) => {
    process.env.CISCO_RISPORT_CONFIG_DIR = dir;
    const c = require("../../../cli/utils/config.js");
    c.addCluster("a", { host: "1.1.1.1", username: "u", password: "p" });
    c.addCluster("b", { host: "2.2.2.2", username: "u", password: "p" });
    c.useCluster("a");
    c.removeCluster("a");
    const active = c.getActiveCluster();
    assert.equal(active.name, "b");
    delete process.env.CISCO_RISPORT_CONFIG_DIR;
  });
});

test("maskPassword masks plain passwords", () => {
  const c = require("../../../cli/utils/config.js");
  assert.equal(c.maskPassword("secret"), "******");
  assert.equal(c.maskPassword("<ss:42:password>"), "<ss:42:password>");
});
```

**Implementation:** `cli/utils/config.js`

```js
const fs = require("node:fs");
const path = require("node:path");
const os = require("node:os");
const { execSync } = require("node:child_process");

const SS_PLACEHOLDER_RE = /<ss:(\d+):(\w+)>/g;

function getConfigDir() {
  return process.env.CISCO_RISPORT_CONFIG_DIR || path.join(os.homedir(), ".cisco-risport");
}

function getConfigPath() { return path.join(getConfigDir(), "config.json"); }

function loadConfig() {
  const configPath = getConfigPath();
  if (!fs.existsSync(configPath)) return { activeCluster: null, clusters: {} };
  return JSON.parse(fs.readFileSync(configPath, "utf-8"));
}

function saveConfig(config) {
  const dir = getConfigDir();
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true, mode: 0o700 });
  fs.writeFileSync(getConfigPath(), JSON.stringify(config, null, 2), { mode: 0o600 });
}

function addCluster(name, opts) {
  const config = loadConfig();
  config.clusters[name] = { host: opts.host, username: opts.username, password: opts.password };
  if (opts.insecure) config.clusters[name].insecure = true;
  if (!config.activeCluster) config.activeCluster = name;
  saveConfig(config);
}

function useCluster(name) {
  const config = loadConfig();
  if (!config.clusters[name]) throw new Error(`Cluster "${name}" not found. Run "cisco-risport config list" to see available clusters.`);
  config.activeCluster = name;
  saveConfig(config);
}

function removeCluster(name) {
  const config = loadConfig();
  if (!config.clusters[name]) throw new Error(`Cluster "${name}" not found.`);
  delete config.clusters[name];
  if (config.activeCluster === name) {
    const remaining = Object.keys(config.clusters);
    config.activeCluster = remaining.length > 0 ? remaining[0] : null;
  }
  saveConfig(config);
}

function getActiveCluster(clusterName) {
  const config = loadConfig();
  const name = clusterName || config.activeCluster;
  if (!name || !config.clusters[name]) return null;
  return { name, ...config.clusters[name] };
}

function listClusters() {
  const config = loadConfig();
  return { activeCluster: config.activeCluster, clusters: config.clusters };
}

function maskPassword(password) {
  if (!password) return "";
  SS_PLACEHOLDER_RE.lastIndex = 0;
  if (SS_PLACEHOLDER_RE.test(password)) { SS_PLACEHOLDER_RE.lastIndex = 0; return password; }
  return "*".repeat(password.length);
}

function hasSsPlaceholders(obj) {
  for (const value of Object.values(obj)) {
    if (typeof value === "string") {
      SS_PLACEHOLDER_RE.lastIndex = 0;
      if (SS_PLACEHOLDER_RE.test(value)) { SS_PLACEHOLDER_RE.lastIndex = 0; return true; }
    }
  }
  return false;
}

function resolveSsPlaceholders(obj) {
  const resolved = { ...obj };
  for (const [key, value] of Object.entries(resolved)) {
    if (typeof value !== "string") continue;
    SS_PLACEHOLDER_RE.lastIndex = 0;
    resolved[key] = value.replace(SS_PLACEHOLDER_RE, (match, id, field) => {
      try {
        const output = execSync(`ss-cli get ${id} --format json`, { encoding: "utf-8", timeout: 10000 });
        const secret = JSON.parse(output);
        if (secret[field] !== undefined) return secret[field];
        if (Array.isArray(secret.items)) {
          const item = secret.items.find((i) => i.fieldName === field || i.slug === field);
          if (item) return item.itemValue;
        }
        throw new Error(`Field "${field}" not found in secret ${id}`);
      } catch (err) {
        if (err.message.includes("ENOENT") || err.message.includes("not found")) {
          throw new Error(`Config contains Secret Server references (<ss:...>) but ss-cli is not available. Install with: npm install -g @sieteunoseis/ss-cli`);
        }
        throw err;
      }
    });
  }
  return resolved;
}

module.exports = {
  getConfigDir, loadConfig, saveConfig, addCluster, useCluster, removeCluster,
  getActiveCluster, listClusters, maskPassword, hasSsPlaceholders, resolveSsPlaceholders,
};
```

---

### Task 3: Utilities — connection.js

**Test first:** `test/cli/utils/connection.test.js`

```js
const { test } = require("node:test");
const assert = require("node:assert/strict");

test("resolveConfig prefers flags over env", () => {
  process.env.CUCM_HOST = "env-host";
  process.env.CUCM_USERNAME = "env-user";
  process.env.CUCM_PASSWORD = "env-pass";
  const { resolveConfig } = require("../../../cli/utils/connection.js");
  const result = resolveConfig({ host: "flag-host", username: "flag-user", password: "flag-pass" });
  assert.equal(result.host, "flag-host");
  delete process.env.CUCM_HOST;
  delete process.env.CUCM_USERNAME;
  delete process.env.CUCM_PASSWORD;
});

test("resolveConfig accepts CUCM_HOSTNAME env var", () => {
  process.env.CUCM_HOSTNAME = "hostname-host";
  process.env.CUCM_USERNAME = "u";
  process.env.CUCM_PASSWORD = "p";
  const { resolveConfig } = require("../../../cli/utils/connection.js");
  const result = resolveConfig({});
  assert.equal(result.host, "hostname-host");
  delete process.env.CUCM_HOSTNAME;
  delete process.env.CUCM_USERNAME;
  delete process.env.CUCM_PASSWORD;
});

test("resolveConfig throws when missing credentials", () => {
  const { resolveConfig } = require("../../../cli/utils/connection.js");
  assert.throws(() => resolveConfig({}), /No cluster configured/);
});
```

**Implementation:** `cli/utils/connection.js`

```js
const configUtil = require("./config.js");

function resolveConfig(flags) {
  const env = {
    host: process.env.CUCM_HOST || process.env.CUCM_HOSTNAME || undefined,
    username: process.env.CUCM_USERNAME || undefined,
    password: process.env.CUCM_PASSWORD || undefined,
  };

  let fileConfig = {};
  const cluster = configUtil.getActiveCluster(flags.cluster || undefined);
  if (cluster) fileConfig = cluster;

  const resolved = {
    host: flags.host || env.host || fileConfig.host,
    username: flags.username || env.username || fileConfig.username,
    password: flags.password || env.password || fileConfig.password,
    insecure: flags.insecure || fileConfig.insecure || false,
  };

  if (!resolved.host || !resolved.username || !resolved.password) {
    throw new Error(
      "No cluster configured. Set one up with:\n" +
      "  cisco-risport config add <name> --host <h> --username <u> --password <p>\n" +
      "  Or set environment variables: CUCM_HOST, CUCM_USERNAME, CUCM_PASSWORD"
    );
  }

  if (configUtil.hasSsPlaceholders(resolved)) {
    Object.assign(resolved, configUtil.resolveSsPlaceholders(resolved));
  }

  return resolved;
}

module.exports = { resolveConfig };
```

---

### Task 4: Utilities — audit.js

**Test first:** `test/cli/utils/audit.test.js`

```js
const { test } = require("node:test");
const assert = require("node:assert/strict");
const os = require("node:os");
const path = require("node:path");
const fs = require("node:fs");

test("audit.log writes jsonl entry", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "audit-test-"));
  process.env.CISCO_RISPORT_CONFIG_DIR = dir;
  const audit = require("../../../cli/utils/audit.js");
  audit.log({ command: "query", status: "success" });
  const content = fs.readFileSync(path.join(dir, "audit.jsonl"), "utf-8");
  const entry = JSON.parse(content.trim());
  assert.equal(entry.command, "query");
  assert.ok(entry.timestamp);
  fs.rmSync(dir, { recursive: true, force: true });
  delete process.env.CISCO_RISPORT_CONFIG_DIR;
});

test("audit rotates when file exceeds 10MB", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "audit-rot-"));
  process.env.CISCO_RISPORT_CONFIG_DIR = dir;
  const auditPath = path.join(dir, "audit.jsonl");
  fs.writeFileSync(auditPath, "x".repeat(10 * 1024 * 1024 + 1));
  const audit = require("../../../cli/utils/audit.js");
  audit.log({ command: "test" });
  assert.ok(fs.existsSync(path.join(dir, "audit.jsonl.1")));
  fs.rmSync(dir, { recursive: true, force: true });
  delete process.env.CISCO_RISPORT_CONFIG_DIR;
});
```

**Implementation:** `cli/utils/audit.js`

```js
const fs = require("node:fs");
const path = require("node:path");
const { getConfigDir } = require("./config.js");

const MAX_FILE_SIZE = 10 * 1024 * 1024;

function getAuditPath() { return path.join(getConfigDir(), "audit.jsonl"); }

function rotateIfNeeded(auditPath) {
  try {
    const stats = fs.statSync(auditPath);
    if (stats.size >= MAX_FILE_SIZE) {
      const rotated = auditPath + ".1";
      if (fs.existsSync(rotated)) fs.unlinkSync(rotated);
      fs.renameSync(auditPath, rotated);
    }
  } catch { /* file doesn't exist yet */ }
}

function log(entry) {
  const dir = getConfigDir();
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true, mode: 0o700 });
  const auditPath = getAuditPath();
  rotateIfNeeded(auditPath);
  fs.appendFileSync(auditPath, JSON.stringify({ timestamp: new Date().toISOString(), ...entry }) + "\n");
}

module.exports = { log };
```

---

### Task 5: Utilities — output.js

**Test first:** `test/cli/utils/output.test.js`

```js
const { test } = require("node:test");
const assert = require("node:assert/strict");

test("printError writes to stderr", () => {
  const { printError } = require("../../../cli/utils/output.js");
  const original = process.stderr.write.bind(process.stderr);
  const lines = [];
  process.stderr.write = (msg) => { lines.push(msg); return true; };
  printError(new Error("something failed"));
  process.stderr.write = original;
  assert.ok(lines.some((l) => l.includes("something failed")));
});

test("printError emits auth hint on 401", () => {
  const { printError } = require("../../../cli/utils/output.js");
  const original = process.stderr.write.bind(process.stderr);
  const lines = [];
  process.stderr.write = (msg) => { lines.push(msg); return true; };
  printError(new Error("Authentication failed"));
  process.stderr.write = original;
  assert.ok(lines.some((l) => l.includes("cisco-risport config test")));
});
```

**Implementation:** `cli/utils/output.js`

```js
const formatTable = require("../formatters/table.js");
const formatJson = require("../formatters/json.js");
const formatToon = require("../formatters/toon.js");
const formatCsv = require("../formatters/csv.js");

const formatters = { table: formatTable, json: formatJson, toon: formatToon, csv: formatCsv };

async function printResult(data, format) {
  const formatter = formatters[format || "table"];
  if (!formatter) throw new Error(`Unknown format "${format}". Valid: table, json, toon, csv`);
  const output = await Promise.resolve(formatter(data));
  console.log(output);
}

function printError(err) {
  const message = err.message || String(err);
  process.stderr.write(`Error: ${message}\n`);
  if (message.includes("Authentication failed") || (err.status === 401)) {
    process.stderr.write('Hint: Run "cisco-risport config test" to verify your credentials.\n');
  } else if (message.includes("Rate limit") || err.status === 429) {
    process.stderr.write("Hint: Reduce query frequency or use --auto-page with smaller --max values.\n");
  } else if (message.includes("certificate") || message.includes("CERT")) {
    process.stderr.write("Hint: Use --insecure for self-signed certificates.\n");
  }
  process.exitCode = 1;
}

module.exports = { printResult, printError };
```

---

### Task 6: Formatters

**Implementation:** (copy verbatim from cisco-dime, no changes needed)

`cli/formatters/json.js`

```js
function formatJson(data) { return JSON.stringify(data, null, 2); }
module.exports = formatJson;
```

`cli/formatters/toon.js`

```js
async function formatToon(data) {
  const { encode } = await import("@toon-format/toon");
  return encode(data);
}
module.exports = formatToon;
```

`cli/formatters/csv.js`

```js
const { stringify } = require("csv-stringify/sync");
function formatCsv(data) {
  const rows = Array.isArray(data) ? data : [data];
  if (rows.length === 0) return "";
  const columns = Object.keys(rows[0]);
  return stringify(rows, { header: true, columns });
}
module.exports = formatCsv;
```

`cli/formatters/table.js`

```js
const Table = require("cli-table3");
function formatTable(data) {
  if (Array.isArray(data)) return formatListTable(data);
  return formatItemTable(data);
}
function formatListTable(rows) {
  if (rows.length === 0) return "No results found";
  const columns = Object.keys(rows[0]);
  const table = new Table({ head: columns });
  for (const row of rows) table.push(columns.map((col) => String(row[col] ?? "")));
  return `${table.toString()}\n${rows.length} result${rows.length !== 1 ? "s" : ""} found`;
}
function formatItemTable(item) {
  const table = new Table();
  for (const [key, value] of Object.entries(item)) {
    const displayValue = typeof value === "object" && value !== null ? JSON.stringify(value, null, 2) : String(value ?? "");
    table.push({ [key]: displayValue });
  }
  return table.toString();
}
module.exports = formatTable;
```

---

### Task 7: Entry Point — cli/index.js

**Implementation:**

```js
#!/usr/bin/env node
const { Command } = require("commander");
const pkg = require("../package.json");

import("update-notifier").then(({ default: updateNotifier }) => {
  updateNotifier({ pkg }).notify();
}).catch(() => {});

const program = new Command();

program
  .name("cisco-risport")
  .description("CLI for querying Cisco CUCM real-time device registration status via RisPort70")
  .version(pkg.version)
  .option("--format <type>", "output format: table, json, toon, csv", "table")
  .option("--host <host>", "CUCM hostname (overrides config/env)")
  .option("--username <user>", "CUCM username (overrides config/env)")
  .option("--password <pass>", "CUCM password (overrides config/env)")
  .option("--cluster <name>", "use a specific named cluster")
  .option("--insecure", "skip TLS certificate verification")
  .option("--no-audit", "disable audit logging for this command")
  .option("--debug", "enable debug logging");

require("./commands/config.js")(program);
require("./commands/query.js")(program);
require("./commands/cti.js")(program);
require("./commands/models.js")(program);
require("./commands/status-reasons.js")(program);
require("./commands/summary.js")(program);

program.parse();
```

---

### Task 8: Command — config.js

**Implementation:** `cli/commands/config.js`

```js
const configUtil = require("../utils/config.js");
const { printResult, printError } = require("../utils/output.js");

module.exports = function (program) {
  const config = program.command("config").description("Manage CUCM cluster configurations");

  config
    .command("add <name>")
    .description("Add a CUCM cluster (requires global --host, --username, --password)")
    .option("--insecure", "skip TLS verification for this cluster")
    .action((name, opts, cmd) => {
      try {
        const globalOpts = cmd.optsWithGlobals();
        const host = globalOpts.host;
        const username = globalOpts.username;
        const password = globalOpts.password;
        if (!host) throw new Error("Missing required option: --host");
        if (!username) throw new Error("Missing required option: --username");
        if (!password) throw new Error("Missing required option: --password");
        const clusterOpts = { host, username, password };
        if (opts.insecure || globalOpts.insecure) clusterOpts.insecure = true;
        configUtil.addCluster(name, clusterOpts);
        console.log(`Cluster "${name}" added successfully.`);
      } catch (err) { printError(err); }
    });

  config
    .command("use <name>")
    .description("Set the active cluster")
    .action((name) => {
      try { configUtil.useCluster(name); console.log(`Active cluster set to "${name}".`); }
      catch (err) { printError(err); }
    });

  config
    .command("list")
    .description("List all configured clusters")
    .action(async () => {
      try {
        const { activeCluster, clusters } = configUtil.listClusters();
        const rows = Object.entries(clusters).map(([name, c]) => ({
          name, active: name === activeCluster ? "*" : "", host: c.host, username: c.username,
        }));
        if (rows.length === 0) { console.log("No clusters configured. Run: cisco-risport config add <name> ..."); return; }
        await printResult(rows, program.opts().format);
      } catch (err) { printError(err); }
    });

  config
    .command("show")
    .description("Show active cluster details (masks password)")
    .action(async () => {
      try {
        const cluster = configUtil.getActiveCluster(program.opts().cluster);
        if (!cluster) { console.log("No active cluster. Run: cisco-risport config add <name> ..."); return; }
        await printResult({ ...cluster, password: configUtil.maskPassword(cluster.password) }, program.opts().format);
      } catch (err) { printError(err); }
    });

  config
    .command("remove <name>")
    .description("Remove a cluster")
    .action((name) => {
      try { configUtil.removeCluster(name); console.log(`Cluster "${name}" removed.`); }
      catch (err) { printError(err); }
    });

  config
    .command("test")
    .description("Test connection to the active cluster")
    .action(async () => {
      try {
        const { resolveConfig } = require("../utils/connection.js");
        const connConfig = resolveConfig(program.opts());
        if (connConfig.insecure) process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";
        const risPortService = require("../../main.js");
        const svc = new risPortService(connConfig.host, connConfig.username, connConfig.password);
        // Light query: max 1 device, any class — just tests auth and connectivity
        await svc.selectCmDevice({
          action: "SelectCmDevice", maxReturned: 1, deviceClass: "Any",
          model: 255, status: "Any", node: "", selectBy: "Name",
          selectItems: [""], protocol: "Any", downloadStatus: "Any",
        });
        console.log(`Connection successful. RisPort70 at ${connConfig.host}:8443 is reachable.`);
      } catch (err) { printError(err); }
    });
};
```

---

### Task 9: Command — query.js

**Test first:** `test/cli/query.test.js`

```js
const { test, mock } = require("node:test");
const assert = require("node:assert/strict");

test("query flattens node/device results into array", () => {
  // flattenResults helper: each CmNode.item has CmDevices.item
  const { flattenResults } = require("../../cli/commands/query.js");
  const nodes = [
    { Name: "node1", CmDevices: { item: [{ Name: "SEP001", Status: "Registered" }] } },
    { Name: "node2", CmDevices: { item: { Name: "SEP002", Status: "UnRegistered" } } },
  ];
  const flat = flattenResults(nodes);
  assert.equal(flat.length, 2);
  assert.equal(flat[0].Name, "SEP001");
  assert.equal(flat[1].Name, "SEP002");
});

test("query returns empty array for empty results", () => {
  const { flattenResults } = require("../../cli/commands/query.js");
  assert.deepEqual(flattenResults([]), []);
  assert.deepEqual(flattenResults(""), []);
  assert.deepEqual(flattenResults(null), []);
});
```

**Implementation:** `cli/commands/query.js`

```js
const { resolveConfig } = require("../utils/connection.js");
const { printResult, printError } = require("../utils/output.js");
const audit = require("../utils/audit.js");

function flattenResults(results) {
  if (!results || (typeof results === "string" && results === "")) return [];
  const nodes = Array.isArray(results) ? results : [results];
  const devices = [];
  for (const node of nodes) {
    if (!node || !node.CmDevices) continue;
    const items = node.CmDevices.item;
    if (!items) continue;
    const arr = Array.isArray(items) ? items : [items];
    for (const dev of arr) devices.push(dev);
  }
  return devices;
}

module.exports = function (program) {
  program
    .command("query")
    .description("Query real-time CM device registration status (selectCmDevice / selectCmDeviceExt)")
    .option("--device-class <class>", "Phone|Gateway|H323|Cti|VoiceMail|MediaResources|HuntList|SIPTrunk|Unknown|Any", "Any")
    .option("--status <status>", "Registered|UnRegistered|Rejected|PartiallyRegistered|Unknown|Any", "Any")
    .option("--select-by <field>", "Name|IPV4Address|IPV6Address|DirNumber|Description|SIPStatus", "Name")
    .option("--select-items <items>", "comma-separated device names/IPs/numbers")
    .option("--model <id>", "model number or name (255 = any)", "255")
    .option("--protocol <proto>", "SIP|SCCP|Unknown|Any", "Any")
    .option("--node <name>", "filter to a specific CUCM node")
    .option("--max <n>", "maximum results per page", "1000")
    .option("--extended", "use SelectCmDeviceExt for additional fields")
    .option("--auto-page", "auto-paginate through all results")
    .action(async (cmdOpts) => {
      const start = Date.now();
      try {
        const globalOpts = program.opts();
        const connConfig = resolveConfig(globalOpts);
        if (connConfig.insecure) process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";
        if (globalOpts.debug) process.env.DEBUG = "cisco-risport";

        const risPortService = require("../../main.js");
        const svc = new risPortService(connConfig.host, connConfig.username, connConfig.password);

        const selectItems = cmdOpts.selectItems ? cmdOpts.selectItems.split(",").map((s) => s.trim()) : [""];
        const action = cmdOpts.extended ? "SelectCmDeviceExt" : "SelectCmDevice";
        const opts = {
          action,
          maxReturned: parseInt(cmdOpts.max, 10) || 1000,
          deviceClass: cmdOpts.deviceClass,
          model: cmdOpts.model,
          status: cmdOpts.status,
          node: cmdOpts.node || "",
          selectBy: cmdOpts.selectBy,
          selectItems,
          protocol: cmdOpts.protocol,
          downloadStatus: "Any",
        };

        let rawResults;
        if (cmdOpts.autoPage) {
          const paged = await svc.selectCmDevicePaginated(opts);
          rawResults = paged.results;
        } else if (selectItems.length > 1000) {
          const batched = await svc.selectCmDeviceBatched(opts, {}, selectItems);
          rawResults = batched.results;
        } else {
          const result = await svc.selectCmDevice(opts);
          rawResults = result.results;
        }

        const devices = flattenResults(rawResults);

        if (devices.length === 0) {
          console.log("No devices found matching the criteria.");
        } else {
          await printResult(devices, globalOpts.format);
        }

        if (globalOpts.audit !== false) {
          audit.log({
            cluster: connConfig.host, command: "query",
            args: { deviceClass: cmdOpts.deviceClass, status: cmdOpts.status },
            duration_ms: Date.now() - start, status: "success", results: devices.length,
          });
        }
      } catch (err) {
        audit.log({ command: "query", duration_ms: Date.now() - start, status: "error", error: err.message });
        printError(err);
      }
    });
};

module.exports.flattenResults = flattenResults;
```

---

### Task 10: Command — cti.js

**Test first:** `test/cli/cti.test.js`

```js
const { test } = require("node:test");
const assert = require("node:assert/strict");

test("flattenCtiResults returns array from node items", () => {
  const { flattenCtiResults } = require("../../cli/commands/cti.js");
  const nodes = [
    { Name: "node1", CtiItems: { item: [{ AppID: "App1", Status: "Open" }] } },
  ];
  const flat = flattenCtiResults(nodes);
  assert.equal(flat.length, 1);
  assert.equal(flat[0].AppID, "App1");
});

test("flattenCtiResults handles empty/null", () => {
  const { flattenCtiResults } = require("../../cli/commands/cti.js");
  assert.deepEqual(flattenCtiResults(null), []);
  assert.deepEqual(flattenCtiResults([]), []);
});
```

**Implementation:** `cli/commands/cti.js`

```js
const { resolveConfig } = require("../utils/connection.js");
const { printResult, printError } = require("../utils/output.js");
const audit = require("../utils/audit.js");

function flattenCtiResults(results) {
  if (!results || (typeof results === "string" && results === "")) return [];
  const nodes = Array.isArray(results) ? results : [results];
  const items = [];
  for (const node of nodes) {
    if (!node || !node.CtiItems) continue;
    const nodeItems = node.CtiItems.item;
    if (!nodeItems) continue;
    const arr = Array.isArray(nodeItems) ? nodeItems : [nodeItems];
    for (const item of arr) items.push(item);
  }
  return items;
}

module.exports = function (program) {
  program
    .command("cti")
    .description("Query CTI device/line/provider registration status (selectCtiItem)")
    .option("--class <class>", "Provider|Device|Line", "Provider")
    .option("--status <status>", "Open|Closed|Any", "Any")
    .option("--node <name>", "filter to a specific CUCM node")
    .option("--app-by <field>", "AppID|UserID", "AppID")
    .option("--app-item <name>", "application ID or user ID to filter on")
    .option("--dev-name <name>", "device name filter")
    .option("--dir-number <number>", "directory number filter")
    .option("--max <n>", "maximum results", "1000")
    .action(async (cmdOpts) => {
      const start = Date.now();
      try {
        const globalOpts = program.opts();
        const connConfig = resolveConfig(globalOpts);
        if (connConfig.insecure) process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";

        const risPortService = require("../../main.js");
        const svc = new risPortService(connConfig.host, connConfig.username, connConfig.password);

        const result = await svc.selectCtiDevice(
          parseInt(cmdOpts.max, 10) || 1000,
          cmdOpts.class,
          cmdOpts.status,
          cmdOpts.node || "",
          cmdOpts.appBy || "AppID",
          cmdOpts.appItem || "",
          cmdOpts.devName || "",
          cmdOpts.dirNumber || ""
        );

        const items = flattenCtiResults(result.results);

        if (items.length === 0) {
          console.log("No CTI items found matching the criteria.");
        } else {
          await printResult(items, globalOpts.format);
        }

        if (globalOpts.audit !== false) {
          audit.log({
            cluster: connConfig.host, command: "cti",
            args: { class: cmdOpts.class, status: cmdOpts.status },
            duration_ms: Date.now() - start, status: "success", results: items.length,
          });
        }
      } catch (err) {
        audit.log({ command: "cti", duration_ms: Date.now() - start, status: "error", error: err.message });
        printError(err);
      }
    });
};

module.exports.flattenCtiResults = flattenCtiResults;
```

---

### Task 11: Command — models.js

**Test first:** `test/cli/models.test.js`

```js
const { test } = require("node:test");
const assert = require("node:assert/strict");

test("modelsToRows returns array of {id, name} objects", () => {
  const { modelsToRows } = require("../../cli/commands/models.js");
  const models = { "30006": "Cisco 7965", "30007": "Cisco 7975" };
  const rows = modelsToRows(models);
  assert.equal(rows.length, 2);
  assert.ok(rows.every((r) => "id" in r && "name" in r));
});
```

**Implementation:** `cli/commands/models.js`

```js
const { resolveConfig } = require("../utils/connection.js");
const { printResult, printError } = require("../utils/output.js");

function modelsToRows(models) {
  return Object.entries(models).map(([id, name]) => ({ id, name }));
}

module.exports = function (program) {
  program
    .command("models")
    .description("List device model ID-to-name mappings (returnModels)")
    .action(async () => {
      try {
        const globalOpts = program.opts();
        // Models are static data; no connection needed
        const risPortService = require("../../main.js");
        // Instantiate with dummy creds — returnModels() is synchronous and local
        const svc = new risPortService("localhost", "x", "x");
        const models = svc.returnModels();
        const rows = modelsToRows(models);
        await printResult(rows, globalOpts.format);
      } catch (err) { printError(err); }
    });
};

module.exports.modelsToRows = modelsToRows;
```

---

### Task 12: Command — status-reasons.js

**Implementation:** `cli/commands/status-reasons.js`

```js
const { printResult, printError } = require("../utils/output.js");

module.exports = function (program) {
  program
    .command("status-reasons")
    .description("List status reason code-to-description mappings (returnStatusReasons)")
    .action(async () => {
      try {
        const globalOpts = program.opts();
        const risPortService = require("../../main.js");
        const svc = new risPortService("localhost", "x", "x");
        const reasons = svc.returnStatusReasons();
        const rows = Object.entries(reasons).map(([code, description]) => ({ code, description }));
        await printResult(rows, globalOpts.format);
      } catch (err) { printError(err); }
    });
};
```

---

### Task 13: Command — summary.js

**Test first:** `test/cli/summary.test.js`

```js
const { test } = require("node:test");
const assert = require("node:assert/strict");

test("buildSummaryRow counts device statuses correctly", () => {
  const { buildSummaryRow } = require("../../cli/commands/summary.js");
  const devices = [
    { Status: "Registered" },
    { Status: "Registered" },
    { Status: "UnRegistered" },
    { Status: "Rejected" },
  ];
  const row = buildSummaryRow("Phone", devices);
  assert.equal(row.class, "Phone");
  assert.equal(row.registered, 2);
  assert.equal(row.unregistered, 1);
  assert.equal(row.rejected, 1);
  assert.equal(row.total, 4);
});

test("buildSummaryRow handles empty device list", () => {
  const { buildSummaryRow } = require("../../cli/commands/summary.js");
  const row = buildSummaryRow("Gateway", []);
  assert.equal(row.total, 0);
  assert.equal(row.registered, 0);
});
```

**Implementation:** `cli/commands/summary.js`

```js
const { resolveConfig } = require("../utils/connection.js");
const { printResult, printError } = require("../utils/output.js");
const audit = require("../utils/audit.js");
const { flattenResults } = require("./query.js");

const SUMMARY_CLASSES = ["Phone", "Gateway", "H323", "Cti", "VoiceMail", "MediaResources", "HuntList", "SIPTrunk"];

function buildSummaryRow(deviceClass, devices) {
  const row = { class: deviceClass, registered: 0, unregistered: 0, rejected: 0, partial: 0, unknown: 0, total: devices.length };
  for (const dev of devices) {
    const s = (dev.Status || "").toLowerCase();
    if (s === "registered") row.registered++;
    else if (s === "unregistered") row.unregistered++;
    else if (s === "rejected") row.rejected++;
    else if (s === "partiallyregistered") row.partial++;
    else row.unknown++;
  }
  return row;
}

module.exports = function (program) {
  program
    .command("summary")
    .description("Show registration summary across all device classes (cluster health dashboard)")
    .option("--node <name>", "filter to a specific CUCM node")
    .option("--extended", "use SelectCmDeviceExt")
    .action(async (cmdOpts) => {
      const start = Date.now();
      try {
        const globalOpts = program.opts();
        const connConfig = resolveConfig(globalOpts);
        if (connConfig.insecure) process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";

        const risPortService = require("../../main.js");
        const svc = new risPortService(connConfig.host, connConfig.username, connConfig.password);
        const action = cmdOpts.extended ? "SelectCmDeviceExt" : "SelectCmDevice";

        const rows = [];
        for (const deviceClass of SUMMARY_CLASSES) {
          const result = await svc.selectCmDevice({
            action, maxReturned: 10000, deviceClass, model: 255,
            status: "Any", node: cmdOpts.node || "", selectBy: "Name",
            selectItems: [""], protocol: "Any", downloadStatus: "Any",
          });
          const devices = flattenResults(result.results);
          rows.push(buildSummaryRow(deviceClass, devices));
        }

        await printResult(rows, globalOpts.format);

        if (globalOpts.audit !== false) {
          audit.log({
            cluster: connConfig.host, command: "summary",
            duration_ms: Date.now() - start, status: "success",
          });
        }
      } catch (err) {
        audit.log({ command: "summary", duration_ms: Date.now() - start, status: "error", error: err.message });
        printError(err);
      }
    });
};

module.exports.buildSummaryRow = buildSummaryRow;
```

---

### Task 14: Skill — SKILL.md

**Implementation:** `skills/cisco-risport-cli/SKILL.md`

````markdown
---
name: cisco-risport-cli
description: Use when querying Cisco CUCM real-time device registration status via the cisco-risport CLI — checking phone/gateway registration, CTI device status, cluster health summaries, and model/status-reason lookups.
---

# cisco-risport CLI

CLI for querying Cisco CUCM real-time device registration status via RisPort70 SOAP.

## Setup

Configure a cluster (one-time):

```bash
cisco-risport config add <name> --host <host> --username <user> --password <pass> --insecure
cisco-risport config test
```

Or use environment variables:

```bash
export CUCM_HOST=10.0.0.1
export CUCM_USERNAME=admin
export CUCM_PASSWORD=secret
```

## Common Workflows

### Check all registered phones

```bash
cisco-risport query --device-class Phone --status Registered
```

### Check specific devices by name

```bash
cisco-risport query --select-by Name --select-items SEP001122334455,SEP001122334466
```

### Get cluster health at a glance

```bash
cisco-risport summary
```

### Query all devices (auto-paginate)

```bash
cisco-risport query --device-class Phone --auto-page
```

### Check gateways in JSON

```bash
cisco-risport query --device-class Gateway --format json
```

### CTI provider status

```bash
cisco-risport cti --class Provider --status Open
```

### List available model IDs

```bash
cisco-risport models
```

### Look up a status reason code

```bash
cisco-risport status-reasons
```

### Export summary to CSV

```bash
cisco-risport summary --format csv > cluster-health.csv
```

## All Commands

| Command | Description |
|---|---|
| `config add <name>` | Add a CUCM cluster |
| `config use <name>` | Switch active cluster |
| `config list` | List all clusters |
| `config show` | Show active cluster |
| `config remove <name>` | Remove a cluster |
| `config test` | Test connectivity |
| `query` | Device registration status |
| `cti` | CTI device/line/provider status |
| `models` | Model ID lookup table |
| `status-reasons` | Status reason code lookup |
| `summary` | Cluster health dashboard |

## Global Flags

`--format table|json|toon|csv`, `--host`, `--username`, `--password`, `--cluster`, `--insecure`, `--no-audit`, `--debug`
````

---

### Task 15: .gitignore & Finishing Up

Add `docs/superpowers/` to `.gitignore`:

```
# Superpowers docs (local dev specs/plans)
docs/superpowers/
```

Run tests:

```bash
node --test test/cli/utils/config.test.js
node --test test/cli/utils/connection.test.js
node --test test/cli/utils/audit.test.js
node --test test/cli/utils/output.test.js
node --test test/cli/query.test.js
node --test test/cli/cti.test.js
node --test test/cli/models.test.js
node --test test/cli/summary.test.js
```

Smoke test after `npm install`:

```bash
cisco-risport --help
cisco-risport config add lab --host 10.0.0.1 --username admin --password secret --insecure
cisco-risport config list
cisco-risport config test
cisco-risport query --device-class Phone --status Registered
cisco-risport summary
```
