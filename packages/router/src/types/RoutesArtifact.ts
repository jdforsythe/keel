import type { JsonValue } from "@keel/schema";
import type { Verb } from "./Verb.ts";

/** `routes.json` (k.compiler): one entry per route id; schemas as JSON Schema; layouts have `path: null`. */
export type RoutesArtifact = Readonly<
  Record<
    string,
    {
      readonly actions: readonly Verb[];
      readonly guard: string | null;
      readonly layout: string | null;
      readonly module: string;
      readonly params: JsonValue;
      readonly path: string | null;
      readonly search: JsonValue;
    }
  >
>;
