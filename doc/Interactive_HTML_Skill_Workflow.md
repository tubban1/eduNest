## 目标概述

本方案定义一套 **通过 Skill 自动批量生成交互式 HTML 内容 → 导入 EduNest 列表 → 按密钥解锁** 的完整工作流，供后续实现 Skill（MCP / Cursor Skill）时遵循。

- **内容形态**: 单文件 HTML，内部使用 Vue、Three.js、GSAP 等在 `backend/config/supported-libraries.json` 与 `backend/config/libraries_cn.json` 中宣告的依赖库与 fallback 库，构建高度交互的教学场景。
- **生成方式**: 通过 Skill 从一个 Markdown 内容清单读取配置，一条条生成对应 HTML 文件。
- **分发方式**: 将 HTML 内容批量导入到 EduNest 的一个 list 中，支持「前 3 个免费预览，更多内容需密钥解锁」。
- **授权策略**: 每个密钥最多可绑定 3 台设备；设备一旦解锁，无需再次输入密钥。

---

## 一、通过 Skill 快速创建交互式 HTML（Vue + Three + GSAP 等）

### 1. 技术约束与依赖解析

- **统一依赖声明来源**
  - 主配置：`backend/config/supported-libraries.json`
  - 国内加速 / fallback：`backend/config/libraries_cn.json`
- Skill 在生成 HTML 时 **不得手写 CDN URL**，而是：
  1. 解析上述 JSON，获得库名 → 版本 → CDN URL / fallback 文件名 的映射；
  2. 根据需要的库（`vue` / `three` / `gsap` / `three-orbit-controls` / `chartjs` 等）生成 `<script>` / `<link>` 标签；
  3. 若需要中国大陆加速，则优先使用 `libraries_cn.json` 中的 URL，找不到再回退到 `supported-libraries.json`。

### 2. HTML 基本结构约定

- **统一骨架**（示意）：
  - `<head>`: 
    - `<meta charset="utf-8">` / `<meta name="viewport" …>`  
    - 依赖库 `<script>` / `<link>`（Vue、Three、GSAP、Tailwind、FontAwesome 等）
    - 必要的全局样式（可以内联，也可引用 CSS CDN）
  - `<body>`:
    - 用于挂载 Vue 应用的根节点，如 `<div id="app"></div>`
    - 可选：全屏 Canvas / Three.js 场景容器
  - `<script>`:
    - 初始化 Vue 应用（例如 Vue 3 `createApp`）
    - 注册组件 / 配置路由（如需）
    - 初始化 Three.js 场景 / GSAP 动画时间线等

### 2.1 Skill 输出：每条目两个文件（abc.html + abc.json）

- **约定**：每个内容条目由**一对文件**组成，**同名不同扩展名**：
  - `{id}.html`：完整 HTML 文件，可单独打开验证。
  - `{id}.json`：该条目的元数据与不能放 HTML 的字段。
- **配对规则**：导入时按「主文件名」配对，例如 `quadratic_parabola_intro.html` 与 `quadratic_parabola_intro.json` 视为一条。

### 2.2 abc.json 格式（与 abc.html 同名的 JSON）

- 文件名：与对应 HTML 同名，如 `quadratic_parabola_intro.json`。
- 结构示例：
  ```json
  {
    "title": "二次函数抛物线交互实验",
    "description": "通过拖动滑块实时观察 y=a(x-h)^2+k 中 a、h、k 对图像的影响",
    "tags": ["function", "parabola", "visualization"],
    "language_code": "zh-CN",
    "content_type": "vue",
    "svg_thumbnail": "<svg xmlns=\"http://www.w3.org/2000/svg\">...</svg>",
    "order": 0
  }
  ```
- **字段说明**：
  - `title`（必填）：内容标题
  - `description`（可选）：简短描述
  - `tags`（可选）：字符串数组
  - `language_code`（可选）：BCP47，默认 `zh-CN`
  - `content_type`（可选）：如 `vue`，默认 `vue`
  - `svg_thumbnail`（可选）：列表/卡片缩略图 SVG 字符串（不能放 HTML 内）
  - `order`（可选）：在列表中的顺序，导入时按此排序

