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
    .action(async (opts, cmd) => {
      try {
        const globalOpts = cmd.optsWithGlobals();
        const { resolveConfig } = require("../utils/connection.js");
        const connConfig = resolveConfig(globalOpts);
        if (connConfig.insecure) process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";
        const RisPort = require("../../main.js");
        const svc = new RisPort(connConfig.host, connConfig.username, connConfig.password);
        const models = svc.returnModels();
        if (models && Object.keys(models).length > 0) {
          console.log(`Connection validated. RisPort70 at ${connConfig.host}:8443 is reachable.`);
          console.log(`Models loaded: ${Object.keys(models).length} device models available.`);
        } else {
          console.log(`Connection to ${connConfig.host} established but no models returned.`);
        }
      } catch (err) { printError(err); }
    });
};
