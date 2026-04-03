# 个性化训练 + 趋势追踪 实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 用户通过 👍/👎 评价文章训练 AI 评分偏好；跨天话题匹配标记趋势

**Architecture:** 评价存 DB → 定期生成偏好画像 → 注入 scoring prompt；pipeline 结束前做跨天话题匹配 → 标记 trendTag

**Tech Stack:** SQLite/Drizzle, Vercel AI SDK, React

---

## 功能 A：个性化训练

### Task 1: DB schema + 迁移

**Files:**
- Modify: `src/lib/db/schema.ts`
- Modify: `src/lib/db/index.ts`

- [ ] **Step 1: 在 `src/lib/db/schema.ts` 末尾添加两张新表**

```typescript
// 用户评价
export const userRatings = sqliteTable('user_ratings', {
  id: text('id').primaryKey(),
  digestItemId: text('digest_item_id').notNull().references(() => digestItems.id),
  rating: text('rating').notNull(), // 'like' | 'dislike'
  createdAt: text('created_at').notNull(),
})

// 用户偏好画像（AI 生成的摘要）
export const userProfile = sqliteTable('user_profile', {
  id: text('id').primaryKey(), // 固定 'default'
  profile: text('profile').notNull(), // AI 生成的偏好描述
  ratingCount: integer('rating_count').default(0), // 生成画像时的评分总数
  updatedAt: text('updated_at').notNull(),
})
```

- [ ] **Step 2: 在 `src/lib/db/index.ts` 添加索引**

在现有索引块之后添加：

```typescript
sqlite.exec(`CREATE INDEX IF NOT EXISTS idx_user_ratings_item ON user_ratings(digest_item_id)`)
```

- [ ] **Step 3: 生成并执行迁移**

Run: `pnpm db:generate && pnpm db:migrate`

- [ ] **Step 4: 提交**

```bash
git add src/lib/db/schema.ts src/lib/db/index.ts drizzle/
git commit -m "schema: 新增 user_ratings + user_profile 表"
```

---

### Task 2: 评价 API

**Files:**
- Create: `src/app/api/ratings/route.ts`

- [ ] **Step 1: 创建 `src/app/api/ratings/route.ts`**

```typescript
import { NextResponse } from 'next/server'
import { v4 as uuid } from 'uuid'
import { db } from '@/lib/db/index'
import { userRatings } from '@/lib/db/schema'
import { eq } from 'drizzle-orm'

// 提交评价
export async function POST(request: Request) {
  const body = await request.json() as { digestItemId: string; rating: 'like' | 'dislike' }
  const { digestItemId, rating } = body

  if (!digestItemId || !['like', 'dislike'].includes(rating)) {
    return NextResponse.json({ error: '参数错误' }, { status: 400 })
  }

  // upsert：同一条目只保留最新评价
  const existing = await db.select().from(userRatings)
    .where(eq(userRatings.digestItemId, digestItemId)).limit(1)

  if (existing.length > 0) {
    await db.update(userRatings).set({
      rating,
      createdAt: new Date().toISOString(),
    }).where(eq(userRatings.id, existing[0].id))
    return NextResponse.json({ id: existing[0].id, rating })
  }

  const id = uuid()
  await db.insert(userRatings).values({
    id,
    digestItemId,
    rating,
    createdAt: new Date().toISOString(),
  })

  return NextResponse.json({ id, rating })
}

// 获取指定条目的评价
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const digestItemId = searchParams.get('digestItemId')

  if (!digestItemId) {
    return NextResponse.json({ error: '缺少 digestItemId' }, { status: 400 })
  }

  const rows = await db.select().from(userRatings)
    .where(eq(userRatings.digestItemId, digestItemId)).limit(1)

  return NextResponse.json({ rating: rows[0]?.rating || null })
}
```

- [ ] **Step 2: 验证构建**

Run: `pnpm build`

- [ ] **Step 3: 提交**

```bash
git add src/app/api/ratings/route.ts
git commit -m "API: 新增用户评价接口 POST/GET /api/ratings"
```

---

