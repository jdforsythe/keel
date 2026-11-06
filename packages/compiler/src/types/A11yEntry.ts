/** One `a11y.json` entry: expected role and where the accessible name comes from. */
export type A11yEntry = {
  name: "label" | "alt" | "text" | "aria" | "none";
  role: string | null;
  tag: string;
};
