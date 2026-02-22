# TASKS.md — コーディングエージェント向け実装タスク

このファイルはコーディングエージェントが実装を担当するためのタスク定義書です。
実装を開始する前に、まず `AGENT.md` と `API.md` を読み込んでください。

---

## 基本ルール（全エージェント共通）

- **実装前に必ず読む**: `AGENT.md`（全体方針）・`API.md`（APIエンドポイント仕様）
- **型定義の場所**: フロントエンド・バックエンドをまたぐ共通型は `packages/shared/types/` に定義する。独自に型を作らず、必ずここを参照・追記する
- **コミット単位**: タスク1件ごとにコミットする。複数タスクをまとめてコミットしない
- **ブランチ命名規則**: `feature/A-1-project-setup`（担当記号-タスク番号-概要）
- **未決事項が生じた場合**: 仮実装で進め、コード内に `// TODO: 確認が必要` コメントを残す。実装を止めない
- **他担当のコードを変更する場合**: 変更内容と理由をコメントに明記する
- **開発環境はDockerを使用する**: アプリの起動・コマンド実行は原則 `docker compose` 経由で行う。ホストに Node.js / Bun を直接インストールして動かさない。環境差異によるトラブルを防ぐため、「自分のホストでは動く」状態を完了条件とみなさない。`docker compose up` で起動した状態での動作を完了条件とする
- **パッケージ追加はコンテナ内で行う**: `docker compose exec <service> pnpm add <pkg>` のようにコンテナ内で実行し、`pnpm-lock.yaml` / `bun.lockb` の変更をコミットに含める

---

## 担当A — フロントエンド専任

> `AGENT.md` の「5. Docker構成」と「8. フロントエンド実装方針」を重点的に読んでから着手してください。

### 前提・制約

- バックエンドAPIが未完成の間は、`/apps/web/lib/mocks/` にダミーデータを用意して静的データで先行実装する
- APIが完成したタスクから順次 TanStack Query による実データ取得に差し替える（タスク A-14 〜 A-18）
- コンポーネントはなるべく Server Component で実装し、インタラクションが必要な箇所のみ `'use client'` を付与する
- グラフは `Recharts` を使用する（実装済みHTMLの Canvas描画は参考にしつつ Recharts に置き換える）

---

### タスク一覧

#### A-1 プロジェクトセットアップ
**作業内容**
- `apps/web/` に Next.js 15（App Router・TypeScript・Tailwind CSS v4）を初期化する
- shadcn/ui を導入し、使用するコンポーネント（Button / Card / Dialog / Input / Select / Slider / Badge / Tabs）をインストールする
- `AGENT.md` のカラーパレット・フォント（Syne・Noto Sans JP）を `globals.css` と `tailwind.config.ts` に設定する
- `apps/web/lib/api.ts` にバックエンドAPIへのリクエスト共通関数を実装する（Supabaseセッションから JWT を取得してヘッダーに付与する処理を含む）
- `apps/web/lib/supabase.ts` に Supabase クライアントを初期化する
- `apps/web/lib/mocks/` ディレクトリを作成し、各ページ用のダミーデータファイルを用意する
- 担当Bがタスク B-0 で用意した `apps/web/Dockerfile` と `docker-compose.yml` を使って起動確認する

**完了条件**
- `docker compose up` でコンテナが起動できる
- `http://localhost:3000` にアクセスすると `/dashboard` にリダイレクトされる（認証チェックはダミーで可）
- Hot Reload が有効になっており、ソースを編集するとブラウザに即時反映される

---

#### A-2 認証画面
**作業内容**
- `app/(auth)/login/page.tsx` にログインフォームを実装する
  - メールアドレス・パスワードの入力欄とログインボタン
  - Supabase Auth の `signInWithPassword` を呼び出す
  - 成功時は `/dashboard` にリダイレクトする
  - エラー時はフォーム下部にエラーメッセージを表示する
- `app/(auth)/register/page.tsx` に新規登録フォームを実装する
  - 表示名・メールアドレス・パスワード・月収の入力欄
  - Supabase Auth の `signUp` を呼び出した後、`POST /api/auth/profile` でプロフィールを初期化する
  - 成功時はチャットウィザード（セットアップ）を起動する
- `app/(dashboard)/layout.tsx` でセッション確認を行い、未認証の場合は `/login` にリダイレクトする
- ログアウトボタン（サイドバーに設置）を実装する

**完了条件**
- ログイン・登録・ログアウトが動作する
- 未認証でダッシュボードにアクセスするとログイン画面にリダイレクトされる

---

