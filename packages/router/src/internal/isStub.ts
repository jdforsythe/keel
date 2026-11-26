import { STUB } from "./STUB.ts";
import type { ServerStub } from "./ServerStub.ts";

/** Whether `v` is a stub of a server-only export (`serverOnly`): a key guard on the mark `serverOnly` sets. */
export const isStub = (v: unknown): v is ServerStub => typeof v === "function" && Object.hasOwn(v, STUB);
