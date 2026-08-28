import { defineProvider } from "./fetch-provider";

type KambistaResponse = {
  tc: {
    bid: number;
    ask: number;
  };
};

export const kambistaProvider = defineProvider<KambistaResponse>({
  name: "kambista",
  url: "https://api.kambista.com/v1/exchange/calculates?originCurrency=USD&destinationCurrency=PEN&active=S&amount=1",
  pageUrl: "https://kambista.com/",
  parse: (response) => ({
    buy: response.tc.bid,
    sell: response.tc.ask,
  }),
});
