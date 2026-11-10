import { s } from "@keel/schema";
import type { ActionIo } from "./ActionIo.ts";

/** The issue fields the lookup reads (open objects: the rest is ignored); pull requests carry `pull_request`. */
const Listed = s.array(
  s.object({
    number: s.int(),
    title: s.string(),
    body: s.string().nullable().optional(),
    state: s.string().optional(),
    state_reason: s.string().nullable().optional(),
    pull_request: s.json().optional(),
  }),
);
const Filed = s.object({ number: s.int() });
const Comments = s.array(s.object({ body: s.string().nullable().optional() }));
const NEXT = /<([^>]+)>;\s*rel="next"/;
const LAST = /<([^>]+)>;\s*rel="last"/;
const MAX_PAGES = 50;

type Got<T> = { readonly ok: true; readonly value: T } | { readonly ok: false; readonly why: string };
type Issue = {
  readonly number: number;
  readonly title: string;
  readonly body: string;
  /** `open`, `completed` (closed as completed) or `not_planned` (closed as not planned). */
  readonly status: "open" | "completed" | "not_planned";
};

/**
 * GitHub REST issue calls for `repo` (`owner/name`) at `api`, authorized by `token`, through `io.fetch`. `find(label)`
 * lists every issue with `label`, open or closed, following `Link: rel="next"` only while it stays under `api`, and drops pull
 * requests; a next page past 50 pages of 100 is a failure. `lastComment(n)` is the body of issue `n`'s newest comment
 * (null: none), read from the `rel="last"` page. A failure is a reason without the token or a response body.
 */
export function issueApi(io: Pick<ActionIo, "fetch">, api: string, repo: string, token: string) {
  const base = `${api}/repos/${repo}/issues`;
  const headers = {
    accept: "application/vnd.github+json",
    authorization: `Bearer ${token}`,
    "content-type": "application/json",
    "user-agent": "keel-session-action",
    "x-github-api-version": "2022-11-28",
  };
  const call = async (what: string, url: string, method: string, body?: unknown): Promise<Got<Response>> => {
    let res: Response;
    try {
      const init = { method, headers, ...(body === undefined ? {} : { body: JSON.stringify(body) }) };
      res = await io.fetch(url, init);
    } catch {
      return { ok: false, why: `github ${what} unreachable` };
    }
    return res.ok ? { ok: true, value: res } : { ok: false, why: `github ${what} answered ${res.status}` };
  };
  const filed = async (what: string, url: string, method: string, body: unknown): Promise<Got<number>> => {
    const r = await call(what, url, method, body);
    if (!r.ok) return r;
    const n = Filed.parse(await r.value.json().catch(() => null));
    return n.ok ? { ok: true, value: n.value.number } : { ok: false, why: `github ${what} answered without a number` };
  };
  const under = (link: string | null, rel: RegExp): string | undefined => {
    const url = rel.exec(link ?? "")?.[1];
    return url?.startsWith(`${api}/`) ? url : undefined;
  };
  return {
    find: async (label: string): Promise<Got<Issue[]>> => {
      const out: Issue[] = [];
      let url: string | undefined = `${base}?state=all&labels=${encodeURIComponent(label)}&per_page=100`;
      for (let page = 0; url !== undefined; page++) {
        if (page === MAX_PAGES) return { ok: false, why: `github issues list exceeded ${MAX_PAGES} pages` };
        const r = await call("issues list", url, "GET");
        if (!r.ok) return r;
        const list = Listed.parse(await r.value.json().catch(() => null));
        if (!list.ok) return { ok: false, why: "github issues list answered without a list" };
        for (const i of list.value) {
          if (i.pull_request !== undefined) continue;
          const status =
            i.state === "closed" ? (i.state_reason === "not_planned" ? "not_planned" : "completed") : "open";
          out.push({ number: i.number, title: i.title, body: i.body ?? "", status });
        }
        url = under(r.value.headers.get("link"), NEXT);
      }
      return { ok: true, value: out };
    },
    lastComment: async (n: number): Promise<Got<string | null>> => {
      const first = await call("comments list", `${base}/${n}/comments?per_page=100`, "GET");
      if (!first.ok) return first;
      const last = under(first.value.headers.get("link"), LAST);
      const page = last === undefined ? first : await call("comments list", last, "GET");
      if (!page.ok) return page;
      const list = Comments.parse(await page.value.json().catch(() => null));
      if (!list.ok) return { ok: false, why: "github comments list answered without a list" };
      return { ok: true, value: list.value.at(-1)?.body ?? null };
    },
    create: (label: string, title: string, body: string) =>
      filed("issue create", base, "POST", { title, body, labels: [label] }),
    update: (n: number, title: string, body: string) => filed("issue update", `${base}/${n}`, "PATCH", { title, body }),
    comment: (n: number, body: string) => filed("issue comment", `${base}/${n}/comments`, "POST", { body }),
  };
}
