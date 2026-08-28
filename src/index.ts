import { OpenAPIHono } from "@hono/zod-openapi";
import { swaggerUI } from "@hono/swagger-ui";
import { cors } from "hono/cors";
import readme from "../README.md" with { type: "text" };
import { getAllData } from "./exchanges";
import {
  createApiError,
  negotiateContentType,
  setNegotiatedResponseHeaders,
} from "./http";
import { exchangesRoute, officialRateRoute } from "./openapi";
import {
  fetchSunatOfficialRate,
  InvalidSunatDateError,
} from "./providers/sunat";

export type { DataResult } from "./providers";

const app = new OpenAPIHono();

const indexText =
  "dollarpe by @cristianbgp\n\nGET /exchanges\nGET /exchanges?sort=buy|sell\n\nGET /official-rate\nGET /official-rate?date=YYYY-MM-DD\n\nGET /openapi.json\nGET /docs\nGET /readme";

const indexMarkdown = `# dollarpe by @cristianbgp

- [GET /exchanges](/exchanges)
- [GET /exchanges?sort=buy](/exchanges?sort=buy)
- [GET /exchanges?sort=sell](/exchanges?sort=sell)
- [GET /official-rate](/official-rate)
- [GET /official-rate?date=YYYY-MM-DD](/official-rate?date=YYYY-MM-DD)
- [GET /openapi.json](/openapi.json)
- [GET /docs](/docs)
- [GET /readme](/readme)
`;

app.use("*", cors());

app.get("/", (c) => {
  setNegotiatedResponseHeaders(c);
  const contentType = negotiateContentType(
    c,
    ["text/plain", "text/markdown"],
    "text/plain"
  );

  if (contentType === "not-acceptable") {
    return c.text(
      "Not Acceptable. Request text/plain or text/markdown.",
      406
    );
  }

  c.header("Content-Type", `${contentType}; charset=utf-8`);
  return c.body(contentType === "text/markdown" ? indexMarkdown : indexText);
});

app.get("/readme", (c) => {
  c.header("Content-Type", "text/markdown; charset=utf-8");
  return c.body(readme);
});

app.openapi(
  exchangesRoute,
  async (c) => {
    const { sort = "buy" } = c.req.valid("query");
    const result = await getAllData(sort);

    if (result.length === 0) {
      return c.json(
        createApiError(
          "EXCHANGE_RATES_UNAVAILABLE",
          "Exchange rates are temporarily unavailable",
          "Retry later; upstream providers may be temporarily unavailable."
        ),
        503
      );
    }

    c.header(
      "Cache-Control",
      "public, s-maxage=60, stale-while-revalidate=30"
    );
    return c.json(result, 200);
  },
  (result, c) => {
    if (!result.success) {
      return c.json(
        createApiError(
          "INVALID_SORT",
          "Invalid sort criteria",
          "Use sort=buy or sort=sell."
        ),
        400
      );
    }
  }
);

app.openapi(
  officialRateRoute,
  async (c) => {
    try {
      const { date } = c.req.valid("query");
      const rate = await fetchSunatOfficialRate(date);

      c.header(
        "Cache-Control",
        "public, s-maxage=3600, stale-while-revalidate=86400"
      );
      return c.json(rate, 200);
    } catch (error) {
      if (error instanceof InvalidSunatDateError) {
        return c.json(
          createApiError(
            "INVALID_DATE",
            error.message,
            "Use a real, non-future date in YYYY-MM-DD format."
          ),
          400
        );
      }

      console.error({
        event: "official_rate_fetch_failed",
        provider: "sunat",
        error: error instanceof Error ? error.message : String(error),
      });
      return c.json(
        createApiError(
          "OFFICIAL_RATE_UNAVAILABLE",
          "Official exchange rate is temporarily unavailable",
          "Retry later or request a different historical date."
        ),
        503
      );
    }
  },
  (result, c) => {
    if (!result.success) {
      return c.json(
        createApiError(
          "INVALID_DATE",
          "Invalid date",
          "Use a real, non-future date in YYYY-MM-DD format."
        ),
        400
      );
    }
  }
);

app.doc31("/openapi.json", {
  openapi: "3.1.0",
  info: {
    title: "dollarpe API",
    version: "1.0.0",
    description:
      "US dollar to Peruvian sol exchange rates from online providers and SUNAT.",
  },
});

app.get("/docs", swaggerUI({ url: "/openapi.json" }));

app.notFound((c) => {
  setNegotiatedResponseHeaders(c);
  const contentType = negotiateContentType(
    c,
    ["text/markdown", "application/json"],
    "text/markdown"
  );

  if (contentType === "application/json") {
    return c.json(
      createApiError(
        "NOT_FOUND",
        "The requested resource was not found",
        "Use /readme, /docs, or /openapi.json to find a public endpoint."
      ),
      404
    );
  }

  if (contentType === "not-acceptable") {
    return c.text(
      "Not Acceptable. Request text/markdown or application/json.",
      406
    );
  }

  c.header("Content-Type", "text/markdown; charset=utf-8");
  return c.body(
    "# Not Found\n\nThe requested resource does not exist. Continue with [/readme](/readme), [/docs](/docs), or the machine-readable [/openapi.json](/openapi.json).\n",
    404
  );
});

export default app;
