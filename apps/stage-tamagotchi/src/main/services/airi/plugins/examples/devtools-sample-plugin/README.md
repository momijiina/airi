# Devtools サンプルプラグイン

このサンプルプラグインは、**Plugin Host Inspector** ページでプラグインホストの動作を検証するためのものです。

## ファイル

- `devtools-sample-plugin.json`: プラグインマニフェスト（`ManifestV1`）
- `devtools-sample-plugin.mjs`: プラグイン実装

マニフェストは `apis.providers.listProviders()` が必要とするプロトコル権限を宣言します: `capabilities:wait` の呼び出し、`resources:providers:list-providers` の呼び出し、プロバイダーリソースの読み取り、プロバイダーリストケイパビリティの待機。

## 使い方

1. Stage Tamagotchiで `/devtools/plugin-host` を開く。
2. ページから `registry.root` パスを確認。
3. 両ファイルをその `registry.root` ディレクトリにコピー。
4. Plugin Host Inspectorで:
   - `Refresh` をクリック
   - `devtools-sample-plugin` を見つける
   - `Enable` をクリック
   - `Load`（または `Load Enabled`）をクリック
5. 確認:
   - プラグインが `loaded` と表示される
   - セッションフェーズが `ready` になる
   - ケイパビリティリストが表示される

## このプラグインの動作

- `init`: レンダラー/メインコンソールに起動をログ。
- `setupModules`: `apis.providers.listProviders()` を呼び出し、プロバイダー名をログ。

アプリの状態を変更しないため、ライフサイクル検証に安全です。
