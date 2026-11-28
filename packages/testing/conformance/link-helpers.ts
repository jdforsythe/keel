// Helpers of the k.links and k.opening link suites over act-pages.ts (not a test file). Seed for every property: 1337.
// "The link" is `returnLink('dev.keel.golden2:/api/auth/callback?code=c')`; the start request is a GET of /api/auth/login/github answered 302 to the provider.
import type { TestEvent } from "@keel/testing";
import { START } from "./act-pages.ts";
import { PROVIDER, SCHEME, redirect, ticks } from "./return-support.ts";
import type { Answer } from "./return-support.ts";

export const CB_PATH = "/api/auth/callback?code=c";
export const CALLBACK = `${SCHEME}:${CB_PATH}`;
export const VERIFY_PATH = "/api/auth/verify?t=1";
export const VERIFY = `${SCHEME}:${VERIFY_PATH}`;

/** The start request answers 302 to the provider; every other GET answers 303 to `/` (opens nothing). */
export const base: Answer = (s) => (s.url === START ? redirect(302, PROVIDER) : redirect(303, "/"));

export const providerDocs = (h: { documents(): readonly { url: string }[] }): number =>
  h.documents().filter((d) => d.url === PROVIDER).length;
export const count = (sent: readonly { url: string }[], url: string): number =>
  sent.filter((r) => r.url === url).length;

/** An opening: a click on the home page's mount `Link`. */
export async function opening(h: { fire(id: string, e: TestEvent): Promise<unknown> | unknown }): Promise<void> {
  await h.fire("ac.home.github", { type: "click" });
  await ticks();
}
