import { Hono } from "hono";
import { cors } from "hono/cors";
import sortCriteriaGenerator from "./utils/sort-criteria-generator";

const buyCriteriaDesc = sortCriteriaGenerator((item) => item[1].buy, {
  desc: true,
});
const sellCriteriaDesc = sortCriteriaGenerator((item) => item[1].sell, {
  asc: true,
});

type DataResult = {
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
  });
  const data = await response.json();
  return { buy: accessorToBuy(data), sell: accessorToSell(data), pageUrl };
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
        "Ocp-Apim-Subscription-Key":
          "e4b6947d96a940e7bb8b39f462bcc56d;product=tucambista-production",
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
  ] = allData.map((result) =>
    result.status === "fulfilled" ? result.value : undefined
  );
  const sortCriteria = sort === "buy" ? buyCriteriaDesc : sellCriteriaDesc;
  let result = Object.entries(dollar)
    .filter(([, value]) => value !== undefined)
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
  if(sort !== "buy" && sort !== "sell") {
    c.status(400);
    return c.json({ error: "Invalid sort criteria" });
  }

  const result = await getAllData(sort);
  c.header("Cache-Control", "public, s-maxage=60, stale-while-revalidate=30");
  c.status(200);
  return c.json(result);
});

export default app;
