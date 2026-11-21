import { service } from "@keel/services";
import { setup } from "./setup.contract.ts";

export const setupApi = service({ contract: setup });
