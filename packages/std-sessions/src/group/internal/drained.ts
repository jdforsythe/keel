import { MessageChannel } from "node:worker_threads";

/**
 * One macrotask turn: resolves once the microtask queue has drained and pending messages from workers were handled.
 * A message, not a timer: no clock sees it.
 */
export const drained = (): Promise<void> =>
  new Promise((done) => {
    const channel = new MessageChannel();
    channel.port1.once("message", () => {
      channel.port1.close();
      done();
    });
    channel.port2.postMessage(0);
  });
