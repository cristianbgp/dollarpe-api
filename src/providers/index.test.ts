import { afterEach, expect, test } from "bun:test";
import { providers } from "./index";

const originalFetch = globalThis.fetch;
const fixtures: Array<[string, unknown]> = [
  ["rextie", { fx_rate_buy: "3.31", fx_rate_sell: "3.41" }],
  ["kambista", { tc: { bid: 3.32, ask: 3.42 } }],
  ["tkambio", { buying_rate: "3.33", selling_rate: "3.43" }],
  ["operations.roblex", { amountBuy: 3.34, amountSale: 3.44 }],
  ["decamoney", { exchange_rate: { buy: 3.35, sell: 3.45 } }],
  ["tucambista", { bidRate: 3.36, offerRate: 3.46 }],
  ["chapacambios", [{ MontoCompra: "3.37", MontoVenta: "3.47" }]],
  ["cambiomundial", [{ buy: "3.38", sell: "3.48" }]],
  [
    "listarTipoCambio",
    [
      { fecPublica: "01/01/2000", valTipo: "3.39", codTipo: "C" },
      { fecPublica: "01/01/2000", valTipo: "3.49", codTipo: "V" },
    ],
  ],
];

const responseForUrl = (url: string) => {
  const fixture = fixtures.find(([urlFragment]) => url.includes(urlFragment));

  if (!fixture) {
    throw new Error(`Unexpected provider URL: ${url}`);
  }

  return Response.json(fixture[1]);
};

const useFetch = (
  implementation: (...args: Parameters<typeof fetch>) => ReturnType<typeof fetch>
) => {
  globalThis.fetch = Object.assign(implementation, {
    preconnect: originalFetch.preconnect,
  });
};

afterEach(() => {
  globalThis.fetch = originalFetch;
});

test("maps every provider response to a normalized exchange rate", async () => {
  useFetch(async (input) => {
    return responseForUrl(String(input));
  });

  const results = Object.fromEntries(
    await Promise.all(
      providers.map(async (provider) => [
        provider.name,
        await provider.fetchRate(),
      ])
    )
  );

  expect(results).toEqual({
    rextie: { buy: 3.31, sell: 3.41, pageUrl: "https://www.rextie.com/" },
    kambista: { buy: 3.32, sell: 3.42, pageUrl: "https://kambista.com/" },
    tkambio: { buy: 3.33, sell: 3.43, pageUrl: "https://tkambio.com/" },
    roblex: { buy: 3.34, sell: 3.44, pageUrl: "https://roblex.pe/" },
    decamoney: { buy: 3.35, sell: 3.45, pageUrl: "https://decamoney.com/" },
    tucambista: {
      buy: 3.36,
      sell: 3.46,
      pageUrl: "https://tucambista.pe/",
    },
    chapacambio: {
      buy: 3.37,
      sell: 3.47,
      pageUrl: "https://chapacambio.com/",
    },
    cambiomundial: {
      buy: 3.38,
      sell: 3.48,
      pageUrl: "https://www.cambiomundial.com",
    },
    sunat: {
      buy: 3.39,
      sell: 3.49,
      pageUrl: "https://e-consulta.sunat.gob.pe/cl-at-ittipcam/tcS01Alias",
    },
  });
});

test("uses each provider's required HTTP contract", async () => {
  const requests: Array<{ url: string; init?: RequestInit }> = [];

  useFetch(async (input, init) => {
    const url = String(input);
    requests.push({ url, init });
    return responseForUrl(url);
  });

  for (const provider of providers) {
    await provider.fetchRate();
  }

  expect(
    requests.map(({ url, init }) => {
      const headers = new Headers(init?.headers);

      return {
        url,
        method: init?.method ?? "GET",
        body: init?.body ?? null,
        contentType: headers.get("Content-Type"),
        subscriptionKey: headers.get("Ocp-Apim-Subscription-Key"),
      };
    })
  ).toEqual([
    {
      url: "https://app.rextie.com/api/v1/fxrates/rate/",
      method: "POST",
      body: null,
      contentType: null,
      subscriptionKey: null,
    },
    {
      url: "https://api.kambista.com/v1/exchange/calculates?originCurrency=USD&destinationCurrency=PEN&active=S&amount=1",
      method: "GET",
      body: null,
      contentType: null,
      subscriptionKey: null,
    },
    {
      url: "https://tkambio.com/wp-admin/admin-ajax.php",
      method: "POST",
      body: "action=get_exchange_rate",
      contentType: "application/x-www-form-urlencoded; charset=UTF-8",
      subscriptionKey: null,
    },
    {
      url: "https://operations.roblex.pe/valuation/active-valuation",
      method: "GET",
      body: null,
      contentType: null,
      subscriptionKey: null,
    },
    {
      url: "https://api.decamoney.com/v1/rates",
      method: "GET",
      body: null,
      contentType: null,
      subscriptionKey: null,
    },
    {
      url: "https://apim.tucambista.pe/api/rates",
      method: "GET",
      body: null,
      contentType: null,
      subscriptionKey:
        "e4b6947d96a940e7bb8b39f462bcc56d;product=tucambista-production",
    },
    {
      url: "https://chapacambioscontingencia.blob.core.windows.net/config/tc.json",
      method: "GET",
      body: null,
      contentType: null,
      subscriptionKey: null,
    },
    {
      url: "https://www.cambiomundial.com/backend/tasaCambio/daily",
      method: "GET",
      body: null,
      contentType: null,
      subscriptionKey: null,
    },
    {
      url: "https://e-consulta.sunat.gob.pe/cl-at-ittipcam/tcS01Alias/listarTipoCambio",
      method: "POST",
      body: expect.stringContaining('"token":"x"'),
      contentType: "application/json; charset=utf-8",
      subscriptionKey: null,
    },
  ]);
});
