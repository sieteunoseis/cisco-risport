const { execSync } = require("child_process");
const { readdirSync } = require("fs");
const path = require("path");

const testDir = path.join(__dirname, "cli");
const files = readdirSync(testDir).filter(f => f.endsWith(".test.js"));

let passed = 0;
let failed = 0;

for (const file of files) {
  try {
    console.log(`\nRunning ${file}...`);
    execSync(`node ${path.join(testDir, file)}`, { stdio: "inherit" });
    passed++;
  } catch {
    failed++;
  }
}

console.log(`\n================================`);
console.log(`  Results: ${passed + failed} files, ${passed} passed, ${failed} failed`);
console.log(`================================`);
process.exitCode = failed > 0 ? 1 : 0;
