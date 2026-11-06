/** Network capability with the platform fetch shape. */
export interface Net {
  fetch(req: Request): Promise<Response>;
}
