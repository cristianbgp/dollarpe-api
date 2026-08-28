import {
  afterEach,
  beforeEach,
  describe,
  expect,
  spyOn,
  test,
} from "bun:test";
import app from "./index";

const originalFetch = globalThis.fetch;
let consoleErrorSpy: ReturnType<typeof spyOn> | undefined;

const useFetch = (
  implementation: (...args: Parameters<typeof fetch>) => ReturnType<typeof fetch>
) => {
  globalThis.fetch = Object.assign(implementation, {
    preconnect: originalFetch.preconnect,
  });
};

const jsonResponse = (body: unknown, status = 200) =>
  Response.json(body, { status });

const rextieResponse = {
  fx_rate_buy: "3.33",
  fx_rate_sell: "3.36",
};

const kambistaResponse = {
  tc: {
    bid: 3.32,
    ask: 3.37,
  },
};

afterEach(() => {
  globalThis.fetch = originalFetch;
  consoleErrorSpy?.mockRestore();
  consoleErrorSpy = undefined;
});

beforeEach(() => {
  consoleErrorSpy = spyOn(console, "error").mockImplementation(() => {});
});

describe("GET /exchanges upstream isolation", () => {
  test("returns 503 when every provider fails", async () => {
    useFetch(async () => {
      throw new Error("Provider unavailable in test");
    });

    const response = await app.request("/exchanges");

    expect(response.status).toBe(503);
    expect(response.headers.get("Cache-Control")).toBeNull();
    expect(await response.json()).toEqual({
      error: "Exchange rates are temporarily unavailable",
    });
  });

  test("omits an upstream response with a failing HTTP status", async () => {
    useFetch(async (input) => {
      const url = String(input);

      if (url.includes("rextie")) {
        return jsonResponse(rextieResponse);
      }

      if (url.includes("kambista")) {
        return jsonResponse(kambistaResponse, 500);
      }

      throw new Error("Provider unavailable in test");
    });

    const response = await app.request("/exchanges");

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual([
      [
        "rextie",
        {
          buy: 3.33,
          sell: 3.36,
          pageUrl: "https://www.rextie.com/",
        },
      ],
    ]);
  });

  test("omits malformed rates without failing valid providers", async () => {
    useFetch(async (input) => {
      const url = String(input);

      if (url.includes("rextie")) {
        return jsonResponse(rextieResponse);
      }

      if (url.includes("kambista")) {
        return jsonResponse({ tc: {} });
      }

      throw new Error("Provider unavailable in test");
    });

    const response = await app.request("/exchanges");

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual([
      [
        "rextie",
        {
          buy: 3.33,
          sell: 3.36,
          pageUrl: "https://www.rextie.com/",
        },
      ],
    ]);
  });

  test(
    "omits a provider that exceeds the request timeout",
    async () => {
      useFetch(async (input, init) => {
        const url = String(input);

        if (url.includes("rextie")) {
          return jsonResponse(rextieResponse);
        }

        if (url.includes("kambista")) {
          return new Promise<Response>((_resolve, reject) => {
            init?.signal?.addEventListener(
              "abort",
              () => reject(init.signal?.reason),
              { once: true }
            );
          });
        }

        throw new Error("Provider unavailable in test");
      });

      const response = await app.request("/exchanges");

      expect(response.status).toBe(200);
      expect(await response.json()).toEqual([
        [
          "rextie",
          {
            buy: 3.33,
            sell: 3.36,
            pageUrl: "https://www.rextie.com/",
          },
        ],
      ]);
    },
    6_000
  );
});

describe("GET /exchanges sorting", () => {
  const useTwoValidProviders = () => {
    useFetch(async (input) => {
      const url = String(input);

      if (url.includes("rextie")) {
        return jsonResponse({
          fx_rate_buy: "3.33",
          fx_rate_sell: "3.38",
        });
      }

      if (url.includes("kambista")) {
        return jsonResponse(kambistaResponse);
      }

      throw new Error("Provider unavailable in test");
    });
  };

  test("sorts buy rates from highest to lowest", async () => {
    useTwoValidProviders();

    const response = await app.request("/exchanges?sort=buy");
    const result = (await response.json()) as Array<[string, unknown]>;

    expect(response.status).toBe(200);
    expect(result.map(([provider]) => provider)).toEqual([
      "rextie",
      "kambista",
    ]);
  });

  test("sorts sell rates from lowest to highest", async () => {
    useTwoValidProviders();

    const response = await app.request("/exchanges?sort=sell");
    const result = (await response.json()) as Array<[string, unknown]>;

    expect(response.status).toBe(200);
    expect(result.map(([provider]) => provider)).toEqual([
      "kambista",
      "rextie",
    ]);
  });
});
