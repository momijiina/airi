# @proj-airi/server-sdk

サーバーサイドコンポーネントに接続するためのクライアント側SDK。

## 使い方

```shell
ni @proj-airi/server-sdk -D # @antfu/ni から。`npm i -g @antfu/ni` でインストール可能
pnpm i @proj-airi/server-sdk -D
yarn i @proj-airi/server-sdk -D
npm i @proj-airi/server-sdk -D
```

```typescript
import { Client } from '@proj-airi/server-sdk'

const client = new Client({
  name: 'your airi plugin',
  autoConnect: false,
})

await client.connect()

client.onEvent('input:text', async (event) => {
  console.info(event.data.text)
})
```

`connect()` はWebSocketトランスポートが開いただけでなく、クライアントが完全に使用可能になったときに解決されます。具体的には:

- ソケットがオープン済み
- トークンが設定されている場合、認証が成功
- モジュールのアナウンスが成功

便利なランタイムヘルパー:

- `client.connectionStatus` 現在のライフサイクル状態を公開
- `client.isReady` クライアントが認証+アナウンスを完了したかを返す
- `client.send()` ソケットが利用不可の場合、メッセージを無言で破棄せず `false` を返す
- `client.sendOrThrow()` 厳密な配信セマンティクスが必要な場合に利用可能
- `client.onEvent()` 購読解除関数を返す

## ライセンス

[MIT](../../LICENSE)
