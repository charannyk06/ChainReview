// Web Search tool using Brave Search API
// Requires BRAVE_SEARCH_API_KEY environment variable

interface SearchResult {
  title: string;
  url: string;
  snippet: string;
}

export async function webSearch(args: {
  query: string;
  maxResults?: number;
}): Promise<{ results: SearchResult[]; query: string; warning?: string }> {
  const { query, maxResults = 5 } = args;

  const apiKey = process.env.BRAVE_SEARCH_API_KEY;
  if (!apiKey) {
    return {
      results: [],
      query,
      warning:
        "Web search unavailable: BRAVE_SEARCH_API_KEY not set. Get a free key at https://api.search.brave.com/",
    };
  }

  try {
    const url = new URL("https://api.search.brave.com/res/v1/web/search");
    url.searchParams.set("q", query);
    url.searchParams.set("count", String(Math.min(maxResults, 10)));

    const response = await fetch(url.toString(), {
      headers: {
        Accept: "application/json",
        "Accept-Encoding": "gzip",
        "X-Subscription-Token": apiKey,
      },
    });

    if (!response.ok) {
      return {
        results: [],
        query,
        warning: `Brave Search API error: ${response.status} ${response.statusText}`,
      };
    }

    const data = await response.json() as any;
    const webResults = data.web?.results || [];

    const results: SearchResult[] = webResults
      .slice(0, maxResults)
      .map((r: any) => ({
        title: r.title || "",
        url: r.url || "",
        snippet: r.description || "",
      }));

    return { results, query };
  } catch (err: any) {
    return {
      results: [],
      query,
      warning: `Web search failed: ${err.message}`,
    };
  }
}
