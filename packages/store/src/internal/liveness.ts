import { computed } from "@keel/reactive";

/**
 * Probe created in the current scope (E1203 outside one): returns false once that scope is disposed.
 * Uses the documented k.reactive rule that reading a disposed computed is E1205.
 */
export function liveness(): () => boolean {
  const probe = computed(() => true);
  return () => {
    try {
      return probe.get();
    } catch (e) {
      if (e instanceof Error && "code" in e && e.code === "E1205") return false;
      throw e;
    }
  };
}
