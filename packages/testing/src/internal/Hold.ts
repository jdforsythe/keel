/**
 * Held work of a run (k.drive-law Order): its id among the run's pending work and, once it has settled, how to deliver
 * its outcome to the code awaiting it.
 */
export interface Hold {
  readonly id: number;
  deliver: (() => void) | undefined;
}
