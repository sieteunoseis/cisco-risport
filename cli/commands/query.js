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

function registerCommand(program) {
  program
    .command("query")
    .description("Query real-time CM device registration status (SelectCmDevice / SelectCmDeviceExt)")
    .option("--class <class>", "Any|Phone|Gateway|H323|Cti|VoiceMail|MediaResources|HuntList|SIPTrunk|Unknown", "Any")
    .option("--status <status>", "Any|Registered|UnRegistered|Rejected|PartiallyRegistered|Unknown", "Any")
    .option("--model <id>", "model number or name (255 = any)", "255")
    .option("--select-by <field>", "Name|IPV4Address|IPV6Address|DirNumber|Description|SIPStatus")
    .option("--item <value>", "single or comma-separated items (used with --select-by)")
    .option("--protocol <proto>", "Any|SCCP|SIP|Unknown", "Any")
    .option("--download-status <status>", "Any|Upgrading|Successful|Failed|Unknown", "Any")
    .option("--node <name>", "filter to a specific CUCM node")
    .option("--max <n>", "maximum results per page", "1000")
    .option("--paginate", "auto-paginate through all results using StateInfo")
    .option("--ext", "use SelectCmDeviceExt instead of SelectCmDevice")
    .action(async (cmdOpts, cmd) => {
      const start = Date.now();
      try {
        const globalOpts = cmd.optsWithGlobals();
        const connConfig = resolveConfig(globalOpts);
        if (connConfig.insecure) process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";
        if (globalOpts.debug) process.env.DEBUG = "cisco-risport";

        const RisPort = require("../../main.js");
        const svc = new RisPort(connConfig.host, connConfig.username, connConfig.password);

        const selectItem = cmdOpts.item || "";
        const action = cmdOpts.ext ? "SelectCmDeviceExt" : "SelectCmDevice";
        const maxReturned = parseInt(cmdOpts.max, 10) || 1000;
        const deviceClass = cmdOpts.class || "Any";
        const model = cmdOpts.model || "";
        const status = cmdOpts.status || "Any";
        const node = cmdOpts.node || "";
        const selectBy = cmdOpts.selectBy || "Name";
        const protocol = cmdOpts.protocol || "Any";
        const downloadStatus = cmdOpts.downloadStatus || "Any";

        let rawResults;
        if (cmdOpts.paginate) {
          const paged = await svc.selectCmDevicePaginated(action, maxReturned, deviceClass, model, status, node, selectBy, selectItem, protocol, downloadStatus);
          rawResults = paged.results;
        } else {
          const result = await svc.selectCmDevice(action, maxReturned, deviceClass, model, status, node, selectBy, selectItem, protocol, downloadStatus);
          rawResults = result.results;
        }

        const devices = flattenResults(rawResults);

        if (devices.length === 0) {
          console.log("No devices found matching the criteria.");
        } else {
          // Select table columns
          const columns = ["Name", "IpAddress", "Status", "StatusReason", "Model", "Protocol", "ActiveLoadID", "DirNumber", "Description"];
          const format = globalOpts.format || "table";
          if (format === "table") {
            const rows = devices.map((d) => {
              const row = {};
              for (const col of columns) row[col] = d[col] ?? "";
              return row;
            });
            await printResult(rows, format);
          } else {
            await printResult(devices, format);
          }
        }

        if (globalOpts.audit !== false) {
          audit.log({
            cluster: connConfig.host, command: "query",
            args: { deviceClass: cmdOpts.class, status: cmdOpts.status },
            duration_ms: Date.now() - start, status: "success", results: devices.length,
          });
        }
      } catch (err) {
        audit.log({ command: "query", duration_ms: Date.now() - start, status: "error", error: err.message || String(err) });
        printError(err);
      }
    });
}

module.exports = registerCommand;
module.exports.flattenResults = flattenResults;
