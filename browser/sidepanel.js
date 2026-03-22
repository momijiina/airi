// Airi Browser - Side Panel UI

const logArea = document.getElementById('logArea')
const taskInput = document.getElementById('taskInput')
const sendBtn = document.getElementById('sendBtn')
const stopBtn = document.getElementById('stopBtn')
const statusBar = document.getElementById('statusBar')
const statusMessage = document.getElementById('statusMessage')
const statusDot = document.getElementById('statusDot')
const statusText = document.getElementById('statusText')
const modelSelect = document.getElementById('modelSelect')

let isRunning = false

// ============================================================
// モデル一覧読み込み & 選択
// ============================================================
async function loadModels() {
  try {
    const data = await chrome.storage.local.get({ apiUrl: 'http://localhost:1234/v1/chat/completions', model: '' })
    const baseUrl = data.apiUrl.replace('/chat/completions', '/models')
    const resp = await fetch(baseUrl)
    if (!resp.ok)
      throw new Error('API error')
    const json = await resp.json()
    const models = (json.data || []).filter(m => !m.id.includes('embed') && !m.id.includes('embedding')).map(m => m.id)

    modelSelect.innerHTML = '<option value="" disabled>-- モデルを選択 --</option>'
    models.forEach((m) => {
      const opt = document.createElement('option')
      opt.value = m
      opt.textContent = m
      modelSelect.appendChild(opt)
    })

    if (data.model && models.includes(data.model)) {
      modelSelect.value = data.model
      modelSelect.classList.remove('no-model')
    }
    else {
      modelSelect.value = ''
      modelSelect.classList.add('no-model')
    }
  }
  catch {
    modelSelect.innerHTML = '<option value="" disabled selected>-- 接続エラー --</option>'
    modelSelect.classList.add('no-model')
  }
}

modelSelect.addEventListener('change', () => {
  const selected = modelSelect.value
  if (selected) {
    chrome.storage.local.set({ model: selected })
    modelSelect.classList.remove('no-model')
    statusText.textContent = `接続済み (${selected})`
  }
})

loadModels()

// ============================================================
// 接続チェック
// ============================================================
async function checkConnection() {
  try {
    const data = await chrome.storage.local.get({ apiUrl: 'http://localhost:1234/v1/chat/completions', model: '' })
    const baseUrl = data.apiUrl.replace('/chat/completions', '/models')
    const resp = await fetch(baseUrl, { method: 'GET' })
    if (resp.ok) {
      const json = await resp.json()
      const models = (json.data || []).filter(m => !m.id.includes('embed'))
      statusDot.className = 'status-dot connected'
      statusText.textContent = data.model
        ? `接続済み (${data.model})`
        : 'LM Studio 接続済み（モデル未選択）'
    }
    else {
      throw new Error('Not OK')
    }
  }
  catch {
    statusDot.className = 'status-dot error'
    statusText.textContent = 'LM Studio 未接続'
  }
}

checkConnection()
setInterval(checkConnection, 15000)

// ============================================================
// ログ追加
// ============================================================
function addLog(type, html) {
  // Welcome メッセージを削除
  const welcome = logArea.querySelector('.welcome-message')
  if (welcome)
    welcome.remove()

  const div = document.createElement('div')
  div.className = `log-entry ${type}`
  div.innerHTML = html
  logArea.appendChild(div)
  logArea.scrollTop = logArea.scrollHeight
}

function escapeHtml(text) {
  const div = document.createElement('div')
  div.textContent = text
  return div.innerHTML
}

// ============================================================
// メッセージ受信
// ============================================================
chrome.runtime.onMessage.addListener((msg) => {
  switch (msg.type) {
    case 'log':
      addLog('info', escapeHtml(msg.text))
      break
    case 'thought':
      addLog('thought', `<div class="log-label">💭 思考</div>${escapeHtml(msg.text)}`)
      break
    case 'action':
      addLog('action', `<div class="log-label">⚡ アクション</div>${formatAction(msg.action)}`)
      break
    case 'result':
      addLog(
        `result ${msg.success ? 'success' : 'error'}`,
        `<div class="log-label">${msg.success ? '✓ 結果' : '✗ エラー'}</div>${escapeHtml(msg.text)}`,
      )
      break
    case 'status':
      statusBar.style.display = 'flex'
      statusMessage.textContent = msg.text
      break
    case 'agentDone':
      setRunning(false)
      break
  }
})

function formatAction(action) {
  if (!action)
    return '(不明)'
  const parts = [`type: ${action.type}`]
  if (action.elementIndex !== undefined)
    parts.push(`element: [${action.elementIndex}]`)
  if (action.text)
    parts.push(`text: "${action.text}"`)
  if (action.url)
    parts.push(`url: ${action.url}`)
  if (action.key)
    parts.push(`key: ${action.key}`)
  if (action.direction)
    parts.push(`direction: ${action.direction}`)
  if (action.summary)
    parts.push(`summary: ${action.summary}`)
  if (action.reason)
    parts.push(`reason: ${action.reason}`)
  return escapeHtml(parts.join(' | '))
}

// ============================================================
// 操作
// ============================================================
function setRunning(running) {
  isRunning = running
  sendBtn.style.display = running ? 'none' : 'flex'
  stopBtn.style.display = running ? 'flex' : 'none'
  taskInput.disabled = running
  statusBar.style.display = running ? 'flex' : 'none'

  if (running) {
    statusDot.className = 'status-dot running'
    statusText.textContent = 'エージェント実行中'
  }
  else {
    checkConnection()
  }
}

sendBtn.addEventListener('click', () => {
  const task = taskInput.value.trim()
  if (!task)
    return

  addLog('user-task', `<div class="log-label">📝 タスク</div>${escapeHtml(task)}`)
  taskInput.value = ''
  setRunning(true)

  chrome.runtime.sendMessage({ type: 'startAgent', task })
})

stopBtn.addEventListener('click', () => {
  chrome.runtime.sendMessage({ type: 'stopAgent' })
  addLog('info', '⏹️ 停止リクエストを送信しました...')
})

taskInput.addEventListener('keydown', (e) => {
  if (e.key === 'Enter' && !e.shiftKey) {
    e.preventDefault()
    sendBtn.click()
  }
})
