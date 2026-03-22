# Twitter サービスアーキテクチャドキュメント

## 1. プロジェクト概要

Twitter サービスは BrowserBase ベースの Web オートメーションサービスで、Twitter データへの構造化されたアクセスとインタラクション機能を提供します。レイヤードアーキテクチャ設計を採用し、異なるアプリケーションとの統合のために複数のアダプターをサポートしています。

## 2. 設計目標

- **信頼性**: Twitter ページの変更と制限の安定した処理
- **拡張性**: 新機能の追加と異なる統合方法のサポートが容易
- **パフォーマンス最適化**: リクエスト頻度とブラウザセッションのインテリジェントな管理
- **データ構造化**: 標準化された型付きデータモデルの提供

## 3. アーキテクチャ概要

```txt
┌─────────────────────────────────────────────┐
│          アプリケーション/コンシューマー層    │
│                                             │
│   ┌────────────┐         ┌─────────────┐    │
│   │            │         │             │    │
│   │  AIRI Core │         │ その他 LLM   │    │
│   │            │         │ アプリケーション│   │
│   │            │         │             │    │
│   └──────┬─────┘         └──────┬──────┘    │
└──────────┼─────────────────────┼────────────┘
           │                     │
┌──────────▼─────────────────────▼────────────┐
│                 アダプター層                 │
│                                             │
│   ┌────────────┐         ┌─────────────┐    │
│   │AIRI Adapter│         │ MCP Adapter │    │
│   │(@server-sdk)│        │ (HTTP/JSON) │    │
│   └──────┬─────┘         └──────┬──────┘    │
└──────────┼─────────────────────┼────────────┘
           │                     │
┌──────────▼─────────────────────▼────────────┐
│               コアサービス層                 │
│                                             │
│   ┌──────────────────────────────────┐      │
│   │          Twitter Services        │      │
│   │                                  │      │
│   │  ┌────────┐       ┌────────────┐ │      │
│   │  │ Auth   │       │ Timeline   │ │      │
│   │  │ Service│       │ Service    │ │      │
│   │  └────────┘       └────────────┘ │      │
│   │                                  │      │
│   └──────────────────┬───────────────┘      │
└──────────────────────┼──────────────────────┘
                      │
          ┌───────────▼────────────┐
          │  ブラウザアダプター層    │
          │   (BrowserAdapter)     │
          └───────────┬────────────┘
                      │
          ┌───────────▼────────────┐
          │      Stagehand         │
          └───────────┬────────────┘
                      │
          ┌───────────▼────────────┐
          │     Playwright         │
          └────────────────────────┘
```

## 4. 技術スタックと依存関係

- **コアライブラリ**: TypeScript、Node.js
- **ブラウザオートメーション**: BrowserBase Stagehand、Playwright
- **HTML パーシング**: unified、rehype-parse、unist-util-visit
- **API サーバー**: H3.js、listhen
- **アダプター**: AIRI Server SDK、MCP SDK
- **ロギングシステム**: @guiiai/logg
- **設定**: defu（ディープマージ設定）
- **ユーティリティライブラリ**: zod（型バリデーション）

## 5. 主要コンポーネント

### 5.1 アダプター層

#### 5.1.1 AIRI アダプター

AIRI LLM プラットフォームとの統合を提供し、イベント駆動型の通信を処理します。

#### 5.1.2 MCP アダプター

Model Context Protocol インターフェースを実装し、HTTP ベースの通信を提供します。現在、公式 MCP SDK 実装を使用し、H3.js を通じて高性能 HTTP サーバーと SSE 通信を提供しています。

MCP アダプターはいくつかのツールとリソースを公開します：

- **タイムラインリソース**: ユーザーのタイムラインからツイートにアクセス
- **ツイート詳細リソース**: 特定のツイートの詳細情報を取得
- **ユーザープロフィールリソース**: ユーザープロフィール情報を取得

さらに、インタラクション用のツールを提供します：

