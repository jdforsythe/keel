import type { Client } from "../src/Client.ts";
import type { EndpointMap } from "../src/EndpointMap.ts";
import { unsafe } from "./unsafe.ts";

/** Give the method record built by `service` its per-endpoint static type. */
export function asClient<D extends EndpointMap>(methods: Readonly<Record<string, unknown>>): Client<D> {
  return unsafe(
    "service builds exactly one method per key of D; each validates input by that endpoint's schemas and returns only values its output/errors schemas decoded; TS cannot type Object.fromEntries as a mapped type",
    () => methods as Client<D>,
  );
}
