# `@proj-airi/stage-ui-three`

AIRIステージサーフェスで使用されるThree.jsランタイムコンポーネント、ストア、コンポーザブル、診断ツール。

## 機能

- ステージページで使用される共有Threeシーンルートをホスト。
- VRMモデルの読み込み、マウント、再利用、破棄。
- カメラ、ライト、環境、モデルビュー状態用のパッケージローカルモデルストアを提供。
- Three固有のヒットテスト、レンダーターゲットヘルパー、VRMプレビュー生成を提供。
- Three/VRMランタイム診断用のローカル `trace` サブモジュールを提供。

## エクスポート

- `ThreeScene`: メインのThreeバックドステージコンポーネント。
- `useModelStore`: Threeシーンとモデル設定用のPiniaストア。
- `@proj-airi/stage-ui-three/trace`: ローカルEventaトレースバスとスナップショットヘルパー。
- `@proj-airi/stage-ui-three/composables/vrm`: VRM読み込みとアニメーションヘルパー。
- `@proj-airi/stage-ui-three/utils/vrm-preview`: 単発VRMプレビューレンダリング。
- `composables/hit-test` と `composables/render-target`: レンダラーリードバックヘルパー。

## VRMライフサイクル

このパッケージではVRMランタイム管理が明示的に行われます。

- `VRMModel.vue` はコンポーネントの再マウントに依存せず、読み込み、コミット、クリーンアップを個別に駆動。
- デタッチされたVRMインスタンスは `components/Model/vrm-instance-cache.ts` を通じて `ManagedVrmInstance` 値としてキャッシュ。
- キャッシュエントリは `scopeKey` でスコープされ、再利用前に `modelSrc` で照合。
- コンポーネントのアンマウント時に現在のインスタンスを再利用用にスタッシュする場合あり。
- モデル切り替え時はアクティブインスタンスと現在のスコープのデタッチキャッシュをクリア。
- 新規読み込みは次のVRMをオフスクリーンで準備し、準備完了後にアクティブシーンにコミット。

これにより、通常の再マウントやHMRが即座に深いVRM破棄を強制することを防ぎつつ、モデル切り替えを決定論的に保ちます。

## シーンライフサイクル

`ThreeScene` はシーンがインタラクティブになる前に、2つの独立した非同期準備完了シグナルを調整します:

- **VRM読み込み**: `VRMModel` が `sceneBootstrap`（ジオメトリデータ）を発行し、モデルがシーンにコミットされると `loaded` を発行。
- **コントロール初期化**: `OrbitControls` がカメラとレンダラー参照を取得すると `orbitControlsReady` を発行。

これら2つのシグナルは `useModelStore` で追跡されるバインディングトランザクションを通じて調整:

- `scenePhase`: シーンの現在のフェーズ — `pending` → `loading` → `binding` → `mounted`（または `error` / `no-model`）。
- `sceneTransactionDepth`: 読み込みまたは再バインドサイクルの開始時にインクリメント、バインディング完了時にデクリメント。depth > 0の間、シーンは進行中と見なされる。
- `sceneMutationLocked`: `scenePhase` と `sceneTransactionDepth` から計算。シーンが未マウントまたはトランザクション進行中の場合にtrue。オービットコントロールなどのユーザーインタラクションのゲートに使用。

いずれかのシグナルが到着すると、`ThreeScene` が `completeSceneBinding()` を呼び出します。この関数:

1. `scenePhase` を即座に `'binding'` に設定し、早期の `mounted` 解決をブロック。
2. 保留中の `SceneBootstrap` ペイロード（カメラ位置、モデル原点、目の高さなど）があれば適用。
3. OrbitControlsが更新されたカメラ状態を読み取れるよう、`nextTick` 後に `controlsRef.update()` を呼び出し。
4. 現在の `modelPhase` と `canvasReady` に基づいて `scenePhase` を最終値に解決。

2番目に到着したシグナルがバインディングを完了します。最初に到着したシグナルはもう一方がまだ準備できていないことを検出し、`'loading'` に戻ります。

### モデル切り替え時のカメラ保持

`SceneBootstrap` は `cacheHit` フラグを持っています。`ThreeScene.applySceneBootstrap` はトランザクション理由に基づいてブートストラップデータの適用方法を決定:

- `initial-load` / `unknown`: カメラ位置とターゲットをモデルの計算されたデフォルトにリセット。
- `model-switch`: ユーザーの既存のカメラオフセットと前のモデル原点に対するルックアット角度を保持し、新しいモデル原点に投影。

### サブツリーウォッチ

`ThreeScene` は `modelRef` と `controlsRef` を `flush: 'sync'` で監視し、同一ティック内の即時デタッチイベントを検出します。`controlsRef` がnullになると（例: TresJS内部の再マウント）、`controlsReady` がリセットされ新しいバインディングトランザクションが開始。`modelRef` がnullになると、次の `VRMModel` からの `loadStart` イベントがトランザクションを開くため、新しいトランザクションを開かずに `scenePhase` が `loading` に戻ります。

## `trace` サブモジュール

`@proj-airi/stage-ui-three/trace` は以下を提供:

- Three/VRMランタイムトレースイベント用のローカルEventaコンテキスト。
- トレーシングがオフの場合にホットパスがショートサーキットできる参照カウント式の有効化/無効化制御。
- 以下の共有イベント定義:
  - Threeレンダー情報
  - Threeヒットテストリードバック
  - VRM更新フレーム分解
  - VRM読み込み開始/終了/エラー
  - VRM破棄開始/終了
- レンダラーメモリとVRMシーンサマリー用のリソーススナップショットヘルパー。

トレースバスは意図的に `stage-ui-three` にローカルです。デスクトップアプリは必要に応じてレンダラーウィンドウ間でブリッジできますが、信頼できるソースはこのパッケージに留まります。

## 使用すべきとき

- ステージサーフェスにThreeバックドレンダラーが必要な場合。
- ページがカメラ、ライティング、モデルトランスフォーム、レンダラー向け状態を制御する必要がある場合に `useModelStore` を使用。
- Vueの親チェーンを経由せずにThree/VRMランタイムテレメトリが必要な場合に `@proj-airi/stage-ui-three/trace` を使用。
- メインステージライフサイクルに参加すべきでない単発プレビューレンダリングに `utils/vrm-preview` を使用。

## 使用すべきでないとき

- グローバルビジネスイベントバスとして使用しない。
- Live2Dや非Threeランタイムテレメトリに `trace` サブモジュールを使用しない。
- `trace` サブモジュールを通じてレンダラーからメインへの制御フローをルーティングしない。制御IPCはアプリレベルのコントラクトに保つ。
- VRMインスタンスキャッシュをアプリやウィンドウ間の汎用共有アセットキャッシュとして使用しない。
