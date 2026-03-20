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

function registerCommand(program) {
  program
    .command("cti")
    .description("Query CTI device/line/provider registration status (selectCtiItem)")
    .option("--class <class>", "Provider|Device|Line", "Provider")
    .option("--status <status>", "Open|Closed|Any", "Any")
    .option("--node <name>", "filter to a specific CUCM node")
    .option("--select-by <field>", "AppName|AppID|UserID", "")
    .option("--item <value>", "application name/ID or user ID to filter on")
    .option("--device-name <name>", "device name filter (comma-separated for multiple)")
    .option("--dir-number <number>", "directory number filter (comma-separated for multiple)")
    .option("--max <n>", "maximum results", "1000")
    .action(async (cmdOpts, cmd) => {
      const start = Date.now();
      try {
        const globalOpts = cmd.optsWithGlobals();
        const connConfig = resolveConfig(globalOpts);
        if (connConfig.insecure) process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";

        const RisPort = require("../../main.js");
        const svc = new RisPort(connConfig.host, connConfig.username, connConfig.password);

        const appItems = cmdOpts.item ? cmdOpts.item.split(",").map((s) => s.trim()) : [""];
        const devNames = cmdOpts.deviceName ? cmdOpts.deviceName.split(",").map((s) => s.trim()) : [""];
        const dirNumbers = cmdOpts.dirNumber ? cmdOpts.dirNumber.split(",").map((s) => s.trim()) : [""];

        const result = await svc.selectCtiDevice(
          parseInt(cmdOpts.max, 10) || 1000,
          cmdOpts.class,
          cmdOpts.status,
          cmdOpts.node || "",
          cmdOpts.selectBy || "",
          appItems.length === 1 ? appItems[0] : appItems,
          devNames.length === 1 ? devNames[0] : devNames,
          dirNumbers.length === 1 ? dirNumbers[0] : dirNumbers
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
        audit.log({ command: "cti", duration_ms: Date.now() - start, status: "error", error: err.message || String(err) });
        printError(err);
      }
    });
}

module.exports = registerCommand;
module.exports.flattenCtiResults = flattenCtiResults;
