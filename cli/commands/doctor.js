const config = require("../utils/config.js");
const { resolveConfig } = require("../utils/connection.js");

module.exports = function (program) {
  program.command("doctor")
    .description("Check RisPort connectivity and configuration health")
    .action(async (opts, command) => {
      const globalOpts = command.optsWithGlobals();
      let passed = 0;
      let warned = 0;
      let failed = 0;

      const ok = (msg) => { console.log(`  \u2713 ${msg}`); passed++; };
      const warn = (msg) => { console.log(`  \u26A0 ${msg}`); warned++; };
      const fail = (msg) => { console.log(`  \u2717 ${msg}`); failed++; };

      console.log("\n  cisco-risport doctor");
      console.log("  " + "\u2500".repeat(50));

      // 1. Configuration
      console.log("\n  Configuration");
      let conn;
      try {
        const data = config.loadConfig();
        if (!data.activeCluster) {
          fail("No active cluster configured");
          console.log("    Run: cisco-risport config add <name> --host <host> --username <user> --password <pass>");
          printSummary(passed, warned, failed);
          return;
        }
        ok(`Active cluster: ${data.activeCluster}`);
        const cluster = data.clusters[data.activeCluster];
        ok(`Host: ${cluster.host}`);
        ok(`Username: ${cluster.username}`);

        if (cluster.insecure) warn("TLS verification: disabled (--insecure)");
        else ok("TLS verification: enabled");

        conn = resolveConfig(globalOpts);
      } catch (err) {
        fail(`Config error: ${err.message}`);
        printSummary(passed, warned, failed);
        return;
      }

      // 2. RisPort API connectivity
      console.log("\n  RisPort API");
      try {
        if (conn.insecure) { process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0"; }
        const RisPort = require("../../main.js");
        const svc = new RisPort(conn.host, conn.username, conn.password);

        // Test with returnModels (no network call needed)
        const models = svc.returnModels();
        ok(`Models loaded: ${Object.keys(models).length} device models`);

        // Test with a real query (1 device max)
        const result = await svc.selectCmDevice("SelectCmDevice", 1, "Any", "", "Any", "", "Name", "", "Any", "Any");
        ok("RisPort API: connected");

        // Node discovery
        if (result.results) {
          const nodes = Array.isArray(result.results) ? result.results : [result.results];
          const nodeNames = nodes.map((n) => n.Name || n.name || "unknown").filter(Boolean);
          ok(`Nodes discovered: ${nodeNames.length > 0 ? nodeNames.join(", ") : "none"}`);
        }
      } catch (err) {
        const msg = err.message || String(err);
        if (msg.includes("401") || msg.includes("Authentication")) {
          fail("RisPort API: authentication failed \u2014 check username/password");
        } else if (msg.includes("ECONNREFUSED")) {
          fail("RisPort API: connection refused \u2014 check host and port");
        } else if (msg.includes("ENOTFOUND")) {
          fail("RisPort API: hostname not found \u2014 check host");
        } else if (msg.includes("certificate")) {
          fail("RisPort API: TLS certificate error \u2014 try adding --insecure to the cluster config");
        } else {
          fail(`RisPort API: ${msg}`);
        }
      }

      // 3. Security
      console.log("\n  Security");
      try {
        const fs = require("node:fs");
        const configPath = config.getConfigPath();
        const stats = fs.statSync(configPath);
        const mode = (stats.mode & 0o777).toString(8);
        if (mode === "600") ok(`Config file permissions: ${mode} (secure)`);
        else warn(`Config file permissions: ${mode} \u2014 should be 600. Run: chmod 600 ${configPath}`);
      } catch { /* config file may not exist yet */ }

      // 4. Audit trail
      try {
        const fs = require("node:fs");
        const path = require("node:path");
        const auditPath = path.join(config.getConfigDir(), "audit.jsonl");
        if (fs.existsSync(auditPath)) {
          const stats = fs.statSync(auditPath);
          const sizeMB = (stats.size / 1024 / 1024).toFixed(1);
          ok(`Audit trail: ${sizeMB}MB`);
          if (stats.size > 8 * 1024 * 1024) warn("Audit trail approaching 10MB rotation limit");
        } else {
          ok("Audit trail: empty (no operations logged yet)");
        }
      } catch { /* ignore */ }

      printSummary(passed, warned, failed);
    });

  function printSummary(passed, warned, failed) {
    console.log("\n  " + "\u2500".repeat(50));
    console.log(`  Results: ${passed} passed, ${warned} warning${warned !== 1 ? "s" : ""}, ${failed} failed`);
    if (failed > 0) {
      process.exitCode = 1;
      console.log("  Status:  issues found \u2014 review failures above");
    } else if (warned > 0) {
      console.log("  Status:  healthy with warnings");
    } else {
      console.log("  Status:  all systems healthy");
    }
    console.log("");
  }
};