#### A-3 共通レイアウト（サイドバー・ヘッダー）
**作業内容**
- `components/layout/Sidebar.tsx` を実装する
  - ナビゲーション項目: ダッシュボード・支出管理・予算/目標・将来設計・AIアドバイス・設定
  - 現在のパス（`usePathname`）に応じてアクティブ状態をハイライトする
  - ロゴ・チャット設定ボタン・ログアウトボタンを含む
- `app/(dashboard)/layout.tsx` にサイドバーを組み込む
- `finance-dashboard.html` のサイドバーデザインを忠実に再現する

**完了条件**
- 各ナビゲーション項目をクリックすると対応するページに遷移する
- 現在のページに応じてサイドバーのアクティブ状態が正しく切り替わる

---

#### A-4 ダッシュボードページ（静的）
**作業内容**
- `app/(dashboard)/dashboard/page.tsx` を実装する
- 以下のコンポーネントを作成し、ダミーデータで表示する
  - `components/charts/TrendChart.tsx`: 支出トレンド折れ線グラフ（Recharts）。3ヶ月・6ヶ月・1年の切り替えタブ付き
  - `components/charts/` 配下に必要なグラフコンポーネントを実装する
  - 月次サマリー統計カード（今月の支出・貯蓄・総資産）。各カードに予算消化プログレスバーを表示する
  - 最近の取引5件一覧
  - AIアドバイスプレビュー（最新2件）
  - ライフプラン進捗（目標ごとのプログレスバー）
- `finance-dashboard.html` のダッシュボードセクションのデザインを再現する

**完了条件**
- ダミーデータでダッシュボードの全要素が表示される
- グラフが描画される

---

#### A-5 支出管理ページ（静的）
**作業内容**
- `app/(dashboard)/expense/page.tsx` を実装する
- 以下のコンポーネントを作成する
  - カテゴリ別支出バー（予算上限・消化率・予算超過時の色変更）
  - `components/charts/PieChart.tsx`: 支出構成円グラフ（Recharts）
  - 取引履歴一覧テーブル（カテゴリバッジ・金額の色分け）
  - 検索入力欄・カテゴリフィルタードロップダウン・月切り替えタブ
- `components/modals/AddExpenseModal.tsx` を実装する
  - 金額・カテゴリ（グリッド選択）・メモ・日付の入力フォーム
  - 画像アップロードエリア（ファイル選択）。画像選択時にOCR処理を呼び出すプレースホルダーを用意する（Phase 3で担当Cが実装するAPIと接続する）
  - React Hook Form + Zod でバリデーションする
- ページ上部の「＋ 支出を追加」ボタンからモーダルを開く

**完了条件**
- ダミーデータで全要素が表示される
- 支出追加モーダルが開閉できる
- フォームバリデーションが動作する（金額未入力でエラー表示など）

---

#### A-6 予算・目標ページ（静的）
**作業内容**
- `app/(dashboard)/budget/page.tsx` を実装する
- 月次予算セクション
  - カテゴリ別予算の一覧表示
  - `components/forms/BudgetEditForm.tsx`: インライン編集フォーム。予算金額をクリックすると入力欄に切り替わる
  - 固定費/変動費のトグル切り替え
- ライフプラン目標セクション
  - 目標カード一覧（タイトル・アイコン・目標金額・進捗バー・目標年）
  - `components/modals/AddGoalModal.tsx`: 目標追加モーダル
  - `components/modals/EditGoalModal.tsx`: 目標編集モーダル
  - 目標の削除ボタン（確認ダイアログ付き）
- 「チャットで再設定」ボタンからチャットウィザードを開く

**完了条件**
- ダミーデータで全要素が表示される
- インライン編集UIが開閉できる（保存処理はダミーで可）
- 目標追加・編集モーダルが開閉できる

---

#### A-7 将来設計ページ（静的）
**作業内容**
- `app/(dashboard)/future/page.tsx` を実装する
- 前提条件編集フォーム
  - 年齢・年収上昇率・投資利回り・インフレ率・月投資額の各フィールドをスライダーUIで実装する
  - スライダー変更時にシミュレーション再計算APIを呼び出すプレースホルダーを設置する（デバウンス500ms）
- 各目標の達成確率ゲージ（半円グラフ）
  - `components/charts/GaugeChart.tsx`: Canvas または SVG で半円ゲージを実装する
  - 確率に応じて色を変える（80%以上: 緑 / 50〜79%: オレンジ / 50%未満: 赤）
- `components/charts/ProjectionChart.tsx`: 資産推移シミュレーションチャート（Recharts AreaChart）
  - 90%信頼区間のバンド（p5〜p95の塗りつぶし）
  - 中央値（p50）の折れ線
  - 目標ラインの点線
