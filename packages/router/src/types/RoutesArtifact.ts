import type { JsonValue } from "@keel/schema";
import type { Method } from "../contract/types/Method.ts";
import type { Verb } from "./Verb.ts";

/**
 * `routes.json` (k.compiler): one entry per route id; schemas as JSON Schema; layouts have `path: null`; an API entry
 * has `api: true` and its `method`, and its `query` as `search`; a `local: true` entry has `local: true`.
 */
export type RoutesArtifact = Readonly<
  Record<
    string,
    {
      readonly actions: readonly Verb[];
      readonly api?: true;
      readonly guard: string | null;
      readonly layout: string | null;
      readonly local?: true;
      readonly method?: Method;
      readonly module: string;
      readonly params: JsonValue;
      readonly path: string | null;
      readonly search: JsonValue;
    }
  >
>;
