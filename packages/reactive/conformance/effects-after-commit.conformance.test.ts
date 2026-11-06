// Spec: k.reactive, clause "Effects run after commit".
import { describe, expect, it } from 'vitest';
import { signal, effect, scope, batch } from '@keel/reactive';

describe('k.reactive: effects run after commit', () => {
  it('inside a batch, the effect observes only final values and runs once', () => {
    const seen: Array<[number, number]> = [];
    scope(() => {
      const a = signal(0);
      const b = signal(0);
      effect(() => {
        seen.push([a.get(), b.get()]);
      });
      batch(() => {
        a.set(1);
        b.set(2);
        a.set(3);
      });
    });
    expect(seen).toEqual([
      [0, 0],
      [3, 2],
    ]);
  });

  it('the effect does not run while the batch is still open', () => {
    let runs = 0;
    let during = -1;
    scope(() => {
      const a = signal(0);
      effect(() => {
        a.get();
        runs++;
      });
      const before = runs;
      batch(() => {
        a.set(1);
        a.set(2);
        during = runs - before;
      });
      expect(runs - before).toBe(1);
    });
    expect(during).toBe(0);
  });

  it('reads of a signal inside a batch see the written value immediately', () => {
    scope(() => {
      const a = signal(0);
      batch(() => {
        a.set(7);
        expect(a.get()).toBe(7);
      });
    });
  });

  it('a batch whose writes net to no change still commits without an inconsistent view', () => {
    const seen: number[] = [];
    scope(() => {
      const a = signal(0);
      effect(() => {
        seen.push(a.get());
      });
      batch(() => {
        a.set(1);
        a.set(0);
      });
    });
    expect(seen.every((v) => v === 0)).toBe(true);
    expect(seen.length).toBeLessThanOrEqual(2);
  });
});
