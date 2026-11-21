import { type PostedForm, servedForm } from "@keel/runtime-dom/internal";

/** Run `fn` with `posted` as the render's rejected post (`servedForm`, k.forms Submit), restoring the slot after it. */
export function withServedForm<T>(posted: PostedForm | null, fn: () => T): T {
  const before = servedForm.current;
  servedForm.current = posted;
  try {
    return fn();
  } finally {
    servedForm.current = before;
  }
}
