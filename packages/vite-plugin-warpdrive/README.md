# @proj-airi/vite-plugin-warpdrive

選択したビルドアセット（大きなWASM/TTF/VRMなど）をリモートオブジェクトストレージにリライトし、ビルド後にアップロードするViteプラグイン。Viteの `renderBuiltUrl` フックを使用して、生成されたバンドルがリモートURLを参照しつつ、ローカルファイルをアップロード用に保持します。

## なぜ必要か

- HTML/JSバンドルを軽量に保ちながら、重いアセット（WASM、フォント、モデル）をオブジェクトストレージ/CDNから配信。
- シンプルなプロバイダー抽象化。[`s3mini`](https://github.com/good-lly/s3mini) によるS3互換実装を同梱。
- オプションのマニフェスト（`remote-assets.manifest.json`）を出力し、ビルドファイル名をリモートURL + hostId/hostTypeにマッピング。

## インストール

```bash
pnpm add -D @proj-airi/vite-plugin-warpdrive
```

## 使い方

```ts
import { createS3Provider, WarpDrivePlugin } from '@proj-airi/vite-plugin-warpdrive'
// vite.config.ts
import { defineConfig } from 'vite'

export default defineConfig({
  plugins: [
    WarpDrivePlugin({
      prefix: 'remote-assets', // path prefix in the bucket (default: remote-assets)
      include: [/\.wasm$/i, /\.ttf$/i, /\.vrm$/i], // which assets to rewrite/upload (required)
      // includeBy: (file, ctx) => ctx.hostId?.includes('duckdb'), // extra predicate with host info
      // contentTypeBy: (file) => file.endsWith('.wasm') ? 'application/wasm' : undefined,
      manifest: true, // emit remote-assets.manifest.json in dist
      delete: true, // delete local uploaded assets (default: true)
      clean: true, // clean remote prefix before upload (default: true if provider supports it)
      skipNotModified: true, // skip uploads if provider supports it (default: true)
      // dryRun: true, // rewrite URLs/manifest only; skip cleaning/uploading
      provider: createS3Provider({
        endpoint: process.env.S3_ENDPOINT!,
        accessKeyId: process.env.S3_ACCESS_KEY_ID!,
        secretAccessKey: process.env.S3_SECRET_ACCESS_KEY!,
        region: process.env.S3_REGION,
        publicBaseUrl: process.env.WARP_DRIVE_PUBLIC_BASE, // defaults to endpoint
      }),
    }),
  ],
})
```

### オプション

- `provider`（必須）: `UploadProvider` を実装するオブジェクト（下記参照）。
- `prefix`: アップロードキーとURLのパスプレフィックス文字列（デフォルト: `remote-assets`。例: `remote-assets/assets/foo.wasm`）。
- `include`: リライト/アップロード対象アセットを決定する正規表現または述語関数の配列（空配列は何もリライトしない）。
- `includeBy`: オプションの `(filename, ctx) => boolean`（`ctx` に `hostId`、`hostType` あり）。
- `contentTypeBy`: オプションの `(filename) => string | Promise<string | undefined> | undefined`。`provider.upload` に渡される。
- `manifest`: trueの場合、fileName/key/url/hostId/hostType/sizeを記述する `remote-assets.manifest.json` を出力。
- `delete`: true（デフォルト）の場合、アップロード後にローカルアセットをディスクから削除。
- `clean`: true（デフォルト）の場合、アップロード前に `provider.cleanPrefix(prefix)` を呼び出し。プレフィックスがないかプロバイダーが `cleanPrefix` を持たない場合はスキップ。
- `skipNotModified`: true（デフォルト）の場合、`provider.shouldSkipUpload` が true を返すとアップロードをスキップ。
- `dryRun`: trueの場合、URLリライト/マニフェスト出力のみでクリーン/アップロードは行わない。

#### UploadProvider インターフェース

```ts
interface UploadProvider {
  getPublicUrl: (key: string) => string
  upload: (localPath: string, key: string, contentType?: string) => Promise<void>
  cleanPrefix?: (prefix: string) => Promise<void>
  shouldSkipUpload?: (localPath: string, key: string) => Promise<boolean>
}
```

### createS3Provider

`s3mini` の軽量ラッパー。必須フィールド:

- `endpoint`: バケットの完全URL（例: `https://s3.example.com/my-bucket`）。
- `accessKeyId`、`secretAccessKey`: 認証情報。
- オプション: `region`、`requestSizeInBytes`、`requestAbortTimeout`、`publicBaseUrl`（公開URLベースをオーバーライド）、`skipNotModified`（デフォルト: true。ETag/MD5でアップロードをスキップ）。

## 動作の仕組み

1. `renderBuiltUrl` がマッチするアセットに対してリモートURLを返し、key/hostId/hostTypeを記憶。
2. `generateBundle` がアップロード対象アセットを記録、オプションのマニフェストを出力し、ローカルファイルを `dist/` に残す。
3. `closeBundle` がオプションでプレフィックスをクリーン、未変更アップロードをスキップ、アセットをアップロード、ローカルコピーを削除（`delete` が false でない場合）。
