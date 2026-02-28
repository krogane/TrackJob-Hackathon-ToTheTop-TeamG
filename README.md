# LifeBalance

家計管理 × 将来設計ダッシュボード。
「家計簿を付ける時間がない」「続かない」「将来設計につながらない」を解決することを目的に、ダッシュボード・LINE / Discord 連携・AI アドバイスで支出管理〜将来シミュレーションまでを一体化します。

---

## デモ

| | URL |
|---|---|
| フロントエンド（Vercel） | https://track-job-hackathon-to-the-top-team-ivory.vercel.app/ |
| バックエンド API（Render） | https://trackjob-hackathon-tothetop-teamg-api.onrender.com |

---

## 主な機能

### 支出・収支管理
- カテゴリ別の支出登録・編集・削除
- レシート画像の OCR 自動読み取り（Gemini Vision）
- 収支トレンドグラフ・カテゴリ別円グラフ
- CSV エクスポート

### 予算管理
- カテゴリ別の月次予算上限を設定
- 予算消化率のリアルタイム表示

### 将来設計シミュレーション
- 目標（マイホーム・老後資金など）の登録と進捗管理
- モンテカルロ法による目標達成確率と資産推移の可視化
- 前提条件（年齢・年収成長率・投資利回り・インフレ率など）のカスタマイズ

### AI 機能
- **KakeAI チャットウィザード**: 予算・目標・ライフプランをチャット形式で設定・再設定
- **AI アドバイス**: 支出履歴・予算消化率・目標進捗を踏まえた改善提案（Gemini 2.0 Flash）
- **レシート OCR**: カメラ/ファイルからレシートを読み取り、金額・カテゴリを自動入力

### LINE 連携
- LINE 公式アカウントを友だち追加 + LIFF でアカウント連携
- LINE トークからテキストで支出登録（例: `ランチ 850円`）
- レシート画像を送ると OCR で自動登録
- `サマリー` で当月の支出合計を確認

### Discord 連携
- Discord OAuth2 でアカウント連携
- Bot への DM からテキストで支出登録
- レシート画像を送ると OCR で自動登録
- `サマリー` で当月の支出合計を確認

### その他
- チャット式初回セットアップ（予算・目標を対話形式で設定）
- ライト / ダークモード切り替え
- Supabase Auth によるメール + パスワード認証

---

## 技術スタック

### フロントエンド
- **Next.js 15**（App Router）
- TypeScript
- Tailwind CSS v4 / shadcn/ui
- Recharts
- React Hook Form + Zod
- Zustand（グローバル状態）/ TanStack Query（サーバー状態）
- `@line/liff`（LINE LIFF SDK）

### バックエンド
- **Hono**（Bun ランタイム）
- TypeScript
- Drizzle ORM
- Supabase（PostgreSQL / Storage / Auth）
- Zod（バリデーション）
- `@line/bot-sdk`（LINE Messaging API）
- `discord.js`（Discord Gateway）

### AI
- **Gemini 2.0 Flash**
  - チャットウィザード（予算・目標設定）
  - AI アドバイス生成
  - レシート OCR（Vision API）

### インフラ
- フロントエンド: **Vercel**
- バックエンド: **Render**
- DB / Auth / Storage: **Supabase**

---

## リポジトリ構成（モノレポ）

```
lifebalance/
├── apps/
│   ├── web/        # Next.js フロントエンド
│   └── api/        # Hono バックエンド（Bun）
├── packages/
│   └── shared/     # 共通型定義
├── docker-compose.yml
├── AGENT.md        # 実装方針ガイド（詳細）
└── API.md          # API 仕様（エンドポイント / スキーマ）
```

---

## セットアップ

### 1. 依存関係のインストール

```bash
pnpm install
```

> **Windows 環境で pnpm が失敗する場合**
> 日本語パスなど特殊パスが原因でエラーになることがあります。
> `npm install` で代替するか、パスに ASCII 文字のみのディレクトリに移してお試しください。

### 2. 環境変数の設定

#### `apps/web/.env.local`

```env
# Supabase（認証・フロントから直接使用）
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=

# バックエンド API のベース URL
NEXT_PUBLIC_API_BASE_URL=http://localhost:8787

# LINE LIFF（LINE 連携に必要）
NEXT_PUBLIC_LINE_LIFF_ID=
NEXT_PUBLIC_LINE_BOT_BASIC_ID=   # @から始まるBasicID（QRコード表示用）

# Discord（Discord 連携に必要）
NEXT_PUBLIC_DISCORD_CLIENT_ID=
```

#### `apps/api/.env`

