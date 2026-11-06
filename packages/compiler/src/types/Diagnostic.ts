/** One diagnostic per docs/OUTPUT.md: stable code, 1-based location, one-line message, optional fix hunk. */
export type Diagnostic = {
  code: string;
  path: string;
  line: number;
  col: number;
  message: string;
  fix?: string;
  see?: string;
};
