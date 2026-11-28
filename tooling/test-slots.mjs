// How many test tasks root `pnpm test` runs at once and how many vitest workers each may use, from the machine's
// cores and its load before the run starts. A worker starved of CPU runs its tests past their timeouts, and on a
// shared machine the other load is not ours to lower, so the run sizes itself to the cores the load leaves free:
// fewer tasks and fewer workers each when the machine is busy, so every worker keeps a fair share of a core.

/**
 * @param {{ cores: number, load: number, env?: Record<string, string | undefined> }} m `load` the one-minute load
 *   average; `env` may set `KEEL_TEST_TASKS` and `KEEL_TEST_WORKERS` (positive integers), which win
 * @returns {{ tasks: number, workers: number | undefined, free: number }} `workers` undefined leaves vitest's own
 *   default (a machine of four cores or fewer)
 */
export function testSlots({ cores, load, env = {} }) {
  const own = (k) => {
    const n = Number(env[k]);
    return Number.isInteger(n) && n > 0 ? n : undefined;
  };
  // The cores the other load leaves, never under a quarter of the machine: the run must still finish.
  const free = Math.min(cores, Math.max(Math.ceil(cores / 4), Math.round(cores - load)));
  const small = cores <= 4;
  const tasks = own("KEEL_TEST_TASKS") ?? (small ? 1 : free >= (cores * 3) / 4 ? 4 : free >= cores / 2 ? 3 : 2);
  const workers = own("KEEL_TEST_WORKERS") ?? (small ? undefined : Math.max(2, Math.ceil((free * 1.5) / tasks)));
  return { tasks, workers, free };
}
