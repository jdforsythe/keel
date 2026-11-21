import { STUB } from "./STUB.ts";
import type { ServerStub } from "./ServerStub.ts";

/** Whether `v` is a stub of a server-only export (`serverOnly`). */
export const isStub = (v: unknown): v is ServerStub => typeof v === "function" && STUB in v;
