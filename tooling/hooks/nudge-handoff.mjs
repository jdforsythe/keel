// Counts Bash calls per session; after 40, prints a one-line nudge to run /handoff.
import fs from "node:fs";
const f = ".claude/.callcount";
const n = (fs.existsSync(f) ? Number(fs.readFileSync(f, "utf8")) : 0) + 1;
fs.writeFileSync(f, String(n));
if (n % 40 === 0) console.log("I0001 40 tool calls since last nudge: run /handoff");
process.exit(0);
