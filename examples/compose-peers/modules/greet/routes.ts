import { manifest } from "@keel/router";
import { greet } from "./greet.contract.ts";
import { loadHello } from "./loadHello.server.ts";

export const routes = manifest(greet, { "greet.hello": { loader: loadHello } });
