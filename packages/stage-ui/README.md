# Stage UI

ステージの共有コア — コンポーネント、ストア、コンポーザブル、AIツールを提供するパッケージ。

## 主な機能

### AIツール (`src/tools/`)

LLMがチャットから呼び出せるツール群。`@xsai/tool` で定義。

| ツール | ファイル | 説明 |
|--------|----------|------|
| `debug` | `debug.ts` | デバッグ用（乱数生成） |
| `mcp` | `mcp.ts` | MCP プロトコル連携 |
| `timer` | `timer.ts` | タイマー・アラーム設定（`set_timer`, `set_alarm`, `cancel_timer`, `stop_alarm`, `list_timers`） |
| `calendar` | `calendar.ts` | カレンダー操作（`open_calendar`, `add_calendar_event`, `list_calendar_events`, `remove_calendar_event`） |
| `webSearch` | `web-search.ts` | Web検索・ブラウジング |

> **注意**: `tool()` は `Promise<Tool>` を返すため、エクスポート関数では必ず `Promise.all([...])` で解決すること。

### カレンダー (`src/stores/calendar.ts`, `src/components/scenarios/calendar/`)

- **ストア**: `useCalendarStore` — イベントCRUD、繰り返し予定（daily/weekly/monthly）、localStorage永続化
- **コンポーネント**:
  - `CalendarDialog` — レスポンシブダイアログ（デスクトップ: reka-ui / モバイル: vaul-vue）
  - `CalendarContent` — 月表示グリッド + イベント一覧
  - `AddEventDialog` — イベント追加モーダル（オーナー選択、時間、繰り返し設定）
- **スケジューラ**: `useCalendarScheduler` (`src/composables/calendar-scheduler.ts`) — 60秒間隔でAiriの予定をチェックし、`ingest()` でAIに実行させる

### タイマー・アラーム (`src/tools/timer.ts`)

- 30秒間隔で繰り返し鳴動、停止ボタン付きバナー
- Web Audio API ビープ + ブラウザ Notification
- チャットへの通知メッセージ自動追加

## Histoire（UIストーリーボード）

https://histoire.dev/

```shell
pnpm -F @proj-airi/stage-ui run story:dev
```

### プロジェクト構成

1. ストーリーが特定のコンポーネントに紐づく場合、`src` フォルダ内のコンポーネントの横に配置します。例: `MyComponent.story.vue`
2. ストーリーが特定のコンポーネントに紐づかない場合、`stories` フォルダに配置します。例: `MyStory.story.vue`
