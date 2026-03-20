const assert = require("assert");

let passed = 0, failed = 0, total = 0;
function describe(name, fn) { console.log(`  ${name}`); fn(); }
function it(name, fn) {
  total++;
  try { fn(); console.log(`    \u2713 ${name}`); passed++; }
  catch (e) { console.log(`    \u2717 ${name}: ${e.message}`); failed++; }
}
async function itAsync(name, fn) {
  total++;
  try { await fn(); console.log(`    \u2713 ${name}`); passed++; }
  catch (e) { console.log(`    \u2717 ${name}: ${e.message}`); failed++; }
}

const formatTable = require("../../cli/formatters/table.js");
const formatJson = require("../../cli/formatters/json.js");
const formatCsv = require("../../cli/formatters/csv.js");
const formatToon = require("../../cli/formatters/toon.js");

const sampleList = [
  { Name: "SEP001122334455", IpAddress: "10.0.0.1", Status: "Registered" },
  { Name: "SEP556677889900", IpAddress: "10.0.0.2", Status: "UnRegistered" },
];
const sampleItem = { Name: "SEP001122334455", IpAddress: "10.0.0.1", Status: "Registered" };

(async () => {
  describe("table formatter", () => {
    it("produces string output for an array", () => {
      const result = formatTable(sampleList);
      assert.strictEqual(typeof result, "string");
      assert.ok(result.length > 0, "Output should not be empty");
    });

    it("includes column headers from object keys", () => {
      const result = formatTable(sampleList);
      assert.ok(result.includes("Name"), "Should contain 'Name' header");
      assert.ok(result.includes("IpAddress"), "Should contain 'IpAddress' header");
      assert.ok(result.includes("Status"), "Should contain 'Status' header");
    });

    it("includes data values", () => {
      const result = formatTable(sampleList);
      assert.ok(result.includes("SEP001122334455"), "Should contain device name");
      assert.ok(result.includes("10.0.0.1"), "Should contain IP address");
    });

    it("includes row count in output", () => {
      const result = formatTable(sampleList);
      assert.ok(result.includes("2 results found"), "Should show result count");
    });

    it("shows singular 'result' for single-item array", () => {
      const result = formatTable([sampleItem]);
      assert.ok(result.includes("1 result found"), "Should show singular result");
    });

    it("produces key-value output for a single object", () => {
      const result = formatTable(sampleItem);
      assert.strictEqual(typeof result, "string");
      assert.ok(result.includes("SEP001122334455"), "Should contain item value");
    });

    it("returns 'No results found' for empty array", () => {
      const result = formatTable([]);
      assert.strictEqual(result, "No results found");
    });

    it("handles null/undefined values gracefully", () => {
      const result = formatTable([{ Name: "test", IpAddress: null, Status: undefined }]);
      assert.strictEqual(typeof result, "string");
    });
  });

  describe("json formatter", () => {
    it("produces valid JSON for an array", () => {
      const result = formatJson(sampleList);
      const parsed = JSON.parse(result);
      assert.ok(Array.isArray(parsed), "Parsed result should be an array");
      assert.strictEqual(parsed.length, 2);
    });

    it("produces valid JSON for a single item", () => {
      const result = formatJson(sampleItem);
      const parsed = JSON.parse(result);
      assert.strictEqual(parsed.Name, "SEP001122334455");
    });

    it("output is pretty-printed with 2-space indent", () => {
      const result = formatJson(sampleItem);
      assert.ok(result.includes("  "), "Should contain 2-space indentation");
    });

    it("preserves all fields", () => {
      const result = formatJson(sampleItem);
      const parsed = JSON.parse(result);
      assert.strictEqual(parsed.IpAddress, "10.0.0.1");
      assert.strictEqual(parsed.Status, "Registered");
    });
  });

  describe("csv formatter", () => {
    it("produces CSV with headers for an array", () => {
      const result = formatCsv(sampleList);
      const lines = result.trim().split("\n");
      assert.ok(lines.length >= 3, "Should have header + 2 data rows");
      assert.ok(lines[0].includes("Name"), "First line should contain header 'Name'");
      assert.ok(lines[0].includes("IpAddress"), "First line should contain header 'IpAddress'");
    });

    it("produces CSV for a single item (wrapped in array)", () => {
      const result = formatCsv(sampleItem);
      const lines = result.trim().split("\n");
      assert.ok(lines.length >= 2, "Should have header + 1 data row");
    });

    it("returns empty string for empty array", () => {
      const result = formatCsv([]);
      assert.strictEqual(result, "");
    });

    it("includes data values in rows", () => {
      const result = formatCsv(sampleList);
      assert.ok(result.includes("SEP001122334455"), "Should contain device name");
      assert.ok(result.includes("10.0.0.1"), "Should contain IP address");
    });
  });

  console.log(`  toon formatter`);
  await itAsync("produces string output", async () => {
    const result = await formatToon(sampleItem);
    assert.strictEqual(typeof result, "string");
    assert.ok(result.length > 0, "Output should not be empty");
  });

  await itAsync("handles array input", async () => {
    const result = await formatToon(sampleList);
    assert.strictEqual(typeof result, "string");
    assert.ok(result.length > 0, "Output should not be empty");
  });

  console.log(`\n  formatters.test.js: ${total} tests, ${passed} passed, ${failed} failed`);
  if (failed > 0) process.exit(1);
})();
