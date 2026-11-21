import { loader } from "@keel/router";
import { ok } from "@keel/schema";
import { SignData } from "./SignData.schema.ts";
import { members } from "./members.contract.ts";
import { signText } from "./signText.ts";

export const loadSignup = loader(members, "members.signup", { output: SignData }, async () => ok({ text: signText }));
