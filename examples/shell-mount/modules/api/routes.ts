import { manifest } from "@keel/router";
import { api } from "./api.contract.ts";
import { loadMe } from "./loadMe.server.ts";

export const routes = manifest(api, { "api.me": { loader: loadMe } });
