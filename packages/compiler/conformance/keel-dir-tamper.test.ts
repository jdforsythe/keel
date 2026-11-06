// Untestable at the pure compile API level: E1005 (changed bytes under .keel/ reported by `keel check`) needs the filesystem and the check CLI (k.check).
// The Vite plugin that wraps compile() is likewise untestable here.
import { test } from "vitest";

test.skip("Changing any byte of a file under .keel/ makes keel check report E1005 on that file (untestable here)", () => {});
