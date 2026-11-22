import { manifest } from "@keel/router";
import { loadCount } from "./loadCount.server.ts";
import { stock } from "./stock.contract.ts";

export const routes = manifest(stock, { "stock.count": { loader: loadCount } });