- シナリオ比較テーブル（現状維持・食費削減・副収入・悲観の4シナリオ）

**完了条件**
- ダミーデータで全要素が表示される
- スライダーを動かすとフォームの値が変わる

---

#### A-8 AIアドバイスページ（静的）
**作業内容**
- `app/(dashboard)/advice/page.tsx` を実装する
- 緊急アクション・改善提案・継続中の良い点の3セクション表示
- 家計スコアの大型数値表示とカテゴリ別スコアのプログレスバー
- `components/charts/ScoreHistoryChart.tsx`: スコア推移折れ線グラフ（Recharts）
- 来月の目標リスト
- 「アドバイスを更新」ボタン（クリック時にローディング状態を表示するプレースホルダー）

**完了条件**
- ダミーデータで全要素が表示される

---

#### A-9 設定ページ（静的）
**作業内容**
- `app/(dashboard)/settings/page.tsx` を実装する
- プロフィール設定フォーム（表示名・月収）
- LINE連携セクション
  - 未連携時: 「LINEと連携する」ボタン
  - 連携済み時: 連携中の表示と「連携を解除する」ボタン
  - 連携フローの詳細実装は Phase 4（タスク A-19）で行う
- 通知設定（月次サマリーのON/OFF トグル）

**完了条件**
- ダミーデータで全要素が表示される
- フォームが表示される

---

#### A-10 チャットウィザード（ルールベース・Phase 1版）
**作業内容**
- `components/modals/ChatWizardModal.tsx` を実装する
- モーダルとしてどのページからでも開けるように Zustand ストアで開閉状態を管理する
- ルールベースの会話フロー（以下の順でヒアリングする）
  1. 月収の確認（選択肢: 〜20万 / 20〜30万 / 30〜40万 / 40万〜）
  2. 最重要ライフイベントの選択（マイホーム / 結婚・育児 / FIRE / その他）
  3. 目標年と目標金額の入力
  4. 現在の貯蓄額の入力
  5. 主な固定費（家賃・通信費）の入力
  6. 月々の貯蓄目標額の入力
  7. 入力内容の確認画面表示
- 確認画面で「保存する」を押したら `POST /api/goals`・`PUT /api/budgets`・`PATCH /api/auth/profile` を呼び出す（APIが未完成の間はコンソールにログ出力するだけでよい）
- Phase 3でAI化する際に差し替えやすいよう、会話ロジック部分を `hooks/useChatWizard.ts` に分離する

**完了条件**
- 会話フローが最後まで進められる
- 確認画面が表示される
- 「やり直す」ボタンで最初に戻れる

---

#### A-11 レスポンシブ対応・UI仕上げ
**作業内容**
- 各ページのタブレット・モバイル表示を調整する（サイドバーはモバイルでハンバーガーメニューに変更）
- ページ遷移・モーダル開閉・データ読み込み時のローディング状態（スケルトンUI）を実装する
- `loading.tsx` を各ページに追加する
- `error.tsx` を各ページに追加する（エラー時のフォールバックUI）
- トースト通知（支出追加成功・エラー時）を実装する

**完了条件**
- モバイル幅（375px）でレイアウトが崩れない
- データ読み込み中にスケルトンが表示される

---

#### A-12〜A-13 バックエンド待機・先行着手タスク
**作業内容**（担当BのAPIが完成するまでの期間に着手する）
- `packages/shared/types/` の型定義を担当Cと協力して整備する
- Storybook の導入と主要コンポーネントのストーリー作成（オプション）
- アクセシビリティ対応（`aria-label`・キーボード操作）

---

#### A-14〜A-18 APIとの結合（担当BのAPIが完成次第）

各タスクは担当BのAPIが1本完成するごとに着手する。ダミーデータを TanStack Query に置き換える。

| タスク | 接続するAPI |
|---|---|
| A-14 | `GET /api/transactions`・`POST /api/transactions`・`GET /api/transactions/summary` |
| A-15 | `GET /api/budgets`・`PUT /api/budgets`・`PATCH /api/budgets/:id` |
| A-16 | `GET /api/goals`・`POST /api/goals`・`PATCH /api/goals/:id`・`DELETE /api/goals/:id` |
| A-17 | `GET /api/assumptions`・`PUT /api/assumptions` |
| A-18 | `GET /api/auth/profile`・`PATCH /api/auth/profile` |

**各タスクの作業内容**
- `hooks/use〇〇.ts` にTanStack Queryのカスタムフックを実装する
- ミューテーション後に関連するクエリを `invalidateQueries` で無効化する
- エラーレスポンス（`error.code`）に応じたエラーメッセージをトーストで表示する

---