### Task 3: 评价按钮组件

**Files:**
- Create: `src/components/digest/rating-buttons.tsx`

- [ ] **Step 1: 创建 `src/components/digest/rating-buttons.tsx`**

```tsx
"use client"

import { useState, useCallback } from "react"
import { ThumbsUp, ThumbsDown } from "lucide-react"
import { cn } from "@/lib/utils"

interface RatingButtonsProps {
  digestItemId: string
  initialRating?: 'like' | 'dislike' | null
}

export function RatingButtons({ digestItemId, initialRating = null }: RatingButtonsProps) {
  const [rating, setRating] = useState<'like' | 'dislike' | null>(initialRating)
  const [isLoading, setIsLoading] = useState(false)

  const handleRate = useCallback(async (newRating: 'like' | 'dislike') => {
    if (isLoading) return
    // 点击已选中的取消（再次点同一个按钮）
    const finalRating = rating === newRating ? null : newRating

    setRating(finalRating)
    setIsLoading(true)

    try {
      if (finalRating) {
        await fetch('/api/ratings', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ digestItemId, rating: finalRating }),
        })
      }
    } catch {
      setRating(rating) // 回滚
    } finally {
      setIsLoading(false)
    }
  }, [digestItemId, rating, isLoading])

  return (
    <div className="flex items-center gap-0.5">
      <button
        onClick={() => handleRate('like')}
        disabled={isLoading}
        className={cn(
          "p-1 rounded-md transition-colors",
          rating === 'like'
            ? "text-green-600 bg-green-600/10"
            : "text-muted-foreground/40 hover:text-green-600 hover:bg-green-600/10"
        )}
        aria-label="喜欢"
      >
        <ThumbsUp className="size-3.5" />
      </button>
      <button
        onClick={() => handleRate('dislike')}
        disabled={isLoading}
        className={cn(
          "p-1 rounded-md transition-colors",
          rating === 'dislike'
            ? "text-red-500 bg-red-500/10"
            : "text-muted-foreground/40 hover:text-red-500 hover:bg-red-500/10"
        )}
        aria-label="不喜欢"
      >
        <ThumbsDown className="size-3.5" />
      </button>
    </div>
  )
}
```

- [ ] **Step 2: 在 `src/components/digest/digest-card.tsx` 中集成**

在头部区域，收藏按钮旁边添加 RatingButtons。修改 DigestItem 接口添加 `userRating` 字段：

在 `DigestItem` 接口中添加：
```typescript
  userRating?: 'like' | 'dislike' | null
```

在卡片头部的 `<FavoriteButton ... />` 旁边添加：
```tsx
import { RatingButtons } from "@/components/digest/rating-buttons"

// 在头部右侧区域，FavoriteButton 之前
<div className="flex items-center gap-1">
  <RatingButtons digestItemId={item.id} initialRating={item.userRating} />
  <FavoriteButton ... />
</div>
```

将原来包裹 FavoriteButton 的代码从单独的 `<FavoriteButton>` 改为上面的包裹结构。

- [ ] **Step 3: 在 `src/app/api/digest/[date]/route.ts` 中返回评价数据**

在 API 中查询 userRatings，添加到返回数据中：

```typescript
import { userRatings } from '@/lib/db/schema'

// 在查询收藏之后，查询评价
const allRatings = await db.select().from(userRatings)
const ratingMap = new Map(allRatings.map(r => [r.digestItemId, r.rating]))

// itemsWithFavorite 中添加 userRating 字段
const itemsWithFavorite = items.map(item => ({
  ...item,
  isFavorited: favoriteMap.has(item.id),
  favoriteId: favoriteMap.get(item.id) || null,
  isRecommended: item.aiScore >= RECOMMEND_THRESHOLD,
  userRating: ratingMap.get(item.id) || null,
}))
```

- [ ] **Step 4: 验证构建**

Run: `pnpm build`

- [ ] **Step 5: 提交**

```bash
git add src/components/digest/rating-buttons.tsx src/components/digest/digest-card.tsx src/app/api/digest/\\[date\\]/route.ts
git commit -m "功能：卡片添加 👍/👎 评价按钮"
```

