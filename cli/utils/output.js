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
    process.stderr.write("Hint: Reduce query frequency or use --paginate with smaller --max values.\n");
  } else if (message.includes("certificate") || message.includes("CERT")) {
    process.stderr.write("Hint: Use --insecure for self-signed certificates.\n");
  }
  process.exitCode = 1;
}

module.exports = { printResult, printError };