- **ログインツール**: セッション状態について明確なフィードバックを提供する簡略化された認証ツール。既存のセッションのロードを試み、セッションが正常にロードされたか、手動ログインが必要かを明確に伝えます。強化されたセッション管理システムに依存するため、ユーザー名/パスワードパラメータは不要になりました。
- **ツイート投稿ツール**: 新しいツイートの作成と公開
- **いいねツール**: ID でツイートにいいね
- **リツイートツール**: ID でツイートをリツイート
- **タイムライン更新ツール**: 最新のツイートでタイムラインを更新。件数の制御や、リプライとリツイートを含めるかどうかのオプション付き。
- **プロフィール取得ツール**: ユーザーのプロフィール情報を取得。現在の URL からユーザー名を抽出するか、特定のユーザー名をパラメータとして受け取ることができます。

アダプターは国際化されたメッセージ（中国語/英語）を使用して、ログイン状態とセッション管理について明確なフィードバックをユーザーに提供します。

#### 5.1.3 開発サーバー

listhen を使用して最適化された開発体験を提供。自動ブラウザオープン、リアルタイムロギング、デバッグツールを含みます。

### 5.2 コアサービス層

#### 5.2.1 認証サービス（Auth Service）

認証サービスは信頼性とエラーハンドリングを改善するために大幅に強化されました：

1. **改善されたセッション検出**: 既存のブラウザセッション検出のロジックを強化
2. **堅牢なエラーハンドリング**: 異なる認証失敗タイプを区別するための詳細なエラーハンドリングを実装
3. **タイムアウト最適化**: ネットワーク変動時の安定性を向上するために、各種操作のタイムアウトを調整
4. **強化された Cookie 管理**: 手動ログインの必要性を減らすために Cookie の保存とロードメカニズムを改善
5. **セッションバリデーション**: 保存されたセッションの整合性を検証するための包括的なセッションバリデーションを追加
6. **簡略化された API**: ログインメソッドでの明示的なユーザー名/パスワードの必要性を削除し、セッションファイルとブラウザセッション検出に依存

サービスは多段階認証アプローチに従います：

1. **セッションファイルのロード**: まずディスクから保存されたセッションのロードを試行
2. **既存セッションの検出**: ブラウザに有効な Twitter セッションがあるかを確認
3. **手動ログインプロセス**: 必要に応じて、Twitter ログインページをガイド

いずれかの方法で認証に成功した後、セッションは将来の使用のために自動的に永続化されます。システムは現在のログイン状態についてユーザーに明確なフィードバックを提供し、変更が検出された場合にセッションを自動的に監視・保存します。

#### 5.2.2 タイムラインサービス（Timeline Service）

Twitter タイムラインのコンテンツを取得・処理します。

#### 5.2.3 その他のサービス

検索サービス、インタラクションサービス、ユーザープロフィールサービスなどを含みます。（MVP では未実装）

### 5.3 パーサーとツール

#### 5.3.1 ツイートパーサー

HTML から構造化データを抽出します。

#### 5.3.2 レートリミッター

Twitter の制限トリガーを回避するためにリクエスト頻度を制御します。

#### 5.3.3 セッションマネージャー

認証セッションデータを管理し、以下のメソッドを提供します：

- セッション Cookie をローカルファイルに保存
- 起動時に以前のセッションをロード
- 無効または期限切れのセッションを削除
- セッションの有効期間と整合性を検証

### 5.3.4 ブラウザアダプター層

サービスは直接の BrowserBase API 使用から、Playwright 上に構築された AI 搭載 Web ブラウジングフレームワークである Stagehand に移行しました。Stagehand はブラウザ自動化を簡素化する 3 つのコア API を提供します：

- **act**: 自然言語の指示でページ上のアクションを実行
- **extract**: 自然言語クエリでページから構造化データを取得
- **observe**: ページを分析し、実行前に可能なアクションを提案

Stagehand は DOM をチャンクで処理して LLM パフォーマンスを最適化し、複雑なページ構造のためのフォールバックビジョン機能を提供します。この移行により、Twitter のインターフェースとのインタラクション時のコードの保守性と自動化の信頼性が大幅に向上しました。

