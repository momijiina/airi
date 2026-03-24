import { tool } from '@xsai/tool'
import { z } from 'zod'

const BRIDGE_SERVER_URL = 'http://localhost:3001'

// NOTICE: 65s was far too long — the LLM tool loop blocks waiting for tool execution,
// so a slow/dead bridge server would freeze the entire chat turn.
const SEARCH_TIMEOUT_MS = 20_000
const NAVIGATE_TIMEOUT_MS = 25_000

/**
 * Normalize a URL that the LLM may have garbled.
 * Common issues:
 * - Percent-encoded characters in the domain (e.g., `%20` → space → remove)
 * - Broken punycode (`xn--` prefix with encoded spaces)
 * - Double-encoded characters (`%2520` → `%20` → space)
 */
function normalizeUrl(rawUrl: string): string {
  let url = rawUrl.trim()

  // Fix double-encoding: %25XX → %XX
  url = url.replace(/%25([0-9A-F]{2})/gi, '%$1')

  // Decode percent-encoded characters in the URL so we can inspect it
  try {
    const parsed = new URL(url)
    // Decode hostname: percent-encoded domains are invalid
    // e.g., "wikiwiki.xn--jp%20%20aogiri..." → likely "wikiwiki.jp"
    if (parsed.hostname.includes('%')) {
      parsed.hostname = decodeURIComponent(parsed.hostname).replace(/\s+/g, '')
    }
    // Strip spaces from hostname (LLM sometimes injects them)
    parsed.hostname = parsed.hostname.replace(/\s+/g, '')

    return parsed.toString()
  }
  catch {
    // If URL parsing fails, try basic cleanup
    return url.replace(/\s+/g, '')
  }
}

/**
 * browser-bridge サーバーにリクエストを送信するヘルパー
 */
async function bridgeRequest(path: string, body: Record<string, unknown>, timeoutMs?: number): Promise<unknown> {
  const timeout = timeoutMs ?? SEARCH_TIMEOUT_MS
  const res = await fetch(`${BRIDGE_SERVER_URL}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(timeout),
  })

  if (!res.ok) {
    const text = await res.text().catch(() => '')
    throw new Error(`Bridge server error ${res.status}: ${text.slice(0, 200)}`)
  }

  return res.json()
}

const tools = [
  tool({
    name: 'web_search',
    description: 'Search the web using a browser. Returns a list of search result links. IMPORTANT: After getting search results, you MUST use web_browse to visit at least 1-3 of the top result URLs to read their actual content before answering. The search results page alone does not contain enough detail. Always search in Japanese (日本語) unless the user explicitly asks for another language.',
    execute: async ({ query, engine }) => {
      try {
        const result = await bridgeRequest('/api/search', { query, engine }) as Record<string, unknown>
        if (result.error) {
          return `Search failed: ${result.error}`
        }
        // 検索結果をLLMが読みやすい形式にフォーマット
        let output = `## Search results for: ${query}\n\n`
        if (result.title)
          output += `Page: ${result.title}\n`
        if (result.url)
          output += `URL: ${result.url}\n\n`
        if (Array.isArray(result.searchLinks) && (result.searchLinks as Array<{ title: string, url: string }>).length > 0) {
          output += `### Top results:\n`
          for (const link of result.searchLinks as Array<{ title: string, url: string }>) {
            output += `- ${link.title}: ${link.url}\n`
          }
          output += '\n'
        }
        if (result.text)
          output += `### Page content:\n${(result.text as string).slice(0, 3000)}\n`

        output += '\n---\nIMPORTANT: You MUST now use web_browse to visit at least 1-3 of the URLs listed above to read their full content. The search results page only shows titles and snippets — you need the actual page content to give a good answer. Do NOT answer based on search results alone.'
        return output
      }
      catch (error) {
        const message = error instanceof Error ? error.message : String(error)
        if (message.includes('timeout') || message.includes('Failed to fetch')) {
          return 'Web search is unavailable. The browser bridge server may not be running. Please start it with: node browser-bridge/server.mjs'
        }
        return `Web search error: ${message}`
      }
    },
    parameters: z.object({
      query: z.string().describe('The search query to look up on the web'),
      engine: z.enum(['google', 'bing', 'duckduckgo']).optional().default('google').describe('Search engine to use (default: google)'),
    }),
  }),
  tool({
    name: 'web_browse',
    description: 'Navigate to a specific URL and extract its full text content. You SHOULD use this after web_search to read the actual pages from search results. Also use to visit any known URL. Call this multiple times to read several pages for thorough research.',
    execute: async ({ url: rawUrl }) => {
      const url = normalizeUrl(rawUrl)
      try {
        const result = await bridgeRequest('/api/navigate', { url }, NAVIGATE_TIMEOUT_MS) as Record<string, unknown>
        if (result.error) {
          return `Browse failed: ${result.error}`
        }
        let output = ''
        if (result.title)
          output += `Page: ${result.title}\n`
        if (result.url)
          output += `URL: ${result.url}\n\n`
        if (result.text)
          output += `${(result.text as string).slice(0, 4000)}\n`

        const pageContent = output || 'No content extracted from page.'
        return `${pageContent}\n---\nYou have read this page. If you now have enough information to answer the user's question, summarize and respond in the same language the user used. Otherwise, browse additional URLs or search again with different terms.`
      }
      catch (error) {
        const message = error instanceof Error ? error.message : String(error)
        if (message.includes('timeout') || message.includes('Failed to fetch')) {
          return 'Web browsing is unavailable. The browser bridge server may not be running.'
        }
        return `Web browse error: ${message}`
      }
    },
    parameters: z.object({
      url: z.string().describe('The URL to navigate to and extract content from'),
    }),
  }),
]

export async function webSearch() {
  return Promise.all(tools)
}
