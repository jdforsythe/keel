// Shared fixtures for k.ui conformance under the real harness (not a test file). Property seed: 1337.
import { manifest } from "@keel/router";
import { s } from "@keel/schema";
import { Text, defineTokens } from "@keel/ui";

/** The tokens of the k.ui spec section. */
export const tokens = defineTokens({
  color: { fg: { light: "#111", dark: "#eee" }, bg: { light: "#fff", dark: "#111" }, accent: "#0a5" },
  space: { 0: "0", 1: "4px", 2: "8px", 3: "16px" },
  radius: { 1: "4px" },
  font: { body: "system-ui" },
  fontSize: { sm: "14px", md: "16px", lg: "24px" },
  breakpoint: { md: "768px" },
  motion: { fast: "120ms" },
});

/** One-route manifest (k.router) so `Link to` receives a real `Href`. */
export const routes = manifest({
  home: { path: "/", params: s.object({}), search: s.object({}), component: () => Text({ children: "home" }) },
});
export const home = routes.href("home", {}, {});

/** A component with an empty `Props` schema around `view`. */
export const page = (view: () => Node) => Object.assign(view, { Props: s.object({}) });
