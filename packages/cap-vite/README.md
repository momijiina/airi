# @proj-airi/cap-vite

[Capacitor](https://capacitorjs.com/) のViteを使用したライブリロード開発用CLI。

## 使い方

```bash
cap-vite [vite args...] -- <ios|android> [cap run args...]
```

例:

```bash
pnpm exec cap-vite -- ios --target <DEVICE_ID_OR_SIMULATOR_NAME>
pnpm exec cap-vite -- --host 0.0.0.0 --port 5173 -- android --target <DEVICE_ID_OR_SIMULATOR_NAME> --flavor release
CAPACITOR_DEVICE_ID=<DEVICE_ID_OR_SIMULATOR_NAME> pnpm exec cap-vite -- ios
pnpm -F @proj-airi/stage-pocket run dev:ios -- --target <DEVICE_ID_OR_SIMULATOR_NAME>
```

- `--` の前の引数は `vite` に転送されます。
- `--` の後の引数は `cap run` に転送されます。
- `CAPACITOR_DEVICE_ID` が設定され、`cap run` の引数に `--target` が含まれていない場合、`cap-vite` が自動的に `--target <CAPACITOR_DEVICE_ID>` を挿入します。
- `cap-vite` は常にVite開発サーバーを起動します。追加引数として `vite dev` や `vite serve` を渡さないでください。
- 開発サーバー起動後、ターミナルで `R` を押すとViteを再起動せずに `cap run` を再実行できます。

`pnpm exec cap run ios --list` または `pnpm exec cap run android --list` で利用可能なデバイスとシミュレータの一覧を確認できます。

## Capacitor設定

`capacitor.config.ts` の `server.url` を環境変数 `CAPACITOR_DEV_SERVER_URL` に設定する必要があります。残りはCLIが処理します。

```ts
const serverURL = env.CAPACITOR_DEV_SERVER_URL
const isCleartext = serverURL?.startsWith('http://') ?? false

const config: CapacitorConfig = {
  appId: 'com.example.app',
  appName: 'Example App',
  webDir: 'dist',
  server: serverURL
    ? {
        url: serverURL,
        cleartext: isCleartext,
      }
    : undefined,
}

export default config
```

## なぜ必要か？

- `server.url` を気にする必要がなく、自動的に正しい値に設定されます。
- ネイティブコード変更時にネイティブアプリを再実行。起動を忘れる心配がありません。
- 同じターミナルからオンデマンドで `cap run` を再実行可能。クリーンなネイティブ再起動が必要な時に便利です。
- 2つのターミナルを開く必要なく、1つのコマンドで実行できます。

## アーキテクチャノート

- Vite引数は `cap-vite` 内で再実装せず、実際のVite CLIに委ねます。
- `cap-vite` はユーザーの既存 `vite.config.*` を編集せずに独自のViteプラグインを追加できるよう、ラッパー設定をインジェクトします。
- インジェクトされたプラグインは `server.resolvedUrls` を読み取り、`cap run` を起動し、ネイティブプラットフォームディレクトリのファイル変更時またはターミナルで `R` を押した時に再起動します。
- `cap-vite` は2つの引数グループを分割し、`cap run` 引数を環境変数を通じてインジェクトされたプラグインに渡すだけです。
