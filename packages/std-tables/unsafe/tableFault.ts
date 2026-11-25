import { unsafe } from "./unsafe.ts";

/** Throws `<code> <message>`: E2851 (columns, styles), E2852 (search) or E2853 (rows, keys), the faults std.tables specifies as throws. */
export function tableFault(code: "E2851" | "E2852" | "E2853", message: string): never {
  return unsafe(
    "std.tables specifies E2851, E2852 and E2853 as throws: a column, style, search or row key that is wrong is a bug in the app's code, which the nearest Boundary catches and reports, never an expected failure a Result would carry",
    () => {
      throw new Error(`${code} ${message}`);
    },
  );
}
