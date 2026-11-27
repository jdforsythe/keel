import type { CreateRecord } from "@keel/scaffold/create";
import type { OutDiag } from "./OutDiag.ts";

/** One record `create-app` prints: the plan's, a refusal's diagnostic, or the trailer. */
export type Out =
  | CreateRecord
  | OutDiag
  | {
      readonly kind: "summary";
      readonly name: string;
      readonly ok: boolean;
      readonly counts: Readonly<Record<string, number>>;
    };
