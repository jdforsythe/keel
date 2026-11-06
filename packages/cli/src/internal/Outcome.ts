import type { OutRecord } from "../types/OutRecord.ts";
import type { Write } from "../types/Write.ts";

/** What an operation produced: records to render and file effects for the host (empty for pure queries). */
export type Outcome = { readonly records: readonly OutRecord[]; readonly writes: readonly Write[] };
