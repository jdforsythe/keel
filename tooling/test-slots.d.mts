// Types of test-slots.mjs, for the TypeScript files of tooling that import it.
export function testSlots(m: {
  cores: number;
  load: number;
  env?: Record<string, string | undefined>;
}): { tasks: number; workers: number | undefined; free: number };
