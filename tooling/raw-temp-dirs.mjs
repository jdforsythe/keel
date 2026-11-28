// S0018: a raw temp folder in test code. A test makes its temp folders with `tempDir` (test-tmp.ts), which removes them
// when the test file ends; a call to `mkdtemp` or `mkdtempSync` (a bare name, `fs.mkdtempSync`, `fsp.mkdtemp`, any
// object's) leaves the removal to the test, and a test that forgets it leaves a folder in the machine's temp folder
// for every run. Conformance files are not judged (the conformance-writer owns them).
import { Visitor, parseSync } from "oxc-parser";

const RAW = new Set(["mkdtemp", "mkdtempSync"]);

/** The `mkdtemp` and `mkdtempSync` calls of a source as `{ line, col, message }`. */
export function rawTempDirs(src, file) {
  const { program } = parseSync(file, src);
  const starts = [0];
  for (let i = 0; i < src.length; i++) if (src[i] === "\n") starts.push(i + 1);
  const found = [];
  new Visitor({
    CallExpression(n) {
      const c = n.callee;
      const name =
        c.type === "Identifier"
          ? c.name
          : c.type === "MemberExpression" && !c.computed && c.property.type === "Identifier"
            ? c.property.name
            : undefined;
      if (name === undefined || !RAW.has(name)) return;
      let line = starts.length;
      while (starts[line - 1] > n.start) line--;
      found.push({
        line,
        col: n.start - starts[line - 1] + 1,
        message: `${name} in test code leaves its folder behind; make it with tempDir from @keel/tooling/test-tmp, which removes it`,
      });
    },
  }).visit(program);
  return found;
}
