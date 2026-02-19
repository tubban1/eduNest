# user_init_context 存储与提交给 AI

## 1. init_context 如何写入数据库

- **登录用户**  
  - 表：`user_init_context`（字段：`id`, `user_id` 唯一, `context` JSONB, `created_at`, `updated_at`）。  
  - 接口：`POST /api/onboard/context`，body `{ context: { role, region, subjects, age?, birthYear?, ... } }`。  
  - 校验：必须含 `region`、`subjects`（数组）、`role`（student | parent | teacher）。  
  - 后端按 `user_id` **upsert**，整份 `context` 写入 `context` 列。

- **访客**  
  - 表：`visitor_init_context`（按 `visitor_id` 唯一，同样用 `context` JSONB）。  
  - 接口：`POST /api/onboard/visitor-context`。  
  - 注册后 merge-on-login 会合并到 `user_init_context` 并同步 `users.role`。

示例一条 `context`（parent）：

```json
{
  "role": "parent",
  "region": "CH",
  "subjects": ["science", "politics", "history", "programming"],
  "birthYear": 2014,
  "age": 12
}
```

---

## 2. age / birthYear 的语义（按 role 明确对象）

**同一套字段 `age`、`birthYear` 在不同 role 下指代不同对象**，在提示词里必须按 role 区分，否则会歧义。

| role     | age / birthYear 指代对象 | 说明 |
|----------|--------------------------|------|
| student  | **学生本人**             | 当前学习者的年龄/出生年 |
| parent   | **被辅导的孩子**         | 家长在辅导的孩子的年龄/出生年，不是家长本人 |
| teacher  | 不使用 age/birthYear     | 使用 `teachingAgeRanges` 表示教学对象年龄段 |

你看到的 parent 示例里 `"age": 12, "birthYear": 2014` 表示：**孩子** 2014 年生、当前 12 岁，不是家长本人。

---

## 3. init_context 如何提交给 AI（仅生成内容时）

**实现位置**：`edu/backend/src/services/aiService.js`

- **时机**：调用 **aiService 生成教育内容**（`generateEducationalContent`）时；**aiGuide 对话不注入**。
- **读取**：登录用户按 `user_id` 查 `user_init_context.context`（生成接口需认证，仅 user_id）。
- **拼装**：`buildUserContextPrompt(ctx, role)` 只拼 role + 年龄相关一句：  
  - **student**：The student is X years old.  
  - **parent**：The parent's child is X years old.  
  - **teacher**：Teaching age ranges: ….
- **注入**：将上述文案拼到生成用的 system prompt 末尾：  
  `USER CONTEXT (who you are generating content for — tailor tone and level accordingly):\n{userContextStr}`  

这样 AI 在**生成互动/动画内容**时会按角色和年龄调整难度与表述；aiGuide 对话不再带这段上下文。
