import type {
  DataResult,
  ExchangeProvider,
  ProviderDefinition,
} from "./types";

const UPSTREAM_TIMEOUT_MS = 5_000;

export class ProviderRequestError extends Error {
  constructor(message: string, readonly status?: number) {
    super(message);
    this.name = "ProviderRequestError";
  }
}

export function defineProvider<TResponse>({
  name,
  url,
  pageUrl,
  request,
  parse,
}: ProviderDefinition<TResponse>): ExchangeProvider {
  return {
    name,
    async fetchRate(): Promise<DataResult> {
      const response = await fetch(url, {
        ...request,
        signal: AbortSignal.timeout(UPSTREAM_TIMEOUT_MS),
      });

      if (!response.ok) {
        throw new ProviderRequestError(
          `${name} request failed with status ${response.status}`,
          response.status
        );
      }

      const rawRate = parse((await response.json()) as TResponse);
      const buy = Number(rawRate.buy);
      const sell = Number(rawRate.sell);

      if (
        !Number.isFinite(buy) ||
        buy <= 0 ||
        !Number.isFinite(sell) ||
        sell <= 0
      ) {
        throw new ProviderRequestError(
          `${name} returned invalid exchange rates`
        );
      }

      return { buy, sell, pageUrl };
    },
  };
}
