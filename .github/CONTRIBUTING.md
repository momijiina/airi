# [Project AIRI](https://github.com/moeru-ai/airi) へのコントリビューションを始めよう

こんにちは！このプロジェクトへのコントリビューションに興味を持っていただきありがとうございます。このガイドが始めるお手伝いをします。

## 前提条件

- [Git](https://git-scm.com/downloads)
- [Node.js 23+](https://nodejs.org/en/download/)
- [corepack](https://github.com/nodejs/corepack)
- [pnpm](https://pnpm.io/installation)

<details>
<summary>Windows セットアップ</summary>

0. [Visual Studio](https://visualstudio.microsoft.com/downloads/) をダウンロードし、こちらの手順に従ってください：https://rust-lang.github.io/rustup/installation/windows-msvc.html#walkthrough-installing-visual-studio-2022

   > Visual Studio のインストール時に Windows SDK と C++ ビルドツールを必ずインストールしてください。

1. PowerShell を開く
2. [`scoop`](https://scoop.sh/) をインストール

   ```powershell
   Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope CurrentUser
   Invoke-RestMethod -Uri https://get.scoop.sh | Invoke-Expression
   ```

3. `scoop` で `git`、Node.js、`rustup`、`msvc` をインストール

   ```powershell
   scoop install git nodejs rustup

   # Rust の依存関係用
   # crates または apps/tamagotchi の開発をしない場合は不要
   scoop install main/rust-msvc
   # Rust & Windows 固有
   rustup toolchain install stable-x86_64-pc-windows-msvc
   rustup default stable-x86_64-pc-windows-msvc
   ```

   > https://stackoverflow.com/a/64121601

4. `corepack` で `pnpm` をインストール

   ```powershell
   corepack enable
   corepack prepare pnpm@latest --activate
   ```

</details>

<details>
<summary>macOS セットアップ</summary>

0. Terminal（または iTerm2、Ghostty、Kitty など）を開く
1. `brew` で `git`、`node` をインストール

   ```shell
   brew install git node
   ```

2. `corepack` で `pnpm` をインストール

   ```shell
   corepack enable
   corepack prepare pnpm@latest --activate
   ```

</details>

<details>
<summary>Linux セットアップ</summary>

0. ターミナルを開く
1. [nodesource/distributions: NodeSource Node.js Binary Distributions](https://github.com/nodesource/distributions?tab=readme-ov-file#table-of-contents) に従って `node` をインストール
2. [Git](https://git-scm.com/downloads/linux) に従って `git` をインストール
3. `corepack` で `pnpm` をインストール

   ```shell
   corepack enable
   corepack prepare pnpm@latest --activate
   ```

4. デスクトップ版の開発を手伝いたい場合、以下の依存関係が必要です：

   ```shell
   sudo apt install \
      libssl-dev \
      libglib2.0-dev \
      libgtk-3-dev \
      libjavascriptcoregtk-4.1-dev \
      libwebkit2gtk-4.1-dev
   ```

</details>

## 以前にこのプロジェクトにコントリビューションしたことがある場合

> [!WARNING]
>
> このリポジトリをクローンしていない場合は、このセクションをスキップしてください。

ローカルリポジトリがアップストリームリポジトリと最新であることを確認してください：

```shell
git fetch --all
git checkout main
git pull upstream main --rebase
```

作業ブランチがある場合、ブランチをアップストリームリポジトリと最新にするには：

```shell
git checkout <your-branch-name>
git rebase main
```

## このプロジェクトをフォーク

[moeru-ai/airi](https://github.com/moeru-ai/airi) ページの右上にある **Fork** ボタンをクリックしてください。

## クローン

```shell
git clone https://github.com/<your-github-username>/airi.git
cd airi
```

## 作業ブランチの作成

```shell
git checkout -b <your-branch-name>
```

## 依存関係のインストール

```shell
corepack enable
pnpm install

# Rust の依存関係用
# crates または apps/tamagotchi の開発をしない場合は不要
cargo fetch
```

> [!NOTE]
>
> スクリプトを簡潔にするために [@antfu/ni](https://github.com/antfu-collective/ni) のインストールをおすすめします。
>
> ```shell
> corepack enable
> npm i -g @antfu/ni
> ```
>
> インストール後は：
>
> - `ni` を `pnpm install`、`npm install`、`yarn install` の代わりに使えます。
> - `nr` を `pnpm run`、`npm run`、`yarn run` の代わりに使えます。
>
> パッケージマネージャーを気にする必要はなく、`ni` が適切なものを選んでくれます。

## 開発するアプリケーションを選択

### Stage Tamagotchi（デスクトップ版）

```shell
pnpm dev:tamagotchi
```

> [!NOTE]
>
> [@antfu/ni](https://github.com/antfu-collective/ni) ユーザーの場合：
>
> ```shell
> nr dev:tamagotchi
> ```

### Stage Web（[airi.moeru.ai](https://airi.moeru.ai) のブラウザ版）

```shell
pnpm dev
```

> [!NOTE]
>
> [@antfu/ni](https://github.com/antfu-collective/ni) ユーザーの場合：
>
> ```shell
> nr dev
> ```

### UI ストーリーボード

ライブ UI コンポーネントストーリーボードを [airi.moeru.ai/ui](https://airi.moeru.ai/ui/) で閲覧できます。

### ドキュメントサイト

```shell
pnpm dev:docs
```

> [!NOTE]
>
> [@antfu/ni](https://github.com/antfu-collective/ni) ユーザーの場合：
>
> ```shell
> nr dev:docs
> ```

### Telegram Bot 連携

Postgres データベースが必要です。

```shell
cd services/telegram-bot
docker compose up -d
```

`.env` を設定

```shell
cp .env .env.local
```

`.env.local` の認証情報を編集してください。

データベースのマイグレーション

```shell
pnpm -F @proj-airi/telegram-bot db:generate
pnpm -F @proj-airi/telegram-bot db:push
```

Bot を実行

```shell
pnpm -F @proj-airi/telegram-bot start
```

> [!NOTE]
>
> [@antfu/ni](https://github.com/antfu-collective/ni) ユーザーの場合：
>
> ```shell
> nr -F @proj-airi/telegram-bot dev
> ```

### Discord Bot 連携

```shell
cd services/discord-bot
```

`.env` を設定

```shell
cp .env .env.local
```

`.env.local` の認証情報を編集してください。

Bot を実行

```shell
pnpm -F @proj-airi/discord-bot start
```

> [!NOTE]
>
> [@antfu/ni](https://github.com/antfu-collective/ni) ユーザーの場合：
>
> ```shell
> nr -F @proj-airi/discord-bot dev
> ```

### Minecraft エージェント

```shell
cd services/minecraft
```

Minecraft クライアントを起動し、希望するポートでワールドをエクスポートして、`.env.local` にポート番号を記入してください。

`.env` を設定

```shell
cp .env .env.local
```

`.env.local` の認証情報を編集してください。

Bot を実行

```shell
pnpm -F @proj-airi/minecraft-bot start
```

> [!NOTE]
>
> [@antfu/ni](https://github.com/antfu-collective/ni) ユーザーの場合：
>
> ```shell
> nr -F @proj-airi/minecraft-bot dev
> ```

## コミット

### コミット前

lint（静的チェッカー）と TypeScript コンパイラが満足していることを確認してください：

```shell
pnpm lint && pnpm typecheck
```

画像をコミットする場合は、PNG、JPG などの代わりに AVIF フォーマットの使用を検討してください。既存の画像を AVIF に変換するには：

```shell
pnpm to-avif <画像またはディレクトリのパス1> <パス2> <パス3> ...
```

> [!NOTE]
>
> [@antfu/ni](https://github.com/antfu-collective/ni) がインストールされている場合、`nr` でコマンドを実行できます：
>
> ```shell
> nr lint && nr typecheck
> ```

### コミット

```shell
git add .
git commit -m "<コミットメッセージ>"
```

### フォークリポジトリにプッシュ

```shell
git push origin <your-branch-name> -u
```

フォークリポジトリでブランチを確認できるはずです。

> [!NOTE]
>
> このプロジェクトに初めてコントリビューションする場合は、アップストリームリポジトリも追加する必要があります：
>
> ```shell
> git remote add upstream https://github.com/moeru-ai/airi.git
> ```

## プルリクエストの作成

[moeru-ai/airi](https://github.com/moeru-ai/airi) ページに移動し、**Pull requests** タブをクリックし、**New pull request** ボタンをクリックし、**Compare across forks** リンクをクリックして、フォークリポジトリを選択してください。

変更を確認し、**Create pull request** ボタンをクリックしてください。

## やったー！完了です！

おめでとうございます！このプロジェクトへの最初のコントリビューションが完了しました。メンテナーがプルリクエストをレビューするのをお待ちください。
