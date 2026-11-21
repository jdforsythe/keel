// What `keel build` keeps of a failed tool's output: the error block, bounded, never the progress lines.
import fc from "fast-check";
import { describe, expect, test } from "vitest";
import { toolError } from "../src/shell/toolError.ts";

const compiling = (n: number): string =>
  Array.from({ length: n }, (_, i) => `   Compiling crate-${i} v1.0.${i}`).join("\n");
const PANIC = [
  "error: proc macro panicked",
  " --> src/lib.rs:7:14",
  "  |",
  "7 |         .run(tauri::generate_context!())",
  "  |              ^^^^^^^^^^^^^^^^^^^^^^^^^^",
  "  |",
  "  = help: message: failed to open icon /app/dist/web/tauri/icons/icon.png: No such file or directory (os error 2)",
  "",
  "error: could not compile `golden-1` (lib) due to 1 previous error",
  "failed to build app: failed to build app",
  "       Error failed to build app: failed to build app",
];

describe("toolError", () => {
  test("a cargo failure keeps the first error block, with paths relative to the project", () => {
    const out = toolError(`\n${compiling(3000)}\n${PANIC.join("\n")}\n`, "/app");
    expect(out).toBe(
      `${PANIC.filter((l) => l !== "")
        .join("\n")
        .replace("/app/", "")}\n`,
    );
    expect(out).toContain("failed to open icon dist/web/tauri/icons/icon.png");
    expect(out).not.toContain("Compiling");
  });

  test("a long error run is cut at 12 lines with a count of the rest", () => {
    const errors = Array.from({ length: 40 }, (_, i) => `error[E04${i}]: cannot find value \`x${i}\``);
    const out = toolError(`${compiling(10)}\n${errors.join("\n")}\n`, "/app").split("\n");
    expect(out.slice(0, 12)).toEqual(errors.slice(0, 12));
    expect(out.slice(12)).toEqual(["... +28 more lines", ""]);
    expect(toolError(errors.slice(0, 12).join("\n"), "/app")).toBe(`${errors.slice(0, 12).join("\n")}\n`);
    expect(toolError(errors.slice(0, 13).join("\n"), "/app")).toContain("\n... +1 more lines\n");
  });

  test("the error line of each tool starts the block", () => {
    const gradle =
      "> Task :app:compileDebugJavaWithJavac FAILED\n\nFAILURE: Build failed with an exception.\n\n* What went wrong:\nExecution failed for task ':app:compileDebugJavaWithJavac'.\n";
    expect(toolError(gradle, "/app").split("\n")[0]).toBe("FAILURE: Build failed with an exception.");
    expect(
      toolError("note: x\n/app/ios/App/A.swift:3:1: error: no such module 'X'\n** BUILD FAILED **\n", "/app"),
    ).toBe("ios/App/A.swift:3:1: error: no such module 'X'\n** BUILD FAILED **\n");
    expect(toolError("ok\n[error] android platform has not been added yet.\n", "/app")).toBe(
      "[error] android platform has not been added yet.\n",
    );
    // A crate named for errors is progress, not an error line.
    expect(toolError("   Compiling quick-error v2.0.1\n   Compiling thiserror v1.0.0\nerror: x\n", "/app")).toBe(
      "error: x\n",
    );
  });

  test("ANSI colors and blank lines are dropped", () => {
    expect(toolError("\x1b[1m\x1b[31merror\x1b[0m: bad\n\n   \n  at x\x1b[0m\n", "/app")).toBe("error: bad\n  at x\n");
  });

  test("with no error line, the last five lines; never more than 13 lines, none blank", () => {
    fc.assert(
      fc.property(fc.array(fc.stringMatching(/^[a-zA-Z :.[\]-]{0,20}$/), { maxLength: 60 }), (lines) => {
        const out = toolError(lines.join("\n"), "/app");
        expect(out.endsWith("\n")).toBe(true);
        const shown = out.slice(0, -1).split("\n");
        expect(shown.length).toBeLessThanOrEqual(13);
        if (out !== "\n") for (const l of shown) expect(l.trim()).not.toBe("");
        const kept = lines.map((l) => l.trimEnd()).filter((l) => l !== "");
        if (!kept.some((l) => /(?:^\W*|: )(?:error|failure)\b/i.test(l)))
          expect(shown).toEqual(kept.length === 0 ? [""] : kept.slice(-5));
      }),
      { seed: 1337, numRuns: 300 },
    );
  });
});
