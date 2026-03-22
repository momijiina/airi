# @proj-airi/electron-vueuse

AIRI Electronアプリ全体で共有するVueUseライクなコンポーザブルとヘルパー。

## 提供機能

- 一般的なElectron動作用のレンダラーコンポーザブル（`mouse`、`window bounds`、`auto updater` など）
- 再利用可能なEventaコンテキスト/呼び出しパターン（`useElectronEventaContext`、`useElectronEventaInvoke`）
- レンダラーコード用のEventaコンテキスト/呼び出しエルゴノミクス
- メインプロセスループユーティリティ（`useLoop`、`createRendererLoop`）

IPCコントラクト定義には `@proj-airi/electron-eventa` を使用してください。

## 使い方

```ts
import { electron } from '@proj-airi/electron-eventa'
import { useElectronEventaInvoke } from '@proj-airi/electron-vueuse'

const openSettings = useElectronEventaInvoke(electron.window.getBounds)
```

```ts
import { createRendererLoop } from '@proj-airi/electron-vueuse/main'
```
