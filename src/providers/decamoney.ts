import { defineProvider } from "./fetch-provider";

type DecamoneyResponse = {
  exchange_rate: {
    buy: number;
    sell: number;
  };
};

export const decamoneyProvider = defineProvider<DecamoneyResponse>({
  name: "decamoney",
  url: "https://api.decamoney.com/v1/rates",
  pageUrl: "https://decamoney.com/",
  parse: (response) => ({
    buy: response.exchange_rate.buy,
    sell: response.exchange_rate.sell,
  }),
});
