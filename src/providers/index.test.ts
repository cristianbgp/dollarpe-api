import { afterEach, expect, test } from "bun:test";
import { providers } from "./index";

const originalFetch = globalThis.fetch;

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
  const fixtures: Array<[string, unknown]> = [
    ["rextie", { fx_rate_buy: "3.31", fx_rate_sell: "3.41" }],
    ["kambista", { tc: { bid: 3.32, ask: 3.42 } }],
    ["tkambio", { buying_rate: "3.33", selling_rate: "3.43" }],
    ["operations.roblex", { amountBuy: 3.34, amountSale: 3.44 }],
    ["decamoney", { exchange_rate: { buy: 3.35, sell: 3.45 } }],
    ["tucambista", { bidRate: 3.36, offerRate: 3.46 }],
    [
      "chapacambios",
      [{ MontoCompra: "3.37", MontoVenta: "3.47" }],
    ],
    ["cambiomundial", [{ buy: "3.38", sell: "3.48" }]],
  ];

  useFetch(async (input) => {
    const url = String(input);
    const fixture = fixtures.find(([urlFragment]) => url.includes(urlFragment));

    if (!fixture) {
      throw new Error(`Unexpected provider URL: ${url}`);
    }

    return Response.json(fixture[1]);
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
  });
});
