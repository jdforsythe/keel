/** What `PGlite.create` takes so that it compiles nothing: the engine's two WebAssembly modules. */
export interface PgliteModules {
  readonly pgliteWasmModule: WebAssembly.Module;
  readonly initdbWasmModule: WebAssembly.Module;
}
