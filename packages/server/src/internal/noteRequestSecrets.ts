import { onSecret, secretValues } from "@keel/schema/internal";
import { requestSecrets } from "./requestSecrets.ts";

let noting = false;

/**
 * Once per process: each `Secret` made while a request runs adds its revealed strings and numbers (`secretValues`)
 * to that request's set (`requestSecrets`). A `Secret` made outside a request adds nothing.
 */
export function noteRequestSecrets(): void {
  if (noting) return;
  noting = true;
  onSecret((made) => {
    const into = requestSecrets.getStore();
    if (into !== undefined) for (const v of secretValues(made)) into.add(v);
  });
}
