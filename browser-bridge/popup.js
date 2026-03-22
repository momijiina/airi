/**
 * Airi Browser Bridge — Popup Script
 */
const DEFAULT_SERVER = 'http://localhost:3001'

const statusDot = document.getElementById('status-dot')
const statusText = document.getElementById('status-text')
const serverUrl = document.getElementById('server-url')
const saveBtn = document.getElementById('save-btn')
const checkBtn = document.getElementById('check-btn')
const logEl = document.getElementById('log')

// 設定読み込み
chrome.storage.local.get({ serverUrl: DEFAULT_SERVER }, (s) => {
  serverUrl.value = s.serverUrl
  checkConnection()
})

// 保存
saveBtn.addEventListener('click', () => {
  const url = serverUrl.value.trim().replace(/\/+$/, '') || DEFAULT_SERVER
  serverUrl.value = url
  chrome.storage.local.set({ serverUrl: url }, () => {
    addLog(`💾 設定を保存しました: ${url}`)
    checkConnection()
  })
})

// 接続テスト
checkBtn.addEventListener('click', checkConnection)

function checkConnection() {
  setStatus('checking', '接続確認中...')
  chrome.runtime.sendMessage({ action: 'checkServer' }, (response) => {
    if (chrome.runtime.lastError) {
      setStatus('off', 'サービスワーカーに接続できません')
      addLog(`❌ ${chrome.runtime.lastError.message}`)
      return
    }
    if (response && response.connected) {
      setStatus('on', 'サーバーに接続済み ✓')
      addLog('✅ サーバー接続OK')
    }
    else {
      setStatus('off', 'サーバーに接続できません')
      addLog(`❌ ${response?.error || '接続失敗'}`)
    }
  })
}

function setStatus(state, text) {
  statusDot.className = `status-dot ${state}`
  statusText.textContent = text
}

function addLog(msg) {
  const item = document.createElement('div')
  item.className = 'log-item'
  const time = new Date().toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
  item.textContent = `[${time}] ${msg}`
  logEl.prepend(item)
  // 最大20件保持
  while (logEl.children.length > 20) logEl.lastChild.remove()
}

// バックグラウンドからの通知を受信
chrome.runtime.onMessage.addListener((msg) => {
  if (msg.type === 'activity') {
    addLog(`📡 ${msg.message}`)
  }
  else if (msg.type === 'done') {
    addLog(`✅ ${msg.message}`)
  }
  else if (msg.type === 'error') {
    addLog(`❌ ${msg.message}`)
  }
  else if (msg.type === 'status') {
    addLog(`ℹ️ ${msg.message}`)
  }
})
