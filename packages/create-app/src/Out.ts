import type { CreateRecord } from "@keel/scaffold/create";
import type { OutDiag } from "./OutDiag.ts";

/** One record `create-app` prints: the plan's (a file `--dry-run` would create carries `"dry-run": true`), a refusal's diagnostic, or the trailer. */
export type Out =
  | CreateRecord
  | { readonly kind: "scaffold.edit"; readonly action: "create"; readonly path: string; readonly "dry-run": true }
  | OutDiag
  | {
      readonly kind: "summary";
      readonly name: string;
      readonly ok: boolean;
      readonly counts: Readonly<Record<string, number>>;
      readonly "dry-run"?: true;
    };
