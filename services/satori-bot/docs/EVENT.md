### **JSON フィールドドキュメント**

`SatoriEvent` の JSON フィールドドキュメント

* **ルートレベル**

| パス | 型 | 説明 |
| --- | --- | --- |
| `self_id` | String | イベントを受信する Bot のユニーク ID（QQ 番号）。 |
| `platform` | String | プラットフォーム名（例：`onebot`）。 |
| `timestamp` | Number | イベントが作成された Unix タイムスタンプ（ミリ秒）。 |
| `type` | String | イベントの一般カテゴリ（例：`message-created`）。 |
| `subtype` | String | イベントのサブカテゴリ（例：`group`）。 |
| `subsubtype` | String | さらなる分類（例：`group`）。 |
| `id` | Integer | イベント処理用の内部シーケンス ID。 |
| `sn` | Integer | イベントのシリアルナンバー。 |

* **メッセージオブジェクト**

| パス | 型 | 説明 |
| --- | --- | --- |
| `message` | Object | 標準化されたメッセージ詳細のコンテナ。 |
| `message.message_id` | String | この特定のメッセージのユニーク識別子。 |
| `message.content` | String | メッセージのプレーンテキスト内容。 |

* **ユーザーとメンバー**

| パス | 型 | 説明 |
| --- | --- | --- |
| `user` | Object | メッセージ送信者の標準化された情報。 |
| `user.id` | String | 送信者のユニーク ID。 |
| `user.name` | String | 送信者の表示名。 |
| `user.avatar` | String | 送信者のアバター画像の URL。 |
| `member` | Object | コンテキスト固有のメンバー情報（例：グループメンバーシップ）。 |
| `member.nick` | String | この特定のグループでのユーザーのニックネーム/カード。 |
| `member.roles` | Array | ユーザーに割り当てられたロールのリスト（例：`member`）。 |

* **コンテキスト（ギルド/グループ）**

| パス | 型 | 説明 |
| --- | --- | --- |
| `guild` | Object | ギルド/グループの情報。 |
| `guild.id` | String | グループ/ギルドのユニーク ID。 |
| `channel` | Object | チャネルの情報（QQ グループではギルドと同じことが多い）。 |
| `channel.type` | Integer | チャネルタイプの分類。 |

* **Bot インスタンス（`login`）**

| パス | 型 | 説明 |
| --- | --- | --- |
| `login` | Object | このイベントを処理する Bot インスタンスの情報。 |
| `login.user` | Object | Bot 自身のユーザー詳細（名前、アバター、ID）。 |
| `login.status` | Integer | 接続ステータス（1 = オンライン）。 |
| `login.features` | Array | サポートされている API 機能のリスト（例：`message.create`）。 |
| `login.adapter` | String | 使用されているアダプタープロトコル（`onebot`）。 |

### [オプション] アダプターからの生データ

例：onebot

* **OneBot データ（`_data`）** *OneBot アダプターからの生ペイロード*

| パス | 型 | 説明 |
| --- | --- | --- |
| `_data.message_type` | String | メッセージの種類（例：`group`、`private`）。 |
| `_data.sub_type` | String | サブタイプ（例：`normal`、`anonymous`）。 |
| `_data.message_id` | Integer | 整数としてのメッセージ ID（OneBot 標準）。 |
| `_data.real_id` | Integer | プロトコルからの実際のメッセージ ID。 |
| `_data.sender` | Object | OneBot フォーマット固有の送信者詳細。 |
| `_data.sender.card` | String | 送信者のグループカード/ニックネーム。 |
| `_data.raw_message` | String | メッセージの未フォーマット生文字列。 |
| `_data.message` | Array | メッセージセグメントの配列（テキスト、画像、顔文字など）。 |
| `_data.group_id` | Integer | グループの数値 ID。 |
| `_data.group_name` | String | グループの名前。 |

* **プロトコル生データ（`_data.raw`）** *内部低レベルプロトコルデータ（NTQQ/Lagrange）*

| パス | 型 | 説明 |
| --- | --- | --- |
| `_data.raw.msgId` | String | プロトコルレベルのメッセージ ID。 |
| `_data.raw.msgSeq` | String | メッセージシーケンス番号。 |
| `_data.raw.elements` | Array | 詳細なリッチメディア要素（テキスト、顔文字、画像）。 |
| `_data.raw.senderUin` | String | 送信者のユーザー内部番号（QQ）。 |
| `_data.raw.peerUin` | String | 受信者/グループのユーザー内部番号。 |
