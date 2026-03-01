# API.md — KakeAI API仕様書

> ベースURL: `http://localhost:8787`
> すべてのリクエスト・レスポンスは `Content-Type: application/json`
> 認証が必要なエンドポイントは `Authorization: Bearer <Supabase JWT>` ヘッダーが必須
> `/api/webhooks/*` のみ認証ミドルウェアを適用しない

---

## 目次

1. [共通仕様](#1-共通仕様)
2. [認証 /api/auth](#2-認証-apiauth)
3. [支出管理 /api/transactions](#3-支出管理-apitransactions)
4. [予算管理 /api/budgets](#4-予算管理-apibudgets)
5. [ライフプラン目標 /api/goals](#5-ライフプラン目標-apigoals)
6. [将来設計前提条件 /api/assumptions](#6-将来設計前提条件-apiassumptions)
7. [AIアドバイス /api/advice](#7-aiアドバイス-apiadvice)
8. [シミュレーション /api/simulation](#8-シミュレーション-apisimulation)
9. [チャット /api/chat](#9-チャット-apichat)
10. [OCR /api/ocr](#10-ocr-apiocr)
11. [外部連携 /api/connections](#11-外部連携-apiconnections)
12. [Webhook /api/webhooks](#12-webhook-apiwebhooks)

---

## 1. 共通仕様

### 共通レスポンス形式

**成功時**
```json
{
  "data": { ... }
}
```

一覧取得の場合はページネーション情報を付与する。
```json
{
  "data": [ ... ],
  "pagination": {
    "total": 100,
    "page": 1,
    "limit": 20,
    "has_next": true
  }
}
```

**エラー時**
```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "amount is required"
  }
}
```

### エラーコード一覧

| code | HTTPステータス | 説明 |
|---|---|---|
| `VALIDATION_ERROR` | 400 | リクエストボディ・クエリのバリデーション失敗 |
| `UNAUTHORIZED` | 401 | Authorizationヘッダーがないまたは無効 |
| `FORBIDDEN` | 403 | 他ユーザーのリソースへのアクセス |
| `NOT_FOUND` | 404 | リソースが存在しない |
| `CONFLICT` | 409 | 一意制約違反（同月・同カテゴリの予算が既に存在するなど） |
| `INTERNAL_ERROR` | 500 | サーバー内部エラー |

### 日付フォーマット
- 日付: `YYYY-MM-DD`（例: `2025-06-29`）
- 年月: `YYYY-MM`（例: `2025-06`）
- 日時: ISO 8601（例: `2025-06-29T12:34:56Z`）

### カテゴリ値
支出カテゴリは以下の文字列のいずれか。

| 値 | 表示名 |
|---|---|
| `housing` | 住居費 |
| `food` | 食費 |
| `transport` | 交通費 |
| `entertainment` | 娯楽・趣味 |
| `clothing` | 衣類・日用品 |
| `communication` | 通信費・サブスク |
| `medical` | 医療・健康 |
| `social` | 交際費 |
| `other` | その他 |

収入カテゴリは以下の文字列のいずれか。

| 値 | 表示名 |
|---|---|
| `salary` | 給与 |
| `bonus` | ボーナス |
| `side_income` | 副収入 |
| `other` | その他 |

---

## 2. 認証 /api/auth

> 認証処理の大半はSupabase Auth SDKをフロントエンドで直接実行する。
> バックエンドの `/api/auth` はプロフィール初期化など補助的な処理のみを担う。

---

### `POST /api/auth/profile`
ユーザー登録後のプロフィール初期化。Supabaseへの登録完了後にフロントエンドから呼び出す。

**認証**: 必要

**リクエストボディ**
```json
{
  "display_name": "田中 太郎",
  "monthly_income": 280000
}
```

| フィールド | 型 | 必須 | バリデーション |
|---|---|---|---|
| `display_name` | string | ✅ | 1〜50文字 |
| `monthly_income` | integer | ✅ | 1以上 |

**レスポンス `201`**
```json
{
  "data": {
    "id": "550e8400-e29b-41d4-a716-446655440000",
    "display_name": "田中 太郎",
    "monthly_income": 280000,
    "created_at": "2025-06-29T12:00:00Z"
  }
}
```

---

### `GET /api/auth/profile`
ログイン中のユーザーのプロフィールを取得する。

**認証**: 必要

**レスポンス `200`**
```json
{
  "data": {
    "id": "550e8400-e29b-41d4-a716-446655440000",
    "display_name": "田中 太郎",
    "monthly_income": 280000,
    "created_at": "2025-06-29T12:00:00Z",
    "updated_at": "2025-06-29T12:00:00Z"
  }
}
```

---

### `PATCH /api/auth/profile`
プロフィールを更新する。

**認証**: 必要

**リクエストボディ**（すべてオプション、送信したフィールドのみ更新）
```json
{
  "display_name": "田中 花子",
  "monthly_income": 300000
}
```

**レスポンス `200`**
```json
{
  "data": {
    "id": "550e8400-e29b-41d4-a716-446655440000",
    "display_name": "田中 花子",
    "monthly_income": 300000,
    "updated_at": "2025-06-29T15:00:00Z"
  }
}
```

---

## 3. 支出管理 /api/transactions

---

### `GET /api/transactions`
取引履歴の一覧を取得する。

**認証**: 必要

**クエリパラメータ**

| パラメータ | 型 | 必須 | デフォルト | 説明 |
|---|---|---|---|---|
| `year_month` | string | ❌ | 当月 | 絞り込む年月（`YYYY-MM`）。`all` を指定すると全期間 |
| `category` | string | ❌ | - | カテゴリで絞り込む |
| `type` | string | ❌ | - | `expense` または `income` |
| `source` | string | ❌ | - | `dashboard` / `line` / `discord` |
| `keyword` | string | ❌ | - | `description` の部分一致検索 |
| `page` | integer | ❌ | `1` | ページ番号（1始まり） |
| `limit` | integer | ❌ | `20` | 1ページあたりの件数（最大100） |
| `sort` | string | ❌ | `transacted_at` | ソートキー（`transacted_at` / `amount` / `created_at`） |
| `order` | string | ❌ | `desc` | `asc` または `desc` |

**レスポンス `200`**
```json
{
  "data": [
    {
      "id": "550e8400-e29b-41d4-a716-446655440001",
      "amount": 980,
      "type": "expense",
      "category": "food",
      "description": "ラーメン一蘭",
      "receipt_url": null,
      "source": "dashboard",
      "transacted_at": "2025-06-29",
      "created_at": "2025-06-29T12:34:56Z"
    }
  ],
  "pagination": {
    "total": 45,
    "page": 1,
    "limit": 20,
    "has_next": true
  }
}
```

---

### `POST /api/transactions`
取引を登録する。

**認証**: 必要

**リクエストボディ**
```json
{
  "amount": 980,
  "type": "expense",
  "category": "food",
  "description": "ラーメン一蘭",
  "receipt_url": null,
  "transacted_at": "2025-06-29"
}
```

| フィールド | 型 | 必須 | バリデーション |
|---|---|---|---|
| `amount` | integer | ✅ | 1以上 |
| `type` | string | ✅ | `expense` または `income` |
| `category` | string | ✅ | カテゴリ定数のいずれか |
| `description` | string | ❌ | 最大200文字 |
| `receipt_url` | string | ❌ | Supabase StorageのURL |
| `transacted_at` | string | ✅ | `YYYY-MM-DD` |

**レスポンス `201`**
```json
{
  "data": {
    "id": "550e8400-e29b-41d4-a716-446655440001",
    "amount": 980,
    "type": "expense",
    "category": "food",
    "description": "ラーメン一蘭",
    "receipt_url": null,
    "source": "dashboard",
    "transacted_at": "2025-06-29",
    "created_at": "2025-06-29T12:34:56Z"
  }
}
```

---

### `GET /api/transactions/:id`
取引の詳細を取得する。

**認証**: 必要

**パスパラメータ**

| パラメータ | 型 | 説明 |
|---|---|---|
| `id` | string (uuid) | 取引ID |

**レスポンス `200`**
```json
{
  "data": {
    "id": "550e8400-e29b-41d4-a716-446655440001",
    "amount": 980,
    "type": "expense",
    "category": "food",
    "description": "ラーメン一蘭",
    "receipt_url": null,
    "source": "dashboard",
    "transacted_at": "2025-06-29",
    "created_at": "2025-06-29T12:34:56Z"
  }
}
```

---

### `PATCH /api/transactions/:id`
取引を更新する。送信したフィールドのみ更新する。

**認証**: 必要

**リクエストボディ**（すべてオプション）
```json
{
  "amount": 1200,
  "category": "social",
  "description": "ランチ代（修正）",
  "transacted_at": "2025-06-28"
}
```

**レスポンス `200`**
```json
{
  "data": {
    "id": "550e8400-e29b-41d4-a716-446655440001",
    "amount": 1200,
    "type": "expense",
    "category": "social",
    "description": "ランチ代（修正）",
    "receipt_url": null,
    "source": "dashboard",
    "transacted_at": "2025-06-28",
    "created_at": "2025-06-29T12:34:56Z"
  }
}
```

---

### `DELETE /api/transactions/:id`
取引を削除する。

**認証**: 必要

**レスポンス `204`**
レスポンスボディなし。

---

### `GET /api/transactions/summary`
月次のカテゴリ別集計サマリーを取得する。ダッシュボードの統計カードと支出管理画面で使用する。

**認証**: 必要

**クエリパラメータ**

| パラメータ | 型 | 必須 | デフォルト | 説明 |
|---|---|---|---|---|
| `year_month` | string | ❌ | 当月 | 集計する年月（`YYYY-MM`） |

**レスポンス `200`**
```json
{
  "data": {
    "year_month": "2025-06",
    "total_expense": 143200,
    "total_income": 280000,
    "net_saving": 136800,
    "by_category": [
      {
        "category": "housing",
        "amount": 75000,
        "transaction_count": 1
      },
      {
        "category": "food",
        "amount": 27600,
        "transaction_count": 18
      }
    ]
  }
}
```

---

### `POST /api/transactions/upload-receipt`
レシート画像をSupabase Storageにアップロードする。OCR前の画像保存に使用する。

**認証**: 必要

**リクエスト**: `multipart/form-data`

| フィールド | 型 | 必須 | バリデーション |
|---|---|---|---|
| `file` | File | ✅ | JPEG/PNG/WEBP、最大10MB |

**レスポンス `201`**
```json
{
  "data": {
    "url": "https://xxxx.supabase.co/storage/v1/object/public/receipts/user-id/filename.jpg"
  }
}
```

---

## 4. 予算管理 /api/budgets

---

### `GET /api/budgets`
指定した月の全カテゴリの予算と消化率を取得する。

**認証**: 必要

**クエリパラメータ**

| パラメータ | 型 | 必須 | デフォルト | 説明 |
|---|---|---|---|---|
| `year_month` | string | ❌ | 当月 | `YYYY-MM` |

**レスポンス `200`**
```json
{
  "data": {
    "year_month": "2025-06",
    "budgets": [
      {
        "id": "550e8400-e29b-41d4-a716-446655440010",
        "category": "housing",
        "limit_amount": 75000,
        "spent_amount": 75000,
        "usage_rate": 1.0,
        "is_fixed": true
      },
      {
        "id": "550e8400-e29b-41d4-a716-446655440011",
        "category": "food",
        "limit_amount": 30000,
        "spent_amount": 27600,
        "usage_rate": 0.92,
        "is_fixed": false
      }
    ],
    "total_budget": 190000,
    "total_spent": 143200
  }
}
```

---

### `PUT /api/budgets`
指定した月の予算を一括で更新（または初期設定）する。存在しないカテゴリは新規作成、既存は上書きする。

**認証**: 必要

**リクエストボディ**
```json
{
  "year_month": "2025-06",
  "budgets": [
    { "category": "housing",       "limit_amount": 75000, "is_fixed": true },
    { "category": "food",          "limit_amount": 30000, "is_fixed": false },
    { "category": "transport",     "limit_amount": 15000, "is_fixed": false },
    { "category": "entertainment", "limit_amount": 20000, "is_fixed": false },
    { "category": "clothing",      "limit_amount": 20000, "is_fixed": false },
    { "category": "communication", "limit_amount": 10000, "is_fixed": true },
    { "category": "medical",       "limit_amount": 10000, "is_fixed": false },
    { "category": "social",        "limit_amount": 10000, "is_fixed": false }
  ]
}
```

| フィールド | 型 | 必須 | バリデーション |
|---|---|---|---|
| `year_month` | string | ✅ | `YYYY-MM` |
| `budgets` | array | ✅ | 1件以上 |
| `budgets[].category` | string | ✅ | カテゴリ定数のいずれか |
| `budgets[].limit_amount` | integer | ✅ | 0以上 |
| `budgets[].is_fixed` | boolean | ✅ | - |

**レスポンス `200`**
```json
{
  "data": {
    "year_month": "2025-06",
    "updated_count": 8
  }
}
```

---

### `PATCH /api/budgets/:id`
特定カテゴリの予算を個別更新する。

**認証**: 必要

**パスパラメータ**

| パラメータ | 型 | 説明 |
|---|---|---|
| `id` | string (uuid) | 予算ID |

**リクエストボディ**（すべてオプション）
```json
{
  "limit_amount": 25000,
  "is_fixed": false
}
```

**レスポンス `200`**
```json
{
  "data": {
    "id": "550e8400-e29b-41d4-a716-446655440011",
    "category": "food",
    "limit_amount": 25000,
    "is_fixed": false,
    "updated_at": "2025-06-29T15:00:00Z"
  }
}
```

---

### `POST /api/budgets/copy`
前月の予算設定を指定した月にコピーする。新規ユーザーの月初設定を簡略化するために使用する。

**認証**: 必要

**リクエストボディ**
```json
{
  "from_year_month": "2025-05",
  "to_year_month": "2025-06"
}
```

**レスポンス `201`**
```json
{
  "data": {
    "copied_count": 8,
    "to_year_month": "2025-06"
  }
}
```

---

## 5. ライフプラン目標 /api/goals

---

### `GET /api/goals`
ライフプラン目標の一覧を取得する。`sort_order` 昇順で返す。

**認証**: 必要

**クエリパラメータ**

| パラメータ | 型 | 必須 | デフォルト | 説明 |
|---|---|---|---|---|
| `status` | string | ❌ | - | `active` / `paused` / `completed` で絞り込み |

**レスポンス `200`**
```json
{
  "data": [
    {
      "id": "550e8400-e29b-41d4-a716-446655440020",
      "title": "マイホーム購入",
      "icon": "🏠",
      "target_amount": 5000000,
      "saved_amount": 3840000,
      "monthly_saving": 30000,
      "target_year": 2028,
      "priority": "high",
      "status": "active",
      "sort_order": 1,
      "progress_rate": 0.768,
      "created_at": "2025-01-01T00:00:00Z",
      "updated_at": "2025-06-29T12:00:00Z"
    }
  ]
}
```

> `progress_rate` はレスポンス時にサーバーサイドで計算して付与する（`saved_amount / target_amount`）。

---

### `POST /api/goals`
ライフプラン目標を新規作成する。

**認証**: 必要

**リクエストボディ**
```json
{
  "title": "マイホーム購入",
  "icon": "🏠",
  "target_amount": 5000000,
  "saved_amount": 3840000,
  "monthly_saving": 30000,
  "target_year": 2028,
  "priority": "high"
}
```

| フィールド | 型 | 必須 | バリデーション |
|---|---|---|---|
| `title` | string | ✅ | 1〜50文字 |
| `icon` | string | ❌ | 絵文字1文字（省略時は `🎯`） |
| `target_amount` | integer | ✅ | 1以上 |
| `saved_amount` | integer | ❌ | 0以上（デフォルト: `0`） |
| `monthly_saving` | integer | ✅ | 0以上 |
| `target_year` | integer | ✅ | 現在年以降 |
| `priority` | string | ✅ | `high` / `medium` / `low` |

**レスポンス `201`**
```json
{
  "data": {
    "id": "550e8400-e29b-41d4-a716-446655440020",
    "title": "マイホーム購入",
    "icon": "🏠",
    "target_amount": 5000000,
    "saved_amount": 3840000,
    "monthly_saving": 30000,
    "target_year": 2028,
    "priority": "high",
    "status": "active",
    "sort_order": 1,
    "progress_rate": 0.768,
    "created_at": "2025-06-29T12:00:00Z",
    "updated_at": "2025-06-29T12:00:00Z"
  }
}
```

---

### `PATCH /api/goals/:id`
目標を更新する。送信したフィールドのみ更新する。

**認証**: 必要

**パスパラメータ**

| パラメータ | 型 | 説明 |
|---|---|---|
| `id` | string (uuid) | 目標ID |

**リクエストボディ**（すべてオプション）
```json
{
  "title": "マイホーム購入（修正）",
  "saved_amount": 4000000,
  "monthly_saving": 35000,
  "target_year": 2027,
  "priority": "high",
  "status": "active"
}
```

**レスポンス `200`**
```json
{
  "data": {
    "id": "550e8400-e29b-41d4-a716-446655440020",
    "title": "マイホーム購入（修正）",
    "icon": "🏠",
    "target_amount": 5000000,
    "saved_amount": 4000000,
    "monthly_saving": 35000,
    "target_year": 2027,
    "priority": "high",
    "status": "active",
    "sort_order": 1,
    "progress_rate": 0.8,
    "updated_at": "2025-06-29T15:00:00Z"
  }
}
```

---

### `DELETE /api/goals/:id`
目標を削除する。

**認証**: 必要

**レスポンス `204`**
レスポンスボディなし。

---

### `PATCH /api/goals/reorder`
目標の表示順を一括更新する。

**認証**: 必要

**リクエストボディ**
```json
{
  "orders": [
    { "id": "550e8400-e29b-41d4-a716-446655440020", "sort_order": 1 },
    { "id": "550e8400-e29b-41d4-a716-446655440021", "sort_order": 2 },
    { "id": "550e8400-e29b-41d4-a716-446655440022", "sort_order": 3 }
  ]
}
```

**レスポンス `200`**
```json
{
  "data": {
    "updated_count": 3
  }
}
```

---

## 6. 将来設計前提条件 /api/assumptions

ユーザーごとに1レコード。初回取得時にデフォルト値で自動生成する。

### デフォルト値

| フィールド | デフォルト値 |
|---|---|
| `age` | `30` |
| `annual_income_growth` | `3.0` |
| `investment_return` | `5.0` |
| `inflation_rate` | `2.0` |
| `monthly_investment` | `0` |
| `simulation_trials` | `1000` |

---

### `GET /api/assumptions`
前提条件を取得する。レコードが存在しない場合はデフォルト値で自動作成して返す。

**認証**: 必要

**レスポンス `200`**
```json
{
  "data": {
    "id": "550e8400-e29b-41d4-a716-446655440030",
    "age": 30,
    "annual_income_growth": 3.0,
    "investment_return": 5.0,
    "inflation_rate": 2.0,
    "monthly_investment": 15000,
    "simulation_trials": 1000,
    "updated_at": "2025-06-29T12:00:00Z"
  }
}
```

---

### `PUT /api/assumptions`
前提条件を全件更新する。

**認証**: 必要

**リクエストボディ**
```json
{
  "age": 30,
  "annual_income_growth": 3.0,
  "investment_return": 5.0,
  "inflation_rate": 2.0,
  "monthly_investment": 15000,
  "simulation_trials": 1000
}
```

| フィールド | 型 | 必須 | バリデーション |
|---|---|---|---|
| `age` | integer | ✅ | 18〜100 |
| `annual_income_growth` | number | ✅ | -10.0〜30.0（%） |
| `investment_return` | number | ✅ | -10.0〜30.0（%） |
| `inflation_rate` | number | ✅ | 0.0〜20.0（%） |
| `monthly_investment` | integer | ✅ | 0以上 |
| `simulation_trials` | integer | ❌ | `100` / `500` / `1000`（デフォルト: `1000`） |

**レスポンス `200`**
```json
{
  "data": {
    "id": "550e8400-e29b-41d4-a716-446655440030",
    "age": 30,
    "annual_income_growth": 3.0,
    "investment_return": 5.0,
    "inflation_rate": 2.0,
    "monthly_investment": 15000,
    "simulation_trials": 1000,
    "updated_at": "2025-06-29T15:00:00Z"
  }
}
```

---

## 7. AIアドバイス /api/advice

---

### `GET /api/advice`
指定した月のアドバイスを取得する。生成済みのアドバイスがある場合はキャッシュを返す。

**認証**: 必要

**クエリパラメータ**

| パラメータ | 型 | 必須 | デフォルト | 説明 |
|---|---|---|---|---|
| `month` | string | ❌ | 当月 | `YYYY-MM` |

**レスポンス `200`**（生成済みの場合）
```json
{
  "data": {
    "id": "550e8400-e29b-41d4-a716-446655440040",
    "month": "2025-06",
    "score": 72,
    "content": {
      "urgent": [
        {
          "title": "食費が予算の92%に達しています",
          "body": "先月より外食が増えています。残り7日で¥2,800の余裕しかありません。自炊を増やすか、コンビニ利用を控えると改善できます。"
        }
      ],
      "suggestions": [
        {
          "title": "サブスクを見直すと月¥3,400節約できます",
          "body": "Netflix利用頻度が月2回以下です。一時停止で年間¥17,880の節約になります。"
        }
      ],
      "positives": [
        {
          "title": "貯蓄習慣が定着しています",
          "body": "過去6ヶ月連続で貯蓄目標の90%以上を達成しています。この調子で続けましょう！"
        }
      ],
      "next_month_goals": [
        "食費を¥27,000以内に抑える",
        "育児積立を¥23,000に増額する",
        "Netflixの停止を検討する"
      ]
    },
    "generated_at": "2025-06-29T12:00:00Z"
  }
}
```

**レスポンス `404`**（未生成の場合）
```json
{
  "error": {
    "code": "NOT_FOUND",
    "message": "Advice for 2025-06 has not been generated yet"
  }
}
```

---

### `POST /api/advice/generate`
指定した月のアドバイスをGeminiで生成して保存する。既に生成済みの場合は `force: true` を指定しない限りキャッシュを返す。

**認証**: 必要

**リクエストボディ**
```json
{
  "month": "2025-06",
  "force": false
}
```

| フィールド | 型 | 必須 | 説明 |
|---|---|---|---|
| `month` | string | ❌ | 対象月（省略時は当月） |
| `force` | boolean | ❌ | `true` の場合は既存を上書き生成（デフォルト: `false`） |

**レスポンス `201`**
`GET /api/advice` と同じ形式のレスポンスを返す。

---

### `GET /api/advice/history`
過去のアドバイス履歴（スコアの推移）を取得する。アドバイスページのスコアグラフで使用する。

**認証**: 必要

**クエリパラメータ**

| パラメータ | 型 | 必須 | デフォルト | 説明 |
|---|---|---|---|---|
| `months` | integer | ❌ | `6` | 取得する月数（最大24） |

**レスポンス `200`**
```json
{
  "data": [
    { "month": "2025-01", "score": 65 },
    { "month": "2025-02", "score": 68 },
    { "month": "2025-03", "score": 67 },
    { "month": "2025-04", "score": 70 },
    { "month": "2025-05", "score": 67 },
    { "month": "2025-06", "score": 72 }
  ]
}
```

---

### `POST /api/advice/detail`
改善提案カードの内容をもとに、モーダル表示用の具体的アクションをGeminiで生成する。

**認証**: 必要

**リクエストボディ**
```json
{
  "section": "improvement",
  "title": "食費が予算の92%に達しています",
  "summary": "残り7日で¥2,800の余裕しかありません。コンビニ利用を減らし自炊を増やしましょう。",
  "urgent": true
}
```

| フィールド | 型 | 必須 | 説明 |
|---|---|---|---|
| `section` | string | ❌ | `improvement` \| `positive`（デフォルト: `improvement`） |
| `title` | string | ✅ | 提案タイトル |
| `summary` | string | ✅ | 提案本文 |
| `urgent` | boolean | ❌ | 緊急提案かどうか |

**レスポンス `200`**
```json
{
  "data": {
    "proposal_items": [
      "今週の外食回数を2回までに制限し、超過しそうな日は先に自炊メニューを決める",
      "コンビニ利用を週3回以内に抑え、1回あたり¥800を上限にする",
      "毎週日曜に食費実績を確認し、翌週の予算上限を再設定する"
    ]
  }
}
```

---

## 8. シミュレーション /api/simulation

---

### `POST /api/simulation/run`
モンテカルロ法で資産推移シミュレーションを実行する。
`assumptions` と `goals` の現在の設定値をもとに計算する。
前提条件が変更されるまで結果をキャッシュし、変更後は再計算する。

**認証**: 必要

**リクエストボディ**（すべてオプション）
```json
{
  "force": false
}
```

| フィールド | 型 | 必須 | 説明 |
|---|---|---|---|
| `force` | boolean | ❌ | `true` の場合はキャッシュを無視して再計算（デフォルト: `false`） |

**レスポンス `200`**
```json
{
  "data": {
    "calculated_at": "2025-06-29T12:00:00Z",
    "assumptions_snapshot": {
      "age": 30,
      "annual_income_growth": 3.0,
      "investment_return": 5.0,
      "inflation_rate": 2.0,
      "monthly_investment": 15000,
      "simulation_trials": 1000
    },
    "yearly_projections": [
      {
        "year": 2025,
        "age": 30,
        "p5":  3200000,
        "p25": 3500000,
        "p50": 3840000,
        "p75": 4100000,
        "p95": 4500000
      },
      {
        "year": 2028,
        "age": 33,
        "p5":  5500000,
        "p25": 6800000,
        "p50": 7800000,
        "p75": 9000000,
        "p95": 11000000
      }
    ],
    "goal_probabilities": [
      {
        "goal_id": "550e8400-e29b-41d4-a716-446655440020",
        "title": "マイホーム購入",
        "target_amount": 5000000,
        "target_year": 2028,
        "probability": 0.76,
        "expected_achievement_year": 2027
      },
      {
        "goal_id": "550e8400-e29b-41d4-a716-446655440021",
        "title": "育児準備資金",
        "target_amount": 1000000,
        "target_year": 2026,
        "probability": 0.52,
        "expected_achievement_year": null
      }
    ]
  }
}
```

> `yearly_projections` は現在年から最も遠い目標の `target_year` + 5年まで1年単位で返す。
> `p5` / `p25` / `p50` / `p75` / `p95` はそれぞれ5・25・50・75・95パーセンタイル。
> `expected_achievement_year` は中央値（p50）ベースで目標金額を超える年。超えない場合は `null`。

---

### `POST /api/simulation/scenario`
前提条件を仮で変更した場合の達成確率を試算する。設定を保存せずに「もし〜だったら」を確認するために使用する。

**認証**: 必要

**リクエストボディ**
```json
{
  "overrides": {
    "annual_income_growth": 5.0,
    "investment_return": 7.0,
    "monthly_investment": 30000
  }
}
```

> `overrides` に指定したフィールドのみ現在の `assumptions` から上書きしてシミュレーションする。

**レスポンス `200`**
`POST /api/simulation/run` と同じ形式。`calculated_at` は現在時刻、キャッシュへの保存は行わない。

---

## 9. チャット /api/chat

チャットウィザードのAI化（Phase 3）で使用する。Phase 1ではこのエンドポイントは呼び出さない。

---

### `POST /api/chat`
Geminiとの会話を1ターン進める。会話履歴はクライアント側で保持してリクエストに含める。

**認証**: 必要

**リクエストボディ**
```json
{
  "messages": [
    {
      "role": "user",
      "content": "最重要ライフイベントはマイホーム購入です"
    },
    {
      "role": "model",
      "content": "素敵な目標です！目標年と必要金額を教えてください。"
    },
    {
      "role": "user",
      "content": "2030年 500万円"
    }
  ],
  "setup_context": {
    "monthly_income": 280000,
    "current_savings": 1200000,
    "housing_cost": 90000,
    "daily_food_cost": 1200
  }
}
```

| フィールド | 型 | 必須 | バリデーション |
|---|---|---|---|
| `messages` | array | ✅ | 1件以上、最大50件 |
| `messages[].role` | string | ✅ | `user` または `model` |
| `messages[].content` | string | ✅ | 1〜2000文字 |
| `setup_context` | object | - | `/setup`で取得した補助情報 |

**レスポンス `200`**（通常の会話継続中）
```json
{
  "data": {
    "role": "model",
    "content": "マイホーム購入、素晴らしい目標ですね！3年後となると2028年頃でしょうか。頭金として用意したい金額はありますか？",
    "is_complete": false,
    "config": null
  }
}
```

**レスポンス `200`**（ヒアリング完了・設定生成時）
```json
{
  "data": {
    "role": "model",
    "content": "設定内容をまとめました。確認してよければ「保存する」を押してください！",
    "is_complete": true,
    "config": {
      "monthly_income": 280000,
      "monthly_savings_target": 60000,
      "current_savings": 1200000,
      "life_goals": [
        {
          "title": "マイホーム購入",
          "target_amount": 5000000,
          "target_year": 2028,
          "priority": "高"
        }
      ],
      "suggested_budgets": {
        "housing": 75000,
        "food": 30000,
        "transport": 15000,
        "entertainment": 20000,
        "clothing": 20000,
        "communication": 10000,
        "medical": 10000,
        "social": 10000
      }
    }
  }
}
```

> `is_complete: true` の場合、フロントエンドは `config` の内容を確認画面に表示し、ユーザーが承認後に `/api/goals`・`/api/budgets`・`/api/auth/profile` へ一括保存する。

---

## 10. OCR /api/ocr

---

### `POST /api/ocr`
レシート画像をGemini Visionで解析して支出情報を抽出する。

**認証**: 必要

**リクエストボディ**
```json
{
  "image_url": "https://xxxx.supabase.co/storage/v1/object/public/receipts/user-id/receipt.jpg"
}
```

> 先に `POST /api/transactions/upload-receipt` で画像をアップロードし、返却されたURLを渡す。

| フィールド | 型 | 必須 | 説明 |
|---|---|---|---|
| `image_url` | string | ✅ | Supabase StorageのURL |

**レスポンス `200`**（解析成功）
```json
{
  "data": {
    "amount": 980,
    "description": "ラーメン一蘭 新宿店",
    "transacted_at": "2025-06-29",
    "category": "food",
    "confidence": 0.95
  }
}
```

**レスポンス `200`**（解析失敗・読み取れない場合）
```json
{
  "data": {
    "amount": null,
    "description": null,
    "transacted_at": null,
    "category": null,
    "confidence": 0.0,
    "error_message": "レシートを読み取れませんでした。手動で入力してください。"
  }
}
```

> `confidence` が `0.7` 未満の場合はフロントエンドで警告メッセージを表示する。

---

## 11. 外部連携 /api/connections

---

### `GET /api/connections`
現在の外部連携状態を取得する。

**認証**: 必要

**レスポンス `200`**
```json
{
  "data": [
    {
      "id": "550e8400-e29b-41d4-a716-446655440050",
      "platform": "line",
      "is_active": true,
      "connected_at": "2025-05-01T10:00:00Z"
    }
  ]
}
```

---

### `POST /api/connections/line`
LINE連携を登録する。フロントエンドでLINEログインを実行して取得したLINEユーザーIDを渡す。

**認証**: 必要

**リクエストボディ**
```json
{
  "line_user_id": "Uxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
}
```

| フィールド | 型 | 必須 | バリデーション |
|---|---|---|---|
| `line_user_id` | string | ✅ | `U` で始まる33文字 |

**レスポンス `201`**
```json
{
  "data": {
    "id": "550e8400-e29b-41d4-a716-446655440050",
    "platform": "line",
    "is_active": true,
    "connected_at": "2025-06-29T12:00:00Z"
  }
}
```

---

### `DELETE /api/connections/:platform`
外部連携を解除する。

**認証**: 必要

**パスパラメータ**

| パラメータ | 型 | 説明 |
|---|---|---|
| `platform` | string | `line` または `discord` |

**レスポンス `204`**
レスポンスボディなし。

---

## 12. Webhook /api/webhooks

> このエンドポイント群には認証ミドルウェアを適用しない。代わりに各プラットフォーム固有の署名検証を行う。

---

### `POST /api/webhooks/line`
LINE Messaging APIからのWebhookを受信する。

**認証**: なし（LINE署名検証を実施）

**リクエストヘッダー**

| ヘッダー | 説明 |
|---|---|
| `X-Line-Signature` | `LINE_CHANNEL_SECRET` を鍵としたリクエストボディのHMAC-SHA256（Base64エンコード） |

**リクエストボディ**（LINEが送信する形式をそのまま受け取る）
```json
{
  "destination": "Uxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx",
  "events": [
    {
      "type": "message",
      "message": {
        "type": "text",
        "id": "000000000000000000",
        "text": "ランチ 850円"
      },
      "source": {
        "type": "user",
        "userId": "Uxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
      },
      "replyToken": "xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx",
      "timestamp": 1719619200000
    }
  ]
}
```

**処理フロー（サーバーサイド）**

1. `X-Line-Signature` を検証する。不一致の場合は `400` を返す。
2. `events[].source.userId` で `external_connections` テーブルを検索してアプリユーザーを特定する。
3. メッセージタイプに応じて処理を分岐する。

| `message.type` | 処理内容 |
|---|---|
| `text` | Geminiで自然言語から金額・カテゴリ・日付を抽出 → `transactions` に登録 → 確認メッセージを返信 |
| `image` | LINEから画像を取得 → Supabase Storageに保存 → OCR → `transactions` に登録 → 確認メッセージを返信 |
| その他 | 使い方ヘルプメッセージを返信 |

**特殊テキストコマンド**

| 受信テキスト | 処理内容 |
|---|---|
| `サマリー` / `summary` | 今月の支出サマリーをテキスト形式で返信 |
| `ヘルプ` / `help` | 使い方説明を返信 |

**レスポンス `200`**
LINEのWebhookは必ず `200 OK` を即座に返す必要がある（5秒以内）。
重い処理（Gemini呼び出し、DB登録）は非同期で実行し、処理結果はreplyToken経由でLINEに送信する。

```json
{}
```

**LINEへの返信メッセージ例**

支出登録成功時:
```
✅ 食費 ¥850 を登録しました！
📅 2025年6月29日

今月の食費: ¥28,450 / ¥30,000（94.8%）
```

今月のサマリー返信時:
```
📊 2025年6月のサマリー

💰 支出合計: ¥143,200
💚 貯蓄:    ¥56,800

【カテゴリ別】
🏠 住居費   ¥75,000 ████████ 100%
🍜 食費     ¥28,450 ███████░  92%
🚃 交通費   ¥10,200 █████░░░  68%

詳細はこちら👇
https://lifebalance.app/dashboard
```
