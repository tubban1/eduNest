Ran tool
[MODE: PLAN]

下面是**清晰完整的API文档梳理**，每个API都标明了【✅保留/需聚合】【🆕需新增】【❌后续不需要】。每个API归属文件也已标注，便于后续重构和文件精简。

---

# AI 教育平台 API 文档（重构规划版）

---

## 1. 内容主线 `/content.js`

| API | 路径 | 说明 | 状态 |
|-----|------|------|------|
| GET | `/content` | 内容列表，聚合所有字段 | ✅ 已有，需确保聚合 |
| GET | `/content/:id` | 内容详情，聚合所有字段 | ✅ 已有，需确保聚合 |
| POST | `/content/:id/like` | 点赞内容 | 🆕 需新增（目前在user_collections.js） |
| DELETE | `/content/:id/like` | 取消点赞内容 | 🆕 需新增（目前在user_collections.js） |
| GET | `/content/:id/collections` | 获取内容被当前用户收藏到的所有分组id | 🆕 需新增（目前在user_collections.js） |
| POST | `/content/:id/collections` | 收藏内容到分组（body: { list_id }） | 🆕 需新增（目前在user_collections.js） |
| DELETE | `/content/:id/collections/:listId` | 取消收藏内容 | 🆕 需新增（目前在user_collections.js） |
| GET | `/content/short/:shortId` | 通过short_id获取内容 | ✅ 已有 |
| POST | `/content` | 创建内容 | ✅ 已有 |
| PUT | `/content/:id` | 编辑内容 | ✅ 已有 |
| DELETE | `/content/:id` | 删除内容 | ✅ 已有 |

---

## 2. 用户收藏/分组 `/user_collections.js`

| API | 路径 | 说明 | 状态 |
|-----|------|------|------|
| GET | `/user_collections/groups` | 获取我的所有收藏夹 | ✅ 已有 |
| POST | `/user_collections/groups` | 新建收藏夹 | ✅ 已有 |
| PUT | `/user_collections/groups/:groupId` | 编辑收藏夹 | ✅ 已有 |
| DELETE | `/user_collections/groups/:groupId` | 删除收藏夹 | ✅ 已有 |
| GET | `/user_collections/group/:groupId` | 获取某分组下的内容（聚合所有字段） | ✅ 已有，需确保聚合 |
| POST | `/user_collections` | 收藏内容到分组（老接口） | ❌ 后续不需要，已被 /content/:id/collections 替代 |
| DELETE | `/user_collections/:contentId/:listId` | 取消收藏内容（老接口） | ❌ 后续不需要，已被 /content/:id/collections 替代 |
| GET | `/user_collections/content/:contentId` | 获取内容的所有收藏列表（老接口） | ❌ 后续不需要，已被 /content/:id/collections 替代 |
| POST | `/user_collections/:contentId/like` | 点赞内容（老接口） | ❌ 后续不需要，已被 /content/:id/like 替代 |
| DELETE | `/user_collections/:contentId/like` | 取消点赞内容（老接口） | ❌ 后续不需要，已被 /content/:id/like 替代 |

---

## 3. 用户喜欢内容 `/user_content.js`

| API | 路径 | 说明 | 状态 |
|-----|------|------|------|
| GET | `/user_content/liked` | 获取我喜欢的内容（聚合所有字段） | ✅ 已有，需确保聚合 |

---

## 4. 分组管理 `/collection_lists.js`

- 只负责分组元数据管理（如排序、批量操作），如已合并到user_collections.js可删除。
- **状态**：❌ 后续不需要，功能合并到/user_collections/groups

---

## 5. 用户相关 `/users.js` `/auth.js`

| API | 路径 | 说明 | 状态 |
|-----|------|------|------|
| GET | `/users/me` | 获取当前用户信息 | ✅ 已有 |
| POST | `/auth/register` | 用户注册 | ✅ 已有 |
| POST | `/auth/login` | 用户登录 | ✅ 已有 |
| POST | `/auth/logout` | 用户登出 | ✅ 已有 |

---

## 6. AI 相关 `/ai.js`

| API | 路径 | 说明 | 状态 |
|-----|------|------|------|
| POST | `/ai/generate` | 智能内容生成 | ✅ 已有 |
| POST | `/ai/fix/:contentId` | 智能内容修复 | ✅ 已有 |

---

## 7. 其他辅助API

| API | 路径 | 说明 | 状态 |
|-----|------|------|------|
| GET | `/tags` | 获取标签列表 | ✅ 已有 |
| GET | `/languages` | 获取语言列表 | ✅ 已有 |

---

## 8. 字段说明

- **like_count**：内容被多少用户点赞
- **collect_count**：内容被多少用户收藏（去重用户，需修正SQL为COUNT(DISTINCT user_id)）
- **is_liked**：当前用户是否已点赞
- **is_collected**：当前用户是否已收藏
- **分组（收藏夹）**：{ id, name, visibility, order_index }

---

## 9. 说明

- 所有内容对象结构统一，所有聚合字段后端自动返回。
- 所有操作均为RESTful风格，便于前后端协作和维护。
- ❌ 标记的API和文件为后续不需要，迁移完成后可删除。
- 🆕 标记的API为需新增，重构时需补充。
- ✅ 标记的API为保留/需确保聚合字段。

---

如需详细SQL、字段示例或接口参数说明，可进一步细化！