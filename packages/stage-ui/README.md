# Stage UI

ステージの共有コア

## Histoire（UIストーリーボード）

https://histoire.dev/

```shell
pnpm -F @proj-airi/stage-ui run story:dev
```

### プロジェクト構成

1. ストーリーが特定のコンポーネントに紐づく場合、`src` フォルダ内のコンポーネントの横に配置します。例: `MyComponent.story.vue`
2. ストーリーが特定のコンポーネントに紐づかない場合、`stories` フォルダに配置します。例: `MyStory.story.vue`
