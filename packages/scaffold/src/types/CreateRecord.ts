import type { ScaffoldDiag } from "./ScaffoldDiag.ts";

/**
 * One record `create-app` prints (k.create Next): a written file (`scaffold.edit`, compact `create <path>`), a warning
 * (W1364), or a command to run next (`create.next`, compact `next <command>`, `dir` the folder to run it in when it is
 * not the project's, relative to it).
 */
export type CreateRecord =
  | { readonly kind: "scaffold.edit"; readonly action: "create"; readonly path: string }
  | ScaffoldDiag
  | { readonly kind: "create.next"; readonly command: string; readonly dir?: string };
