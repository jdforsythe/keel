import { formatter } from "@keel/cli";
import { s } from "@keel/schema";

const RefRecord = s.object({ id: s.int({ min: 0 }), name: s.string(), key: s.string().optional() }, { closed: true });

/**
 * Output record kind `conflicts.race` (std.conflicts): one diagnostic at `path` 1:1, the file the analysis read. `code`
 * is E2701 for a race (`reason` `order` or `invalid`, `against` its concurrent entries) and W2702 for an unchecked
 * entry (`reason` `folded` or `undo`, `against` empty).
 */
export const RaceRecord = s.object(
  {
    kind: s.literal("conflicts.race"),
    code: s.enum(["E2701", "W2702"]),
    path: s.string(),
    store: s.string(),
    entry: RefRecord,
    against: s.array(RefRecord),
    reason: s.enum(["order", "invalid", "folded", "undo"]),
  },
  { closed: true },
);
export type RaceRecord = s.infer<typeof RaceRecord>;

const ref = (r: { readonly id: number; readonly name: string }): string => `${r.name} #${r.id}`;

/** `E2701 <path>:1:1 race api.editTodo #6 over api.editTodo #4, api.addTodo #5 +1 on api.board`, or the W2702 line. */
const compact = (r: RaceRecord): string => {
  const at = `${r.code} ${r.path}:1:1`;
  if (r.code === "W2702") return `${at} unchecked ${ref(r.entry)} on ${r.store} (${r.reason})`;
  const more = r.against.length > 2 ? ` +${r.against.length - 2}` : "";
  return `${at} race ${ref(r.entry)} over ${r.against.slice(0, 2).map(ref).join(", ")}${more} on ${r.store}`;
};

const HINT = {
  order: "the result depends on the order: declare it 'reject', or write a value that does not depend on a stale read",
  invalid: "one order fails an invariant or the schema: declare it 'reject'",
  folded: "its base is older than the kept log: raise logLimit or check an earlier snapshot",
  undo: "an undo lies between the kept log's start and it",
} as const;

/** The compact line, then every entry of `against` and what the reason means. */
const pretty = (r: RaceRecord): string =>
  [
    compact(r),
    ...r.against.map((a) => `  over ${ref(a)}${a.key === undefined ? "" : ` (${a.key})`}`),
    `  ${HINT[r.reason]}`,
  ].join("\n");

formatter("conflicts.race", { schema: RaceRecord, compact, pretty });