#### A-19 LINE連携設定UI（Phase 4・担当Cと協力）
**作業内容**
- 設定ページのLINE連携セクションを完成させる
- LINEログインフローを実装し、取得したLINEユーザーIDを `POST /api/connections/line` に送信する
- `GET /api/connections` で連携状態を取得して表示を切り替える
- `DELETE /api/connections/line` で連携解除する

---

#### A-20 チャットウィザードAI化（Phase 3・担当Cと協力）
**作業内容**
- タスク A-10 で実装した `hooks/useChatWizard.ts` を差し替える
- `POST /api/chat` を呼び出して会話を進める
- レスポンスの `is_complete: true` を検出したら `config` を確認画面に表示する
- ストリーミングレスポンスに対応する（Geminiがストリーミングを返す場合）

---

---

## 担当B — バックエンド専任

> `AGENT.md` の「5. Docker構成」と「9. バックエンド実装方針」と `API.md` の全エンドポイントを重点的に読んでから着手してください。

### 前提・制約

- すべてのAPIエンドポイントは `API.md` で定義されたリクエスト・レスポンス形式に厳密に従う
- ルートハンドラは薄く保つ（バリデーション → サービス呼び出し → レスポンス返却のみ）。ビジネスロジックは `services/` に実装する
- 認証ミドルウェア（タスク B-3）が完成するまでは、認証チェックをスキップした状態で各APIを先行実装してよい。ただし `userId` をハードコードせず、後から差し替えやすい構造にする
- Zodスキーマはリクエストボディ・クエリパラメータ・レスポンスの3種類すべて定義する
- **アプリの起動・コマンド実行はすべて `docker compose` 経由で行う**（ホストに Bun を直接インストールしない）

---

### タスク一覧

#### B-0 Docker環境構築（最優先・担当Aの作業開始前に完了させる）
**作業内容**
- `AGENT.md` の「5. Docker構成」に記載された内容をそのまま実装する
- 作成するファイルは以下の4点
  - `apps/web/Dockerfile`
  - `apps/api/Dockerfile`
  - `docker-compose.yml`（ルート）
  - `.dockerignore`（ルートおよび各 `apps/` 配下）
- `.gitignore` に以下を追加する
  - `docker-compose.override.yml`
  - `apps/web/.env.local`
  - `apps/api/.env`
- 環境変数のテンプレートファイルを作成する
  - `apps/web/.env.local.example`
  - `apps/api/.env.example`
  - 各ファイルに必要なキー名だけを記載し、値は空にしておく（`AGENT.md` の「4. 環境変数」を参照）
- `docker compose up --build` を実行してエラーなく起動することを確認する

**完了条件**
- `docker compose up --build` でフロントエンド（port 3000）・バックエンド（port 8787）が両方起動する
- `GET http://localhost:8787/health` が `200 {"status":"ok"}` を返す（B-1 のヘルスチェック実装後）
- ホスト側でソースファイルを編集すると、コンテナ内に即時反映されることを確認する（Hot Reload）
- `.env.local` / `.env` が git に含まれていないことを確認する
- 担当AとCに Docker 環境の起動手順を共有する

#### B-1 Honoセットアップ
**作業内容**
- `apps/api/` に Hono（Bun ランタイム）プロジェクトを初期化する
- `apps/api/src/index.ts` にルートのHonoアプリを作成する
- CORSミドルウェアを設定する（`FRONTEND_URL` 環境変数のオリジンのみ許可）
- 共通エラーハンドリングミドルウェアを実装する
  - 予期しない例外をキャッチして `{ error: { code: "INTERNAL_ERROR", message: "..." } }` 形式で返す
  - Zodのバリデーションエラーを `{ error: { code: "VALIDATION_ERROR", message: "..." } }` 形式に変換する
- ヘルスチェック用エンドポイント `GET /health` を実装する（`{ "status": "ok" }` を返す）
- `apps/api/.env` に必要な環境変数を `.env.example` として定義する

**完了条件**
- `docker compose up` でコンテナが起動した状態で `GET http://localhost:8787/health` が `200` を返す
- 存在しないパスへのアクセスが `404` を返す
- ホスト側でソースファイルを編集すると、コンテナを再起動せずに変更が反映される

---

#### B-2 DBスキーマ定義・マイグレーション
**作業内容**
- `apps/api/src/db/schema.ts` に `AGENT.md` の「5. データベース設計」で定義した全テーブルを Drizzle ORM のスキーマとして定義する
  - `users`・`transactions`・`budgets`・`life_goals`・`assumptions`・`advice_logs`・`external_connections`
