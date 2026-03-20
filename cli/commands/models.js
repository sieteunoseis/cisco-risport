const { printResult, printError } = require("../utils/output.js");

function modelsToRows(models) {
  return Object.entries(models).map(([id, name]) => ({ id, name }));
}

function registerCommand(program) {
  program
    .command("models")
    .description("List device model ID-to-name mappings (returnModels)")
    .option("--search <term>", "filter models by name or ID")
    .action(async (cmdOpts, cmd) => {
      try {
        const globalOpts = cmd.optsWithGlobals();
        const RisPort = require("../../main.js");
        // Models are static data; no connection needed
        const svc = new RisPort("localhost", "x", "x");
        const models = svc.returnModels();
        let rows = modelsToRows(models);
        if (cmdOpts.search) {
          const term = cmdOpts.search.toLowerCase();
          rows = rows.filter((r) => r.id.toLowerCase().includes(term) || r.name.toLowerCase().includes(term));
        }
        if (rows.length === 0) {
          console.log("No models found matching the search criteria.");
        } else {
          await printResult(rows, globalOpts.format);
        }
      } catch (err) { printError(err); }
    });
}

module.exports = registerCommand;
module.exports.modelsToRows = modelsToRows;
