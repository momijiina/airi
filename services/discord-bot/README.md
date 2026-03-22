# `discord-bot`

アイリがDiscordのボイスチャンネルであなたや他のユーザーと会話できるようにします。

## はじめかた

```shell
git clone git@github.com:moeru-ai/airi.git
pnpm i
```

[Discord Developer Portal](https://discord.com/developers/home) で新しいアプリケーションを作成します。これがサーバーに追加するBotになります。

**"Bot"** タブで "Privileged Gateway Intents" セクションを見つけ、以下のintentを有効にします:

- **"Server Members Intent"**
- **"Message Content Intent"**

"Privileged Gateway Intents" セクションの上に "Token" セクションがあります。
新しく作成したBotの場合、"Reset Token" をクリックして新しいトークンを生成し、後で使うためにコピーしてください。

> [!NOTE]
> トークンを忘れたり紛失した場合、"Reset Token" をクリックすればいつでも新しいトークンを生成できますが、
> `.env.local` ファイルのトークンも更新することを忘れないでください。

`.env.local` ファイルを作成:

```shell
cd services/discord-bot
cp .env .env.local
```

以下の認証情報を設定として入力:

```shell
DISCORD_TOKEN=''
DISCORD_BOT_CLIENT_ID=''

OPENAI_MODEL=''
OPENAI_API_KEY=''
OPENAI_API_BASE_URL=''

ELEVENLABS_API_KEY=''
ELEVENLABS_API_BASE_URL=''
```

```shell
pnpm run -F @proj-airi/discord-bot start
```

## 類似プロジェクト

- [pladisdev/Discord-AI-With-STT](https://github.com/pladisdev/Discord-AI-With-STT)

## 謝辞

- 音声処理の実装 https://github.com/TheTrueSCP/CharacterAIVoice/blob/54d6a41b4e0eba9ad996c5f9ddcc6230277af2f8/src/VoiceHandler.js
- 使用例 https://github.com/discordjs/voice-examples/blob/da0c3b419107d41053501a4dddf3826ad53c03f7/radio-bot/src/bot.ts
- 優れたライブラリ https://github.com/discordjs/discord.js