### 2.3 HTML 内嵌元数据（可选，与 abc.json 二选一或互补）

- 若希望**单 HTML 文件**也能被解析，可在 `<head>` 中增加元数据块（导入时未提供 json 或未传同名字段则从此解析）：
  ```html
  <script type="application/edu-content-meta" id="edu-meta">
  {"title":"...","description":"...","tags":[],"language_code":"zh-CN","content_type":"vue"}
  </script>
  ```
- 导入时**优先级**：请求体 / 前端组装的 item > abc.json > HTML 内 edu-meta。

### 2.4 批量导入：选择文件夹

- 用户操作：在「批量导入」页点击**选择文件夹**，选中包含多对 `abc.html` + `abc.json` 的目录。
- 前端逻辑：
  1. 读取选中目录下的所有文件（或用户多选的所有文件）。
  2. 按主文件名配对：每个 `*.html` 匹配同名的 `*.json`（无 json 时仅用 html，元数据从 HTML 内 edu-meta 解析或留空）。
  3. 每条组装为：`full_html` = html 文件内容，`title`/`description`/`tags`/`language_code`/`content_type`/`svg_thumbnail` 从同名 json 读取（若有）。
  4. 调用批量导入 API。
- 单次最多 100 条；仅包含至少一个 `.html` 的配对会参与导入。

### 3. Skill 生成 HTML 的职责

- **输入**（Skill 接口设计建议）：
  - 内容配置（来自 Markdown 清单，见下一节），包括：
    - `id` / `short_id`（建议）  
    - 标题 / 学科 / 年级 / 目标知识点  
    - 建议使用的库（如 `["vue", "three", "gsap"]`）  
    - 简要交互描述（如「拖动滑块控制抛物线参数 a、h、k」）
- **输出**（每条目两个文件，见 §2.1）：
  - `{id}.html`：完整 HTML；同目录下对应 `{id}.json`（元数据，含 title、description、tags、svg_thumbnail 等）。
  - 路径可根据现有项目约定，如 `public/content/html/<id>.html`。
  - HTML 内保证：
    - 所有外部依赖来自上述 JSON 配置；
    - 入口 `init()` 或 `main()` 中有清晰的舞台初始化逻辑（例如创建场景、相机、灯光、事件绑定等）。

Skill 实现时，可以预置若干 **模板类型**（如「函数图像交互」「几何变换」「物理模拟」「音乐节奏」等），再根据 Markdown 配置选择模板并填充参数，避免每次从零构造三维场景。

---

## 二、用 Markdown 清单驱动批量生成 HTML

### 1. Markdown 清单格式（建议）

新建文件：`doc/Interactive_HTML_Content_List.md`（文件名可按需要调整，但 Skill 需约定固定路径）。

示例结构：

```md
## 交互式 HTML 内容清单

### item: quadratic_parabola_intro
- id: quadratic_parabola_intro
- title: 二次函数抛物线交互实验
- subject: math
- grade: 8
- tags: [function, parabola, visualization]
- libraries: [vue, three, gsap]
- description: |
  通过拖动滑块实时观察 y=a(x-h)^2+k 中 a、h、k 对图像的影响，并结合学习目标说明。

### item: triangle_rotation
- id: triangle_rotation
- title: 三角形旋转与对称
- subject: math
- grade: 7
- tags: [geometry, rotation]
- libraries: [vue, gsap]
- description: |
  使用 2D Canvas + GSAP 展示三角形绕点旋转，学生可以拖动角度控制器。
```

### 2. Skill 对 Markdown 的处理流程

1. **解析清单**
   - 扫描所有以 `### item:` 开头的段落；
   - 抽取每个条目的字段：`id/title/subject/grade/tags/libraries/description`。
2. **为每个条目生成 HTML**
   - 构造目标文件名：`<id>.html` 或 `<id>.standalone.html`；
   - 根据 `libraries` 决定 `<script>` 依赖；
   - 根据 `description` / `subject` 选择模板并生成具体交互逻辑。
