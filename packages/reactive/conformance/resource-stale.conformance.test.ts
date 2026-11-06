// Spec: k.reactive, clause "stale resource results never overwrite newer ones".
import { describe, expect, it } from 'vitest';
import { resource, scope } from '@keel/reactive';

const flush = async (): Promise<void> => {
  for (let i = 0; i < 10; i++) await Promise.resolve();
};

interface Deferred<T> {
  promise: Promise<T>;
  resolve(v: T): void;
  reject(e: unknown): void;
}
const deferred = <T>(): Deferred<T> => {
  let resolve: (v: T) => void = () => {};
  let reject: (e: unknown) => void = () => {};
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
};

const setup = (n: number) => {
  const ds = Array.from({ length: n }, () => deferred<string>());
  let i = 0;
  let get: () => { state: string; value?: string; error?: unknown } = () => ({ state: '' });
  let refetch: () => void = () => {};
  scope(() => {
    const r = resource(() => ds[i++]!.promise);
    get = () => r.get();
    refetch = () => r.refetch();
  });
  return { ds, get: () => get(), refetch: () => refetch() };
};

describe('k.reactive: stale resource results', () => {
  it('older fetch resolving after a newer one does not overwrite it', async () => {
    const t = setup(2);
    t.refetch();
    t.ds[1]!.resolve('new');
    await flush();
    expect(t.get()).toEqual({ state: 'ready', value: 'new' });
    t.ds[0]!.resolve('old');
    await flush();
    expect(t.get()).toEqual({ state: 'ready', value: 'new' });
  });

  it('two refetches resolving out of order: value is from the latest', async () => {
    const t = setup(3);
    t.refetch();
    t.refetch();
    t.ds[2]!.resolve('third');
    await flush();
    t.ds[0]!.resolve('first');
    await flush();
    t.ds[1]!.resolve('second');
    await flush();
    expect(t.get()).toEqual({ state: 'ready', value: 'third' });
  });

  it('a stale rejection does not replace a newer ready value', async () => {
    const t = setup(2);
    t.refetch();
    t.ds[1]!.resolve('fresh');
    await flush();
    t.ds[0]!.reject(new Error('stale failure'));
    await flush();
    expect(t.get()).toEqual({ state: 'ready', value: 'fresh' });
  });

  it('a stale result arriving while the latest is still loading leaves it loading', async () => {
    const t = setup(2);
    t.refetch();
    t.ds[0]!.resolve('stale');
    await flush();
    expect(t.get()).toEqual({ state: 'loading' });
    t.ds[1]!.resolve('latest');
    await flush();
    expect(t.get()).toEqual({ state: 'ready', value: 'latest' });
  });
});
