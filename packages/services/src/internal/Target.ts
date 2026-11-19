/** Where one call goes: the URL its path joins, and how its Request is answered (`ctx.net.fetch`, or an app in process). */
export type Target = {
  readonly base: string;
  readonly module?: true;
  send(req: Request): Promise<Response>;
};
