import { Hono } from "hono";
import { cors } from "hono/cors";
import { getAllData } from "./exchanges";

export type { DataResult } from "./providers";

const app = new Hono();

app.use("*", cors());

app.get("/", (c) => {
  return c.text(`dollarpe by @cristianbgp\n\nGET /exchanges`);
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
  c.header("Cache-Control", "public, s-maxage=60, stale-while-revalidate=30");
  c.status(200);
  return c.json(result);
});

export default app;
