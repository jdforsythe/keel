import { loader } from "@keel/router";
import { ok } from "@keel/schema";
import { ShellData } from "./ShellData.schema.ts";
import { members } from "./members.contract.ts";
import { shellText } from "./shellText.ts";

/** The signed-out frame's data: the masthead's copy; no household name before a member signs in. */
export const loadFrame = loader(members, "members.frame", { output: ShellData }, async ({ user }) =>
  ok({ text: shellText, name: null, signedIn: user !== "" }),
);
