# `telegram-bot`

アイリがTelegramであなたや他のユーザーと会話できるようにします。

## はじめかた

クローンと依存関係のインストール:

```shell
git clone git@github.com:moeru-ai/airi.git
pnpm i
pnpm run build:packages
```

埋め込みモデル用にOllamaインスタンスを起動

```shell
ollama start
ollama pull nomic-embed-text
```

`.env.local` ファイルを作成:

```shell
cd services/telegram-bot
cp .env .env.local
```

以下の認証情報を設定として入力:

```shell
DATABASE_URL=postgres://postgres:123456@localhost:5432/postgres
TELEGRAM_BOT_TOKEN=''

LLM_API_BASE_URL=''
LLM_API_KEY=''
LLM_MODEL=''
LLM_RESPONSE_LANGUAGE=''

LLM_VISION_API_BASE_URL=''
LLM_VISION_API_KEY=''
LLM_VISION_MODEL=''

EMBEDDING_API_BASE_URL=''
EMBEDDING_API_KEY=''
EMBEDDING_MODEL=''
EMBEDDING_DIMENSION=''
```

例:

```shell
DATABASE_URL=postgres://postgres:123456@localhost:5433/postgres
TELEGRAM_BOT_TOKEN='<Bot ID>:<Token>' # get one from @BotFather

LLM_API_BASE_URL='https://openrouter.ai/api/v1/' # if you use OpenRouter too
LLM_API_KEY='sk-or-v1-<token>'
LLM_MODEL='deepseek/deepseek-chat-v3-0324:free'
LLM_RESPONSE_LANGUAGE='English'

LLM_VISION_API_BASE_URL='https://openrouter.ai/api/v1/'
LLM_VISION_API_KEY='sk-or-v1-<token>'
LLM_VISION_MODEL='openai/gpt-4o' # as long as the model supports image input

EMBEDDING_API_BASE_URL='http://localhost:11434/v1/' # ollama
EMBEDDING_API_KEY=''
EMBEDDING_MODEL='nomic-embed-text' # embedding model
EMBEDDING_DIMENSION='768' # must set
```

DBとBotの両方を起動:

```shell
docker compose up -d
pnpm run -F @proj-airi/telegram-bot start
```
