import { store } from "@keel/store";
import { RunsCopy } from "./RunsCopy.schema.ts";

export const runsCopy = store(RunsCopy, { runs: { last: null, kept: 0 }, read: false }, { id: "shopping.runsCopy" });