---

### Task 4: 偏好画像生成 + scoring 注入

**Files:**
- Create: `src/lib/ai/preference.ts`
- Modify: `src/lib/ai/scoring.ts`

- [ ] **Step 1: 创建 `src/lib/ai/preference.ts`**

```typescript
import { generateText } from 'ai'
import { getModels } from './client'
import { db } from '../db/index'
import { userRatings, userProfile, digestItems } from '../db/schema'
import { eq, desc } from 'drizzle-orm'

// 生成/更新偏好画像的最小评价数
const MIN_RATINGS_FOR_PROFILE = 10
// 每新增多少条评价后重新生成画像
const PROFILE_REFRESH_INTERVAL = 20

// 获取当前偏好画像（用于注入 scoring prompt）
export function getPreferenceProfile(): string | null {
  try {
    const rows = db.select().from(userProfile).where(eq(userProfile.id, 'default')).all()
    return rows[0]?.profile || null
  } catch {
    return null
  }
}

// 检查是否需要更新画像
export function shouldUpdateProfile(): boolean {
  try {
    const totalRatings = db.$client
      .prepare('SELECT COUNT(*) as cnt FROM user_ratings')
      .get() as { cnt: number }

    const profile = db.select().from(userProfile).where(eq(userProfile.id, 'default')).all()

    if (totalRatings.cnt < MIN_RATINGS_FOR_PROFILE) return false
    if (profile.length === 0) return true
    return totalRatings.cnt - (profile[0].ratingCount || 0) >= PROFILE_REFRESH_INTERVAL
  } catch {
    return false
  }
}

// 用 AI 从评价历史生成偏好画像
export async function updatePreferenceProfile(): Promise<string> {
  // 获取最近 100 条评价及对应的文章信息
  const ratings = db.$client.prepare(`
    SELECT ur.rating, di.title, di.source, di.one_liner
    FROM user_ratings ur
    JOIN digest_items di ON ur.digest_item_id = di.id
    ORDER BY ur.created_at DESC
    LIMIT 100
  `).all() as Array<{ rating: string; title: string; source: string; one_liner: string }>

  const liked = ratings.filter(r => r.rating === 'like')
    .map(r => `- [${r.source}] ${r.title}`)
    .join('\n')
  const disliked = ratings.filter(r => r.rating === 'dislike')
    .map(r => `- [${r.source}] ${r.title}`)
    .join('\n')

  const { text: profile } = await generateText({
    model: getModels().fast,
    prompt: `根据用户的文章评价历史，总结用户的内容偏好画像。

用户喜欢的文章：
${liked || '（暂无）'}

用户不喜欢的文章：
${disliked || '（暂无）'}

请用 2-3 句话总结用户的偏好特征，包括：
1. 偏好的话题/领域
2. 不感兴趣的内容类型
3. 偏好的内容风格（实战/理论/新闻/观点等）

只返回偏好描述，不要有其他文字。`,
  })

  const totalRatings = (db.$client
    .prepare('SELECT COUNT(*) as cnt FROM user_ratings')
    .get() as { cnt: number }).cnt

  const now = new Date().toISOString()
  const existing = db.select().from(userProfile).where(eq(userProfile.id, 'default')).all()

  if (existing.length === 0) {
    await db.insert(userProfile).values({
      id: 'default',
      profile,
      ratingCount: totalRatings,
      updatedAt: now,
    })
  } else {
    await db.update(userProfile).set({
      profile,
      ratingCount: totalRatings,
      updatedAt: now,
    }).where(eq(userProfile.id, 'default'))
  }

  console.log('[preference] 偏好画像已更新:', profile)
  return profile
}
```

- [ ] **Step 2: 修改 `src/lib/ai/scoring.ts` 注入偏好画像**

在文件顶部添加 import：
```typescript
import { getPreferenceProfile } from './preference'
```

在 `processBatch` 函数中，构建 prompt 时注入偏好画像。在 prompt 的"关注领域"之后、"评分维度"之前，添加偏好画像段落：

