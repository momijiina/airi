# AIRI Satori Bot

> **⚠️ 免責事項**: これは **AIRI** のサブモジュールです。この Satori Bot の `core` 部分は単なる **暫定的な実装** です。メインフレームワークが安定したら、最終的にこれを削除し、**AIRI の Core** に統合する予定です。

**スタンドアロン型**、イベント駆動の AI エージェントで、[Satori プロトコル](https://satori.chat/) 上に構築されています。Koishi ブリッジを介して複数のチャットプラットフォーム（QQ、Telegram、Discord、Lark）に接続し、自律的な思考ループを備えています。

## 🏗 アーキテクチャと内部構造（暫定）

**重要**: このモジュールは現在、独立して動作するための自己完結型「ミニコア」（`src/core/`）を実装しています。これは AIRI の **最終的なアーキテクチャではありません**。

* **暫定的なロジック**: `src/core/` にあるイベントループ、スケジューラ、プランナーのロジックはプレースホルダーです。将来の AIRI Core の動作をシミュレートしています。
* **保持されるコンポーネント**: **Dispatcher** と **Database** は保持されます。これらは AIRI Core に対して **ツールライクなモジュール** として公開され、アクション実行と状態永続化に使用されます。
* **将来の移行**: メインの AIRI Core が準備できたら、`src/core/` ディレクトリ（特にループ/プランニングロジック）は削除されます。このモジュールは **アダプター**（Satori プロトコル処理）と **ケイパビリティプロバイダー**（アクション）として厳密にリファクタリングされ、認知ループはメインの AIRI プロセスに委譲されます。

現在のスタンドアロン版については、以下のドキュメントを参照してください：

* **[HANDLER.md](./docs/HANDLER.md)**: **現在の** イベントからアクションへのフロー（キュー → スケジューラ → LLM）を説明しています。
* **[PERSISTENCE.md](./docs/PERSISTENCE.md)**: この暫定コアに固有の **現在の** メモリファースト状態管理戦略の詳細です。

**主要なコードパス：**
* **ループとロジック（暫定）**: `src/core/`
* **アダプター（永続）**: `src/adapter/satori/`
* **ケイパビリティ（永続）**: `src/capabilities/`

## 前提条件

* **Node.js** >= 18.0.0
* **pnpm** >= 8.0.0
* **Koishi インスタンス**: `server-satori` プラグインが動作していること。
* **LLM プロバイダー**: OpenAI 互換 API（Ollama、vLLM、DeepSeek など）。

## クイックスタート

1. **依存関係のインストール**
```bash
pnpm install
```

2. **環境設定**
設定例をコピーして編集します：

```bash
cp .env .env.local
```

**主要な変数：**

```env
# Satori 設定
SATORI_WS_URL=ws://localhost:5140/satori/v1/events
SATORI_API_BASE_URL=http://localhost:5140/satori/v1
SATORI_TOKEN= # オプション：Koishi で認証が無効の場合は空のまま

# LLM（OpenAI 互換）
LLM_API_KEY=your_api_key_here
LLM_API_BASE_URL=https://api.openai.com/v1
LLM_MODEL=gpt-4
LLM_RESPONSE_LANGUAGE=English
LLM_OLLAMA_DISABLE_THINK=false
```

3. **実行**

```bash
# 開発（ホットリロード）
pnpm --filter @proj-airi/satori-bot dev

# プロダクション
pnpm --filter @proj-airi/satori-bot start
```

## 主要な場所

* **ペルソナとシステムプロンプト**: `src/core/planner/prompts/*.velin.md`
* **データベース（PGlite）**: `data/pglite-db`（アーキテクチャについては *PERSISTENCE.md* を参照）
* **アクションロジック**: `src/capabilities/actions/`