3. **幂等设计**
   - 若目标 HTML 已存在，可选择：
     - 覆盖模式：每次重生成（适合迭代开发）；
     - 跳过模式：仅新条目生成。
   - 具体策略可通过 Markdown 中额外字段 `mode: overwrite|skip` 指定，或通过 Skill 参数控制。

---

## 三、批量导入 EduNest 列表与试看/解锁机制

### 0. 与现有 List 页面对接

**实现参考**：`edu/frontend/src/app/list/[short_id]/page.tsx`

列表页面路由为 `/list/[short_id]`，**允许所有人访问**（含未登录用户）：

- **public 列表**：任何人可直接访问（未登录亦可）；**private 列表**仅创建者可访问。Skill 导入的列表需设置 `visibility = 'public'` 以允许访问。
- **API**：`GET /api/collection_lists/by-short-id/:short_id`（`optionalAuth`，未登录亦可调用）
- **数据映射**：
  - Markdown 中的 `list` 对应表 `collection_lists`
  - 每条内容挂载到列表：表 `user_collections`（`list_id` + `content_id`），按 `added_at` 排序
- **已实现的访问策略**：
  - `pricing_mode = 'free'`：全部内容可访问
  - `pricing_mode = 'premium'` / `'free_preview'`：前 3 条免费预览（`is_free_preview`），其余需购买/订阅（`is_accessible`）
  - 创建者、已购买用户、平台订阅用户：可访问全部（`can_access_all`）
- **后端逻辑**：`edu/backend/src/services/database.js` → `getCollectionListByShortId`

### 1. 列表与内容映射

- 在 EduNest 系统中，为这些交互 HTML 创建一个专用 `list`（即 `collection_lists` 中的一条记录）；
- 每个 Markdown 条目对应：
  - 一条 `content` 记录（含 `short_id` / `title` / 元数据）；
  - 一条 `user_collections` 记录将其挂到该 `list` 下（`list_id` + `content_id`）；
  - 其 `full_html` 或 `standalone` 渲染指向生成的 HTML 文件。

**批量导入方式（任选其一）：**

1. **批量导入 API（推荐）**  
   - 接口：`POST /api/collection_lists/:listId/import`  
   - 鉴权：需登录，且 `listId` 的列表创建者为本用户。  
   - 请求体：`items` 为数组，每条**必填** `full_html`（HTML 文件内容）；**可选** `title`、`description`、`tags`、`language_code`、`content_type`、`svg_thumbnail`。  
   - **从 HTML 解析**：若未传 `title`/`description`/`tags`/`language_code`/`content_type`，服务端会从 HTML 内的 `<script type="application/edu-content-meta" id="edu-meta">{"title":"...",...}</script>` 解析（见 §2.1）。  
   - **不能放 HTML 的字段**：`svg_thumbnail` 等由请求体或 manifest 提供（见 §2.2）。  
   - 请求体示例（含 manifest 字段）：
     ```json
     {
       "items": [
         {
           "full_html": "<!DOCTYPE html><html><head><script type=\"application/edu-content-meta\" id=\"edu-meta\">{\"title\":\"二次函数抛物线交互实验\",\"description\":\"...\",\"tags\":[\"function\",\"parabola\"],\"language_code\":\"zh-CN\",\"content_type\":\"vue\"}</script></head><body>...</body></html>",
           "svg_thumbnail": "<svg xmlns=\"http://www.w3.org/2000/svg\">...</svg>"
         }
       ]
     }
     ```
   - 说明：单次最多 100 条；每条会先创建 `content`（含 `full_html`、可选 `svg_thumbnail`），再写入 `user_collections` 挂到该列表。  
   - 返回：`{ success, created, failed, results: [{ id, short_id, title }], errors?: [...] }`。

