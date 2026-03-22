# @proj-airi/plugin-protocol

Project AIRIにおけるプラグイン-モジュール間通信の共有プロトコルコントラクト。

## 機能

- モジュール/プラグインオーケストレーション用のWebSocketイベント名とペイロード型を定義。
- プロトコルイベント名にバインドされたEventaイベント定義を提供。
- サーバーとプラグインランタイムで使用する共有トランスポート/イベントユーティリティ型を提供。

## 使い方

```ts
import type { WebSocketEvent, WebSocketEventOf, WebSocketEvents } from '@proj-airi/plugin-protocol/types'

import { moduleAnnounce, moduleAuthenticate } from '@proj-airi/plugin-protocol/types'
```

## 使用すべきとき

- プラグイン <-> ホスト通信の標準プロトコルコントラクトが必要な場合。
- 複数ランタイム間でイベント名の安定性とペイロード定義の一致が必要な場合。

## 使用すべきでないとき

- SDKパッケージの高レベルランタイムクライアントAPIだけが必要な場合。
- プラグイン/サーバートランスポートコントラクトに含まれないアプリ専用UI状態を実装する場合。

## ライセンス

[MIT](../../LICENSE)
