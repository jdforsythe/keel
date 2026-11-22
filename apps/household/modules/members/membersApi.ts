import { service } from "@keel/services";
import { members } from "./members.contract.ts";

/** A typed client for the members API: the profile page lists, mints and revokes tokens through it. */
export const membersApi = service({ contract: members });
