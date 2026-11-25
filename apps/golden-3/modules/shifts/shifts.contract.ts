import { contract } from "@keel/router/contract";
import { ShiftParams } from "./ShiftParams.schema.ts";
import { SignupParams } from "./SignupParams.schema.ts";

export const shifts = contract("shifts", {
  "shifts.shell": { layout: true },
  "shifts.index": { path: "/" },
  "shifts.show": { path: "/shifts/:shiftId", params: ShiftParams },
  "shifts.mine": { path: "/mine" },
  "shifts.signup": { path: "/mine/:signupId", params: SignupParams },
  "shifts.roster": { path: "/roster" },
  "shifts.attend": { path: "/roster/:signupId", params: SignupParams },
});