## 6. データフロー

1. **リクエストフロー**: アプリケーション層 → アダプター → コアサービス → ブラウザアダプター層 → BrowserBase API → Twitter
2. **レスポンスフロー**: Twitter → BrowserBase API → ブラウザアダプター層 → コアサービス → データパーシング → アダプター → アプリケーション層
3. **認証フロー**:
   - セッションロード → 既存セッション確認 → 手動ログイン → セッションバリデーション → セッションストレージ
   - 認証プロセスの各ステップで明確なフィードバックが提供されます

## 7. 設定システム

設定システムは `defu` ライブラリを使用してディープマージ設定を行うように最適化され、冗長な初期化を排除しました。更新された設定構造には Stagehand 固有の設定が含まれます：

```typescript
interface Config {
  // BrowserBase/Stagehand 設定
  browserbase: {
    apiKey: string
    projectId?: string
    endpoint?: string
    stagehand?: {
      modelName?: string // 例："gpt-4o" または "claude-3-5-sonnet-latest"
      modelClientOptions?: {
        apiKey: string // OpenAI または Anthropic API キー
      }
    }
  }

  // ブラウザ設定
  browser: BrowserConfig

  // Twitter 設定
  twitter: {
    credentials?: TwitterCredentials
    defaultOptions?: {
      timeline?: TimelineOptions
      search?: SearchOptions
    }
  }

  // アダプター設定
  adapters: {
    airi?: {
      url?: string
      token?: string
      enabled: boolean
    }
    mcp?: {
      port?: number
      enabled: boolean
    }
  }

  // システム設定
  system: {
    logLevel: string
    concurrency: number
  }
}
```

システムは `TWITTER_COOKIES` 環境変数に依存しなくなりました。Cookie はセッション管理システムを通じて管理されます。

## 8. 開発とテスト

### 8.1 開発環境セットアップ

```bash
# 依存関係のインストール
npm install

# 環境変数の設定
cp .env.example .env
# .env を編集して BrowserBase API キーと Twitter 認証情報を追加（オプション）

# 開発モード起動
npm run dev        # 標準モード
npm run dev:mcp    # MCP 開発サーバーモード
```

### 8.2 テスト戦略

- **ユニットテスト**: パーサー、ユーティリティクラス、ビジネスロジックのテスト
- **統合テスト**: サービスとアダプターのインタラクションテスト
- **E2E テスト**: 完全な使用シナリオのシミュレーション

## 9. 統合例

### 9.1 Stagehand との統合例

```typescript
import { StagehandAdapter, TwitterService } from 'twitter-services'

async function main() {
  // Stagehand アダプターの初期化
  const browser = new StagehandAdapter(process.env.BROWSERBASE_API_KEY, process.env.BROWSERBASE_PROJECT_ID)
  await browser.initialize({
    headless: true,
    stagehand: {
      modelName: 'gpt-4o', // または Anthropic の場合 'claude-3-5-sonnet-latest'
      modelClientOptions: {
        apiKey: process.env.OPENAI_API_KEY // または process.env.ANTHROPIC_API_KEY
      }
    }
  })

  // Twitter サービスの作成
  const twitter = new TwitterService(browser)

  // 認証 - 多段階アプローチを試行
  const loggedIn = await twitter.login()

  if (loggedIn) {
    console.info('ログイン成功')

    // Stagehand の自然言語機能を使用してタイムラインを取得
    const tweets = await twitter.getTimeline({ count: 10 })
    console.info(tweets)
  }
  else {
    console.error('ログイン失敗')
  }

  // リソースの解放
  await browser.close()
}
```

### 9.2 AIRI モジュールとしての統合

```typescript
import { AIRIAdapter, BrowserBaseMCPAdapter, TwitterService } from 'twitter-services'

async function startAIRIModule() {
  const browser = new BrowserBaseMCPAdapter(process.env.BROWSERBASE_API_KEY)
  await browser.initialize({ headless: true })

  const twitter = new TwitterService(browser)

  // AIRI アダプターの作成
  const airiAdapter = new AIRIAdapter(twitter, {
    url: process.env.AIRI_URL,
    token: process.env.AIRI_TOKEN
  })

  // アダプターの起動
  await airiAdapter.start()

  console.info('Twitter サービスが AIRI モジュールとして稼働中')
}
```

