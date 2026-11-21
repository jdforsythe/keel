// The routes module of the k.place suites (not a test file). A test imports it for the server side; `resumeDocument`
// imports it again for the client side, where every module it reaches is evaluated anew.
import { manifest } from "@keel/router";
import { contract } from "@keel/router/contract";
import { compilePage } from "./claim-support.ts";
import { CASES } from "./place-cases.ts";

const placed = contract("pl", Object.fromEntries(CASES.map((c) => [`pl.${c.key}`, { path: `/${c.key}` }])));

export const routes = manifest(
  placed,
  Object.fromEntries(CASES.map((c) => [`pl.${c.key}`, { component: compilePage(`${c.key}.page`, c.source) }])),
);

export default routes;
