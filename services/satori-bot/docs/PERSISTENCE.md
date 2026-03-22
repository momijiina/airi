## **アーキテクチャ状況報告：メモリと永続化**

**日付:** 2026年3月6日（リファクタリング済み）
**コンポーネント:** 状態管理層（Drizzle + PGlite）

### **1. メモリアーキテクチャ（RAM）**

Bot はアクティブなチャットセッションに対して **メモリファースト** 戦略を採用し、重要なキューとメッセージデータはディスクに永続化します。

* **ストレージメカニズム**: アクティブなチャットコンテキストは `BotContext` オブジェクト（`src/core/types.ts`）内のネイティブ `Map<string, ChatContext>` に格納されます。
* **ライフサイクル管理**:
    * **作成**: コンテキストはメッセージ受信時に `src/core/session/context.ts` の `ensureChatContext` を介して遅延ロードされます。
    * **保持**: 現在、コンテキストはプロセス終了までメモリに保持されます。履歴はループ中にトリミングされます。
* **コンテキストトリミング**:
    * `src/core/loop/scheduler.ts` の `handleLoopStep` 内で実行されます。
    * 個々のチャネルは厳格な制限を適用します：`MAX_ACTIONS_IN_CONTEXT = 50`、`ACTIONS_KEEP_ON_TRIM = 20`。
    * メッセージ履歴はデータベースから動的に取得され（直近 10 メッセージ）、LLM コンテキストを軽量に保ちます。

### **2. 永続化アーキテクチャ（データベース）**

Bot は `lowdb`（JSON）から **PGlite**（WASM/Node での PostgreSQL）+ **Drizzle ORM** に移行し、堅牢な状態管理と高性能 I/O を実現しています。

* **技術**: [PGlite](https://pglite.dev/) + [Drizzle ORM](https://orm.drizzle.team/)。
* **場所**: `data/` ディレクトリ（`.env.local` の `DB_PATH` で設定）。
* **スキーマ（`src/lib/schema.ts`）**:
    * `channels`: 検出されたチャネルのメタデータ（ID、名前、プラットフォーム、self_id）。
    * `messages`: `channel_id` と `timestamp` にインデックスが設定された永続メッセージログ。
    * `event_queue`: 処理待ちの受信 Satori イベントの永続キュー。
    * `unread_events`: 各チャネルの未読イベントの永続ストア。
* **最適化された I/O 戦略**:
    * **インクリメンタル更新**: 以前の「全書き換え」アプローチとは異なり、Bot はターゲットを絞った SQL 操作を使用します。
    * **キュー管理**: 個々のアイテムが ID によって追加（`pushToEventQueue`）および削除（`removeFromEventQueue`）されます。
    * **未読追跡**: 未読メッセージはインクリメンタルに永続化（`pushToUnreadEvents`）され、チャネルごとにクリア（`clearUnreadEventsForChannel`）されます。
* **マイグレーション**: `drizzle-kit` で管理されます。マイグレーションは `src/lib/db.ts` で起動時に自動適用されます。

### **3. 状態の一貫性とリカバリ**

一時的なメモリと永続ディスク状態のギャップは大幅に縮小されました。

* **耐久性のあるキュー**: `eventQueue` と `unreadEvents` は完全に永続化されています。Bot がクラッシュした場合、中断した場所からキューの処理を再開します。
* **メッセージ履歴**: LLM の会話履歴はデータベースのインデックス付き `messages` テーブルから再構築され、再起動後の継続性を保証します。
* **ハードリセット軽減**: `AbortController` ハンドルは再起動時に失われますが、コアタスクキューと会話コンテキストは保持されます。

### **4. 設定**

データベース設定は `src/config.ts` で管理されます：
* `DB_PATH`: PGlite データディレクトリへのパス（デフォルト: `data/pglite-db`）。
