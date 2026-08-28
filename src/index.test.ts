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

test("GET / lists endpoints with and without query parameters", async () => {
  const response = await app.request("/");
  const body = await response.text();

  expect(response.status).toBe(200);
  expect(body).toContain("GET /exchanges\n");
  expect(body).toContain("GET /exchanges?sort=buy|sell");
  expect(body).toContain("GET /official-rate\n");
  expect(body).toContain("GET /official-rate?date=YYYY-MM-DD");
  expect(body).toContain("GET /openapi.json");
  expect(body).toContain("GET /docs");
});

describe("OpenAPI documentation", () => {
  test("describes every public API route and query parameter", async () => {
    const response = await app.request("/openapi.json");

    expect(response.status).toBe(200);
    const document = (await response.json()) as {
      openapi: string;
      paths: Record<
        string,
        {
          get?: {
            parameters?: Array<{
              name: string;
              in: string;
              required: boolean;
              schema: Record<string, unknown>;
            }>;
            responses: Record<string, unknown>;
          };
        }
      >;
    };

    expect(document.openapi).toBe("3.1.0");
    expect(Object.keys(document.paths).sort()).toEqual([
      "/exchanges",
      "/official-rate",
    ]);

    const exchanges = document.paths["/exchanges"].get!;
    expect(
      exchanges.parameters?.find((parameter) => parameter.name === "sort")
    ).toMatchObject({
      name: "sort",
      in: "query",
      required: false,
      schema: { type: "string", enum: ["buy", "sell"] },
    });
    expect(Object.keys(exchanges.responses).sort()).toEqual([
      "200",
      "400",
      "503",
    ]);

    const officialRate = document.paths["/official-rate"].get!;
    expect(
      officialRate.parameters?.find((parameter) => parameter.name === "date")
    ).toMatchObject({
      name: "date",
      in: "query",
      required: false,
      schema: { type: "string", format: "date" },
    });
    expect(Object.keys(officialRate.responses).sort()).toEqual([
      "200",
      "400",
      "503",
    ]);
  });

  test("serves an interactive Swagger UI", async () => {
    const response = await app.request("/docs");
    const body = await response.text();

    expect(response.status).toBe(200);
    expect(response.headers.get("Content-Type")).toContain("text/html");
    expect(body.toLowerCase()).toContain("swagger");
    expect(body).toContain("/openapi.json");
  });
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

describe("GET /official-rate", () => {
  test("returns the official SUNAT exchange rate", async () => {
    useFetch(async () =>
      jsonResponse([
        { fecPublica: "01/01/2000", valTipo: "3.340", codTipo: "C" },
        { fecPublica: "01/01/2000", valTipo: "3.348", codTipo: "V" },
      ])
    );

    const response = await app.request("/official-rate");

    expect(response.status).toBe(200);
    expect(response.headers.get("Cache-Control")).toBe(
      "public, s-maxage=3600, stale-while-revalidate=86400"
    );
    expect(await response.json()).toEqual({
      source: "sunat",
      date: expect.stringMatching(/^\d{4}-\d{2}-\d{2}$/),
      buy: 3.34,
      sell: 3.348,
      pageUrl: "https://e-consulta.sunat.gob.pe/cl-at-ittipcam/tcS01Alias",
    });
  });

  test("queries the SUNAT month for the requested date", async () => {
    let requestBody: unknown;
    useFetch(async (_input, init) => {
      requestBody = JSON.parse(String(init?.body));
      return jsonResponse([
        { fecPublica: "14/11/2025", valTipo: "3.360", codTipo: "C" },
        { fecPublica: "14/11/2025", valTipo: "3.370", codTipo: "V" },
        { fecPublica: "17/11/2025", valTipo: "3.365", codTipo: "C" },
        { fecPublica: "17/11/2025", valTipo: "3.374", codTipo: "V" },
        { fecPublica: "20/11/2025", valTipo: "3.400", codTipo: "C" },
        { fecPublica: "20/11/2025", valTipo: "3.410", codTipo: "V" },
      ]);
    });

    const response = await app.request("/official-rate?date=2025-11-17");

    expect(response.status).toBe(200);
    expect(requestBody).toEqual({ anio: 2025, mes: 10, token: "x" });
    expect(await response.json()).toEqual({
      source: "sunat",
      date: "2025-11-17",
      buy: 3.365,
      sell: 3.374,
      pageUrl: "https://e-consulta.sunat.gob.pe/cl-at-ittipcam/tcS01Alias",
    });
  });

  test("rejects an impossible calendar date", async () => {
    useFetch(async () => {
      throw new Error("fetch must not be called for an invalid date");
    });

    const response = await app.request("/official-rate?date=2025-02-30");

    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({ error: "Invalid date" });
  });

  test("rejects a future date", async () => {
    useFetch(async () => {
      throw new Error("fetch must not be called for a future date");
    });

    const response = await app.request("/official-rate?date=2999-01-01");

    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({ error: "Invalid date" });
  });

  test("returns 503 when SUNAT is unavailable", async () => {
    useFetch(async () => {
      throw new Error("SUNAT unavailable in test");
    });

    const response = await app.request("/official-rate");

    expect(response.status).toBe(503);
    expect(response.headers.get("Cache-Control")).toBeNull();
    expect(await response.json()).toEqual({
      error: "Official exchange rate is temporarily unavailable",
    });
  });
});
