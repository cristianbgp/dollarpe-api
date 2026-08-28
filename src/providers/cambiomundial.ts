import { defineProvider } from "./fetch-provider";

type CambioMundialResponse = [
  {
    buy: string | number;
    sell: string | number;
  },
];

export const cambiomundialProvider = defineProvider<CambioMundialResponse>({
  name: "cambiomundial",
  url: "https://www.cambiomundial.com/backend/tasaCambio/daily",
  pageUrl: "https://www.cambiomundial.com",
  parse: ([response]) => ({
    buy: Number(response.buy),
    sell: Number(response.sell),
  }),
});
