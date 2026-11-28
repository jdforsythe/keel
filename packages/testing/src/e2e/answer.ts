import { createServer } from "node:http";
import { answerEntries } from "../internal/e2e/answerEntries.ts";
import { e2eError } from "../internal/e2e/e2eError.ts";
import { requireE2e } from "../internal/e2e/requireE2e.ts";
import { sendResponse } from "../internal/e2e/sendResponse.ts";
import { sentOf } from "../internal/e2e/sentOf.ts";
import { testEnd } from "../internal/e2e/testEnd.ts";
import { webRequest } from "../internal/e2e/webRequest.ts";
import type { Answered } from "../types/Answered.ts";
import type { SentRequest } from "../types/SentRequest.ts";

/**
 * An origin the test owns (k.e2e Answered origins): a loopback HTTP server answering each request with
 * `handler(request)`, its requests kept in order. A server reaches it through `env` (`origin`); a page, through a
 * serve's `origins`. Disposed when the test ends.
 */
export async function answer(handler: (request: Request) => Response | Promise<Response>): Promise<Answered> {
  requireE2e("answer");
  const sent: SentRequest[] = [];
  const respond = async (request: Request): Promise<Response> => {
    sent.push(sentOf(request.method, request.url, request.headers.keys()));
    try {
      return await handler(request);
    } catch (e) {
      return new Response(`answer handler threw: ${e instanceof Error ? e.message : String(e)}`, { status: 500 });
    }
  };
  const server = createServer((req, res) => {
    void (async () => {
      const host = req.headers.host ?? "127.0.0.1";
      await sendResponse(res, await respond(await webRequest(req, `http://${host}${req.url ?? "/"}`)));
    })();
  });
  const port = await new Promise<number>((done, failed) => {
    server.once("error", (e) => failed(e2eError("E1737", `answer could not listen: ${e.message}`, {})));
    server.listen(0, "127.0.0.1", () => {
      const a = server.address();
      done(typeof a === "object" && a !== null ? a.port : 0);
    });
  });
  let closed: Promise<void> | undefined;
  const handle: Answered = {
    origin: `http://127.0.0.1:${port}`,
    requests: () => [...sent],
    dispose: () => {
      closed ??= new Promise<void>((done) => {
        server.closeAllConnections();
        server.close(() => done());
      });
      return closed;
    },
  };
  answerEntries.set(handle, { respond });
  testEnd().disposeAtEnd(handle.dispose);
  return handle;
}
