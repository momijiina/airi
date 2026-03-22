/**
 * Airi Browser Bridge — Service Worker
 * AiriサーバーとHTTPロングポーリングで通信し、
 * ブラウザのタブを自動操作してウェブリサーチを実行する
 */

const DEFAULT_SERVER = 'http://localhost:3001'

async function getSettings() {
  const s = await chrome.storage.local.get({ serverUrl: DEFAULT_SERVER, enabled: true })
  return s
}

function sleep(ms) { return new Promise(r => setTimeout(r, ms)) }

// =============================================
// Polling Loop
// =============================================

let polling = false

async function pollOnce() {
  if (!polling)
    return
  const { serverUrl, enabled } = await getSettings()
  if (!enabled) { setTimeout(pollOnce, 5000); return }

  try {
    const res = await fetch(`${serverUrl}/api/ext-bridge/poll`, {
      signal: AbortSignal.timeout(30000),
    })
    const cmd = await res.json()

    if (cmd && cmd.type && cmd.type !== 'noop') {
      // コマンドを受信 → 実行
      notifyPopup('activity', `コマンド受信: ${cmd.type}`)
      let result
      try {
        result = await executeCommand(cmd, serverUrl)
      }
      catch (e) {
        result = { error: e.message }
      }
      // 結果を送信
      await fetch(`${serverUrl}/api/ext-bridge/result`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: cmd.id, ...result }),
      }).catch(() => {})
      notifyPopup('done', `完了: ${cmd.type}`)
    }
  }
  catch (e) {
    // サーバー接続失敗 → 少し待ってリトライ
    notifyPopup('error', `接続エラー: ${e.message}`)
    await sleep(5000)
  }

  // 次のポーリングをスケジュール
  setTimeout(pollOnce, 200)
}

function startPolling() {
  if (polling)
    return
  polling = true
  notifyPopup('status', '接続中...')
  pollOnce()
}

function stopPolling() {
  polling = false
  notifyPopup('status', '停止中')
}

// サービスワーカー起動時にポーリング開始
startPolling()

// Alarmで定期的にポーリング生存確認
chrome.alarms.create('keep-polling', { periodInMinutes: 0.4 })
chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === 'keep-polling') {
    startPolling()
  }
})

// =============================================
// Command Execution
// =============================================

async function executeCommand(cmd) {
  if (cmd.type === 'search') {
    return await handleSearch(cmd.query, cmd.searchEngine)
  }
  else if (cmd.type === 'navigate') {
    return await handleNavigate(cmd.url)
  }
  return { error: `不明なコマンド: ${cmd.type}` }
}

async function handleSearch(query, engine) {
  let url
  if (engine === 'google') {
    url = `https://www.google.co.jp/search?q=${encodeURIComponent(query)}&hl=ja&gl=JP`
  }
  else if (engine === 'duckduckgo') {
    url = `https://duckduckgo.com/?q=${encodeURIComponent(query)}&kl=jp-jp`
  }
  else {
    url = `https://www.bing.com/search?q=${encodeURIComponent(query)}&cc=JP&setlang=ja&mkt=ja-JP&ensearch=1`
  }
  return await openTabAndExtract(url, engine || 'bing')
}

async function handleNavigate(url) {
  return await openTabAndExtract(url, null)
}

async function openTabAndExtract(url, searchEngine) {
  // 現在のアクティブタブを記憶
  let originalTab = null
  try {
    const [t] = await chrome.tabs.query({ active: true, currentWindow: true })
    originalTab = t
  }
  catch {}

  // 新しいタブを開く
  const tab = await chrome.tabs.create({ url, active: true })

  try {
    // ページ読み込み完了を待つ
    await waitForTabLoad(tab.id, 25000)
    await sleep(2500) // 動的コンテンツのレンダリング待ち

    // コンテンツを抽出
    const [{ result: content }] = await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      func: extractPageContent,
      args: [searchEngine],
    })

    // スクリーンショットを撮影
    let screenshot = null
    try {
      screenshot = await chrome.tabs.captureVisibleTab(null, { format: 'png' })
    }
    catch (e) {
      console.warn('スクリーンショット撮影失敗:', e)
    }

    // タブを閉じて元のタブに戻る
    await chrome.tabs.remove(tab.id)
    if (originalTab) {
      await chrome.tabs.update(originalTab.id, { active: true }).catch(() => {})
    }

    return {
      title: content.title,
      url: content.url,
      text: content.text,
      searchLinks: content.searchLinks || [],
      screenshot: screenshot || '',
    }
  }
  catch (e) {
    // エラー時もタブを確実に閉じる
    await chrome.tabs.remove(tab.id).catch(() => {})
    if (originalTab) {
      await chrome.tabs.update(originalTab.id, { active: true }).catch(() => {})
    }
    throw e
  }
}

