import { declaredCodes } from "@keel/schema/internal";
import { attempted } from "./attempted.ts";

/** A code Keel owns: the kernel's `keel.`, `schema.` and `store.` errors. */
const KERNEL = /^(keel|schema|store)\.[A-Za-z0-9.]+$/;

/**
 * The code a log writes after `cls` (k.serverlog Thrown values): a defect's own `code`; a `KeelError`'s when `s.error`
 * declared it in this process or it is a kernel code, else `[code]`; for any other class none, so a thrown object's
 * `code` property is never written. Never throws.
 */
export function thrownCode(x: unknown, cls: string): string | undefined {
  const read = attempted((): string | undefined => {
    if (typeof x !== "object" || x === null) return undefined;
    if (cls === "Defect") {
      const own: unknown = Object.getOwnPropertyDescriptor(x, "code")?.value;
      return typeof own === "string" && /^E\d{4}$/.test(own) ? own : undefined;
    }
    if (cls !== "Result") return undefined;
    const code: unknown = Reflect.get(x, "code");
    return typeof code === "string" && (declaredCodes().has(code) || KERNEL.test(code)) ? code : "[code]";
  });
  return read.ok ? read.value : undefined;
}
