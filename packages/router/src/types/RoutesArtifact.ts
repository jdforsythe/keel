import type { JsonValue } from "@keel/schema";
import type { Verb } from "./Verb.ts";

/** `routes.json` (k.compiler): one entry per route id; schemas as JSON Schema; layouts have `path: null`; an API route has `api: true`. */
export type RoutesArtifact = Readonly<
  Record<
    string,
    {
      readonly actions: readonly Verb[];
      readonly api?: true;
      readonly guard: string | null;
      readonly layout: string | null;
      readonly module: string;
      readonly params: JsonValue;
      readonly path: string | null;
      readonly search: JsonValue;
    }
  >
>;
