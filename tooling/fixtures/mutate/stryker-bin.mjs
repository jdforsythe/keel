// Fixture standing in for Stryker's bin: writes `.stryker-tmp/progress.json` like the Keel reporter does, then
// either never finishes another mutant (default) or finishes one every 100 ms and exits 0 (`--advance`).
// SIGINT ends it with 130, as Stryker does after saving. Its pid goes to `child.pid` for the test to check.
import fs from "node:fs";

fs.writeFileSync("child.pid", String(process.pid));
const advance = process.argv.includes("--advance");
let tested = 3;
const save = () => fs.writeFileSync(".stryker-tmp/progress.json", JSON.stringify({ total: 8, tested }));
save();
process.on("SIGINT", () => process.exit(130));
setInterval(() => {
  if (!advance) return;
  tested++;
  save();
  if (tested >= 20) process.exit(0);
}, 100);
