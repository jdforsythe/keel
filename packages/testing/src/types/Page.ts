import type { A11yNode } from "./A11yNode.ts";
import type { CookieInfo } from "./CookieInfo.ts";
import type { Downloaded } from "./Downloaded.ts";
import type { ExpectedProblem } from "./ExpectedProblem.ts";
import type { Found } from "./Found.ts";
import type { Layout } from "./Layout.ts";
import type { LoadedDocument } from "./LoadedDocument.ts";
import type { Match } from "./Match.ts";
import type { Problem } from "./Problem.ts";
import type { SentRequest } from "./SentRequest.ts";
import type { StyleName } from "./StyleName.ts";
import type { TestEvent } from "./TestEvent.ts";
import type { UploadFile } from "./UploadFile.ts";
import type { Wait } from "./Wait.ts";

/**
 * A browser tab of a built app (k.e2e-page): the harness's verbs on a real page, by id alone. Each verb that acts
 * resolves once the page is quiet; each wait is bounded (`Wait`) and rejects E1735 when it runs out.
 */
export interface Page {
  fire(id: string, event: TestEvent): Promise<void>;
  press(key: string): Promise<void>;
  find(id: string): Promise<Found>;
  findAll(prefix: string): Promise<readonly Found[]>;
  until(id: string, match: Match, wait?: Wait): Promise<void>;
  settle(): Promise<void>;
  a11y(id?: string): Promise<A11yNode>;
  focusOrder(): Promise<readonly string[]>;
  navigate(path: string): Promise<void>;
  reload(): Promise<void>;
  back(): Promise<void>;
  location(): Promise<{ readonly path: string; readonly entries: number }>;
  documents(): Promise<readonly LoadedDocument[]>;
  requests(): readonly SentRequest[];
  cookies(): Promise<readonly CookieInfo[]>;
  fetch(path: string, init?: RequestInit): Promise<Response>;
  offline(on: boolean): Promise<void>;
  scroll(y: number): Promise<void>;
  viewport(size: { readonly width: number; readonly height: number }): Promise<void>;
  layout(id?: string): Promise<Layout>;
  /** The computed `names` of `id`, or of the `body` with `id` `undefined`. */
  style(id: string | undefined, names: readonly StyleName[]): Promise<Partial<Record<StyleName, string>>>;
  /** The document's title, as `document.title` reads it. */
  title(): Promise<string>;
  /** Runs a held page's scripts; `grows` lists ids whose elements may gain descendants during the claim. */
  resume(options?: { readonly grows?: readonly string[] }): Promise<void>;
  /** With no argument every problem not yet taken, taking none; with `expected`, those some entry matches, taken. */
  problems(...expected: readonly ExpectedProblem[]): readonly Problem[];
  /** Picks `files` on an `<input type="file">` as a file dialog does (E1726 on another element). */
  upload(id: string, files: readonly UploadFile[]): Promise<void>;
  /** Clicks `id` and resolves the file the click downloads (E1735 when none comes within the bound). */
  download(id: string): Promise<Downloaded>;
  /** Moves the mouse to the element's centre. */
  hover(id: string): Promise<void>;
  /** A page for each tab this page opened, in order, each loaded as `open` resolves. */
  opened(): Promise<readonly Page[]>;
  /** Another tab in this context (its cookies and storage); `hold` as `Served.open`'s. */
  open(path: string, options?: { readonly hold?: boolean }): Promise<Page>;
}
