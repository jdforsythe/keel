// A stream's inbox holds no abort listener past the wait that added it. Seed 1337
import { expect, test } from "vitest";
import { inbox } from "../src/server/internal/inbox.ts";

test("after many waits on one signal, no abort listener is left on it", async () => {
  const box = inbox<null>();
  const ac = new AbortController();
  let held = 0;
  const add = ac.signal.addEventListener.bind(ac.signal);
  const remove = ac.signal.removeEventListener.bind(ac.signal);
  ac.signal.addEventListener = (...args: Parameters<AbortSignal["addEventListener"]>) => {
    held++;
    add(...args);
  };
  ac.signal.removeEventListener = (...args: Parameters<AbortSignal["removeEventListener"]>) => {
    held--;
    remove(...args);
  };
  for (let i = 0; i < 1000; i++) {
    const next = box.next(ac.signal);
    box.push({ kind: "reset" });
    expect(await next).toEqual({ kind: "reset" });
  }
  expect(held).toBe(0);
});
