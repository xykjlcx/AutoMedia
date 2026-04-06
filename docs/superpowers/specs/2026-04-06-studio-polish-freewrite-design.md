# Studio 语气润色 + 自由写作 设计文档

> 日期：2026-04-06
> 范围：D3 语气润色、D1 自由写作

---

## 背景

Studio 当前只能从日报文章作为素材入口创建草稿，且编辑器缺少 AI 辅助微编辑能力。两个改进：

1. **D3 语气润色**：选中文本 → 浮动工具栏 → AI 改写
2. **D1 自由写作**：无需素材，空白开写

## D3 语气润色

### 交互设计

1. 用户在编辑器（textarea）中选中一段文本
2. 选中文本上方弹出浮动工具栏，提供 4 种润色方向：
   - 🗣 口语化（更自然、对话感）
   - 📝 正式（更书面、专业）
   - ✂️ 精简（删除冗余、压缩表达）
   - 📖 扩展（补充细节、丰富表达）
3. 点击按钮 → 按钮显示 loading → AI 返回结果 → 直接替换选中文本
4. 取消选中或点击编辑器其他位置 → 工具栏消失

### 浮动工具栏定位

- 监听 textarea 的 `mouseup` 和 `keyup` 事件
- 通过 `selectionStart` / `selectionEnd` 判断是否有选中文本
- 位置：利用一个隐藏的 mirror div 计算选中文本的视觉坐标，将工具栏绝对定位到选区上方
- 备选简化方案：工具栏固定出现在 textarea 上方（选中文本时显示），避免复杂的坐标计算

### API

```
POST /api/studio/polish
```

请求：
```json
{
  "text": "选中的文本",
  "tone": "casual" | "formal" | "concise" | "expand",
  "platform": "xhs" | "twitter" | "article",
  "context": "选中文本前后各 200 字的上下文（可选）"
}
```

响应：
```json
{
  "result": "润色后的文本"
}
```

### Prompt 设计

- 系统提示：你是一位专业的中文编辑，负责对文本进行语气调整
- 明确当前平台风格（小红书活泼、Twitter 精炼、公众号专业）
- 传入上下文帮助 AI 理解语境，但只改写选中部分
- 输出要求：只返回改写后的文本，不要解释

### 前端改动

- `draft-editor.tsx`：新增选中检测 + 浮动工具栏组件
- 新建 `components/studio/polish-toolbar.tsx`：浮动工具栏 UI + API 调用
- `studio-page.tsx`：无需改动（状态通过 editor 的 onChange 回传）

### 不做

- 不创建版本快照（润色是微操作，频繁快照是噪音）
- 不做 diff 预览（直接替换，textarea 原生 undo 可撤销）
- 不做自定义 prompt（4 个预设覆盖 90% 场景）

---

## D1 自由写作

### 交互设计

1. Studio 页面顶部工具栏新增「新建」按钮（当前只有从日报进入的路径）
2. 点击「新建」→ 清空编辑器状态 → 用户直接在空白编辑器中写作
3. 平台选择、手动保存、版本历史、导出、配图 → 全部复用现有能力
4. AI 生成按钮仍然可用：
   - 有素材时 → 现有逻辑（从素材生成）
   - 无素材但有内容 → AI 基于已有内容润色/扩写
   - 无素材无内容 → 提示用户先写点内容或选择素材

### 前端改动

- `studio-page.tsx`：顶部加「新建」按钮，点击后重置 state（id=null, title='', content='', sourceIds=[]）
- `source-picker.tsx`：素材选择变为可选步骤，不再是必须
- AI 生成按钮：无素材时改提示文案（「AI 润色」替代「AI 生成」）

### 后端改动

- `generator.ts`：增加无素材分支
  - 检测 `sourceIds.length === 0`
  - 使用「基于已有内容 + 平台风格 + style profile」的 prompt
  - 不走 source 收集逻辑
- `queries.ts`：`createDraft()` 允许空 sourceIds（当前已支持）

### 无素材生成 Prompt

- 角色：你是一位内容创作者，当前平台为 {platform}
- 任务：基于用户已写的草稿内容，进行润色、优化结构、补充细节
- 注入 style profile（如果有）
- 输出格式与现有平台 schema 一致

### 不做

- 不做 AI 选题推荐（用户直接打标题更快）
- 不改数据库 schema（sourceIds 空数组已满足）
- 不加空白模板库（过度工程化）

---

## 文件改动清单

| 文件 | 改动 |
|---|---|
| `components/studio/polish-toolbar.tsx` | 新建：浮动工具栏组件 |
| `components/studio/draft-editor.tsx` | 改：集成选中检测 + 工具栏 |
| `components/studio/studio-page.tsx` | 改：新建按钮 + 无素材状态处理 |
| `components/studio/source-picker.tsx` | 改：素材选择变可选 |
| `app/api/studio/polish/route.ts` | 新建：润色 API |
| `lib/studio/generator.ts` | 改：增加无素材生成分支 |

---

## 明确排除

- 不做：富文本编辑器升级（textarea 够用，升级是另一个项目）
- 不做：协作写作（单用户产品）
- 不做：AI 对话式写作助手（scope 太大）
- 不做：润色历史记录（靠版本快照已够用）
