import { parseHTML } from "linkedom";
import { DataResult } from "../index";

export async function fetchHTMLAndExtract({
  url,
  accessorToBuy,
  accessorToSell,
  pageUrl,
}: {
  url: string;
  accessorToBuy: (data: Document) => number;
  accessorToSell: (data: Document) => number;
  pageUrl: string;
}): Promise<DataResult> {
  const response = await fetch(url);
  const html = await response.text();

  const { document } = parseHTML(html);

  return {
    buy: accessorToBuy(document),
    sell: accessorToSell(document),
    pageUrl,
  };
}
