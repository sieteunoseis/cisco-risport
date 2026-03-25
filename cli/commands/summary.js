const { resolveConfig } = require("../utils/connection.js");
const { printResult, printError } = require("../utils/output.js");
const audit = require("../utils/audit.js");
const { flattenResults } = require("./query.js");

const DEFAULT_CLASSES = ["Phone", "Gateway", "SIPTrunk"];
const ALL_CLASSES = [
  "Phone",
  "Gateway",
  "H323",
  "Cti",
  "VoiceMail",
  "MediaResources",
  "HuntList",
  "SIPTrunk",
];

function buildSummaryRow(deviceClass, devices) {
  const row = {
    class: deviceClass,
    registered: 0,
    unregistered: 0,
    rejected: 0,
    partial: 0,
    unknown: 0,
    total: devices.length,
  };
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

function registerCommand(program) {
  program
    .command("summary")
    .description(
      "Show registration summary across device classes (cluster health dashboard)",
    )
    .option(
      "--all-classes",
      "query all device classes (default: Phone, Gateway, SIPTrunk)",
    )
    .option("--node <name>", "filter to a specific CUCM node")
    .option(
      "--no-ext",
      "use SelectCmDevice instead of SelectCmDeviceExt (returns per-node duplicates)",
    )
    .action(async (cmdOpts, cmd) => {
      const start = Date.now();
      try {
        const globalOpts = cmd.optsWithGlobals();
        const connConfig = resolveConfig(globalOpts);
        if (connConfig.insecure) process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";

        const RisPort = require("../../main.js");
        const svc = new RisPort(
          connConfig.host,
          connConfig.username,
          connConfig.password,
        );
        const action =
          cmdOpts.ext === false ? "SelectCmDevice" : "SelectCmDeviceExt";
        const classes = cmdOpts.allClasses ? ALL_CLASSES : DEFAULT_CLASSES;

        const rows = [];
        for (const deviceClass of classes) {
          const result = await svc.selectCmDevice(
            action,
            1000,
            deviceClass,
            "",
            "Any",
            cmdOpts.node || "",
            "Name",
            "",
            "Any",
            "Any",
          );
          const devices = flattenResults(result.results);
          rows.push(buildSummaryRow(deviceClass, devices));
        }

        await printResult(rows, globalOpts.format);

        if (globalOpts.audit !== false) {
          audit.log({
            cluster: connConfig.host,
            command: "summary",
            duration_ms: Date.now() - start,
            status: "success",
          });
        }
      } catch (err) {
        audit.log({
          command: "summary",
          duration_ms: Date.now() - start,
          status: "error",
          error: err.message || String(err),
        });
        printError(err);
      }
    });
}

module.exports = registerCommand;
module.exports.buildSummaryRow = buildSummaryRow;
