import { KERNEL_FOLDERS } from "./KERNEL_FOLDERS.ts";

/** Whether `path` lies in a kernel package's own folder, `packages/<p>/`, the one place a scope may detach (E1207). */
export function inKernel(path: string): boolean {
  const m = /(?:^|\/)packages\/([^/]+)\//.exec(path);
  return m?.[1] !== undefined && KERNEL_FOLDERS.has(m[1]);
}
