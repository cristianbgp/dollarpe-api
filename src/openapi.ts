import { createRoute, z } from "@hono/zod-openapi";
import { providerNames } from "./providers/types";

const ErrorSchema = z
  .object({
    error: z.string().openapi({
      description: "Backward-compatible copy of the human-readable message.",
      example: "Invalid sort criteria",
    }),
    code: z.string().openapi({
      description: "Stable machine-readable error code.",
      example: "INVALID_SORT",
    }),
    message: z.string().openapi({
      description: "Human-readable explanation of the error.",
      example: "Invalid sort criteria",
    }),
    hint: z.string().openapi({
      description: "A concrete action the client can take to recover.",
      example: "Use sort=buy or sort=sell.",
    }),
  })
  .openapi("Error");

const DataResultSchema = z
  .object({
    buy: z.number().positive(),
    sell: z.number().positive(),
    pageUrl: z.url(),
  })
  .openapi("ExchangeRate");

const ExchangeEntrySchema = z.tuple([
  z.enum(providerNames).openapi("ProviderName"),
  DataResultSchema,
]);

const OfficialRateSchema = DataResultSchema.extend({
  source: z.literal("sunat"),
  date: z.iso.date(),
}).openapi("OfficialRate");

const errorResponse = (description: string) => ({
  description,
  content: {
    "application/json": {
      schema: ErrorSchema,
    },
  },
});

export const exchangesRoute = createRoute({
  method: "get",
  path: "/exchanges",
  operationId: "listExchangeRates",
  tags: ["Exchange rates"],
  summary: "List current exchange rates",
  description:
    "Returns every available provider. Providers that fail or return invalid data are omitted.",
  request: {
    query: z.object({
      sort: z
        .enum(["buy", "sell"])
        .optional()
        .openapi({
          param: { name: "sort", in: "query" },
          description:
            "Sort by highest buy rate or lowest sell rate. Defaults to buy.",
          example: "buy",
        }),
    }),
  },
  responses: {
    200: {
      description: "Available exchange rates",
      content: {
        "application/json": {
          schema: z.array(ExchangeEntrySchema),
        },
      },
    },
    400: errorResponse("Invalid sort criteria"),
    503: errorResponse("Every exchange-rate provider is unavailable"),
  },
});

export const officialRateRoute = createRoute({
  method: "get",
  path: "/official-rate",
  operationId: "getOfficialRate",
  tags: ["Official rate"],
  summary: "Get the official SUNAT exchange rate",
  description:
    "Returns the official rate for today in Lima or for a requested historical date.",
  request: {
    query: z.object({
      date: z
        .string()
        .regex(/^\d{4}-\d{2}-\d{2}$/)
        .optional()
        .openapi({
          param: { name: "date", in: "query" },
          description:
            "Historical date in YYYY-MM-DD format. Future dates are rejected.",
          format: "date",
          example: "2025-11-17",
        }),
    }),
  },
  responses: {
    200: {
      description: "Official SUNAT exchange rate",
      content: {
        "application/json": {
          schema: OfficialRateSchema,
        },
      },
    },
    400: errorResponse("Invalid or future date"),
    503: errorResponse("SUNAT is temporarily unavailable"),
  },
});
