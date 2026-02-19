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

### 3. Skill 生成 HTML 的职责

- **输入**（Skill 接口设计建议）：
  - 内容配置（来自 Markdown 清单，见下一节），包括：
    - `id` / `short_id`（建议）  
    - 标题 / 学科 / 年级 / 目标知识点  
    - 建议使用的库（如 `["vue", "three", "gsap"]`）  
    - 简要交互描述（如「拖动滑块控制抛物线参数 a、h、k」）
- **输出**：
  - 对应的 `public/content/html/<short_id>.html`（路径可根据现有项目实际约定微调）
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

### 1. 列表与内容映射

- 在 EduNest 系统中，为这些交互 HTML 创建一个专用 `list`（如「交互实验合集」）；
- 每个 Markdown 条目对应：
  - 一条 `content` 记录（含 `short_id` / `title` / 元数据）；
  - 一条 `list_item` 记录将其挂到该 `list` 下；
  - 其 `full_html` 或 `standalone` 渲染指向生成的 HTML 文件。

Skill 或后台任务可以：

- 遍历 Markdown 清单；
- 对于尚未存在的 `content.id`：
  - 调用后端 API 创建内容，并将生成的 HTML 路径关联进去；
  - 将内容加入指定 `list` 中。

### 2. 免费预览前三个内容

在列表层面约定一个**访问策略**（可在文档或配置中声明）：

- 对该 `list` 挂载的内容，按某种序（例如 `sort_order` 或 `created_at` 升序）排序；
- 对所有用户（含未登录）：
  - **前 3 条**：允许完整预览（不校验解锁状态）；
  - 第 4 条及之后：
    - 若当前设备/用户未解锁对应密钥，则只展示：
      - 简要介绍 / 缩略图 / 预览 GIF；
      - 引导文案（提示输入密钥解锁）。

该策略可在后端中通过一个通用的「访问检查」函数实现，例如：

- 输入：`userId | visitorId | deviceId`, `contentId`, `listId`
- 输出：`{ canViewFull: boolean, reason?: 'preview_only' | 'locked' }`

---

## 四、密钥授权与设备绑定设计

### 1. 密钥与设备绑定规则

- **密钥粒度**: 建议与「一个 list」或「一个课程包」绑定，而不是单个 content。
- **使用规则**：
  - 一串密钥（如 `ABCDE-FGHIJ-KLMNO`）最多可在 **3 台设备** 上激活；
  - 一旦某设备激活成功：
    - 后续在该设备上访问该 list 的任何内容，无需再次输密钥；
    - 登录与否不影响本设备的解锁状态（但可额外与 user_id 关联）。

### 2. 数据结构建议（后端表，可在后续实现时参考）

- `access_keys`
  - `id` / `key`（hash 存储）  
  - `list_id` / `product_id`  
  - `max_devices`（默认 3）  
  - `status`（active / revoked）
- `access_key_devices`
  - `access_key_id`
  - `device_id`（如基于浏览器指纹 + visitor_id 的稳定 ID）
  - `user_id`（可选，已登录时记录）
  - `activated_at`

### 3. 访问判定流程

1. 前端在本地维护一个稳定的 `device_id`（可复用当前 visitor_id 方案，或额外生成）。
2. 访问 list 中 **第 4 条及之后**内容时：
   - 后端检查：
     - 是否存在 `access_key_devices` 记录（该 list 对应的任意 key，在该 `device_id` 上已激活）；
     - 或该 `user_id` 已被授予此 list 的永久访问权限。
3. 若未解锁：
   - 前端展示「输入密钥」对话框；
   - 用户输入密钥，后端验证：
     - key 是否有效、是否属于当前 list；
     - 已绑定的设备数量 `< max_devices`。
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

