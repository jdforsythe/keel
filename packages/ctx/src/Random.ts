/** Randomness capability. `float()` is in [0, 1); `uuid()` is a v4 UUID string. */
export interface Random {
  uuid(): string;
  float(): number;
}
