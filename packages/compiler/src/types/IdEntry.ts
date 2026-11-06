/** One `ids.json` entry: where an element is declared and what it is. */
export type IdEntry = {
  col: number;
  component: string;
  file: string;
  line: number;
  role: string | null;
  tag: string;
};