- `apps/api/drizzle.config.ts` を設定する
- 以下のコマンドをコンテナ内で実行してマイグレーションファイルを生成・適用する
  ```bash
  # マイグレーションファイルの生成
  docker compose exec api bun run db:generate

  # Supabase への適用
  docker compose exec api bun run db:migrate
  ```
- インデックスを定義する（`transactions`: `user_id + transacted_at` の複合インデックス / `budgets`: `user_id + year_month` の複合インデックス）

**完了条件**
- `docker compose exec api bun run db:migrate` がエラーなく完了する
- Supabase Studio でテーブルが確認できる

---

#### B-3 認証ミドルウェア
**作業内容**
- `apps/api/src/middleware/auth.ts` を実装する
  - リクエストヘッダーの `Authorization: Bearer <JWT>` を取得する
  - Supabase の `auth.getUser(token)` でJWTを検証する
  - 検証成功時は `c.set('userId', user.id)` でユーザーIDをコンテキストにセットする
  - トークンがない・無効の場合は `401 UNAUTHORIZED` を返す
- `apps/api/src/index.ts` で `/api/*` に認証ミドルウェアを適用する（`/api/webhooks/*` は除外する）
- このタスク完了後、B-4〜B-9 の各APIで `c.get('userId')` を使用してハードコードを置き換える

**完了条件**
- Authorizationヘッダーなしのリクエストが `401` を返す
- 有効なJWTを付与したリクエストが通過する

---

#### B-4 プロフィールAPI
**作業内容**
- `apps/api/src/routes/auth.ts` を作成する
- `POST /api/auth/profile`・`GET /api/auth/profile`・`PATCH /api/auth/profile` を実装する
- `apps/api/src/db/` に `users` テーブルへのクエリ関数を実装する
  - `createUser(userId, data)`・`getUserById(userId)`・`updateUser(userId, data)`
- `API.md` の「2. 認証」セクションのリクエスト・レスポンス形式に従う

**完了条件**
- `POST /api/auth/profile` でレコードが作成される
- `GET /api/auth/profile` でプロフィールが返る
- `PATCH /api/auth/profile` でレコードが更新される

---

#### B-5 支出管理API
**作業内容**
- `apps/api/src/routes/transactions.ts` を作成する
- 以下のエンドポイントをすべて実装する
  - `GET /api/transactions`（クエリパラメータによるフィルター・ページネーション）
  - `POST /api/transactions`
  - `GET /api/transactions/:id`
  - `PATCH /api/transactions/:id`
  - `DELETE /api/transactions/:id`
  - `GET /api/transactions/summary`（カテゴリ別集計）
  - `POST /api/transactions/upload-receipt`（Supabase Storageへのアップロード）
- `apps/api/src/db/` に `transactions` テーブルへのクエリ関数を実装する
- `source` フィールドはAPIキー経由の場合に `'dashboard'` をデフォルト値として設定する
- 他のユーザーの取引にアクセスした場合は `403 FORBIDDEN` を返す

**完了条件**
- `API.md` の「3. 支出管理」で定義したすべてのエンドポイントが動作する
- フィルター・ソート・ページネーションが正しく機能する
- 他ユーザーのリソースへのアクセスが弾かれる

---

#### B-6 予算管理API
**作業内容**
- `apps/api/src/routes/budgets.ts` を作成する
- 以下のエンドポイントをすべて実装する
  - `GET /api/budgets`（支出集計との結合で `spent_amount` と `usage_rate` を計算して返す）
  - `PUT /api/budgets`（一括更新。UPSERT処理）
  - `PATCH /api/budgets/:id`
  - `POST /api/budgets/copy`
- `GET /api/budgets` の `spent_amount` は `transactions` テーブルから集計して動的に計算する

**完了条件**
- `API.md` の「4. 予算管理」で定義したすべてのエンドポイントが動作する
- `spent_amount` と `usage_rate` が正しく計算される

---

#### B-7 ライフプラン目標API
**作業内容**
- `apps/api/src/routes/goals.ts` を作成する
- 以下のエンドポイントをすべて実装する
  - `GET /api/goals`
  - `POST /api/goals`（`sort_order` は既存件数+1を自動設定）
  - `PATCH /api/goals/:id`
  - `DELETE /api/goals/:id`
  - `PATCH /api/goals/reorder`
- レスポンスには `progress_rate`（`saved_amount / target_amount`）を計算して付与する

**完了条件**
- `API.md` の「5. ライフプラン目標」で定義したすべてのエンドポイントが動作する

---

#### B-8 前提条件API
**作業内容**
- `apps/api/src/routes/assumptions.ts` を作成する
- `GET /api/assumptions`（レコードが存在しない場合は `AGENT.md` のデフォルト値でレコードを作成してから返す）
- `PUT /api/assumptions`

