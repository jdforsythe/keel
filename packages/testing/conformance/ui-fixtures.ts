// Shared fixtures for k.ui conformance under the real harness (not a test file). Property seed: 1337.
import { manifest } from "@keel/router";
import { contract } from "@keel/router/contract";
import { s } from "@keel/schema";
import { Text } from "@keel/ui";
import { defineTokens } from "@keel/ui/tokens";

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

/** One-page contract (k.contract) so `Link to` receives a real `Href`. */
export const ui = contract("ui", { "ui.home": { path: "/" } });
export const routes = manifest(ui, { "ui.home": { component: () => Text({ children: "home" }) } });
export const home = ui.href("ui.home");

/** A component with an empty `Props` schema around `view`. */
export const page = (view: () => Node) => Object.assign(view, { Props: s.object({}) });
