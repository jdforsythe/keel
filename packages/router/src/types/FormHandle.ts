import type { FormSeam } from "../internal/FormSeam.ts";
import type { formHandle } from "../internal/formHandle.ts";

/**
 * What `<Form form>` accepts: the handle `form()` returns (@keel/forms). Its seam is keyed by a symbol from
 * `@keel/router/internal` (RFC 0045), so a handle has no public `setPending`/`validate`/`onResult` methods.
 */
export interface FormHandle {
  readonly [formHandle]: FormSeam;
}