**完了条件**
- `API.md` の「6. 将来設計前提条件」で定義したすべてのエンドポイントが動作する
- 初回アクセス時にデフォルト値でレコードが自動作成される

---

#### B-9 外部連携API
**作業内容**
- `apps/api/src/routes/connections.ts` を作成する
- `GET /api/connections`
- `POST /api/connections/line`
- `DELETE /api/connections/:platform`

**完了条件**
- `API.md` の「11. 外部連携」で定義したすべてのエンドポイントが動作する

---

#### B-10 シミュレーションAPI
**作業内容**
- `apps/api/src/services/simulation.ts` にモンテカルロ法のシミュレーションロジックを実装する
  - `assumptions` テーブルの値を取得する
  - `life_goals` テーブルの全目標を取得する
  - 現在の `saved_amount` を起点に、年ごとに以下のランダム変動を1000回試行する
    - 投資リターン: 正規分布（平均=`investment_return`・標準偏差=10%）
    - インフレ: 正規分布（平均=`inflation_rate`・標準偏差=1%）
    - 収入成長: 正規分布（平均=`annual_income_growth`・標準偏差=2%）
  - 各年のp5・p25・p50・p75・p95パーセンタイルを計算する
  - 各目標の達成確率（目標年までに目標金額を超えた試行の割合）を計算する
  - `expected_achievement_year` は p50 ベースで目標金額を超える最初の年とする
- `apps/api/src/routes/simulation.ts` を作成する
  - `POST /api/simulation/run`（結果を `advice_logs` とは別の列または `assumptions` の `updated_at` でキャッシュ判定する）
  - `POST /api/simulation/scenario`（`assumptions` を上書きして計算。DBに保存しない）

**完了条件**
- `API.md` の「8. シミュレーション」で定義したレスポンス形式で結果が返る
- `force: false` の場合、前提条件が変わっていなければキャッシュが返る
- `POST /api/simulation/scenario` でDBが変更されない

---

#### B-11 アドバイスキャッシュAPI
**作業内容**
- `apps/api/src/routes/advice.ts` にキャッシュ取得・履歴エンドポイントを実装する（Gemini呼び出し部分は担当Cが実装するため、サービス関数のインターフェースだけ定義してスタブを置く）
  - `GET /api/advice`（`advice_logs` テーブルからキャッシュを返す。なければ 404）
  - `GET /api/advice/history`
  - `POST /api/advice/generate` のルート定義とバリデーションのみ実装する。Gemini呼び出しは `services/advice.ts` に委譲するスタブを置く

**完了条件**
- `GET /api/advice` がキャッシュを返す
- `GET /api/advice/history` がスコア履歴を返す
- `POST /api/advice/generate` が 501（未実装）を返すスタブになっている

---

#### B-12 統合テスト・セキュリティ整備
**作業内容**
- 主要エンドポイントの統合テストを作成する（Hono の `app.request()` を使用）
  - 正常系・バリデーションエラー・認証エラー・他ユーザーのリソースへのアクセスの4パターン
- テストの実行はコンテナ内で行う
  ```bash
  docker compose exec api bun test
  ```
- 入力値サニタイズの確認（SQLインジェクション・XSSが通らないことを確認）
- レートリミットミドルウェアを追加する（`/api/` 全体に100リクエスト/分）

---

---

## 担当C — AI・外部連携専任

> `AGENT.md` の「5. Docker構成」・「10. AI機能実装方針」・「11. 外部連携実装方針」を重点的に読んでから着手してください。

### 前提・制約

- Phase 3 の AI 機能実装は担当BのHonoサーバー基盤（タスク B-1〜B-3）が完成してから開始する
- 待機期間（Phase 2 の序盤）は タスク C-1（型定義）とタスク C-2（Gemini動作確認）に集中する
- Gemini のレスポンスは必ず try-catch で囲み、JSONパース失敗時のフォールバック値を実装する。AIのレスポンスが不正でもサーバーが 500 を返さないようにする
- プロンプトはコードに埋め込まず、`apps/api/src/services/prompts/` に定数として定義する

---

### タスク一覧

#### C-1 共通型定義（最優先・全員の作業開始前に完了させる）
**作業内容**
- `packages/shared/types/` に以下のファイルを作成する
  - `transaction.ts`: `Transaction`・`TransactionType`・`ExpenseCategory`・`IncomeCategory` 型
  - `budget.ts`: `Budget`・`BudgetWithUsage` 型
  - `goal.ts`: `LifeGoal`・`GoalPriority`・`GoalStatus` 型
  - `assumption.ts`: `Assumption` 型
  - `advice.ts`: `AdviceContent`・`AdviceItem`・`AdviceLog` 型
  - `simulation.ts`: `YearlyProjection`・`GoalProbability`・`SimulationResult` 型
  - `index.ts`: 全型のre-export
