# AIRIプラグイン - Web拡張機能

> あなたが読んでいるものを読む！

AIRIがあなたがWeb上で読んでいるもの、見ているもの、聴いているものを理解するためのプラグインです。

## 現在の機能

- YouTubeとBilibiliからページ+動画コンテキストを取得。
- テキストトラックやDOMオーバーレイから字幕を抽出。
- コンテキスト更新とオプションの `spark:notify` イベントをキャラクターに送信。
- WebSocket、トグル、クイックステータスを設定するポップアップを提供。

## クイックスタート

1. `pnpm -F @proj-airi/airi-plugin-web-extension dev`
2. ブラウザで `.wxt/dev` からアンパックされた拡張機能を読み込み。
3. ポップアップを開いてWebSocket URLを設定（デフォルト: `ws://localhost:6121/ws`）。
4. YouTube/Bilibiliの動画を再生し、ポップアップに検出されたタイトル/字幕が表示されることを確認。
