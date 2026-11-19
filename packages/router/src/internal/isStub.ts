import { STUB } from "./STUB.ts";

/** Whether `v` is a stub of a server-only export (`serverOnly`). */
export const isStub = (v: unknown): boolean => typeof v === "function" && STUB in v;
