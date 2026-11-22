import { loader } from "@keel/router";
import { ok } from "@keel/schema";
import { ShellData } from "./ShellData.schema.ts";
import { members } from "./members.contract.ts";
import { shellText } from "./shellText.ts";

/** The members pages' frame: the masthead's copy and whether a member is signed in. */
export const loadShell = loader(members, "members.shell", { output: ShellData }, async ({ user }) =>
  ok({ text: shellText, name: null, signedIn: user !== "" }),
);
