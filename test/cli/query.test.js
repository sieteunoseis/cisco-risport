const assert = require("assert");

let passed = 0, failed = 0, total = 0;
function describe(name, fn) { console.log(`  ${name}`); fn(); }
function it(name, fn) {
  total++;
  try { fn(); console.log(`    \u2713 ${name}`); passed++; }
  catch (e) { console.log(`    \u2717 ${name}: ${e.message}`); failed++; }
}

const { flattenResults } = require("../../cli/commands/query.js");
const { flattenCtiResults } = require("../../cli/commands/cti.js");
const { buildSummaryRow } = require("../../cli/commands/summary.js");
const { modelsToRows } = require("../../cli/commands/models.js");

describe("flattenResults", () => {
  it("returns empty array for null input", () => {
    assert.deepStrictEqual(flattenResults(null), []);
  });

  it("returns empty array for undefined input", () => {
    assert.deepStrictEqual(flattenResults(undefined), []);
  });

  it("returns empty array for empty string input", () => {
    assert.deepStrictEqual(flattenResults(""), []);
  });

  it("flattens a single node with multiple devices", () => {
    const input = {
      CmDevices: {
        item: [
          { Name: "SEP001122334455", Status: "Registered" },
          { Name: "SEP556677889900", Status: "UnRegistered" },
        ],
      },
    };
    const result = flattenResults(input);
    assert.strictEqual(result.length, 2);
    assert.strictEqual(result[0].Name, "SEP001122334455");
    assert.strictEqual(result[1].Name, "SEP556677889900");
  });

  it("flattens multiple nodes", () => {
    const input = [
      { CmDevices: { item: [{ Name: "DEV1" }] } },
      { CmDevices: { item: [{ Name: "DEV2" }, { Name: "DEV3" }] } },
    ];
    const result = flattenResults(input);
    assert.strictEqual(result.length, 3);
  });

  it("wraps a single-item (non-array) into the result", () => {
    const input = { CmDevices: { item: { Name: "SINGLE" } } };
    const result = flattenResults(input);
    assert.strictEqual(result.length, 1);
    assert.strictEqual(result[0].Name, "SINGLE");
  });

  it("skips nodes with no CmDevices", () => {
    const input = [{ SomeOtherKey: {} }, { CmDevices: { item: [{ Name: "DEV1" }] } }];
    const result = flattenResults(input);
    assert.strictEqual(result.length, 1);
  });

  it("skips nodes with CmDevices but no items", () => {
    const input = { CmDevices: {} };
    const result = flattenResults(input);
    assert.strictEqual(result.length, 0);
  });

  it("handles null entries in array", () => {
    const input = [null, { CmDevices: { item: [{ Name: "DEV1" }] } }];
    const result = flattenResults(input);
    assert.strictEqual(result.length, 1);
  });
});

describe("flattenCtiResults", () => {
  it("returns empty array for null input", () => {
    assert.deepStrictEqual(flattenCtiResults(null), []);
  });

  it("returns empty array for empty string", () => {
    assert.deepStrictEqual(flattenCtiResults(""), []);
  });

  it("flattens a single node with CtiItems", () => {
    const input = { CtiItems: { item: [{ Name: "CTI1" }, { Name: "CTI2" }] } };
    const result = flattenCtiResults(input);
    assert.strictEqual(result.length, 2);
  });

  it("flattens multiple nodes", () => {
    const input = [
      { CtiItems: { item: [{ Name: "CTI1" }] } },
      { CtiItems: { item: [{ Name: "CTI2" }] } },
    ];
    const result = flattenCtiResults(input);
    assert.strictEqual(result.length, 2);
  });

  it("wraps single item (non-array)", () => {
    const input = { CtiItems: { item: { Name: "SINGLE" } } };
    const result = flattenCtiResults(input);
    assert.strictEqual(result.length, 1);
  });

  it("skips nodes without CtiItems", () => {
    const input = [{ Other: {} }, { CtiItems: { item: [{ Name: "CTI1" }] } }];
    const result = flattenCtiResults(input);
    assert.strictEqual(result.length, 1);
  });
});

describe("buildSummaryRow", () => {
  it("counts registered devices", () => {
    const devices = [
      { Status: "Registered" },
      { Status: "Registered" },
      { Status: "UnRegistered" },
    ];
    const row = buildSummaryRow("Phone", devices);
    assert.strictEqual(row.class, "Phone");
    assert.strictEqual(row.registered, 2);
    assert.strictEqual(row.unregistered, 1);
    assert.strictEqual(row.total, 3);
  });

  it("counts rejected and partial statuses", () => {
    const devices = [
      { Status: "Rejected" },
      { Status: "PartiallyRegistered" },
    ];
    const row = buildSummaryRow("SIPTrunk", devices);
    assert.strictEqual(row.rejected, 1);
    assert.strictEqual(row.partial, 1);
  });

  it("counts unknown statuses", () => {
    const devices = [{ Status: "SomethingElse" }, { Status: "" }];
    const row = buildSummaryRow("Gateway", devices);
    assert.strictEqual(row.unknown, 2);
  });

  it("handles empty device list", () => {
    const row = buildSummaryRow("Phone", []);
    assert.strictEqual(row.total, 0);
    assert.strictEqual(row.registered, 0);
  });
});

describe("modelsToRows", () => {
  it("converts model map to array of {id, name} objects", () => {
    const models = { "684": "Cisco 8845", "685": "Cisco 8865" };
    const rows = modelsToRows(models);
    assert.strictEqual(rows.length, 2);
    assert.strictEqual(rows[0].id, "684");
    assert.strictEqual(rows[0].name, "Cisco 8845");
  });

  it("returns empty array for empty models", () => {
    const rows = modelsToRows({});
    assert.strictEqual(rows.length, 0);
  });
});

console.log(`\n  query.test.js: ${total} tests, ${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
