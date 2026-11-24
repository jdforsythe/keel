import type { TestDiag } from "@keel/testing";

const ESC = String.fromCharCode(27);
const ANSI = new RegExp(`${ESC}\\[[0-9;]*m`, "g");
const FRAME = /(?:^|[\s(])(?:file:\/\/)?((?:\/|[A-Za-z]:[\\/])[^():]+):(\d+):(\d+)\)?$/;

const relative = (root: string, file: string): string => {
  const from = root.split(/[\\/]/).filter((s) => s !== "");
  const to = file.split(/[\\/]/).filter((s) => s !== "");
  let i = 0;
  while (i < from.length && i < to.length && from[i] === to[i]) i++;
  return [...from.slice(i).map(() => ".."), ...to.slice(i)].join("/");
};

/** One T0001 for an error that reached the process outside any test: its first line, at the first file in its stack. */
function strayDiag(e: unknown, root: string): TestDiag {
  const err = typeof e === "object" && e !== null ? e : {};
  const text = "message" in err && typeof err.message === "string" ? err.message : String(e);
  const code = "code" in err && typeof err.code === "string" ? `${err.code} ` : "";
  const said = `${code}${(text.split("\n")[0] ?? "").replace(ANSI, "")}`.trim();
  const message = said === "" ? "error outside any test" : said;
  const stack = "stack" in err && typeof err.stack === "string" ? err.stack : "";
  for (const l of stack.split("\n")) {
    const m = FRAME.exec(l.trim());
    const file = m?.[1];
    if (file !== undefined && !file.startsWith("node:"))
      return {
        kind: "diag",
        code: "T0001",
        path: relative(root, file),
        line: Number(m?.[2]),
        col: Number(m?.[3]),
        message: `uncaught: ${message}`,
      };
  }
  return { kind: "diag", code: "T0001", message: `uncaught: ${message}` };
}

/**
 * Runs `work`, holding the process's `uncaughtException` and `unhandledRejection` for as long as it takes, and returns
 * what it resolved to (undefined when it threw) with one T0001 per error that reached the process or that `work` threw:
 * a run that dies on a stray socket error or a crash in vitest reports the cause instead of Node's crash trailer.
 */
export async function catchingStray<T>(
  root: string,
  work: () => Promise<T>,
): Promise<{ readonly value: T | undefined; readonly strays: readonly TestDiag[] }> {
  const caught: unknown[] = [];
  const hold = (e: unknown): void => {
    caught.push(e);
  };
  process.on("uncaughtException", hold);
  process.on("unhandledRejection", hold);
  let value: T | undefined;
  try {
    value = await work();
  } catch (e) {
    caught.push(e);
  } finally {
    process.off("uncaughtException", hold);
    process.off("unhandledRejection", hold);
  }
  return { value, strays: caught.map((e) => strayDiag(e, root)) };
}
