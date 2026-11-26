import type { A11yNode } from "./A11yNode.ts";
import type { CookieInfo } from "./CookieInfo.ts";
import type { Found } from "./Found.ts";
import type { Layout } from "./Layout.ts";
import type { LoadedDocument } from "./LoadedDocument.ts";
import type { Match } from "./Match.ts";
import type { Problem } from "./Problem.ts";
import type { SentRequest } from "./SentRequest.ts";
import type { StyleName } from "./StyleName.ts";
import type { TestEvent } from "./TestEvent.ts";
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
  resume(): Promise<void>;
  problems(): readonly Problem[];
  /** Another tab in this context (its cookies and storage); `hold` as `Served.open`'s. */
  open(path: string, options?: { readonly hold?: boolean }): Promise<Page>;
}
