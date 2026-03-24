import { tool } from '@xsai/tool'
import { z } from 'zod'

const BRIDGE_SERVER_URL = 'http://localhost:3001'

// NOTICE: 65s was far too long — the LLM tool loop blocks waiting for tool execution,
// so a slow/dead bridge server would freeze the entire chat turn.
const SEARCH_TIMEOUT_MS = 20_000
const NAVIGATE_TIMEOUT_MS = 25_000

// NOTICE: LLMs often garble long/non-ASCII URLs when reproducing them in tool calls
// (e.g., encoding the domain+path into a bogus punycode hostname). This cache stores
// original URLs from search results so the LLM can reference them by number (e.g., "1"
// or "[1]") instead of trying to reproduce the full URL.
const searchResultUrlCache = new Map<number, string>()
let nextUrlRef = 1

// Known TLDs used to detect garbled punycode hostnames
const KNOWN_TLDS = ['org', 'com', 'net', 'jp', 'io', 'dev', 'co', 'info', 'edu', 'gov', 'uk', 'de', 'fr', 'ru', 'cn', 'kr']

/**
 * Normalize a URL that the LLM may have garbled.
 * Handles:
 * - Reference numbers from search results (e.g., "[1]" → cached URL)
 * - Percent-encoded characters in the domain
 * - Bogus punycode hostnames (LLM merged domain+path into one label)
 * - Double-encoded characters (`%2520` → `%20` → space)
 */
function normalizeUrl(rawUrl: unknown): string | null {
  // NOTICE: LLMs sometimes pass a number (e.g., 1) instead of a string ("1")
  // when using the reference system. Coerce to string to avoid .trim() crash.
  let url = String(rawUrl ?? '').trim()

  // Check if it's a reference to a cached search result URL (e.g., "[1]", "1")
  const refMatch = url.match(/^\[?(\d+)\]?$/)
  if (refMatch) {
    const cached = searchResultUrlCache.get(Number(refMatch[1]))
    if (cached)
      return cached
    // NOTICE: If the number doesn't match any cached URL, return null instead
    // of passing a bare number like "1" to the browser — that would resolve
    // to chrome-extension://…/1 in the extension context.
    return null
  }

  // Fix double-encoding: %25XX → %XX
  url = url.replace(/%25([0-9A-F]{2})/gi, '%$1')

  try {
    const parsed = new URL(url)

    // Decode hostname: percent-encoded domains are invalid
    // e.g., "wikiwiki.xn--jp%20%20aogiri..." → likely "wikiwiki.jp"
    if (parsed.hostname.includes('%')) {
      parsed.hostname = decodeURIComponent(parsed.hostname).replace(/\s+/g, '')
    }

    // Strip spaces from hostname (LLM sometimes injects them)
    parsed.hostname = parsed.hostname.replace(/\s+/g, '')

    // NOTICE: Detect bogus punycode hostnames where the LLM merged domain + path
    // into a single hostname label.
    // e.g., "ja.wikipedia.xn--orgwiki-..." → "ja.wikipedia.org/wiki/..."
    // Punycode format: xn--<asciiChars>-<encodedNonAscii>
    // When the ASCII portion starts with a known TLD, the LLM likely concatenated
    // the TLD + path. We reconstruct the hostname with just the TLD and recover
    // what path info we can from the remaining ASCII characters.
    const labels = parsed.hostname.split('.')
    const lastLabel = labels[labels.length - 1]
    if (lastLabel.startsWith('xn--') && labels.length >= 2) {
      const withoutPrefix = lastLabel.slice(4) // remove "xn--"
      const lastHyphenIdx = withoutPrefix.lastIndexOf('-')
      if (lastHyphenIdx > 0) {
        const asciiPart = withoutPrefix.slice(0, lastHyphenIdx).toLowerCase()
        for (const tld of KNOWN_TLDS) {
          if (asciiPart.startsWith(tld) && asciiPart.length > tld.length) {
            const remainingAscii = asciiPart.slice(tld.length)
            parsed.hostname = [...labels.slice(0, -1), tld].join('.')
            // Recover partial path from remaining ASCII chars (non-ASCII is lost)
            if (remainingAscii && parsed.pathname === '/') {
              parsed.pathname = `/${remainingAscii}`
            }
            break
          }
        }
      }
    }

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
    description: 'Search the web using a browser. Returns numbered search result links. IMPORTANT: After getting search results, you MUST use web_browse with the result number (e.g., "1") to visit at least 1-3 pages. Always use the number reference instead of copying the URL. Always search in Japanese (日本語) unless the user explicitly asks for another language.',
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
            const ref = nextUrlRef++
            searchResultUrlCache.set(ref, link.url)
            output += `- [${ref}] ${link.title}: ${link.url}\n`
          }
          output += '\n'
        }
        if (result.text)
          output += `### Page content:\n${(result.text as string).slice(0, 3000)}\n`

        output += '\n---\nIMPORTANT: You MUST now use web_browse to visit at least 1-3 of the results above. Use the reference NUMBER (e.g., url: "1") instead of copying the URL — this avoids URL encoding errors. Do NOT answer based on search results alone.'
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
    description: 'Navigate to a URL and extract its text content. PREFERRED: Pass the reference number from web_search results (e.g., url: "1") to avoid URL encoding errors. Also accepts a full URL. Call this multiple times to read several pages for thorough research.',
    execute: async ({ url: rawUrl }) => {
      const url = normalizeUrl(rawUrl)
      if (!url) {
        const available = [...searchResultUrlCache.entries()].map(([k, v]) => `[${k}] ${v}`).join('\n')
        return `Invalid URL reference: "${rawUrl}". ${available ? `Available references:\n${available}` : 'No cached search results. Run web_search first, then use the result number.'}`
      }
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
      url: z.string().describe('A reference number from search results (e.g., "1" or "[1]") or a full URL to navigate to'),
    }),
  }),
]

export async function webSearch() {
  return Promise.all(tools)
}