2. **Skill / 脚本逐条调用**  
   - 遍历 Markdown 清单或本地 HTML 文件；  
   - 对每条：先 `POST /api/content` 创建内容，再 `POST /api/user_collections` 传入 `content_id` 与 `list_id` 加入列表。  
   - 需在请求头中带登录态（Bearer Token）。

3. **本地 HTML 文件**  
   - 若 HTML 在本地（如 `public/content/html/xxx.html`），需先读成字符串再作为 `full_html` 传入上述批量 API 或 `/api/content`；当前内容以「存 DB 的 full_html」为主，不直接支持「仅填 URL 不存 HTML」。

### 2. 免费预览前三个内容

**当前实现**（`database.js` → `getCollectionListByShortId`）：

- 内容按 `user_collections.added_at` 升序排序；
- `FREE_PREVIEW_COUNT = 3`：前 3 条 `is_free_preview = true`，`is_accessible = true`（所有人可访问）；
- 第 4 条及之后：根据 `pricing_mode` 与用户状态决定 `is_accessible`。

**约定**（与 Skill 生成的列表保持一致）：

- 对所有用户（含未登录）：
  - **前 3 条**：允许完整预览（`is_accessible = true`），点击跳转 `/c/[short_id]`；
  - 第 4 条及之后：
    - 若未解锁：仅展示缩略图/简介，点击提示购买或输入密钥（密钥方案见第四节）；
    - 若已解锁：可访问完整内容。

**访问检查**（可扩展）：

- 输入：`userId | visitorId | deviceId`, `contentId`, `listId`
- 输出：`{ canViewFull: boolean, reason?: 'preview_only' | 'locked' }`

---

## 四、密钥授权与设备绑定设计

### 0. 数据库迁移

**执行 SQL 迁移**：
```bash
# 在 Supabase SQL Editor 或 psql 中执行
psql -f edu/backend/migrations/interactive_html_workflow_tables.sql
```

迁移文件包含：
- `collection_lists.language_code` 字段添加（单一语言，BCP47 格式）
- `access_keys` 表创建
- `access_key_devices` 表创建
- `list_device_access` 视图创建
- 索引和触发器

### 1. 密钥与设备绑定规则

- **密钥粒度**: 建议与「一个 list」或「一个课程包」绑定，而不是单个 content。
- **设备标识方案**：使用 **UUID + localStorage**（方案 2）
  - 前端首次访问时生成 UUID → 存储到 localStorage → 后续一直使用该 ID
  - **推荐复用 `visitor_id`**（格式：`visitor-{uuid}`），已存在于 `utils/visitorId.ts`
  - 也可单独创建 `device_id`（纯 UUID），与 `visitor_id` 解耦
- **使用规则**：
  - 一串密钥（如 `ABCDE-FGHIJ-KLMNO`）最多可在 **3 台设备** 上激活；
  - 一旦某设备激活成功：
    - 后续在该设备上访问该 list 的任何内容，无需再次输密钥；
    - 登录与否不影响本设备的解锁状态（但可额外与 user_id 关联）；
    - 用户清除 localStorage 会生成新的 device_id，视为新设备（符合「3 台设备」的预期）。

### 2. 数据结构（后端表）

**SQL 迁移文件**：`edu/backend/migrations/interactive_html_workflow_tables.sql`

#### 2.1 collection_lists 表扩展

- **language_code**（`TEXT`）：列表的主要语言代码（BCP47 格式，如 `zh-CN`、`en-US`）
  - **单一语言设计**：简化查询和匹配逻辑（`WHERE language_code = 'zh-CN'`）
  - **默认值**：`NULL`（表示未设置或不限语言）
  - **多语言列表处理**：
    - 方案 A：创建多个单语言列表（推荐，便于管理和筛选）
    - 方案 B：使用 `NULL` 表示「不限语言/多语言混合」
  - **索引**：`idx_collection_lists_language_code`（用于按语言筛选列表）

#### 2.2 access_keys 表（密钥管理）

