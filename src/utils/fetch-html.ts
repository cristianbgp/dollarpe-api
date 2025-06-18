import { DataResult } from "../index";

export async function fetchHTMLAndExtract({
  url,
  querySelectorToBuy,
  querySelectorToSell,
  pageUrl,
}: {
  url: string;
  querySelectorToBuy: string;
  querySelectorToSell: string;
  pageUrl: string;
}): Promise<DataResult> {
  const response = await fetch(url, {
    headers: {
      "User-Agent":
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36",
      Accept:
        "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8",
      "Accept-Language": "en-US,en;q=0.5",
    },
  });

  if (!response.ok) {
    console.error(
      `Failed to fetch HTML: ${response.status} ${response.statusText}`
    );
    return {
      buy: 0,
      sell: 0,
      pageUrl,
    };
  }

  let buyValue: number | null = null;
  let sellValue: number | null = null;

  const rewriter = new HTMLRewriter();

  rewriter.on(querySelectorToBuy, {
    element(element) {
      buyValue = Number(element.getAttribute("value"));
    },
  });

  rewriter.on(querySelectorToSell, {
    element(element) {
      sellValue = Number(element.getAttribute("value"));
    },
  });

  console.log("Starting HTMLRewriter transform");
  await rewriter.transform(response).arrayBuffer();

  return {
    buy: buyValue ?? 0,
    sell: sellValue ?? 0,
    pageUrl,
  };
}
