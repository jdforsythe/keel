import { manifest } from "@keel/router";
import HomePage from "./HomePage.tsx";
import { s } from "./s.contract.ts";
export const routes = manifest(s, { "s.home": { component: HomePage } });
