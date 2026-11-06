/** `mode` selects the target; `"client"` (default) emits DOM ops; `"server"` currently emits the same module. */
export type CompileOptions = { readonly mode?: "client" | "server" };
