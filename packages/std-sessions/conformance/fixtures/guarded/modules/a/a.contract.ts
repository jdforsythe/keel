import { contract } from "@keel/router/contract";

/** The module's contract: a guarded board, its sign-in page and two public pages. */
export const a = contract("a", {
  "a.board": { path: "/board" },
  "a.signin": { path: "/signin" },
  "a.about": { path: "/about" },
  "a.help": { path: "/help" },
});
