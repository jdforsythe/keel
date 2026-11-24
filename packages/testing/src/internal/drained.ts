import { outside } from "./outside.ts";

/**
 * One macrotask turn: resolves after the microtask queue has drained, so a promise chain of any length started by
 * the event finishes inside the round. A `MessageChannel` message is a macrotask in Node and browsers alike with no
 * delay and no clock, so a simulated clock never sees it; never a timer a test may have faked.
 */
export const drained = (): Promise<void> =>
  new Promise((done) => {
    // Made outside the run's context (k.drive Driving): a turn of the harness or the drive is not work of the run.
    outside(() => {
      const channel = new MessageChannel();
      channel.port1.onmessage = (): void => {
        channel.port1.close();
        done();
      };
      channel.port2.postMessage(0);
    });
  });
