# AGENT.md — KakeAI 実装方針ガイド

> このファイルは3つのコーディングエージェントが実装を分担するための共有仕様書です。
> 実装を始める前に必ず通読してください。
> APIのエンドポイント・クエリパラメータ・JSONスキーマの詳細は `API.md` を参照してください。
> 分担の詳細は `tasks.md`を参照してください。
> 

---

## 目次

1. [プロダクト概要](#1-プロダクト概要)
2. [技術スタック](#2-技術スタック)
3. [リポジトリ構成](#3-リポジトリ構成)
4. [環境変数](#4-環境変数)
5. [Docker構成](#5-docker構成)
6. [データベース設計](#6-データベース設計)
7. [認証フロー](#7-認証フロー)
8. [フロントエンド実装方針](#8-フロントエンド実装方針)
9. [バックエンド実装方針](#9-バックエンド実装方針)
10. [AI機能実装方針](#10-ai機能実装方針)
11. [外部連携実装方針](#11-外部連携実装方針)
12. [開発フェーズと担当分割](#12-開発フェーズと担当分割)
13. [コーディング規約](#13-コーディング規約)
14. [実装済みUI参考](#14-実装済みui参考)

---

## 1. プロダクト概要

### アプリ名
**KakeAI** — 家計管理 × 将来設計ダッシュボード

### ターゲットユーザー
時間がないが、節約や将来設計のために家計管理をしたい人。

### 解決する課題
- 家計管理をする時間がない
- 家計管理のモチベーションがない
- 家計管理が将来設計に繋がらない

### 主要機能
| 機能 | 概要 |
|---|---|
| チャット式セットアップ | 予算・目標・ライフプランをGeminiとの対話形式で設定する |
| 月次予算管理 | カテゴリ別の支出目標を設定・管理する |
| 支出登録 | ダッシュボードおよびLINE経由でテキスト・画像から支出を登録する |
| AIアドバイス | 過去の支出履歴をもとにGeminiがパーソナライズされた改善提案を生成する |
| 将来設計シミュレーション | モンテカルロ法による目標達成確率の計算とグラフ表示 |
| 外部連携 | LINE経由での支出登録・サマリー確認（Discord はオプション） |

### 利用イメージ
- ダッシュボードですべての機能を操作できる（メイン）
- LINEからも支出登録とサマリー確認ができる（サブ）

---

## 2. 技術スタック

### フロントエンド
| 項目 | 採用技術 |
|---|---|
| フレームワーク | Next.js 15（App Router） |
| 言語 | TypeScript |
| スタイリング | Tailwind CSS v4 |
| UIコンポーネント | shadcn/ui |
| グラフ描画 | Recharts |
| フォーム | React Hook Form + Zod |
| 状態管理 | Zustand（グローバル） + TanStack Query（サーバー状態） |
| HTTPクライアント | fetch（TanStack Query経由） |

### バックエンド
| 項目 | 採用技術 |
|---|---|
| フレームワーク | Hono（Bun ランタイム） |
| 言語 | TypeScript |
| ORM | Drizzle ORM |
| DB | Supabase（PostgreSQL） |
| ファイルストレージ | Supabase Storage |
| 認証 | Supabase Auth（メール+パスワード） |
| バリデーション | Zod |

### AI
| 用途 | 採用モデル |
|---|---|
| チャットウィザード（セットアップ） | Gemini 2.0 Flash |
| AIアドバイス生成 | Gemini 2.0 Flash |
| レシートOCR（画像からの支出登録） | Gemini 2.0 Flash（Vision） |

### インフラ
- デプロイなし（ローカル開発のみ）
- Supabase はクラウドの無料プランを使用

---

## 3. リポジトリ構成

モノレポ構成。`apps/` 配下に frontend・backend を並べる。

```
lifebalance/
├── apps/
│   ├── web/                        # Next.js フロントエンド
│   │   ├── app/
│   │   │   ├── (auth)/             # 認証不要ページ（ログイン・登録）
│   │   │   │   ├── login/
│   │   │   │   └── register/
│   │   │   ├── (dashboard)/        # 認証必須ページ（Route Group）
│   │   │   │   ├── layout.tsx      # サイドバー・ヘッダー共通レイアウト
│   │   │   │   ├── dashboard/
│   │   │   │   ├── expense/
│   │   │   │   ├── budget/
│   │   │   │   ├── future/
│   │   │   │   ├── advice/
│   │   │   │   └── settings/
│   │   │   ├── layout.tsx
│   │   │   └── page.tsx            # / → /dashboard にリダイレクト
│   │   ├── components/
│   │   │   ├── ui/                 # shadcn/ui コンポーネント
│   │   │   ├── charts/             # グラフコンポーネント
│   │   │   ├── forms/              # フォームコンポーネント
│   │   │   ├── modals/             # モーダル類
│   │   │   └── layout/             # サイドバー・ヘッダー
│   │   ├── hooks/                  # カスタムフック
│   │   ├── lib/
│   │   │   ├── api.ts              # バックエンドAPIクライアント
│   │   │   ├── supabase.ts         # Supabase クライアント（認証用）
│   │   │   └── utils.ts
│   │   ├── stores/                 # Zustand ストア
│   │   ├── types/                  # 型定義
│   │   └── Dockerfile              # フロントエンド用Dockerfile
│   │
│   └── api/                        # Hono バックエンド
│       ├── src/
│       │   ├── index.ts            # エントリーポイント
│       │   ├── routes/             # ルート定義
│       │   │   ├── auth.ts
│       │   │   ├── transactions.ts
│       │   │   ├── budgets.ts
│       │   │   ├── goals.ts
│       │   │   ├── assumptions.ts
│       │   │   ├── advice.ts
│       │   │   ├── simulation.ts
│       │   │   ├── chat.ts
│       │   │   └── webhooks/
│       │   │       └── line.ts
│       │   ├── middleware/
│       │   │   ├── auth.ts         # JWT検証ミドルウェア
│       │   │   └── cors.ts
│       │   ├── services/           # ビジネスロジック
│       │   │   ├── gemini.ts       # Gemini API クライアント
│       │   │   ├── ocr.ts          # レシートOCR
│       │   │   ├── advice.ts       # アドバイス生成
│       │   │   ├── simulation.ts   # モンテカルロシミュレーション
│       │   │   └── line.ts         # LINE Messaging API
│       │   ├── db/
│       │   │   ├── schema.ts       # Drizzle スキーマ定義
│       │   │   ├── migrations/     # マイグレーションファイル
│       │   │   └── client.ts       # DBクライアント
│       │   └── types/
│       ├── drizzle.config.ts
│       └── Dockerfile              # バックエンド用Dockerfile
│
├── packages/
│   └── shared/                     # フロントエンド・バックエンド共通型
│       └── types/
│           ├── transaction.ts
│           ├── budget.ts
│           ├── goal.ts
│           └── index.ts
│
├── package.json                    # ワークスペース設定
├── turbo.json                      # Turborepo設定
├── docker-compose.yml              # 開発環境一括起動
├── docker-compose.override.yml     # 開発者ローカル上書き用（git管理外）
├── .dockerignore
├── AGENT.md                        # 本ファイル
└── API.md                          # APIエンドポイント仕様
```

### パッケージマネージャー
`pnpm` + `Turborepo` を使用。

```bash
# 開発サーバー起動（両アプリ同時）
pnpm dev

# フロントエンドのみ
pnpm dev --filter web

# バックエンドのみ
pnpm dev --filter api
```

---

## 4. 環境変数

> 環境変数ファイルは `.gitignore` に必ず追加すること。機密情報をリポジトリにコミットしない。
> Docker Compose 経由で起動する場合は `docker-compose.yml` の `env_file` 指定から自動的に読み込まれる（後述の「5. Docker構成」を参照）。

### apps/web/.env.local
```env
# Supabase（認証のみフロントから直接使用）
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=

# バックエンドAPIのベースURL
# Docker Compose経由の場合は http://api:8787 に変更する
NEXT_PUBLIC_API_BASE_URL=http://localhost:8787
```

### apps/api/.env
```env
# Supabase
SUPABASE_URL=
SUPABASE_SERVICE_ROLE_KEY=        # バックエンドはservice_roleキーを使用

# Gemini
GEMINI_API_KEY=

# LINE（外部連携 Phase4で追加）
LINE_CHANNEL_SECRET=
LINE_CHANNEL_ACCESS_TOKEN=

# サーバー設定
PORT=8787
FRONTEND_URL=http://localhost:3000  # CORS許可オリジン
# Docker Compose経由の場合は http://web:3000 に変更する
```

---

## 5. Docker構成

### 方針

- **開発環境のみを対象とする**（デプロイは行わないため本番用イメージは不要）
- フロントエンド（web）・バックエンド（api）の2サービスを Docker Compose で一括管理する
- ソースコードはホストとコンテナ間でボリュームマウントし、ホスト側の変更がコンテナにリアルタイム反映されるようにする（Hot Reload）
- DBはコンテナ化せず引き続きクラウドの Supabase を使用する

### ファイル構成

```
lifebalance/
├── docker-compose.yml              # 全サービス定義（git管理対象）
├── docker-compose.override.yml     # 開発者ごとのローカル上書き（git管理外・.gitignoreに追加）
├── .dockerignore                   # ルートレベルの除外設定
├── apps/
│   ├── web/
│   │   └── Dockerfile
│   └── api/
│       └── Dockerfile
```

---

### docker-compose.yml

```yaml
services:
  web:
    build:
      context: ./apps/web
      dockerfile: Dockerfile
    ports:
      - "3000:3000"
    volumes:
      - ./apps/web:/app                 # ソースコードをマウント
      - /app/node_modules               # コンテナ側の node_modules を保護
      - /app/.next                      # ビルドキャッシュを保護
    env_file:
      - ./apps/web/.env.local
    environment:
      - NEXT_PUBLIC_API_BASE_URL=http://localhost:8787   # ブラウザからはホスト経由でアクセス
    depends_on:
      - api
    networks:
      - lifebalance

  api:
    build:
      context: ./apps/api
      dockerfile: Dockerfile
    ports:
      - "8787:8787"
    volumes:
      - ./apps/api:/app                 # ソースコードをマウント
      - /app/node_modules               # コンテナ側の node_modules を保護
    env_file:
      - ./apps/api/.env
    environment:
      - FRONTEND_URL=http://localhost:3000   # CORS許可オリジン（ブラウザからのリクエスト元）
    networks:
      - lifebalance

networks:
  lifebalance:
    driver: bridge
```

> **`NEXT_PUBLIC_API_BASE_URL` について**
> ブラウザ上の JavaScript から呼び出すAPIのURLは、コンテナ内部ネットワーク（`http://api:8787`）ではなくホストマシン経由（`http://localhost:8787`）を指定する。
> `NEXT_PUBLIC_*` はビルド時に埋め込まれるため、コンテナ内部URLを指定するとブラウザからアクセスできなくなる。

---

### apps/web/Dockerfile

```dockerfile
FROM node:22-alpine AS base

# pnpm を有効化
RUN corepack enable && corepack prepare pnpm@latest --activate

WORKDIR /app

# 依存関係インストール（パッケージファイルが変わらない限りキャッシュを再利用）
COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile

# ソースコードはボリュームマウントで提供するためCOPYしない
EXPOSE 3000

CMD ["pnpm", "dev"]
```

---

### apps/api/Dockerfile

```dockerfile
FROM oven/bun:1.2-alpine AS base

WORKDIR /app

# 依存関係インストール
COPY package.json bun.lockb ./
RUN bun install --frozen-lockfile

# ソースコードはボリュームマウントで提供するためCOPYしない
EXPOSE 8787

CMD ["bun", "run", "--watch", "src/index.ts"]
```

---

### .dockerignore（ルート）

```
node_modules
.next
.turbo
dist
*.log
.env*
!.env.example
```

> 各 `apps/web/` と `apps/api/` にも同内容の `.dockerignore` を配置すること。

---

### 起動・操作コマンド

```bash
# 初回セットアップ（イメージのビルドと起動）
docker compose up --build

# 通常起動（バックグラウンド）
docker compose up -d

# ログ確認
docker compose logs -f          # 全サービス
docker compose logs -f web      # フロントエンドのみ
docker compose logs -f api      # バックエンドのみ

# コンテナ内でコマンドを実行（例: マイグレーション）
docker compose exec api bun run db:migrate

# コンテナ内でコマンドを実行（例: パッケージ追加）
docker compose exec web pnpm add <package-name>

# 停止
docker compose down

# イメージを再ビルド（Dockerfileや依存関係を変更した場合）
docker compose up --build
```

---

### コンテナ内でのDBマイグレーション手順

DBマイグレーションは必ずコンテナ内から実行する（ホストのBunバージョン差異を防ぐため）。

```bash
# マイグレーションファイルの生成
docker compose exec api bun run db:generate

# Supabaseへの適用
docker compose exec api bun run db:migrate
```

---

### トラブルシューティング

| 症状 | 対処 |
|---|---|
| `node_modules` 関連エラーが出る | `docker compose down -v` でボリュームを削除してから `docker compose up --build` |
| ポート競合エラー | ホスト側の3000番または8787番ポートを使用している別プロセスを停止する |
| Hot Reloadが効かない | `docker compose logs -f web` でエラー確認。Dockerの「File Sharing」設定にプロジェクトのパスが含まれているか確認する |
| 環境変数が読み込まれない | `.env.local` / `.env` ファイルが存在するか確認。`docker compose up` を再起動する |
| `bun install` がキャッシュを使わず毎回走る | `bun.lockb` が更新されているため正常。コード変更のみなら `--no-recreate` フラグを使う |

---

## 6. データベース設計

### テーブル一覧

#### `users`（Supabase Authと連携）
Supabase Auth の `auth.users` を参照する拡張プロファイルテーブル。

```
id              uuid  PK（auth.users.idと同値）
display_name    text
monthly_income  integer       # 月収（円）
created_at      timestamptz
updated_at      timestamptz
```

#### `transactions`（取引履歴）
```
id              uuid  PK
user_id         uuid  FK→users.id
amount          integer       # 金額（円、支出は正値、収入は負値で区別しない→typeで判断）
type            text          # 'expense' | 'income'
category        text          # カテゴリ名（後述のカテゴリ定数を参照）
description     text          # 摘要（任意）
receipt_url     text          # レシート画像URL（Supabase Storage）
source          text          # 'dashboard' | 'line' | 'discord'
transacted_at   date          # 取引日
created_at      timestamptz
```

#### `budgets`（月次予算）
カテゴリ × 月 の組み合わせで予算上限を管理する。

```
id              uuid  PK
user_id         uuid  FK→users.id
year_month      text          # 'YYYY-MM' 形式（例: '2025-06'）
category        text          # カテゴリ名
limit_amount    integer       # 予算上限（円）
is_fixed        boolean       # 固定費フラグ
created_at      timestamptz
updated_at      timestamptz

UNIQUE(user_id, year_month, category)
```

#### `life_goals`（ライフプラン目標）
```
id              uuid  PK
user_id         uuid  FK→users.id
title           text          # 目標名（例: 'マイホーム購入'）
icon            text          # 絵文字アイコン
target_amount   integer       # 目標金額（円）
saved_amount    integer       # 現在の貯蓄額（円）
monthly_saving  integer       # 月積立額（円）
target_year     integer       # 達成目標年
priority        text          # 'high' | 'medium' | 'low'
status          text          # 'active' | 'paused' | 'completed'
sort_order      integer       # 表示順
created_at      timestamptz
updated_at      timestamptz
```

#### `assumptions`（将来設計の前提条件）
ユーザーごとに1レコード。シミュレーション計算に使用。

```
id                    uuid  PK
user_id               uuid  FK→users.id UNIQUE
age                   integer       # 現在の年齢
annual_income_growth  numeric(5,2)  # 年収上昇率（%）
investment_return     numeric(5,2)  # 投資利回り（%）
inflation_rate        numeric(5,2)  # インフレ率（%）
monthly_investment    integer       # 月投資額（円）
simulation_trials     integer       # モンテカルロ試行回数（デフォルト1000）
created_at            timestamptz
updated_at            timestamptz
```

#### `advice_logs`（AIアドバイス履歴）
```
id              uuid  PK
user_id         uuid  FK→users.id
month           text          # 対象月 'YYYY-MM'
content         jsonb         # アドバイス内容（後述の構造を参照）
score           integer       # 家計スコア（0〜100）
generated_at    timestamptz
```

`content` jsonbの構造:
```json
{
  "urgent": [{ "title": "...", "body": "..." }],
  "suggestions": [{ "title": "...", "body": "..." }],
  "positives": [{ "title": "...", "body": "..." }],
  "next_month_goals": ["...", "..."]
}
```

#### `external_connections`（外部連携）
```
id              uuid  PK
user_id         uuid  FK→users.id
platform        text          # 'line' | 'discord'
platform_user_id text         # LINEのuserId等
is_active       boolean
created_at      timestamptz
```

### カテゴリ定数
フロントエンド・バックエンド共通で `packages/shared/types/` に定義する。

```typescript
export const EXPENSE_CATEGORIES = [
  'housing',      // 住居費
  'food',         // 食費
  'transport',    // 交通費
  'entertainment',// 娯楽・趣味
  'clothing',     // 衣類・日用品
  'communication',// 通信費・サブスク
  'medical',      // 医療・健康
  'social',       // 交際費
  'other',        // その他
] as const;

export const INCOME_CATEGORIES = [
  'salary',       // 給与
  'bonus',        // ボーナス
  'side_income',  // 副収入
  'other',
] as const;
```

---

## 7. 認証フロー

### 採用方式
Supabase Auth（メール+パスワード）のみ。

### セッション管理の方針
- フロントエンド（Next.js）は Supabase クライアントSDKで直接ログイン・セッション管理を行う
- バックエンド（Hono）はリクエストヘッダーの `Authorization: Bearer <JWT>` を検証する
- JWTの検証は Supabase の `auth.getUser(token)` を使用（署名検証）

### 認証ミドルウェア（バックエンド）
すべてのAPI（`/api/webhooks/*` を除く）に適用する。

```typescript
// apps/api/src/middleware/auth.ts
// Authorization ヘッダーからJWTを取得 → Supabaseで検証 → c.set('userId', user.id)
```

### フロントエンドのAPI呼び出し
```typescript
// apps/web/lib/api.ts
// Supabaseセッションからアクセストークンを取得してヘッダーに付与する共通クライアント関数を作成
```

### 保護ルート
`app/(dashboard)/` 配下は `layout.tsx` でセッション確認を行い、未認証の場合は `/login` へリダイレクトする。

---

## 8. フロントエンド実装方針

### デザインシステム
実装済みのHTML（`finance-dashboard.html`）のデザインを参考にすること。
カラーパレット・フォント・レイアウトの方針は以下の通り。

```css
/* カラーパレット */
--bg: #0a0e1a          /* ページ背景 */
--bg2: #0f1524         /* サイドバー背景 */
--card: #131929        /* カード背景 */
--card2: #1a2235       /* カード内セカンダリ背景 */
--accent: #4af0b0      /* メインアクセント（緑） */
--accent2: #6c8fff     /* セカンダリアクセント（青） */
--accent3: #ff7eb3     /* 警告アクセント（ピンク） */
--warn: #ffb547        /* 注意（オレンジ） */
--text: #e8edf8        /* 本文テキスト */
--text2: #7a8aaa       /* サブテキスト */

/* フォント */
display: 'Syne'        /* 数値・見出し */
body: 'Noto Sans JP'   /* 本文 */
```

### ページ構成とコンポーネント責務

#### サイドバー (`components/layout/Sidebar.tsx`)
ナビゲーション項目とアクティブ状態の管理。現在のパスに応じてハイライト。

#### ダッシュボード (`app/(dashboard)/dashboard/page.tsx`)
- 月次サマリー統計カード（支出・貯蓄・総資産）
- 支出トレンドグラフ（Recharts LineChart）
- 最近の取引5件
- AIアドバイスプレビュー（最新2件）
- ライフプラン進捗

#### 支出管理 (`app/(dashboard)/expense/page.tsx`)
- カテゴリ別支出バー
- 支出構成円グラフ（Recharts PieChart）
- 取引履歴一覧（検索・カテゴリフィルター・月切り替え）

#### 予算・目標 (`app/(dashboard)/budget/page.tsx`)
- 月次予算の編集フォーム（カテゴリ別、インライン編集）
- 予算変更時に「変更前後のシミュレーション比較」をリアルタイム表示
- ライフプラン目標の一覧・追加・編集

#### 将来設計 (`app/(dashboard)/future/page.tsx`)
- 前提条件編集フォーム（スライダーUI）
- 各目標の達成確率ゲージ（Canvas描画）
- 資産推移シミュレーションチャート（信頼区間バンド付き）
- シナリオ比較テーブル

#### AIアドバイス (`app/(dashboard)/advice/page.tsx`)
- 緊急アクション・改善提案・継続中の良い点の3セクション表示
- 家計スコアと推移
- 来月の目標リスト

#### 設定 (`app/(dashboard)/settings/page.tsx`)
- プロフィール設定（名前・月収）
- 外部連携状態（LINE接続・切断フロー）
- 通知設定

### チャットウィザード（セットアップ）

**Phase 1（ルールベース）** と **Phase 3（AI化）** で実装を切り替える。

Phase 1では固定の会話フロー（分岐ロジック）をフロントエンドのみで実装する。
Phase 3ではバックエンドの `/api/chat` エンドポイントを呼び出すよう差し替える。

モーダルコンポーネントとして実装し、どのページからでも開けるようにする。

### データフェッチング方針
TanStack Query を使用。キャッシュキーの命名規則:

```typescript
// 例
['transactions', { userId, yearMonth: '2025-06', category: 'food' }]
['budgets', { userId, yearMonth: '2025-06' }]
['goals', { userId }]
['advice', { userId, month: '2025-06' }]
['simulation', { userId }]
```

ミューテーション後は関連するキーを `invalidateQueries` で無効化する。

### 支出追加モーダル
- 金額・カテゴリ・メモ・日付の入力フォーム
- 画像アップロード対応（レシート撮影 → OCR自動入力）
  - 画像選択後、`/api/ocr` を呼び出して金額・カテゴリ・日付を自動補完
  - ユーザーが確認・修正してから確定する

---

## 9. バックエンド実装方針

### Honoアプリケーション構成

```typescript
// apps/api/src/index.ts
const app = new Hono()

app.use('*', cors({ origin: process.env.FRONTEND_URL }))
app.use('/api/*', authMiddleware)          // webhooks/* は除外

app.route('/api/transactions', transactionsRoute)
app.route('/api/budgets', budgetsRoute)
app.route('/api/goals', goalsRoute)
app.route('/api/assumptions', assumptionsRoute)
app.route('/api/advice', adviceRoute)
app.route('/api/simulation', simulationRoute)
app.route('/api/chat', chatRoute)
app.route('/api/ocr', ocrRoute)
app.route('/api/webhooks/line', lineWebhookRoute)

export default app
```

### エラーレスポンス形式
すべてのエラーレスポンスは以下の形式に統一する。

```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "amount is required"
  }
}
```

エラーコード一覧:
- `VALIDATION_ERROR` — リクエストボディのバリデーション失敗
- `UNAUTHORIZED` — 認証失敗
- `NOT_FOUND` — リソースが存在しない
- `CONFLICT` — 一意制約違反
- `INTERNAL_ERROR` — サーバー内部エラー

### ページネーション
一覧取得APIは共通のページネーション形式を使用する。

```json
{
  "data": [...],
  "pagination": {
    "total": 100,
    "page": 1,
    "limit": 20,
    "has_next": true
  }
}
```

### Drizzle ORM使用方針
- すべてのDB操作は `apps/api/src/db/` 配下のクエリ関数として定義する
- ルートハンドラ内で直接DBクエリを書かない
- マイグレーションは `drizzle-kit` で管理する

```bash
# マイグレーション生成
pnpm db:generate

# マイグレーション適用
pnpm db:migrate
```

---

## 10. AI機能実装方針

### Geminiクライアント共通設定

```typescript
// apps/api/src/services/gemini.ts
import { GoogleGenerativeAI } from '@google/generative-ai'

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!)
export const geminiFlash = genAI.getGenerativeModel({ model: 'gemini-2.0-flash' })
```

---

### 9-1. レシートOCR

**エンドポイント**: `POST /api/ocr`

**処理フロー**:
1. フロントエンドから画像（base64またはmultipart）を受け取る
2. Gemini Vision APIに画像とプロンプトを送信する
3. 構造化JSONで金額・店名・日付・カテゴリの候補を返す
4. フロントエンドでユーザーが確認・修正して支出を確定する

**プロンプト**:

```
あなたはレシート解析AIです。
添付された画像からレシートの情報を読み取り、以下のJSON形式のみで返してください。
余分なテキストや説明は不要です。

{
  "amount": 数値（税込合計金額、単位は円）,
  "description": "店名または商品名",
  "transacted_at": "YYYY-MM-DD形式の日付",
  "category": "food | housing | transport | entertainment | clothing | communication | medical | social | other のいずれか",
  "confidence": 0.0〜1.0（読み取りの確信度）
}

レシートが読み取れない場合やレシートではない画像の場合は:
{ "error": "読み取れませんでした" }
```

---

### 9-2. AIアドバイス生成

**エンドポイント**: `POST /api/advice/generate`

**生成タイミング**:
- 毎月1日にバックグラウンドで生成（cron的な実行はフロントエンドから手動トリガーで代用）
- ユーザーが「アドバイスを更新」ボタンを押したとき
- 生成済みのアドバイスがある場合はキャッシュを返す（`advice_logs` テーブル参照）

**コンテキストとして渡す情報**:
- ユーザーの月収・年齢
- 直近3ヶ月の月次支出サマリー（カテゴリ別集計）
- 今月のカテゴリ別予算と消化率
- ライフプラン目標と進捗
- 直前月のアドバイスに対するアクション実績（あれば）

**システムプロンプト**:

```
あなたは日本人向けの家計管理・資産形成の専門AIアドバイザーです。
ユーザーのライフプランと収支データを分析し、具体的で実行可能なアドバイスを提供します。

## アドバイスの原則
- 上から目線にならず、寄り添うトーンで記述する
- 金額は具体的に記載する（「節約できます」ではなく「月¥3,000節約できます」）
- 批判ではなく改善策を提示する
- 良い点は必ず認め、モチベーションを維持させる

## 出力形式
以下のJSON形式のみで返してください。説明テキストは不要です。

{
  "score": 0〜100の整数（家計健全度スコア）,
  "urgent": [
    { "title": "簡潔なタイトル（20文字以内）", "body": "具体的な内容（100文字以内）" }
  ],
  "suggestions": [
    { "title": "...", "body": "..." }
  ],
  "positives": [
    { "title": "...", "body": "..." }
  ],
  "next_month_goals": [
    "具体的な行動目標（30文字以内）"
  ]
}

## 各セクションの件数
- urgent: 0〜2件（本当に緊急のもののみ）
- suggestions: 2〜3件
- positives: 1〜2件
- next_month_goals: 2〜3件

## スコアの基準
- 90〜100: 貯蓄目標達成、予算内に収まっている
- 70〜89: おおむね良好、一部改善余地あり
- 50〜69: 複数カテゴリで予算超過、要注意
- 50未満: 貯蓄ができていない、緊急改善が必要
```

**ユーザーコンテキストのテンプレート**（システムプロンプトに続いて送信）:

```
## ユーザー情報
- 年齢: {age}歳
- 月収（税引後）: ¥{monthly_income}

## 今月の予算と支出（{year_month}）
| カテゴリ | 予算 | 支出 | 消化率 |
|---------|------|------|--------|
{budget_table}

## 直近3ヶ月の月別支出合計
{monthly_summary}

## ライフプラン目標
{goals_summary}

## 前月のアドバイスに対する結果
{previous_result}
```

---

### 9-3. チャットウィザード（Phase 3 AI化）

**エンドポイント**: `POST /api/chat`

**リクエスト**:
```json
{
  "messages": [
    { "role": "user", "content": "..." },
    { "role": "model", "content": "..." }
  ]
}
```

**システムプロンプト**:

```
あなたはKakeAIというアプリの初期設定をサポートするAIアシスタントです。
ユーザーから以下の情報を会話形式でヒアリングし、家計管理の設定を行います。

## ヒアリング項目（順番に確認する）
1. 月収（税引後の手取り額）
2. 最重要ライフイベント（マイホーム・結婚・育児・FIRE・留学など）
3. ライフイベントの目標年と必要金額
4. 現在の貯蓄額
5. 主な固定費（家賃・通信費など）
6. 月々の貯蓄目標額

## 会話の原則
- 一度に複数の質問をしない（1メッセージ1質問）
- ユーザーの回答に対して共感・肯定のコメントを1文入れてから次の質問をする
- 曖昧な回答には優しく確認する
- すべてのヒアリングが完了したら、設定内容をまとめて確認を求める

## 設定完了時の出力
すべての情報が揃ったら、以下のJSONを含むメッセージを返す:
<CONFIG>
{
  "monthly_income": 数値,
  "life_goals": [...],
  "monthly_savings_target": 数値,
  "suggested_budgets": { "カテゴリ名": 上限額, ... }
}
</CONFIG>
フロントエンドはこのタグを検出して設定を自動保存する。
```

---

### 9-4. 将来設計シミュレーション（モンテカルロ法）

**エンドポイント**: `POST /api/simulation/run`

**処理フロー**（バックエンドで実装）:

```typescript
// apps/api/src/services/simulation.ts

// 1000回の試行でシミュレーション
// 各試行で年ごとに以下のランダム変動を加える:
//   - 投資リターン: 正規分布(mean=assumptions.investment_return, std=10%)
//   - インフレ: 正規分布(mean=assumptions.inflation_rate, std=1%)
//   - 収入成長: 正規分布(mean=assumptions.annual_income_growth, std=2%)

// 出力: 各年の資産額の分布（5%, 25%, 50%, 75%, 95% パーセンタイル）
// 各ゴールの達成確率（目標年までに目標金額を超えた試行の割合）
```

**レスポンス形式の概要** （詳細は `API.md` を参照）:
```json
{
  "yearly_projections": [
    { "year": 2025, "p5": ..., "p25": ..., "p50": ..., "p75": ..., "p95": ... }
  ],
  "goal_probabilities": [
    { "goal_id": "...", "probability": 0.76 }
  ]
}
```

---

## 11. 外部連携実装方針

### LINE連携（Phase 4）

#### 概要
LINE Messaging API の Webhook を受け取り、テキスト・画像から支出を登録する。
登録確認や月次サマリーをLINEへプッシュ通知する。

#### Webhookエンドポイント
`POST /api/webhooks/line` — 認証ミドルウェアを**適用しない**（LINE署名検証を行う）

#### LINE署名検証
```typescript
// X-Line-Signature ヘッダーを HMAC-SHA256 で検証
// LINE_CHANNEL_SECRET を使用
```

#### メッセージ処理フロー

**テキストメッセージ受信時**:
1. Geminiで自然言語から支出情報を抽出する（金額・カテゴリ・日付）
2. `transactions` テーブルに登録（`source: 'line'`）
3. 登録内容の確認メッセージをLINEに返信する

例:
- 入力: `「ランチ 850円」`
- 返信: `「✅ 食費 ¥850 を登録しました！（本日）」`

**画像メッセージ受信時**:
1. LINE Content APIから画像を取得する
2. Gemini OCRで支出情報を抽出する
3. `transactions` テーブルに登録する
4. 確認メッセージをLINEに返信する

**「サマリー」と送信された時**:
1. 今月の支出サマリーを集計する
2. テキスト形式でLINEに返信する
3. ダッシュボードへのリンクを付記する

#### LINEユーザーとアプリユーザーの紐付け
1. ダッシュボードの設定画面でLINE連携ボタンを押す
2. LINEログインで取得したLINEユーザーIDを `external_connections` テーブルに保存する
3. Webhook受信時に `platform_user_id` でユーザーを特定する

#### Discordはオプション（スコープ外）
Phase 4以降で検討。基本的にLINEと同じ処理フローを Discord Bot のスラッシュコマンドで実装する。

---

## 12. 開発フェーズと担当分割

### Phase 1 — フロントエンド完成（2〜3週間）

| タスク | 概要 |
|---|---|
| 1-0 | Docker環境構築（`Dockerfile` × 2・`docker-compose.yml`・`.dockerignore` の作成） |
| 1-1 | プロジェクトセットアップ（モノレポ・依存関係・デザイントークン） |
| 1-2 | 認証画面（ログイン・登録） |
| 1-3 | ダッシュボードページ（静的データで実装） |
| 1-4 | 支出管理ページ（フィルター・検索・モーダル） |
| 1-5 | 予算・目標ページ（インライン編集UI） |
| 1-6 | 将来設計ページ（スライダー・グラフ・ゲージ） |
| 1-7 | AIアドバイスページ |
| 1-8 | チャットウィザード（ルールベース） |
| 1-9 | 設定ページ |

### Phase 2 — バックエンド & DB（2〜3週間）

| タスク | 概要 |
|---|---|
| 2-1 | Honoセットアップ・ミドルウェア・エラーハンドリング |
| 2-2 | DBスキーマ定義・マイグレーション |
| 2-3 | 認証ミドルウェア実装 |
| 2-4 | 支出管理API（CRUD） |
| 2-5 | 予算API（CRUD） |
| 2-6 | ライフプラン目標API（CRUD） |
| 2-7 | 前提条件API（取得・更新） |
| 2-8 | フロントエンドとAPI結合（静的データをAPIレスポンスに差し替え） |

### Phase 3 — AI機能（2〜3週間）

| タスク | 概要 |
|---|---|
| 3-1 | Geminiクライアント共通実装 |
| 3-2 | レシートOCR API |
| 3-3 | AIアドバイス生成API |
| 3-4 | モンテカルロシミュレーションAPI |
| 3-5 | チャットウィザードのAI化（Phase 1のルールベースを差し替え） |

### Phase 4 — 外部連携（1〜2週間）

| タスク | 概要 |
|---|---|
| 4-1 | LINE Messaging API セットアップ |
| 4-2 | Webhook受信・署名検証 |
| 4-3 | テキスト・画像からの支出登録処理 |
| 4-4 | 月次サマリープッシュ通知 |
| 4-5 | LINEユーザー紐付けUI（設定ページ） |

### Phase 5 — 品質整備（1週間）

| タスク | 概要 |
|---|---|
| 5-1 | シミュレーションロジックのユニットテスト |
| 5-2 | APIエンドポイントの統合テスト |
| 5-3 | エラーハンドリングの網羅的な確認 |
| 5-4 | パフォーマンス計測・改善（画像の遅延読み込みなど） |

---

## 13. コーディング規約

### 共通
- **言語**: TypeScript strict mode を有効にする
- **命名**: 変数・関数はcamelCase、型・コンポーネントはPascalCase、DBカラムはsnake_case
- **コメント**: 複雑なロジック（シミュレーション計算、プロンプト構築）には必ずJSDocコメントを書く
- **import順**: 外部ライブラリ → 内部モジュール（絶対パス） → 相対パス

### フロントエンド固有
- Server Componentとして実装できるものはServer Componentにする
- `'use client'` は最小限のコンポーネントにだけ付与する
- APIへのfetchはすべてカスタムフック（`hooks/` 配下）経由で行う
- Tailwindのクラスは `cn()` ユーティリティで結合する

### バックエンド固有
- ルートハンドラは薄く保つ（バリデーション→サービス呼び出し→レスポンスのみ）
- ビジネスロジックは `services/` 配下に集約する
- DBへのアクセスはすべて `db/` 配下の関数経由で行う
- Zodスキーマはリクエスト・レスポンスの両方に定義する

### Geminiプロンプト
- プロンプトは `services/` 配下の定数として定義し、コードと分離する
- 出力が不安定な場合は「JSON形式のみで返す」指示を強調する
- レスポンスのパースは必ず try-catch で囲み、失敗時のフォールバック値を用意する

---

## 14. 実装済みUI参考

`finance-dashboard.html` に実装済みのダッシュボードHTMLがある。
以下の点を参考にReactコンポーネントへ移行すること。

- カラーパレット・フォント・カード・ボタンのスタイル定義
- サイドバーのナビゲーション構造
- 各ページのレイアウトとコンポーネント配置
- チャートのデータ構造と描画ロジック（RechartsへのマイグレーションでOK）
- チャットモーダルの会話UI構造
- ゲージ（半円グラフ）の Canvas描画ロジック