// タブの読み込み完了を待つ
function waitForTabLoad(tabId, timeout = 25000) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      chrome.tabs.onUpdated.removeListener(listener)
      resolve() // タイムアウトでも続行
    }, timeout)

    function listener(id, changeInfo) {
      if (id === tabId && changeInfo.status === 'complete') {
        clearTimeout(timer)
        chrome.tabs.onUpdated.removeListener(listener)
        resolve()
      }
    }
    chrome.tabs.onUpdated.addListener(listener)
  })
}

// ページ内容を抽出する関数（chrome.scripting.executeScript で注入）
function extractPageContent(searchEngine) {
  const title = document.title
  const url = location.href

  // 検索結果リンクを抽出
  let searchLinks = []
  if (searchEngine === 'bing') {
    document.querySelectorAll('#b_results .b_algo h2 a, #b_results .b_algo .b_title a').forEach((a) => {
      const href = a.href
      const text = a.textContent.trim()
      if (href && href.startsWith('http') && !href.includes('bing.com') && text) {
        searchLinks.push({ title: text, url: href })
      }
    })
    searchLinks = searchLinks.slice(0, 6)
  }
  else if (searchEngine === 'google') {
    document.querySelectorAll('#search .g a, #rso .g a').forEach((a) => {
      const h3 = a.querySelector('h3')
      if (!h3)
        return
      const href = a.href
      const text = h3.textContent.trim()
      if (href && href.startsWith('http') && !href.includes('google.') && text) {
        searchLinks.push({ title: text, url: href })
      }
    })
    searchLinks = searchLinks.slice(0, 6)
  }
  else if (searchEngine === 'duckduckgo') {
    document.querySelectorAll('article[data-testid="result"] a[data-testid="result-title-a"], .result__title a').forEach((a) => {
      const href = a.href
      const text = a.textContent.trim()
      if (href && href.startsWith('http') && text) {
        searchLinks.push({ title: text, url: href })
      }
    })
    searchLinks = searchLinks.slice(0, 6)
  }

  // テキストを抽出
  const clone = document.body.cloneNode(true)
  clone.querySelectorAll('script, style, noscript, [aria-hidden="true"]').forEach(el => el.remove())
  const rawText = (clone.innerText || clone.textContent || '')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
    .slice(0, 2000)

  let text = rawText
  if (searchLinks.length > 0) {
    text += `\n\n## 検索結果のURL一覧\n${
      searchLinks.map((l, i) => `${i + 1}. [${l.title}](${l.url})`).join('\n')}`
  }

  return { title, url, text, searchLinks }
}

// =============================================
// Popup Communication
// =============================================

function notifyPopup(type, message) {
  chrome.runtime.sendMessage({ type, message }).catch(() => {})
}

// メッセージハンドラ（ポップアップからの制御）
chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg.action === 'getStatus') {
    sendResponse({ polling, enabled: true })
  }
  else if (msg.action === 'start') {
    startPolling()
    sendResponse({ ok: true })
  }
  else if (msg.action === 'stop') {
    stopPolling()
    sendResponse({ ok: true })
  }
  else if (msg.action === 'checkServer') {
    getSettings().then(({ serverUrl }) => {
      fetch(`${serverUrl}/api/ext-bridge/status`, { signal: AbortSignal.timeout(5000) })
        .then(r => r.json())
        .then(d => sendResponse({ connected: true, data: d }))
        .catch(e => sendResponse({ connected: false, error: e.message }))
    })
    return true // async response
  }
})
