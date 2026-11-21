// The verdict of one eval iteration: converged only when the root check and the root test both exit 0
// and the task's pass.ts returned true.
export type VerdictInput = { checkExit: number; testExit: number; passed: unknown };

export const verdict = ({ checkExit, testExit, passed }: VerdictInput): boolean =>
  checkExit === 0 && testExit === 0 && passed === true;
