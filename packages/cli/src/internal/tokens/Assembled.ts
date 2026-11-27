import type { Val } from "./Val.ts";

/** What `keel tokens import` writes: tokens by group, looks, and themes (`when` unset is `choice`), and the warnings with the index of their file. */
export type Assembled = {
  readonly groups: Map<string, Map<string, Val>>;
  readonly looks: Map<string, Readonly<Record<string, string>>>;
  readonly themes: Map<string, { when?: string; readonly groups: Map<string, Map<string, string>> }>;
  readonly warns: { readonly file: number; readonly at: number; readonly message: string }[];
};
