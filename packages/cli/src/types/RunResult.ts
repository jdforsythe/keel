/** What one engine call produced. `code`: 0 no error diagnostics, 1 error diagnostics, 2 usage error (k.cli). */
export type RunResult = { readonly code: number; readonly stdout: string; readonly stderr: string };
