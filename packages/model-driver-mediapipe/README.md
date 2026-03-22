# @proj-airi/model-driver-mediapipe

単一人物モーションキャプチャワークショップパッケージ。

**目標**

stage-webが利用できる最小限のクローズドループを提供:

`カメラフレーム` → `MediaPipe Tasks Vision` → `PerceptionState` → `キャンバスオーバーレイ`

**試す場所**

- Devtoolsページ: `apps/stage-web/src/pages/devtools/model-driver-mediapipe.vue`
- メニュー: 設定 → システム → 開発者 → "MediaPipe Workshop"

**主要ファイル**

- `packages/model-driver-mediapipe/src/types.ts`: 中間層コントラクト（`PerceptionState`）
- `packages/model-driver-mediapipe/src/engine.ts`: スケジューラー + フレームドロップポリシー + 状態マージ
- `packages/model-driver-mediapipe/src/backends/mediapipe.ts`: `@mediapipe/tasks-vision` 統合
- `packages/model-driver-mediapipe/src/utils/overlay.ts`: キャンバスオーバーレイレンダラー

**バックエンドの前提条件**

- 単一人物（`maxPeople: 1`）
- 実行モード: `VIDEO`
- ランドマークは正規化（`x`/`y` が `[0..1]`）され、オーバーレイキャンバスに描画

**ドキュメント**

アップストリームのドキュメント/スニペットは `packages/model-driver-mediapipe/references/` に配置。

このパッケージが使用する最小限のAPIは以下にまとめられています:

- `packages/model-driver-mediapipe/references/tasks-vision-api.md`
