import { providers } from "./providers";
import type { DataResult, ProviderName } from "./providers";
import sortCriteriaGenerator from "./utils/sort-criteria-generator";

export type ExchangeSort = "buy" | "sell";
export type DataEntry = [ProviderName, DataResult];

const buyCriteriaDesc = sortCriteriaGenerator<DataEntry>(
  ([, item]) => item.buy,
  { desc: true }
);
const sellCriteriaDesc = sortCriteriaGenerator<DataEntry>(
  ([, item]) => item.sell,
  { asc: true }
);

export async function getAllData(
  sort: ExchangeSort = "buy"
): Promise<DataEntry[]> {
  const settledRates = await Promise.allSettled(
    providers.map((provider) => provider.fetchRate())
  );

  const rates = settledRates.flatMap((result, index): DataEntry[] => {
    if (result.status === "rejected") {
      return [];
    }

    return [[providers[index].name, result.value]];
  });

  const sortCriteria = sort === "buy" ? buyCriteriaDesc : sellCriteriaDesc;
  return rates.sort(sortCriteria);
}
