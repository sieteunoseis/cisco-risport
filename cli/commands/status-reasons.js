const { printResult, printError } = require("../utils/output.js");

module.exports = function (program) {
  program
    .command("status-reasons")
    .description("List status reason code-to-description mappings (returnStatusReasons)")
    .action(async (opts, cmd) => {
      try {
        const globalOpts = cmd.optsWithGlobals();
        const RisPort = require("../../main.js");
        // Status reasons are static data; no connection needed
        const svc = new RisPort("localhost", "x", "x");
        const reasons = svc.returnStatusReasons();
        const rows = Object.entries(reasons).map(([code, description]) => ({ code, description }));
        if (rows.length === 0) {
          console.log("No status reasons available.");
        } else {
          await printResult(rows, globalOpts.format);
        }
      } catch (err) { printError(err); }
    });
};