```typescript
    const preferenceProfile = getPreferenceProfile()
    const preferenceSection = preferenceProfile
      ? `\n用户个人偏好（请据此调整评分权重）：\n${preferenceProfile}\n`
      : ''
```

在 prompt 模板中，`${INTEREST_DOMAINS.map(...).join('\n')}` 之后添加 `${preferenceSection}`。

- [ ] **Step 3: 在 pipeline 中触发画像更新**

在 `src/lib/pipeline.ts` 中，pipeline 完成后（completed 状态写入 DB 之后），检查并更新偏好画像：

```typescript
import { shouldUpdateProfile, updatePreferenceProfile } from './ai/preference'

// 在 completed 的 db.update 之后，sendDigestNotification 之前
if (shouldUpdateProfile()) {
  updatePreferenceProfile().catch(err =>
    console.error('[pipeline] 偏好画像更新失败:', err)
  )
}
```

- [ ] **Step 4: 验证构建**

Run: `pnpm build`

- [ ] **Step 5: 提交**

```bash
git add src/lib/ai/preference.ts src/lib/ai/scoring.ts src/lib/pipeline.ts
git commit -m "功能：偏好画像生成 + 注入 scoring prompt 个性化评分"
```

---

## 功能 B：趋势追踪

### Task 5: digest_items 添加 trendTag 字段

**Files:**
- Modify: `src/lib/db/schema.ts`

- [ ] **Step 1: 在 `digestItems` 表定义中添加 `trendTag` 字段**

在 `isRead` 字段后面添加：

```typescript
  trendTag: text('trend_tag'), // 趋势标签（如"AI Agent"、"Gemma 4"），null 表示非趋势
```

- [ ] **Step 2: 生成并执行迁移**

Run: `pnpm db:generate && pnpm db:migrate`

- [ ] **Step 3: 提交**

```bash
git add src/lib/db/schema.ts drizzle/
git commit -m "schema: digest_items 新增 trendTag 字段"
```

---

### Task 6: 趋势分析逻辑

**Files:**
- Create: `src/lib/ai/trends.ts`

- [ ] **Step 1: 创建 `src/lib/ai/trends.ts`**

```typescript
import { generateText } from 'ai'
import { getModels } from './client'
import { extractJson } from './utils'
import { db } from '../db/index'

interface TrendCandidate {
  url: string
  title: string
  tag: string
}

// 分析当天条目与过去 7 天的话题重叠，标记趋势
export async function analyzeTrends(
  date: string,
  currentTitles: Array<{ url: string; title: string; source: string }>
): Promise<Map<string, string>> {
  // url → trendTag 映射
  const trendMap = new Map<string, string>()

  if (currentTitles.length === 0) return trendMap

  // 获取过去 7 天的文章标题（不含今天）
  const recentItems = db.$client.prepare(`
    SELECT title, source, trend_tag FROM digest_items
    WHERE digest_date < ? AND digest_date >= date(?, '-7 days')
    ORDER BY digest_date DESC
    LIMIT 200
  `).all(date, date) as Array<{ title: string; source: string; trend_tag: string | null }>

  if (recentItems.length === 0) return trendMap

  // 已有的趋势标签
  const existingTrends = recentItems
    .filter(r => r.trend_tag)
    .map(r => r.trend_tag!)
  const uniqueTrends = [...new Set(existingTrends)]

  const recentTitleList = recentItems
    .map(r => `[${r.source}] ${r.title}`)
    .join('\n')

  const currentTitleList = currentTitles
    .map((t, i) => `[${i}] [${t.source}] ${t.title}`)
    .join('\n')

  try {
    const { text } = await generateText({
      model: getModels().fast,
      prompt: `你是一个趋势分析 AI。请判断今天的新文章中，哪些话题在过去 7 天也有讨论（即"趋势"话题）。

过去 7 天的文章标题：
${recentTitleList}

${uniqueTrends.length > 0 ? `已识别的趋势标签：${uniqueTrends.join('、')}\n` : ''}
今天的新文章：
${currentTitleList}

