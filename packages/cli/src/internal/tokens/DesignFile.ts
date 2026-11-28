import type { DesignToken } from "./DesignToken.ts";

/** A design tokens file read: as given, its text, its tokens, and the collection `stem` and `mode` its name gives (`<stem>.<mode>.tokens.json`). */
export type DesignFile = {
  readonly path: string;
  readonly text: string;
  readonly tokens: readonly DesignToken[];
  readonly stem: string;
  readonly mode: string | undefined;
};
