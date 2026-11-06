// Blocks edits to tracked files under packages/*/conformance/ unless branch or HEAD message carries rfc:NNNN.
// Creating a conformance file that is not yet tracked in git is allowed (conformance-writer writes suites first).
import { execSync } from "node:child_process";
import fs from "node:fs";
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
const tag = /rfc:(\d{4})/.exec(branch + msg);
if (tag && tag[1] !== "0000") process.exit(0);
if (tag && tag[1] === "0000") {
  // rfc:0000 = pre-implementation lint/shape fixes (docs/RFC.md); only while every spec section of the package is `proposed`.
  const pkg = /packages\/([^/]+)\/conformance\//.exec(file)?.[1] ?? "";
  const readme = fs.existsSync(`packages/${pkg}/README.md`) ? fs.readFileSync(`packages/${pkg}/README.md`, "utf8") : "";
  const ids = [...readme.matchAll(/\bk\.[a-z-]+/g)].map((m) => m[0]);
  const proposed =
    ids.length > 0 &&
    ids.every((id) =>
      /^status: proposed/m.test(
        fs.existsSync(`spec/kernel/${id}.md`) ? fs.readFileSync(`spec/kernel/${id}.md`, "utf8") : "",
      ),
    );
  if (proposed) process.exit(0);
  console.log("E0001 rfc:0000 not accepted: section already implemented; file a numbered RFC");
  process.exit(2);
}
console.log("E0001 conformance edit requires rfc:NNNN on branch or commit; run /rfc");
process.exit(2);
