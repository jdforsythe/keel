import { s } from "@keel/schema";

/** A loader's answer (k.api): the route's `id` and the `Result` of each loader that ran, by route id. */
export const LoaderAnswer = s.object({ id: s.string(), results: s.record(s.json()) });
