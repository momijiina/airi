import { tool } from '@xsai/tool'
import { z } from 'zod'

const BRIDGE_SERVER_URL = 'http://localhost:3001'

/**
 * browser-bridge サーバーにリクエストを送信するヘルパー
 */
async function bridgeRequest(path: string, body: Record<string, unknown>): Promise<unknown> {
  const res = await fetch(`${BRIDGE_SERVER_URL}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(65000),
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
    description: 'Search the web using a browser. Use this when you need to look up current information, find facts, or research topics you are unsure about. Returns search results with titles, URLs, and page text.',
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
      engine: z.enum(['bing', 'google', 'duckduckgo']).optional().default('bing').describe('Search engine to use (default: bing)'),
    }),
  }),
  tool({
    name: 'web_browse',
    description: 'Navigate to a specific URL and extract its content. Use this to read a webpage after finding it via web_search, or to visit a known URL.',
    execute: async ({ url }) => {
      try {
        const result = await bridgeRequest('/api/navigate', { url }) as Record<string, unknown>
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

        return output || 'No content extracted from page.'
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
      url: z.string().url().describe('The URL to navigate to and extract content from'),
    }),
  }),
]

export async function webSearch() {
  return Promise.all(tools)
}
