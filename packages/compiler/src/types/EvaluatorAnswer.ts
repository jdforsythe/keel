/**
 * The command's answer to one question of an evaluator (k.evaluator Questions): `ok`, the answer as JSON data, or
 * `err`, a failure the view throws in the evaluator as Node would (its `code`, `message`, and `errno` and `syscall`
 * when Node's error had them).
 */
export type EvaluatorAnswer =
  | { readonly ok: unknown }
  | {
      readonly err: {
        readonly code: string;
        readonly message: string;
        readonly errno?: number;
        readonly syscall?: string;
      };
    };
