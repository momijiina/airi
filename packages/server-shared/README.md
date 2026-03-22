# @proj-airi/server-shared

Project AIRIの全サーバーサイドパッケージ用の共有型定義。

## 使い方

```shell
ni @proj-airi/server-shared -D # @antfu/ni から。`npm i -g @antfu/ni` でインストール可能
pnpm i @proj-airi/server-shared -D
yarn i @proj-airi/server-shared -D
npm i @proj-airi/server-shared -D
```

```typescript
import type { WebSocketEvents } from '@proj-airi/server-shared'
```

## 分散ユースケースでのイベント使用方法

### シナリオ

#### Minecraftエージェント

##### 1. 緊急戦闘（ウィッチの襲撃）

- Minecraftが `spark:notify`（kind=alarm, urgency=immediate, payload: HP/位置/装備, destinations=["character"]）を送信。
- キャラクターが `spark:emit` working（"確認した"）。
- キャラクターが interrupt=force と選択肢（撤退 vs 突撃）付きの `spark:command` を発行。
- Minecraftが `spark:emit` working（"柱を立てて回復中"）、その後実行に応じてdone/blocked。
- オプションで `context:update` による要約/メモリ。

##### 2. 準備計画（エンダードラゴン）

- Discord/ユーザーの意図がキャラクターの `spark:command` をMinecraftにトリガー（intent=plan, interrupt=soft, ステップ: ベッド/ポーション/装備収集, フォールバック）。
- オプションで `context:update`（lane='game'）でヒント。
- Minecraftが `spark:emit` で進捗をストリーミング。
- 待ち伏せに遭った場合、Minecraftが新しい `spark:notify`（alarm/immediate）を発行して割り込み。
- キャラクターが別の `spark:command` で修正。
- `spark:emit` done + 要約ノートで完了。

##### 3. 日常的なリマインダー

- Minecraftが食料不足を `spark:notify`（kind=reminder, urgency=soon, destinations=["character"]）で通知。
- キャラクターが次のティックに延期し、`spark:command`（interrupt=soft, intent=plan: "近くで食料を集める"）を送信。
- Minecraftが `spark:emit` queued/working の後 done。

##### 4. リサーチ中の複数ステップコマンド（計画 + ライブ制御）

> [!NOTE]
> `intent=plan` を使うことで、コーディングエージェントのTODOスキャフォールディングと同様に、アイデアが未確定でもループを継続できます。

- キャラクターがユーザー目標（例: 拠点強化）を受け取り、最初の `spark:command` をMinecraftに発行（interrupt=soft, intent=plan, ステップ: 素材収集）。
- キャラクターが同時にゲームループ外でメモリ/検索/設計タスクを実行（wiki検索、過去のノート）。
- 知見が得られたら、キャラクターが `context:update`（lane='game', ヒント/アイデア）でサブエージェントを強化。
- 準備中に緊急イベントが発生した場合、Minecraftが `spark:notify`（alarm）を発行 → キャラクターが `spark:emit` working と `spark:command`（interrupt=force）で対応。
- 設計が完了したら、キャラクターが洗練された `spark:command`（`intent=proposal`（または`action`）、`interrupt=soft`）を構造化されたオプション/ステップ/フォールバック付きで送信。
- Minecraftが `spark:emit` で進捗をストリーミング。完了時、キャラクターが `spark:emit` または `context:update` でメモリに要約。

## ライセンス

[MIT](../../LICENSE)
