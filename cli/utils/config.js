const fs = require("node:fs");
const path = require("node:path");
const os = require("node:os");
const { execSync } = require("node:child_process");

const SS_PLACEHOLDER_RE = /<ss:(\d+):(\w+)>/g;

function getConfigDir() {
  return process.env.CISCO_RISPORT_CONFIG_DIR || path.join(os.homedir(), ".cisco-risport");
}

function getConfigPath() {
  return path.join(getConfigDir(), "config.json");
}

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
  getConfigDir, getConfigPath, loadConfig, saveConfig, addCluster, useCluster, removeCluster,
  getActiveCluster, listClusters, maskPassword, hasSsPlaceholders, resolveSsPlaceholders,
};
