import type { SourceFile } from "../../types/SourceFile.ts";
import type { LooksView } from "./LooksView.ts";

/** What `check()` records of k.looks for each project array it hands the rules (E1811, E1814, E1804's look placement). */
export const projectLooks = new WeakMap<readonly SourceFile[], LooksView>();
