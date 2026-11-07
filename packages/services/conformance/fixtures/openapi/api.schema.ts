// Generated from OpenAPI by `keel scaffold service` (k.services); do not edit.
import { s } from "@keel/schema";
import { endpoints } from "@keel/services";

const Line = s.object({
  sku: s.string(),
  qty: s.int({ min: 1, max: 1000 }),
});
const Address = s.object({
  street: s.string({ min: 1 }),
  city: s.string(),
  zip: s.string().optional(),
});
const Card = s.object({
  cardNumber: s.string(),
});
const Wire = s.object({
  iban: s.string(),
});
const Order = s.object({
  id: s.string(),
  status: s.enum(["pending", "paid", "shipped"]),
  customer: s.string(),
  lines: s.array(Line),
  shipTo: Address,
  note: s.string().nullable(),
  nickname: s.string().nullable().optional(),
  total: s.number({ min: 0 }),
  paid: s.boolean().optional(),
  meta: s.record(s.string()).optional(),
  flags: s
    .object(
      {
        gift: s.boolean().optional(),
      },
      { closed: true },
    )
    .optional(),
  payment: s.union([Card, Wire]).optional(),
});
const NewOrder = s.object({
  customer: s.string(),
  lines: s.array(Line),
  shipTo: Address,
  note: s.string().nullable().optional(),
});
const Conflict = s.object({
  reason: s.enum(["stale", "duplicate"]),
  current: Order.optional(),
});
const NotFound = s.object({
  message: s.string(),
});

export const OrdersApi = endpoints({
  listOrders: {
    method: "GET",
    path: "/orders",
    query: s.object({
      customer: s.string({ min: 1 }),
      status: s.enum(["pending", "paid", "shipped"]).optional(),
      limit: s.int({ min: 1, max: 100 }).optional(),
    }),
    output: s.object({
      items: s.array(Order),
      next: s.string().nullable().optional(),
    }),
  },
  createOrder: {
    method: "POST",
    path: "/orders",
    body: NewOrder,
    output: Order,
    errors: {
      409: Conflict,
    },
  },
  getOrder: {
    method: "GET",
    path: "/orders/:id",
    params: s.object({
      id: s.string(),
    }),
    query: s.object({
      expand: s.boolean().optional(),
    }),
    output: Order,
    errors: {
      404: NotFound,
    },
  },
  replaceOrder: {
    method: "PUT",
    path: "/orders/:id",
    params: s.object({
      id: s.string(),
    }),
    body: NewOrder,
    output: Order,
    errors: {
      404: NotFound,
    },
  },
  patchOrder: {
    method: "PATCH",
    path: "/orders/:id",
    params: s.object({
      id: s.string(),
    }),
    body: s.object({
      note: s.string().nullable().optional(),
      flags: s
        .object(
          {
            gift: s.boolean().optional(),
            rush: s.boolean().optional(),
          },
          { closed: true },
        )
        .optional(),
    }),
    output: Order,
    errors: {
      409: Conflict,
    },
  },
  deleteOrder: {
    method: "DELETE",
    path: "/orders/:id",
    params: s.object({
      id: s.string(),
    }),
    query: s.object({
      force: s.boolean(),
    }),
    output: s.json(),
    errors: {
      404: NotFound,
    },
  },
  getNote: {
    method: "GET",
    path: "/orders/:id/notes/:noteId",
    params: s.object({
      id: s.string(),
      noteId: s.int(),
    }),
    output: s.object({
      text: s.string({ max: 200 }),
    }),
  },
});