- `id`（uuid）：主键
- `key_hash`（text）：密钥的哈希值（用于验证，不存储明文）
- `key_display`（text）：密钥的显示格式（如 `ABCDE-FGHIJ-KLMNO`），用于展示给用户
- `list_id`（uuid）：关联的列表（外键 → `collection_lists.id`）
- `product_id`（uuid）：可选，未来扩展为课程包等产品
- `max_devices`（integer）：该密钥最多可绑定的设备数量，默认 3
- `status`（text）：状态（`'active'` / `'revoked'`），默认 `'active'`
- `created_by`（uuid）：创建者（外键 → `users.id`）
- `created_at` / `updated_at` / `revoked_at`：时间戳

#### 2.3 access_key_devices 表（密钥与设备绑定）

- `id`（uuid）：主键
- `access_key_id`（uuid）：关联的密钥（外键 → `access_keys.id`）
- `device_id`（text）：设备唯一标识（UUID 格式）
  - **实现方案**：前端首次访问时生成 UUID → 存储到 localStorage → 后续一直使用
  - **推荐**：复用 `visitor_id`（格式：`visitor-{uuid}`），已存在于 `utils/visitorId.ts`
  - **可选**：单独创建 `device_id`（纯 UUID），与访客统计解耦
- `user_id`（uuid）：用户ID（可选，已登录时记录）
- `activated_at`（timestamptz）：激活时间
- `user_agent` / `ip_address`：元数据（可选）
- 唯一约束：`(access_key_id, device_id)` - 同一密钥在同一设备上只能激活一次

#### 2.4 辅助视图

- `list_device_access`：快速查询视图，用于判断设备是否已通过密钥解锁某列表

### 3. 访问判定流程

1. **前端获取 device_id**：
   ```typescript
   // 方案 A：复用 visitor_id（推荐）
   import { getVisitorId } from '@/utils/visitorId';
   const deviceId = getVisitorId(); // 格式：visitor-{uuid}
   
   // 方案 B：单独创建 device_id（可选，与访客统计解耦）
   function getDeviceId(): string {
     if (typeof window === 'undefined') return '';
     let deviceId = localStorage.getItem('edu_device_id');
     if (!deviceId) {
       deviceId = crypto.randomUUID();
       localStorage.setItem('edu_device_id', deviceId);
     }
     return deviceId;
   }
   ```

2. **访问 list 中第 4 条及之后内容时**：
   - 后端检查（查询 `list_device_access` 视图）：
     - 是否存在 `access_key_devices` 记录（该 list 对应的任意 key，在该 `device_id` 上已激活）；
     - 或该 `user_id` 已被授予此 list 的永久访问权限（购买/订阅）。
3. **若未解锁**：
   - 前端展示「输入密钥」对话框；
   - 用户输入密钥，后端验证：
     - key 是否有效、是否属于当前 list（通过 `key_hash` 验证）；
     - 已绑定的设备数量 `< max_devices`（查询该 `access_key_id` 的绑定数）。
   - 成功则创建 `access_key_devices` 记录（`device_id` + 可选 `user_id`），返回 `canViewFull = true`。

---

## 五、Skill 视角下的整体流程总结

- **步骤 1：作者维护 Markdown 清单**
  - 在 `doc/Interactive_HTML_Content_List.md` 中添加/修改条目。

- **步骤 2：Skill 解析清单并生成 HTML**
  - 读取 Markdown；
  - 对每个 `item`：
    - 从 `supported-libraries.json` / `libraries_cn.json` 查出所需库；
    - 基于模板生成交互式 HTML 文件。

- **步骤 3：Skill 或后端批量导入 EduNest**
  - 为每个条目创建/更新 `content` 记录；
  - 将内容挂载到指定 `list`；
  - 配置「前 3 条免费预览」策略。

- **步骤 4：密钥分发与设备绑定**
  - 生成并发放 `access_keys`；
  - 用户在前端输入密钥后，由后端为该 `device_id` 绑定访问权限；
  - 后续访问在本设备上不再需要密钥。

此文档主要定义 **约定与工作流**，具体实现 Skill 与后端 API 时，可按本规范对接。

---

