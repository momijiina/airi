/**
 * Airi Browser Bridge Server
 *
 * browser-bridge Chrome拡張機能とAIRIフロントエンドの間を仲介するHTTPサーバー。
 *
 * フロー:
 *   1. AIRI の web_search ツールが POST /api/search を呼ぶ
 *   2. サーバーがコマンドをキューに入れる
 *   3. browser-bridge 拡張が GET /api/ext-bridge/poll でコマンドを取得
 *   4. 拡張がブラウザで検索を実行し、POST /api/ext-bridge/result で結果を返す
 *   5. サーバーが結果をAIRIに返す
 *
 * 起動: node browser-bridge/server.mjs
 */

import { createServer } from 'node:http'

const PORT = Number(process.env.AIRI_BRIDGE_PORT) || 3001
const CORS_ORIGIN = process.env.AIRI_CORS_ORIGIN || '*'

// コマンドキューと結果マップ
let pendingCommand = null
const resultWaiters = new Map() // id -> { resolve, timer }
let commandIdCounter = 0

function jsonResponse(res, data, status = 200) {
  res.writeHead(status, {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': CORS_ORIGIN,
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  })
  res.end(JSON.stringify(data))
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = []
    req.on('data', c => chunks.push(c))
    req.on('end', () => {
      try {
        resolve(JSON.parse(Buffer.concat(chunks).toString()))
      }
      catch {
        reject(new Error('Invalid JSON'))
      }
    })
    req.on('error', reject)
  })
}

const server = createServer(async (req, res) => {
  // CORS preflight
  if (req.method === 'OPTIONS') {
    res.writeHead(204, {
      'Access-Control-Allow-Origin': CORS_ORIGIN,
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    })
    res.end()
    return
  }

  const url = new URL(req.url, `http://localhost:${PORT}`)
  const path = url.pathname

  // =============================================
  // AIRI フロントエンド → サーバー
  // =============================================

  // Web検索リクエスト
  if (path === '/api/search' && req.method === 'POST') {
    try {
      const body = await readBody(req)
      const query = body.query
      const engine = body.engine || 'bing'
      if (!query) {
        jsonResponse(res, { error: 'query is required' }, 400)
        return
      }

      const id = ++commandIdCounter
      const cmd = { id, type: 'search', query, searchEngine: engine }

      // コマンドをキューに入れて結果を待つ
      const resultPromise = new Promise((resolve, reject) => {
        const timer = setTimeout(() => {
          resultWaiters.delete(id)
          reject(new Error('timeout'))
        }, 60000) // 60秒タイムアウト
        resultWaiters.set(id, { resolve, timer })
      })

      pendingCommand = cmd
      console.log(`[search] query="${query}" engine=${engine} id=${id}`)

      const result = await resultPromise
      jsonResponse(res, result)
    }
    catch (e) {
      jsonResponse(res, { error: e.message }, e.message === 'timeout' ? 504 : 500)
    }
    return
  }

  // ページ取得リクエスト
  if (path === '/api/navigate' && req.method === 'POST') {
    try {
      const body = await readBody(req)
      const targetUrl = body.url
      if (!targetUrl) {
        jsonResponse(res, { error: 'url is required' }, 400)
        return
      }

      const id = ++commandIdCounter
      const cmd = { id, type: 'navigate', url: targetUrl }

      const resultPromise = new Promise((resolve, reject) => {
        const timer = setTimeout(() => {
          resultWaiters.delete(id)
          reject(new Error('timeout'))
        }, 60000)
        resultWaiters.set(id, { resolve, timer })
      })

      pendingCommand = cmd
      console.log(`[navigate] url="${targetUrl}" id=${id}`)

      const result = await resultPromise
      jsonResponse(res, result)
    }
    catch (e) {
      jsonResponse(res, { error: e.message }, e.message === 'timeout' ? 504 : 500)
    }
    return
  }

  // =============================================
  // browser-bridge 拡張 → サーバー
  // =============================================

  // ロングポーリング: 拡張がコマンドを取得
  if (path === '/api/ext-bridge/poll' && req.method === 'GET') {
    if (pendingCommand) {
      const cmd = pendingCommand
      pendingCommand = null
      jsonResponse(res, cmd)
    }
    else {
      // コマンドなし → 25秒待機してnoop
      const timer = setTimeout(() => {
        jsonResponse(res, { type: 'noop' })
      }, 25000)

      // 新しいコマンドが来たら即座に返す
      const checkInterval = setInterval(() => {
        if (pendingCommand) {
          clearTimeout(timer)
          clearInterval(checkInterval)
          const cmd = pendingCommand
          pendingCommand = null
          jsonResponse(res, cmd)
        }
      }, 100)

      // クライアント切断時のクリーンアップ
      req.on('close', () => {
        clearTimeout(timer)
        clearInterval(checkInterval)
      })
    }
    return
  }

  // 拡張が結果を返す
  if (path === '/api/ext-bridge/result' && req.method === 'POST') {
    try {
      const body = await readBody(req)
      const id = body.id
      const waiter = resultWaiters.get(id)
      if (waiter) {
        clearTimeout(waiter.timer)
        resultWaiters.delete(id)
        waiter.resolve(body)
      }
      jsonResponse(res, { ok: true })
    }
    catch (e) {
      jsonResponse(res, { error: e.message }, 500)
    }
    return
  }

  // ステータスエンドポイント
  if (path === '/api/ext-bridge/status' && req.method === 'GET') {
    jsonResponse(res, {
      status: 'ok',
      name: 'Airi Browser Bridge Server',
      pending: !!pendingCommand,
      waiters: resultWaiters.size,
    })
    return
  }

  // 404
  jsonResponse(res, { error: 'Not Found' }, 404)
})

server.listen(PORT, () => {
  console.log(`Airi Browser Bridge Server listening on http://localhost:${PORT}`)
  console.log(`  POST /api/search        - Web検索リクエスト`)
  console.log(`  POST /api/navigate      - ページ取得リクエスト`)
  console.log(`  GET  /api/ext-bridge/poll   - 拡張ポーリング`)
  console.log(`  POST /api/ext-bridge/result - 拡張結果返却`)
  console.log(`  GET  /api/ext-bridge/status - ステータス確認`)
})
