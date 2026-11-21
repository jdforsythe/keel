// Generated from OpenAPI by `keel scaffold service` (k.services); do not edit.
import { s } from "@keel/schema";
import { endpoints } from "@keel/services";

const Quote = s.object({
  id: s.string(),
  text: s.string(),
  author: s.string(),
});
const Missing = s.object({
  message: s.string(),
});

export const AppApi = endpoints({
  getQuote: {
    method: "GET",
    path: "/quotes/:id",
    params: s.object({
      id: s.string(),
    }),
    output: Quote,
    errors: {
      404: Missing,
    },
  },
});