### 9.3 MCP を使用した統合

```typescript
// MCP SDK を使用して Twitter サービスとインタラクション
import { Client } from '@modelcontextprotocol/sdk/client/index.js'
import { SSEClientTransport } from '@modelcontextprotocol/sdk/client/sse.js'

async function connectToTwitterService() {
  // SSE トランスポートの作成
  const transport = new SSEClientTransport('http://localhost:8080/sse', 'http://localhost:8080/messages')

  // クライアントの作成
  const client = new Client()
  await client.connect(transport)

  // タイムラインの取得
  const timeline = await client.get('twitter://timeline/10')
  console.info('タイムライン:', timeline.contents)

  // パラメータなしの簡略化ログインツールを使用
  const loginResult = await client.useTool('login', {})
  console.info('ログイン結果:', loginResult.content[0].text)

  // タイムライン更新ツールで最新のツイートを取得
  const refreshResult = await client.useTool('refresh-timeline', { count: 15, includeReplies: false })
  console.info('更新結果:', refreshResult.content[0].text)
  console.info('新着ツイート:', refreshResult.resources)

  // ユーザープロフィール情報を取得
  const profileResult = await client.useTool('get-my-profile', { username: 'twitter' })
  console.info('プロフィール情報:', profileResult.content[0].text)

  // ツールを使用してツイートを送信
  const result = await client.useTool('post-tweet', { content: 'Hello from MCP!' })
  console.info('結果:', result.content)

  return client
}
```

## 10. 拡張ガイド

### 10.1 新機能の追加

例えば、「特定のユーザーからのツイートを取得する」機能を追加する場合：

1. `src/types/twitter.ts` にインターフェースを拡張
2. `src/core/twitter-service.ts` にメソッドを実装
3. アダプターに対応するハンドリングロジックを追加
4. MCP アダプターの場合、`configureServer()` に適切なリソースまたはツールを追加

### 10.2 新しいアダプターのサポート

1. 新しいアダプタークラスを作成
2. ターゲットシステムとの通信ロジックを実装
3. エントリファイルに設定サポートを追加

## 11. メンテナンス推奨事項

- **自動テスト**: ユニットテストと統合テストを記述
- **監視とアラート**: サービスステータスと Twitter アクセス制限を監視
- **セレクター更新**: セレクター設定を定期的に検証・更新
- **セッション管理**: 組み込みのセッション管理システムを使用して安定性を向上し、手動ログイン要件を削減。セッションのローテーションとバリデーションの実装を検討。
- **Cookie 管理**: システムは SessionManager を通じて Cookie ストレージを自動管理しますが、本番環境では暗号化ストレージの追加を検討してください。
- **ユーザーフィードバック**: 認証状態に関する明確で国際化されたフィードバックメッセージを維持し、ユーザー体験を向上。

### 11.4 Stagehand メンテナンス

- **モデル選択**: 特定のユースケースに対して異なる LLM モデル（GPT-4o、Claude 3.5 Sonnet）のパフォーマンスを定期的に評価
- **プロンプトエンジニアリング**: 信頼性とパフォーマンスを向上するために自然言語の指示を改良
- **ビジョン機能**: 複雑な DOM 構造に対して、適切な操作で `useVision: true` を設定してビジョン機能の有効化を検討
- **DOM チャンキング**: Twitter インターフェースの複雑さに基づいてチャンクサイズを監視・最適化

## 12. プロジェクトロードマップ

- MVP 段階: Stagehand 統合を伴うコア機能（認証、タイムライン閲覧）
- 第二段階: Stagehand の自然言語機能を活用した強化されたインタラクション機能
- 第三段階: 最適化された LLM プロンプトによる高度な検索とフィルタリング機能
- 第四段階: パフォーマンス最適化とマルチモデルサポート
