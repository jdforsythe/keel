// The score of one running app: the acceptance suite, the security scan and the a11y scan, all against one origin.
import { type Acceptance, runAcceptance } from "./suite.ts";
import { type A11y, type Security, a11yScan, securityScan } from "./scan.ts";

export type Score = { acceptance: Acceptance; security: Security; a11y: A11y };

/** Acceptance first (it needs the box empty), then the scans, which add one recipe of their own. */
export async function scoreUrl(origin: string, root: string): Promise<Score> {
  const acceptance = await runAcceptance(origin);
  const security = await securityScan(origin);
  const a11y = await a11yScan(origin, root);
  return { acceptance, security, a11y };
}

/** Converged means every acceptance check passed. */
export const converged = (s: Score): boolean => s.acceptance.total > 0 && s.acceptance.passed === s.acceptance.total;
