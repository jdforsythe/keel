import { LISTED } from "./LISTED.ts";

const NAME = /^[a-z][a-z0-9-]*$/;

/** Whether `n` passes an app's name rule (k.create Names): `[a-z][a-z0-9-]*`, at most 64, no package the project lists. */
export const validName = (n: string): boolean => NAME.test(n) && n.length <= 64 && !LISTED.has(n);