请找出今天文章中属于"趋势"的条目（即过去 7 天也有相关讨论的话题），并给出简短的趋势标签（2-5 个字，如"AI Agent"、"Gemma 4"、"跨境合规"）。

如果某条文章延续了已有的趋势标签，请复用该标签保持一致。

请严格只返回 JSON 数组，没有趋势则返回空数组：
[{"index": 0, "tag": "AI Agent"}, ...]`,
    })

    const jsonStr = extractJson(text)
    if (!jsonStr) return trendMap

    const trends: Array<{ index: number; tag: string }> = JSON.parse(jsonStr)
    for (const t of trends) {
      const item = currentTitles[t.index]
      if (item) {
        trendMap.set(item.url, t.tag)
      }
    }
  } catch (err) {
    console.error('[trends] 趋势分析失败:', err)
  }

  return trendMap
}
```

- [ ] **Step 2: 提交**

```bash
git add src/lib/ai/trends.ts
git commit -m "功能：趋势分析逻辑（跨天话题匹配）"
```

---

### Task 7: Pipeline 接入趋势分析 + 写入 trendTag

**Files:**
- Modify: `src/lib/pipeline.ts`

- [ ] **Step 1: 在 pipeline.ts 中接入趋势分析**

添加 import：
```typescript
import { analyzeTrends } from './ai/trends'
```

在摘要完成、写入 DB 之前（`// 增量写入新条目` 注释之前），添加趋势分析：

```typescript
    // ── Stage 3.5: 趋势分析 ──
    progress.detail = '趋势分析中...'
    await saveProgress(runId, progress, date)

    const trendMap = await analyzeTrends(
      date,
      summarized.map(item => ({ url: item.url, title: item.title, source: item.source }))
    )
```

在写入 DB 的事务中，`insertDigest.run(...)` 调用处，修改 SQL 和参数以包含 trendTag：

将 INSERT 语句改为：
```sql
INSERT INTO digest_items (id, digest_date, source, title, url, author, ai_score, one_liner, summary, cluster_id, cluster_sources, created_at, is_read, trend_tag)
VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, ?)
```

在 `insertDigest.run(...)` 的参数末尾添加 `trendMap.get(item.url) || null`。

- [ ] **Step 2: 验证构建**

Run: `pnpm build`

- [ ] **Step 3: 提交**

```bash
git add src/lib/pipeline.ts
git commit -m "接入：Pipeline 摘要后执行趋势分析，写入 trendTag"
```

---

### Task 8: 前端展示趋势标签

**Files:**
- Modify: `src/components/digest/digest-card.tsx`
- Modify: `src/app/api/digest/[date]/route.ts`

- [ ] **Step 1: DigestItem 接口添加 trendTag**

在 `src/components/digest/digest-card.tsx` 的 `DigestItem` 接口中添加：
```typescript
  trendTag?: string | null
```

- [ ] **Step 2: 在卡片中展示趋势徽章**

在跨源讨论标签之前（`{/* 跨源讨论标签 */}` 注释之前），添加趋势标签：

```tsx
        {/* 趋势标签 */}
        {item.trendTag && (
          <div className="flex items-center gap-1.5 mb-2">
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-orange-500/10 text-xs text-orange-600 dark:text-orange-400 font-medium">
              🔥 {item.trendTag}
            </span>
          </div>
        )}
```

- [ ] **Step 3: API 返回 trendTag**

`src/app/api/digest/[date]/route.ts` 不需要额外改动——`getDigestByDate` 已经 `db.select()` 返回所有字段，包括新增的 `trendTag`。Drizzle 会自动包含。

- [ ] **Step 4: 验证构建**

Run: `pnpm build`

- [ ] **Step 5: 提交**

```bash
git add src/components/digest/digest-card.tsx
git commit -m "UI：卡片展示 🔥 趋势标签"
```

---

## 最终验证

- [ ] **运行 `pnpm build` 确认整体构建通过**
- [ ] **运行 `pnpm dev`，手动测试：评价按钮点击、趋势标签展示**
