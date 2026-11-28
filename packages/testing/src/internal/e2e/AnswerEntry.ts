/** What a serve's proxy calls of an `answer` for a mapped origin's request: the handler, logging `url`. */
export type AnswerEntry = { readonly respond: (request: Request) => Promise<Response> };
