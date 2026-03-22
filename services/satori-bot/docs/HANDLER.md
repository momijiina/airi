# コアメッセージフローアーキテクチャ

このドキュメントでは、Satori Bot 内のメッセージの完全なライフサイクル（初期 WebSocket イベントから LLM の意思決定プロセスまで）を概説します。

## 1. アーキテクチャ概要

Bot は **イベント駆動 + 自律ループ** のハイブリッドモデルで動作します：
* **イベント層**: 生の WebSocket シグナル、重複排除、キューイングを処理します。
* **スケジューラ層**: キューを消費し、内部の「未読プール」状態を更新し、チャネル固有の処理ループをトリガーします。
* **プランナー層**: LLM がエージェントとして「未読プール」と「アクション履歴」の状態を観察し、`read_unread_messages`（観察）または `send_message`（行動）を決定します。

---

## 2. 詳細なデータフロー

### フェーズ 1: 受信
**場所:** `src/adapter/satori/client.ts` → `src/core/loop/queue.ts`

1.  **WebSocket 受信**: `SatoriClient` が生の JSON シグナルを受信し、`SatoriEvent` にパースします。
2.  **イベントリスナー**: `setupMessageEventHandler`（`queue.ts` 内）が `message-created` イベントをリッスンします。
3.  **重複排除**: システムが `processedIds` セット（キー: `channelId-messageId`）をチェックし、二重処理を防止します。
4.  **キューイング**:
    * 生の `event` が `{ event, status: 'ready' }` オブジェクトにラップされます。
    * `botContext.eventQueue` にプッシュされ、`pushToEventQueue` を介してデータベースに永続化されます。
    * **主要データ**: `event.message.content`、`event.user.id`、`event.channel.id`。

### フェーズ 2: 消費とアンカリング
**場所:** `src/core/loop/scheduler.ts`（関数: `onMessageArrival`）

システム処理ロックが空いているとき、`eventQueue` からイベントを消費します：

1.  **コンテキスト初期化**:
    * `channelId` を抽出します。
    * `ensureChatContext`（`src/core/session/context.ts` 内）を呼び出し、そのチャネルのインメモリ `ChatContext` をロードまたは作成します。
    * **アンカー**: `event.channel.id` がすべてのコンテキストの主キーです。
2.  **フィルタリング**:
    * `selfId` をチェックします。送信者が Bot 自身の場合、イベントはキューから削除され破棄されます（未読としてカウントされません）。
3.  **状態更新（「未読プール」）**:
    * イベントが `botContext.unreadEvents[channelId]` にプッシュされ、`pushToUnreadEvents` を介してデータベースに永続化されます。
    * その後、`removeFromEventQueue` を介してデータベースキューからイベントが削除されます。
4.  **ループトリガー**:
    * 直ちに `loopIterationForChannel` を呼び出し、この特定のチャネルのエージェントループを起動します。

### フェーズ 3: 推論（LLM）
**場所:** `src/core/loop/scheduler.ts` → `src/core/planner/llm-client.ts`

LLM は「このテキストに返信する」のではなく、「状態に基づいて次のアクションを決定する」ようプロンプトされます。

1.  **コンテキスト構築（`imagineAnAction`）**:
    * **システム**: `system-action-gen-v1`（ツール定義）と `personality-v1`（ペルソナ）を注入します。
    * **短期記憶**: `chatContext.messages`（最近の会話ターン）を注入します。
    * **グローバル状態（重要）**: プロンプトに明示的に *「X 件の未読イベントがあります。」* と記述し、`botContext.unreadEvents` の内容をリストします。
    * **受信注入**: 受信メッセージストリームがある場合、プロンプトの末尾に `Incoming events` ブロックとして注入されます。
    * **アクション履歴**: `chatContext.actions` を注入し、前回の試行結果を表示します（例：「前回のアクション: read_messages、結果: 成功」）。
2.  **生成**:
    * LLM が厳密にフォーマットされた JSON アクションを出力します。例：`{"action": "read_unread_messages", "channelId": "..."}`。

### フェーズ 4: ディスパッチと実行
**場所:** `src/core/dispatcher.ts` → `src/capabilities/registry.ts`

システムが JSON アクションに基づいて `globalRegistry` 内の対応するハンドラーを検索します：

* **ケース: `read_unread_messages`**（`src/capabilities/actions/read-messages.ts`）
    * **ロジック**: 指定されたチャネルの `botContext.unreadEvents` からすべてのバックログイベントを取得します。
    * **フォーマット**: テキストブロックに変換します（例：`[ユーザー]: コンテンツ`）。
    * **結果**: このテキストを `Action Result` に格納します。
    * **状態変更**: そのチャネルの `unreadEvents` をクリアします。**次のティック** で、LLM はこのテキストをアクション履歴で確認し、返信を生成します。

* **ケース: `send_message`**（`src/capabilities/actions/send-message.ts`）
    * **安全性チェック**: 再度 `unreadEvents` をチェックします。生成中に新しいメッセージが到着した場合、送信を中止して読み取りを優先する場合があります。
    * **実行**: `satoriClient.sendMessage` を呼び出します。
    * **記録**: レスポンスをデータベースとインメモリの `messages` 配列に永続化します。

### フェーズ 5: ループ継続
**場所:** `src/core/loop/scheduler.ts`（`handleLoopStep`）

* `dispatchAction` が `shouldContinue` フラグを含む `ActionResult` を返します。
* `shouldContinue` が true の場合（例：メッセージ読み取り後は通常 true、返信が期待されるため）、スケジューラは `LOOP_CONTINUE_DELAY_MS`（デフォルト 2.5 秒）を待ってから、再帰的に `handleLoopStep` を呼び出します。
* **ハードリミット**: LLM のハルシネーションや API の乱用による無限ループを防止するため、各ループは `MAX_LOOP_ITERATIONS = 5` で制限されています。この制限に達するとループが強制中断されます。
* **終了**: LLM が終端アクションを選択した場合、イテレーション制限に達した場合、または `shouldContinue` フラグが false になった場合にループが停止します。
