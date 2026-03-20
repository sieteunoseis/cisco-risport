const { Command } = require("commander");
const pkg = require("../package.json");

// Suppress Node.js TLS warning when --insecure is used
const originalEmitWarning = process.emitWarning;
process.emitWarning = (warning, ...args) => {
  if (typeof warning === "string" && warning.includes("NODE_TLS_REJECT_UNAUTHORIZED")) return;
  originalEmitWarning.call(process, warning, ...args);
};

try {
  const updateNotifier = require("update-notifier").default || require("update-notifier");
  updateNotifier({ pkg }).notify();
} catch {};

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
require("./commands/doctor.js")(program);

program.parse();
