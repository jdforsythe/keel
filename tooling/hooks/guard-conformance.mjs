// Blocks edits to tracked files under packages/*/conformance/ unless branch or HEAD message carries rfc:NNNN.
// Creating a conformance file that is not yet tracked in git is allowed (conformance-writer writes suites first).
import { execSync } from "node:child_process";
import path from "node:path";
const input = JSON.parse(await new Response(process.stdin).text());
const file = input?.tool_input?.file_path ?? "";
if (!/packages\/[^/]+\/conformance\//.test(file)) process.exit(0);
const tracked = (() => {
  try {
    const rel = path.isAbsolute(file) ? path.relative(process.cwd(), file) : file;
    return (
      execSync(`git ls-files --error-unmatch -- ${JSON.stringify(rel)}`, { stdio: ["ignore", "pipe", "ignore"] })
        .toString()
        .trim() !== ""
    );
  } catch {
    return false;
  }
})();
if (!tracked) process.exit(0);
const branch = execSync("git rev-parse --abbrev-ref HEAD").toString();
const msg = execSync("git log -1 --pretty=%s").toString();
if (/rfc:\d{4}/.test(branch + msg)) process.exit(0);
console.log("E0001 conformance edit requires rfc:NNNN on branch or commit; run /rfc");
process.exit(2);
