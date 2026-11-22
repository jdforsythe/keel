import { fileURLToPath } from "node:url";
import type { MessagePort } from "node:worker_threads";
import { ESModulesEvaluator, ModuleRunner, createNodeImportMeta } from "vite/module-runner";
import { field } from "./field.ts";

/**
 * A loader for this user worker's project (std.multi): a module runner whose modules its group's `projectServer`
 * transforms, asked over `port` (`invoke` out, `invoked` back), and this worker evaluates, so the worker has its own
 * copy of each module and everything it loads through the runner shares one copy of each kernel module. The loader
 * takes a `file:` URL.
 */
export function projectLoader(port: MessagePort): (url: string) => Promise<unknown> {
  let next = 0;
  const waiting = new Map<number, (answer: { result: unknown } | { error: unknown }) => void>();
  port.on("message", (m: unknown) => {
    const id = field(m, "id");
    if (field(m, "t") !== "invoked" || typeof id !== "number") return;
    const done = waiting.get(id);
    waiting.delete(id);
    const error = field(m, "error");
    done?.(error === undefined ? { result: field(m, "result") } : { error });
  });
  const runner = new ModuleRunner(
    {
      transport: {
        invoke: (payload) =>
          new Promise((resolve) => {
            const id = next++;
            waiting.set(id, resolve);
            port.postMessage({ t: "invoke", id, data: payload.type === "custom" ? payload.data : null });
          }),
      },
      hmr: false,
      createImportMeta: createNodeImportMeta,
    },
    new ESModulesEvaluator(),
  );
  return (url) => runner.import(fileURLToPath(url));
}
