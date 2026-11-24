/** One piece of pending work of a run: its label and the real time (`performance.now()`) it was created at. */
export interface Piece {
  readonly label: string;
  readonly since: number;
}
