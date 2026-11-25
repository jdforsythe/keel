import { s } from "@keel/schema";

/** One entry of a race record: its log id, its transaction's name and, when it carries one, its write key. */
export const RefRecord = s.object(
  { id: s.int({ min: 0 }), name: s.string(), key: s.string().optional() },
  { closed: true },
);
