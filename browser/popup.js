// Airi Browser - Popup Settings

const DEFAULTS = {
  apiUrl: 'http://localhost:1234/v1/chat/completions',
  model: '',
  maxTokens: 2048,
  temperature: 0.2,
  systemPrompt: '',
}

const fields = ['apiUrl', 'model', 'maxTokens', 'temperature', 'systemPrompt']

// 設定を読み込み & モデル一覧を自動取得
chrome.storage.local.get(DEFAULTS, (data) => {
  fields.forEach((f) => {
    document.getElementById(f).value = data[f]
  })
  // 起動時にモデル一覧を自動取得
  loadModelList(data.apiUrl || DEFAULTS.apiUrl, data.model)
})

async function loadModelList(apiUrl, currentModel) {
  const select = document.getElementById('modelSelect')
  const info = document.getElementById('modelInfo')
  try {
    const resp = await chrome.runtime.sendMessage({ type: 'listModels', apiUrl })
    if (resp && resp.models && resp.models.length > 0) {
      select.innerHTML = '<option value="" disabled>-- モデルを選択してください --</option>'
      resp.models.forEach((m) => {
        const opt = document.createElement('option')
        opt.value = m
        opt.textContent = m
        select.appendChild(opt)
      })
      select.style.display = 'block'
      if (currentModel) {
        select.value = currentModel
        info.textContent = `✓ ${currentModel} を使用中`
        info.style.color = '#4caf50'
      }
      else {
        select.value = ''
        info.textContent = '⚠ モデル未選択！下のリストから選択して保存してください。'
        info.style.color = '#f44336'
      }
    }
    else {
      select.style.display = 'none'
      info.textContent = '✗ モデルが見つかりません。LM Studioを確認してください。'
      info.style.color = '#f44336'
    }
  }
  catch {
    info.textContent = '✗ LM Studioに接続できません。'
    info.style.color = '#f44336'
  }
}

// 保存
document.getElementById('saveBtn').addEventListener('click', () => {
  const settings = {}
  fields.forEach((f) => {
    const el = document.getElementById(f)
    if (el.type === 'number') {
      settings[f] = Number.parseFloat(el.value) || DEFAULTS[f]
    }
    else {
      settings[f] = (f === 'model' || f === 'systemPrompt') ? el.value : (el.value || DEFAULTS[f])
    }
  })

  chrome.storage.local.set(settings, () => {
    const msg = document.getElementById('savedMsg')
    msg.classList.add('show')
    setTimeout(() => msg.classList.remove('show'), 2000)
  })
})

// リセット
document.getElementById('resetBtn').addEventListener('click', () => {
  fields.forEach((f) => {
    document.getElementById(f).value = DEFAULTS[f]
  })
})

// モデル検出 & 一覧表示
document.getElementById('detectBtn').addEventListener('click', async () => {
  const info = document.getElementById('modelInfo')
  const select = document.getElementById('modelSelect')
  info.textContent = '検出中...'
  info.style.color = '#ff9800'
  try {
    const apiUrl = document.getElementById('apiUrl').value || DEFAULTS.apiUrl
    const resp = await chrome.runtime.sendMessage({ type: 'listModels', apiUrl })
    if (resp && resp.models && resp.models.length > 0) {
      // ドロップダウンに一覧表示
      select.innerHTML = '<option value="" disabled>-- モデルを選択してください --</option>'
      resp.models.forEach((m) => {
        const opt = document.createElement('option')
        opt.value = m
        opt.textContent = m
        select.appendChild(opt)
      })
      select.style.display = 'block'
      const cur = document.getElementById('model').value
      select.value = cur || ''
      info.textContent = `✓ ${resp.models.length}個のモデルを検出。下から選択してください。`
      info.style.color = '#4caf50'
    }
    else {
      select.style.display = 'none'
      info.textContent = '✗ モデルが見つかりません。LM Studioを確認してください。'
      info.style.color = '#f44336'
    }
  }
  catch (e) {
    info.textContent = `✗ エラー: ${e.message}`
    info.style.color = '#f44336'
  }
})

// ドロップダウンで選択したらinputに反映
document.getElementById('modelSelect').addEventListener('change', (e) => {
  document.getElementById('model').value = e.target.value
})

// サイドパネルを開く
document.getElementById('openPanelBtn').addEventListener('click', async () => {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true })
  if (tab) {
    await chrome.sidePanel.open({ tabId: tab.id })
    window.close()
  }
})
