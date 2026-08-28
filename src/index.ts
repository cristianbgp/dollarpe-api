import { Hono } from "hono";
import { cors } from "hono/cors";
import sortCriteriaGenerator from "./utils/sort-criteria-generator";

const UPSTREAM_TIMEOUT_MS = 5_000;
const TUCAMBISTA_PUBLIC_SUBSCRIPTION_KEY =
  "e4b6947d96a940e7bb8b39f462bcc56d;product=tucambista-production";

type DataEntry = [string, DataResult];

const buyCriteriaDesc = sortCriteriaGenerator<DataEntry>(
  ([, item]) => item.buy,
  { desc: true }
);
const sellCriteriaDesc = sortCriteriaGenerator<DataEntry>(
  ([, item]) => item.sell,
  { asc: true }
);

export type DataResult = {
  buy: number;
  sell: number;
  pageUrl: string;
};

async function getData({
  url,
  method = "GET",
  headers,
  body,
  accessorToBuy,
  accessorToSell,
  pageUrl,
}: {
  url: string;
  method?: string;
  headers?: Record<string, string>;
  body?: string;
  accessorToBuy: (data: any) => number;
  accessorToSell: (data: any) => number;
  pageUrl: string;
}): Promise<DataResult> {
  const response = await fetch(url, {
    method,
    headers,
    body,
    signal: AbortSignal.timeout(UPSTREAM_TIMEOUT_MS),
  });

  if (!response.ok) {
    throw new Error(`Upstream request failed with status ${response.status}`);
  }

  const data = await response.json();
  const buy = Number(accessorToBuy(data));
  const sell = Number(accessorToSell(data));

  if (!Number.isFinite(buy) || buy <= 0 || !Number.isFinite(sell) || sell <= 0) {
    throw new Error("Upstream returned invalid exchange rates");
  }

  return { buy, sell, pageUrl };
}

async function getAllData(sort: "buy" | "sell" = "buy") {
  const allData = await Promise.allSettled([
    getData({
      url: "https://app.rextie.com/api/v1/fxrates/rate/",
      method: "POST",
      accessorToBuy: (data) => Number(data.fx_rate_buy),
      accessorToSell: (data) => Number(data.fx_rate_sell),
      pageUrl: "https://www.rextie.com/",
    }),
    getData({
      url: "https://api.kambista.com/v1/exchange/calculates?originCurrency=USD&destinationCurrency=PEN&active=S&amount=1",
      accessorToBuy: (data) => data.tc.bid,
      accessorToSell: (data) => data.tc.ask,
      pageUrl: "https://kambista.com/",
    }),
    getData({
      url: "https://tkambio.com/wp-admin/admin-ajax.php",
      method: "POST",
      body: "action=get_exchange_rate",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8",
      },
      accessorToBuy: (data) => Number(data.buying_rate),
      accessorToSell: (data) => Number(data.selling_rate),
      pageUrl: "https://tkambio.com/",
    }),
    getData({
      url: "https://operations.roblex.pe/valuation/active-valuation",
      accessorToBuy: (data) => Number(data.amountBuy),
      accessorToSell: (data) => Number(data.amountSale),
      pageUrl: "https://roblex.pe/",
    }),
    getData({
      url: "https://api.decamoney.com/v1/rates",
      accessorToBuy: (data) => Number(data.exchange_rate.buy),
      accessorToSell: (data) => Number(data.exchange_rate.sell),
      pageUrl: "https://decamoney.com/",
    }),
    getData({
      url: "https://apim.tucambista.pe/api/rates",
      headers: {
        "Ocp-Apim-Subscription-Key": TUCAMBISTA_PUBLIC_SUBSCRIPTION_KEY,
      },
      accessorToBuy: (data) => Number(data.bidRate),
      accessorToSell: (data) => Number(data.offerRate),
      pageUrl: "https://tucambista.pe/",
    }),
    getData({
      url: "https://chapacambioscontingencia.blob.core.windows.net/config/tc.json",
      accessorToBuy: ([data]) => Number(data.MontoCompra),
      accessorToSell: ([data]) => Number(data.MontoVenta),
      pageUrl: "https://chapacambio.com/",
    }),
    getData({
      url: "https://www.cambiomundial.com/backend/tasaCambio/daily",
      accessorToBuy: ([data]) => Number(data.buy),
      accessorToSell: ([data]) => Number(data.sell),
      pageUrl: "https://www.cambiomundial.com",
    }),
  ]);
  const dollar = {} as Record<string, DataResult | undefined>;
  [
    dollar.rextie,
    dollar.kambista,
    dollar.tkambio,
    dollar.roblex,
    dollar.decamoney,
    dollar.tucambista,
    dollar.chapacambio,
    dollar.cambiomundial,
  ] = allData.map((result) =>
    result.status === "fulfilled" ? result.value : undefined
  );
  const sortCriteria = sort === "buy" ? buyCriteriaDesc : sellCriteriaDesc;
  const result = Object.entries(dollar)
    .filter((entry): entry is DataEntry => entry[1] !== undefined)
    .sort(sortCriteria);
  return result;
}

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
