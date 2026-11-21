import type { Z3_context } from "z3-solver";
import { unsafe } from "./unsafe.ts";

/** The members of z3-solver's Emscripten module that hold a query on the WASM heap and start an evaluation. */
interface Heap {
  readonly HEAPU8: Uint8Array;
  _malloc(size: number): number;
  _free(at: number): void;
  _async_Z3_eval_smtlib2_string(context: Z3_context, text: number): void;
  async_call(start: () => void): Promise<string>;
}

/**
 * `Z3_eval_smtlib2_string` of `text` in the context `c`, on Z3's solver thread, with the text held on the WASM heap
 * until Z3 has answered. z3-solver's `eval_smtlib2_string` passes the text as a stack string that the solver thread
 * reads after the frame is released: any main-thread call into the module before that read, the trailing call of the
 * previous evaluation's thread among them, overwrites the end of the query. `_malloc` aborts the module when the heap
 * is full, so the address is never 0.
 */
export async function evalOnHeap(em: unknown, c: Z3_context, text: string): Promise<string> {
  const m = unsafe("z3-solver types its Emscripten module as any", () => em as Heap);
  const bytes = new TextEncoder().encode(`${text}\0`);
  const at = m._malloc(bytes.length);
  try {
    m.HEAPU8.set(bytes, at);
    return await m.async_call(() => m._async_Z3_eval_smtlib2_string(c, at));
  } finally {
    m._free(at);
  }
}
