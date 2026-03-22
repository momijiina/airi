# @proj-airi/ui

[Reka UI](https://reka-ui.com/) と [UnoCSS](https://unocss.dev/) で構築されたスタイリッシュなUIコンポーネントライブラリ。

コンポーネントのプレビューについては、[`stage-ui`](../stage-ui) パッケージのHistoire UIストーリーボードの実行手順を参照してください。

## はじめかた

ライブラリのインストール:

```shell
ni @proj-airi/ui -D # @antfu/ni から。`npm i -g @antfu/ni` でインストール可能
pnpm i @proj-airi/ui -D
yarn i @proj-airi/ui -D
npm i @proj-airi/ui -D
```

このライブラリは Attributify Mode とスタイルリセット付きの `unocss` が必要です。

まず、`unocss` が未インストールの場合はインストール:

```shell
pnpm i -D unocss
```

次に、`uno.config.ts` の presets 配列に `presetAttributify()` を追加:
```ts
import { defineConfig, presetAttributify } from 'unocss'

export default defineConfig({
  presets: [
    presetAttributify(),
    // ...その他のpreset
  ],
})
```

最後に、`main.ts` でリセットスタイルをインポート:
```ts
import '@unocss/reset/tailwind.css'
```

## 使い方

```vue
<script setup lang="ts">
import { Button } from '@proj-airi/ui'
</script>

<template>
  <Button>クリック</Button>
</template>
```

## コンポーネント

* [Animations](src/components/Animations)
    * [TransitionVertical](src/components/Animations/TransitionVertical.vue)
* [Form](src/components/Form)
    * [Checkbox](src/components/Form/Checkbox)
    * [Field](src/components/Form/Field)
    * [Input](src/components/Form/Input)
    * [Radio](src/components/Form/Radio)
    * [Range](src/components/Form/Range)
    * [Select](src/components/Form/Select)
    * [Textarea](src/components/Form/Textarea)

## ライセンス

[MIT](../../LICENSE)