```env
# サーバー設定
PORT=8787
FRONTEND_URL=http://localhost:3000

# Supabase
SUPABASE_URL=
SUPABASE_SERVICE_ROLE_KEY=
DATABASE_URL=

# Gemini
GEMINI_API_KEY=

# LINE Messaging API（LINE 連携に必要）
LINE_CHANNEL_SECRET=
LINE_CHANNEL_ACCESS_TOKEN=

# Discord Bot（Discord 連携に必要）
DISCORD_TOKEN=
DISCORD_CLIENT_ID=
DISCORD_CLIENT_SECRET=
```

> `.env*` は `.gitignore` に追加されています。機密情報をコミットしないでください。

---

## 起動方法

### ローカル（pnpm）

```bash
# フロント / バック同時起動
pnpm dev

# フロントのみ
pnpm dev --filter web

# バックのみ
pnpm dev --filter api
```

### Docker Compose（ローカル開発用）

```bash
# 初回（ビルドして起動）
docker compose up --build

# 以降（バックグラウンド起動）
docker compose up -d

# ログ確認
docker compose logs -f
docker compose logs -f web
docker compose logs -f api

# 停止
docker compose down
```

### DB マイグレーション

```bash
# コンテナ内から実行（ホスト側の Bun 差異を避けるため推奨）
docker compose exec api bun run db:generate
docker compose exec api bun run db:migrate
```

---

## デプロイ

### フロントエンド（Vercel）

1. Vercel にリポジトリを接続し、`apps/web` をルートディレクトリに指定
2. 環境変数（`NEXT_PUBLIC_*`）を Vercel のダッシュボードに登録
3. `NEXT_PUBLIC_API_BASE_URL` に Render の API URL を設定

### バックエンド（Render）

1. Render に Web Service としてリポジトリを接続
2. Build Command: `cd apps/api && bun install`
3. Start Command: `cd apps/api && bun run src/index.ts`
4. 環境変数（`SUPABASE_*`、`GEMINI_API_KEY`、`LINE_*`、`DISCORD_*` など）を登録
5. `FRONTEND_URL` に Vercel のデプロイ URL を設定（CORS 設定に使用）

---

## LINE / Discord 連携のセットアップ

### LINE

1. [LINE Developers コンソール](https://developers.line.biz/console/) で Messaging API チャンネルと LIFF アプリを作成
2. LIFF アプリのエンドポイント URL を `https://<your-domain>/settings` に設定
3. チャンネルを **公開** するか、テスターに利用者の LINE アカウントを登録
4. 取得した各種キーを `.env` / Vercel / Render の環境変数に設定

### Discord

1. [Discord Developer Portal](https://discord.com/developers/applications) でアプリケーションを作成し Bot を追加
2. Bot の **"Public Bot"** を **ON** にする（これをしないと作成者以外が認証できません）
3. OAuth2 > Redirects に `https://<your-domain>/settings` を追加
4. 取得した各種キーを `.env` / Vercel / Render の環境変数に設定

---

## API 仕様ハイライト

### 認証
- Supabase Auth（メール + パスワード）
- バックエンド: `Authorization: Bearer <JWT>` を Supabase で検証

### エラーレスポンス（統一形式）

```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "amount is required"
  }
}
```

### ページネーション（一覧 API 共通）

```json
{
  "data": [],
  "pagination": {
    "total": 100,
    "page": 1,
    "limit": 20,
    "has_next": true
  }
}
```

---

## コーディング規約（要点）

- TypeScript strict モード
- 命名: `camelCase`（変数 / 関数）、`PascalCase`（型 / コンポーネント）、`snake_case`（DB カラム）
- ルートハンドラは薄く（validate → service → response）
- DB 操作は `apps/api/src/db/` の関数に集約
- フロントは TanStack Query を基本に、Mutation 後は `invalidateQueries`

---

## ドキュメント

| ファイル | 内容 |
|---|---|
| `AGENT.md` | 実装方針ガイド（詳細） |
| `API.md` | API 仕様（エンドポイント / スキーマ） |

---

## トラブルシューティング

### Docker

```bash
# node_modules 関連エラー
docker compose down -v
docker compose up --build
```

- **Hot Reload が効かない**: Docker の File Sharing 設定にプロジェクトパスが含まれているか確認
- **環境変数が反映されない**: `.env.local` / `.env` の存在確認 → `docker compose up` を再起動

### LINE 連携が他のユーザーで使えない

LINE Developers コンソールでチャンネルが **「開発中」（未公開）** のままの場合、テスターとして登録されていないユーザーは連携できません。チャンネルの **「公開」** 設定を行うか、**「ロール」タブ** からテスターを追加してください。

### Discord 連携が他のユーザーで使えない

Discord Developer Portal > Bot の **"Public Bot"** が OFF になっていると、Bot 作成者のアカウント以外は OAuth2 認証を通過できません。**"Public Bot" を ON** にしてください。