## 六、剩余任务清单

以下为密钥相关功能的待实现项，按依赖顺序排列。已完成项已标记 ✓。

### 6.1 数据库（若需渠道维度）

- [x] **access_keys 表扩展**：新增 `channel_name`（TEXT，可选）字段，用于按渠道分组密钥 ✓
  - 迁移 SQL：`ALTER TABLE access_keys ADD COLUMN IF NOT EXISTS channel_name TEXT;`
  - 索引（可选）：`CREATE INDEX idx_access_keys_channel_name ON access_keys(channel_name) WHERE channel_name IS NOT NULL;`

### 6.2 后端 API

- [x] **批量生成密钥**：`POST /api/collection_lists/:listId/access-keys/batch` ✓
  - 入参：`{ channel_name?: string, count: number, max_devices?: number }`
  - 逻辑：生成 `count` 个密钥，写入 `access_keys`（`key_hash`、`key_display`、`list_id`、`channel_name`、`max_devices`）
  - 返回：`{ keys: Array<{ id, key_display, channel_name, max_devices, created_at }> }`
  - 权限：仅列表创建者可调用

- [x] **获取密钥列表**：`GET /api/collection_lists/:listId/access-keys` ✓
  - 返回：密钥列表，每条含 `key_display`、`channel_name`、`max_devices`、`status`、`bound_device_count`（已解锁设备数）
  - 权限：仅列表创建者可调用

- [x] **验证并绑定密钥**：`POST /api/collection_lists/:listId/access-keys/validate` ✓
  - 入参：`{ key: string, device_id: string }`（`device_id` 可从前端 `X-Device-Id` 或 `X-Visitor-Id` 获取）
  - 逻辑：校验 key_hash、status、bound_device_count < max_devices，成功则插入 `access_key_devices`
  - 返回：`{ success: boolean, can_access_all?: boolean }`
  - 权限：公开（未登录亦可，用于用户输入密钥解锁）

- [x] **getCollectionListByShortId 扩展**：在访问判定中增加「设备已通过密钥解锁」逻辑 ✓
  - 输入：`device_id`（通过请求头 `X-Device-Id` 或 `X-Visitor-Id` 传入）
  - 查询 `list_device_access` 视图，若存在该 `device_id` + `list_id` 且 `key_status = 'active'`，则 `can_access_all = true`

### 6.3 前端：列表设置页密钥管理

- [x] **渠道名输入框**：用于批量生成时标记密钥所属渠道（如「线下活动」「合作方 A」）✓

- [x] **数量输入框**：批量生成密钥的数量（如 10、50）✓

- [x] **批量生成按钮**：调用批量生成 API，成功后展示新生成的密钥列表（可复制）✓

- [x] **密钥列表展示**：表格或卡片，展示：✓
  - 密钥（`key_display`，支持一键复制、按渠道批量复制）
  - 渠道名（`channel_name`）
  - 已解锁设备数 / 最大设备数（`bound_device_count` / `max_devices`）
  - 状态（`active` / `revoked`）
  - 创建时间

- [ ] **可选**：撤销密钥、导出密钥为 CSV

### 6.4 前端：列表页解锁流程

- [x] **第 4 条及之后内容**：未解锁时展示「输入密钥」入口（按钮/弹窗）✓

- [x] **密钥输入弹窗**：用户输入密钥，调用验证 API，成功则刷新列表数据并关闭弹窗 ✓

- [x] **请求头**：列表页请求 `getCollectionListByShortId` 时携带 `X-Device-Id` 或 `X-Visitor-Id`（复用 `getVisitorId()`）✓

---

### 进度汇总

| 模块 | 状态 |
|------|------|
| 6.1 数据库 channel_name | ✅ 已完成 |
| 6.2 后端 API（4 项） | ✅ 已完成 |
| 6.3 设置页密钥管理 | ✅ 已完成（含按渠道批量复制） |
| 6.4 列表页解锁流程 | ✅ 已完成 |
| **剩余** | 撤销密钥、导出 CSV（可选） |

