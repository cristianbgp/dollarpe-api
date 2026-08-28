import { OpenAPIHono } from "@hono/zod-openapi";
import { swaggerUI } from "@hono/swagger-ui";
import { cors } from "hono/cors";
import { getAllData } from "./exchanges";
import { exchangesRoute, officialRateRoute } from "./openapi";
import {
  fetchSunatOfficialRate,
  InvalidSunatDateError,
} from "./providers/sunat";

export type { DataResult } from "./providers";

const app = new OpenAPIHono();

app.use("*", cors());

app.get("/", (c) => {
  return c.text(
    `dollarpe by @cristianbgp\n\nGET /exchanges\nGET /exchanges?sort=buy|sell\n\nGET /official-rate\nGET /official-rate?date=YYYY-MM-DD\n\nGET /openapi.json\nGET /docs`
  );
});

app.openapi(
  exchangesRoute,
  async (c) => {
    const { sort = "buy" } = c.req.valid("query");
    const result = await getAllData(sort);

    if (result.length === 0) {
      return c.json(
        { error: "Exchange rates are temporarily unavailable" },
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
      return c.json({ error: "Invalid sort criteria" }, 400);
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
        return c.json({ error: error.message }, 400);
      }

      console.error({
        event: "official_rate_fetch_failed",
        provider: "sunat",
        error: error instanceof Error ? error.message : String(error),
      });
      return c.json(
        { error: "Official exchange rate is temporarily unavailable" },
        503
      );
    }
  },
  (result, c) => {
    if (!result.success) {
      return c.json({ error: "Invalid date" }, 400);
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

export default app;
