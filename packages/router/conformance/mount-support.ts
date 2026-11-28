// Fixtures for the k.mount router suites (not a test file). Seed for every property: 1337.
// `mount` is what a project's `identity.ts` default-exports: the identity mount at `/api/auth`.
import { identityMount } from "@keel/router";

export const SEED = 1337;
export const MOUNT_PATH = "/api/auth";
export const mount = identityMount(MOUNT_PATH);

/** The `code` of what `run` threw, or `null` when it returned. */
export function thrownCode(run: () => unknown): unknown {
  try {
    run();
    return null;
  } catch (e) {
    return typeof e === "object" && e !== null && "code" in e ? e.code : "no-code";
  }
}

/** The characters a subpath segment may hold. */
export const SEGMENT_CHARS = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789._~-";
