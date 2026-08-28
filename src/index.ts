import { Hono } from "hono";
import { cors } from "hono/cors";
import { getAllData } from "./exchanges";
import {
  fetchSunatOfficialRate,
  InvalidSunatDateError,
} from "./providers/sunat";

export type { DataResult } from "./providers";

const app = new Hono();

app.use("*", cors());

app.get("/", (c) => {
  return c.text(
    `dollarpe by @cristianbgp\n\nGET /exchanges\nGET /exchanges?sort=buy|sell\n\nGET /official-rate\nGET /official-rate?date=YYYY-MM-DD`
  );
});

app.get("/exchanges", async (c) => {
  const {
    sort = "buy",
  }: {
    sort?: "buy" | "sell";
  } = c.req.query();
  if (sort !== "buy" && sort !== "sell") {
    c.status(400);
    return c.json({ error: "Invalid sort criteria" });
  }

  const result = await getAllData(sort);

  if (result.length === 0) {
    c.status(503);
    return c.json({ error: "Exchange rates are temporarily unavailable" });
  }

  c.header("Cache-Control", "public, s-maxage=60, stale-while-revalidate=30");
  c.status(200);
  return c.json(result);
});

app.get("/official-rate", async (c) => {
  try {
    const rate = await fetchSunatOfficialRate(c.req.query("date"));

    c.header(
      "Cache-Control",
      "public, s-maxage=3600, stale-while-revalidate=86400"
    );
    return c.json(rate);
  } catch (error) {
    if (error instanceof InvalidSunatDateError) {
      c.status(400);
      return c.json({ error: error.message });
    }

    console.error({
      event: "official_rate_fetch_failed",
      provider: "sunat",
      error: error instanceof Error ? error.message : String(error),
    });
    c.status(503);
    return c.json({
      error: "Official exchange rate is temporarily unavailable",
    });
  }
});

export default app;
