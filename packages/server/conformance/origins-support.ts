// Shared helpers for the k.origins server conformance files (not a test file). Public API only. Seed 1337.
// ASSUMPTION: `origins` is set on the deployable inside `topology({...})`, and `createApp` reads it from that topology (k.origins Policy).
// Same sim seed means the same nonce for the first document of a fresh app, so two apps can be compared byte for byte.
import { manifest } from "@keel/router";
import { contract } from "@keel/router/contract";
import { ok, s } from "@keel/schema";
import { topology } from "@keel/server";
import { createAppLoose, liveLoader, simCtx } from "./topology-fixtures.ts";

export const SEED = 1337;
export type Origins = Record<string, Record<string, string>>;

const Out = s.object({ n: s.int() });

export async function appWith(origins: Origins | undefined, mode: "dev" | "production") {
  const appContract = contract("app", {
    "app.live": { method: "GET", path: "/live", events: true, output: Out },
    "app.plain": { path: "/plain" },
  });
  const live = liveLoader(appContract, "app.live", async function* () {
    yield ok({ n: 1 });
  });
  const routes = manifest(appContract, {
    "app.live": { loader: live },
    "app.plain": { component: () => document.createElement("main") },
  });
  return createAppLoose({
    topology: topology({ web: { modules: ["app"], adapter: "node", ...(origins === undefined ? {} : { origins }) } }),
    routes,
    ctx: simCtx(),
    mode,
  });
}

export const directivesOf = (policy: string): string[] =>
  policy
    .split(";")
    .map((d) => d.trim())
    .filter((d) => d !== "");

/** The document policy header (enforcing in production, Report-Only in dev) of `GET /plain`. */
export async function documentPolicy(origins: Origins | undefined, mode: "dev" | "production"): Promise<string> {
  const app = await appWith(origins, mode);
  const res = await app.fetch(new Request("http://localhost/plain"));
  return res.headers.get(mode === "dev" ? "content-security-policy-report-only" : "content-security-policy") ?? "";
}

export const nonceOf = (policy: string): string => /'nonce-([^']+)'/.exec(policy)?.[1] ?? "";

/** The k.security policy as a directive list, for a nonce. */
export const BASELINE = (nonce: string): string[] => [
  "default-src 'none'",
  `script-src 'nonce-${nonce}' 'strict-dynamic'`,
  "style-src 'self'",
  "img-src 'self'",
  "font-src 'self'",
  "connect-src 'self'",
  "manifest-src 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
  "base-uri 'none'",
  "object-src 'none'",
  "require-trusted-types-for 'script'",
  "trusted-types keel",
  "report-uri /__keel/csp",
  "report-to keel-csp",
];
