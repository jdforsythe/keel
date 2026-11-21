/** One Z3 context's SMT-LIB 2 interpreter (`eval_smtlib2_string`), closed with `close`. */
export interface Solver {
  run(text: string): Promise<string>;
  close(): void;
}