- `AGENT.md` の「6. データベース設計」と `API.md` のレスポンスJSONを正確に型に反映させる
- 担当AとBに型定義の完了を通知し、レビューを依頼する

**完了条件**
- `packages/shared/types/index.ts` から全型がインポートできる
- 担当A・Bが型を参照してコンパイルエラーが出ない

---

#### C-2 Gemini動作確認・クライアント実装
**作業内容**
- `apps/api/src/services/gemini.ts` に Gemini クライアントを実装する
  - `@google/generative-ai` パッケージをインストールする
  - `gemini-2.0-flash` モデルのクライアントを初期化する
  - テキスト生成・画像+テキスト生成（Vision）の2つのラッパー関数を実装する
  - エラー時（API制限・タイムアウト）のリトライ処理を実装する（最大2回・指数バックオフ）
- `apps/api/src/services/prompts/` ディレクトリを作成し、各機能のプロンプトを定数として定義するファイルを用意する
  - `ocr.ts`・`advice.ts`・`chat.ts`・`line.ts`
- Gemini APIキーで簡単なテキスト生成が動作することをコンテナ内で確認する
  ```bash
  # 一時的なスクリプトをコンテナ内で実行して動作確認する
  docker compose exec api bun run src/services/gemini.ts
  ```

**完了条件**
- `docker compose exec api bun run <検証スクリプト>` でGemini APIを呼び出して日本語のテキストが返ってくる
- `gemini.ts` のラッパー関数が正常系・エラー系ともに動作する

---

#### C-3 レシートOCR API
**作業内容**
- `apps/api/src/services/prompts/ocr.ts` にOCRプロンプトを定義する（`AGENT.md` の「9-1. レシートOCR」のプロンプトを使用する）
- `apps/api/src/services/ocr.ts` を実装する
  - 画像URL から画像データを取得する
  - Gemini Vision API に画像とプロンプトを送信する
  - レスポンスJSONをパースする
  - パース失敗時は `confidence: 0` のフォールバックレスポンスを返す
- `apps/api/src/routes/ocr.ts` を作成し、`POST /api/ocr` を実装する
- 担当Aが実装した支出追加モーダルの画像アップロード部分と動作確認を行う

**完了条件**
- レシート画像のURLを渡すと金額・カテゴリ・日付が返ってくる
- 読み取り不能な画像でもサーバーが 500 を返さず `confidence: 0` のレスポンスが返る
- `API.md` の「10. OCR」で定義したレスポンス形式に準拠している

---

#### C-4 AIアドバイス生成サービス
**作業内容**
- `apps/api/src/services/prompts/advice.ts` にアドバイス生成プロンプトを定義する（`AGENT.md` の「9-2. AIアドバイス生成」のシステムプロンプトとユーザーコンテキストテンプレートを使用する）
- `apps/api/src/services/advice.ts` を実装する
  - `userId` と `month` を受け取る
  - `transactions`・`budgets`・`life_goals` テーブルから必要なデータを取得する
  - コンテキストテンプレートにデータを埋め込んでプロンプトを構築する
  - Gemini にプロンプトを送信する
  - レスポンスをパースして `advice_logs` テーブルに保存する
  - パース失敗時はフォールバックとして固定のアドバイスオブジェクトを返す
- 担当Bがスタブとして定義した `POST /api/advice/generate` のサービス呼び出し部分を実装する

**完了条件**
- `POST /api/advice/generate` を呼び出すと `advice_logs` にレコードが保存される
- レスポンスが `API.md` の「7. AIアドバイス」で定義した形式に準拠している
- Gemini の出力がJSONとして不正でもサーバーが 500 を返さない

---

#### C-5 チャットウィザードAI化
**作業内容**
- `apps/api/src/services/prompts/chat.ts` にチャットシステムプロンプトを定義する（`AGENT.md` の「9-3. チャットウィザード」のプロンプトを使用する）
- `apps/api/src/routes/chat.ts` を作成し、`POST /api/chat` を実装する
  - リクエストの `messages` 配列を Gemini のマルチターン会話形式（`startChat({ history })` ）に変換する
  - Gemini のレスポンスを返す
  - レスポンスに `<CONFIG>...</CONFIG>` タグが含まれる場合は `is_complete: true` を付与し、タグ内のJSONをパースして `config` フィールドに格納する
  - `<CONFIG>` タグのパースに失敗した場合は `is_complete: false` として会話を継続する
- 担当Aがタスク A-20 でフロントエンド実装を行うため、APIが完成したら動作確認を一緒に行う

**完了条件**
- `POST /api/chat` を複数回呼び出して会話が進む
- ヒアリング完了時に `is_complete: true` と `config` が返る
- `API.md` の「9. チャット」で定義したレスポンス形式に準拠している

---

#### C-6 LINE Webhook実装
**作業内容**
- `apps/api/src/routes/webhooks/line.ts` を作成する
- `POST /api/webhooks/line` を実装する
  - `X-Line-Signature` ヘッダーを HMAC-SHA256 で検証する。不一致の場合は即座に `400` を返す
  - レスポンスは処理の完了を待たず即座に `200 {}` を返す（5秒ルール）
  - 以降の処理は非同期で実行する
- 非同期処理の実装
  - `events[].source.userId` で `external_connections` テーブルを検索してアプリユーザーIDを取得する
  - ユーザーが見つからない場合は「アプリとの連携が必要です」とLINEに返信して終了する
  - メッセージタイプに応じて処理を分岐する（text / image / other）
- テキストメッセージ処理（`apps/api/src/services/prompts/line.ts` にプロンプトを定義する）
  - 特殊コマンド（`サマリー`・`summary`・`ヘルプ`・`help`）を先に判定する
  - 通常のテキストは Gemini で金額・カテゴリ・日付を抽出して `transactions` テーブルに登録する
  - `API.md` の「12. Webhook」の返信メッセージ例に従って確認メッセージをLINEに返信する
- 画像メッセージ処理
  - LINE Content API から画像バイナリを取得する
  - Supabase Storage に保存する
  - `services/ocr.ts` を呼び出して支出情報を抽出する
  - `transactions` テーブルに登録する
  - 確認メッセージをLINEに返信する
- 今月のサマリー返信処理
  - `transactions` テーブルから今月のカテゴリ別集計を取得する
  - `API.md` の「12. Webhook」のサマリーメッセージ例に従ってフォーマットしてLINEに返信する

**完了条件**
- LINE署名検証が正しく動作する（不正なリクエストは `400` を返す）
- テキストメッセージから支出が登録され、確認メッセージが返信される
- 「サマリー」と送信するとサマリーが返信される
- LINEのWebhook検証リクエスト（`events` が空配列のリクエスト）に `200` を返す

---

#### C-7 プロンプトチューニング・品質整備
**作業内容**
- 各AIサービスのプロンプトを実際のデータでテストし、出力品質を確認・調整する
  - OCR: 様々なレシート画像（コンビニ・レストラン・スーパー）で精度確認
  - アドバイス: 異なる支出パターンのデータで適切なアドバイスが生成されることを確認
  - チャット: 会話フローが自然に進むことを確認
  - LINE: 様々な自然言語入力（「昨日スタバで450円使った」「交通費1200円」）で正しく解析されることを確認
- Gemini のJSON出力が不正になるエッジケースを洗い出してフォールバック処理を追加する
- 各プロンプトのバージョン管理ができるようコメントに改訂履歴を残す

**完了条件**
- 主要なユースケースでGeminiが期待通りの出力を返す
- JSONパース失敗が本番でサーバーエラーを引き起こさない

---

## 担当間の連携ポイント

実装を進める中で以下のタイミングで必ず連携してください。

| タイミング | 誰が誰に | 内容 |
|---|---|---|
| B-0 完了時 | BからA・C全員へ | Docker環境が起動できる状態になった。`.env.example` を参照して各自の `.env` を用意するよう共有する |
| C-1 完了時 | CからA・B全員へ | 共通型定義の完了通知・レビュー依頼 |
| B-1 完了時 | BからC | `docker compose up` でHonoサーバーが起動した。`GET http://localhost:8787/health` で疎通確認できる |
| B-3 完了時 | BからA | 認証ミドルウェア完了。APIクライアント（`lib/api.ts`）にJWT付与の実装を依頼 |
| B-5 完了時 | BからA | `GET /api/transactions` が使えるようになった。タスク A-14 に着手可能 |
| C-3 完了時 | CからA | OCR APIが使えるようになった。支出追加モーダルの画像 → OCR → フォーム自動補完を結合 |
| C-5 完了時 | CからA | チャットAPIが使えるようになった。タスク A-20 に着手可能 |
| C-6 完了時 | CからA | LINE Webhookが完成。タスク A-19 のLINE連携設定UIと結合 |

### Dockerに関するトラブル発生時

コンテナ起動・動作に問題が生じた場合は担当Bに報告する。担当Bが一次対応する。
よくある原因と対処は `AGENT.md` の「5. Docker構成 — トラブルシューティング」を参照すること。
