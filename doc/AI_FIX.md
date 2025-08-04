# 🧾 功能需求文档：内容生成与修改系统

---

## 📌 页面目标

该页面用于根据用户输入的知识点与学习阶段自动生成一个 Vue 交互式项目（HTML/CSS/JS），并在页面内即时渲染。

* 用户首次输入知识点 → 自动生成可运行的 Vue 交互代码
* 如果生成代码存在渲染错误 → 捕捉错误并展示给用户，用于提交修复
* 用户也可手动修改内容需求 → 提交生成修复后的代码
* 所有修复请求只能修改代码与依赖，保留原内容结构（标题、描述等）

---

## 🧱 页面模块结构

```text
[1] 初始输入模块 <KnowledgeForm>
    - 输入：知识点（string），学习维度（下拉）
    - 提交后隐藏

[2] 内容展示与渲染模块 <CodePreview>
    - 展示生成后的代码（HTML / CSS / JS）
    - 渲染 iframe 预览区
    - 捕捉 iframe 渲染错误并传回主页面

[3] 修改与修复模块 <FixForm>
    - textarea：展示错误信息或填写修改要求
    - 按钮：“提交修改”按钮
    - 提交后调用模型进行代码修复，仅更新代码部分
```

---

## 📤 表单交互流程

### ✅ 第一次生成内容流程

1. 用户输入知识点与学习维度，点击“生成”
2. 向生成 API 发送请求
3. 获取模型返回内容（包含 HTML / CSS / JS / external\_links 等）
4. 渲染：

   * 显示代码内容
   * 将代码内容注入 iframe 中运行
5. 切换 UI：

   * 隐藏输入表单
   * 显示代码块 + 修改区域

---

### 🔁 后续修改逻辑流程

#### 情况1：自动错误修复

* iframe 渲染失败，错误通过 `window.onerror` 捕获，postMessage 发给主页面
* 主页面将错误写入 textarea 中，用户点击“重新生成”
* 将错误 + 当前代码发送至模型 API，返回修复后的代码并更新预览

#### 情况2：手动需求修改

* 用户在 textarea 中填写改动要求（如“加点背景动画”）
* 提交时同样附上当前代码与修改请求 → 模型返回新代码 → 更新渲染

---

## 🧠 错误捕捉说明（重点）

### ✅ 错误捕捉放在 iframe 内部的原因：

1. **沙盒隔离**：iframe 内容在隔离环境中运行，主页面无法直接捕捉运行时错误（例如 `ReferenceError`、组件渲染错误）
2. **跨域或构建错误**不会冒泡到主窗口，必须在 iframe 页面内部监听

### 推荐 iframe 嵌套逻辑（前端代码注入）：

```html
<script>
  window.onerror = function (message, source, lineno, colno, error) {
    const payload = {
      type: 'RENDER_ERROR',
      message,
      source,
      lineno,
      colno,
      stack: error?.stack,
    };
    parent.postMessage(payload, '*');
  };
</script>
```

然后主页面监听：

```ts
window.addEventListener('message', (e) => {
  if (e.data?.type === 'RENDER_ERROR') {
    showFixFormWithError(e.data.message + '\n' + e.data.stack)
  }
})
```

---

## 🧩 数据结构

### 📌 content 数据结构

| 字段名             | 类型        | 说明                        |
| --------------- | --------- | ------------------------- |
| id              | string    | 内容唯一 ID                   |
| title           | string    | 内容标题                      |
| description     | string    | 内容简介及操作说明                 |
| html            | string    | HTML 代码                   |
| css             | string    | CSS 代码                    |
| js              | string    | JS 代码，使用 `<script setup>` |
| external\_links | string\[] | 外部依赖                      |
| tags            | string\[] | 标签                        |
| content\_type   | string    | 固定为 `"vue"`               |
| language        | string    | 语言代码，例如 `"zh-CN"`         |
| source\_uuid    | string    | 来源内容 ID（若由修改生成）           |

---

## 🔧 接口说明（可用于 Cursor 后端定义）

### POST `/api/content/create`

用于生成初始内容。

```json
{
  "knowledge_point": "牛顿第二定律",
  "stage": "understanding",
  "language": "zh-CN"
}
```

返回：

```json
{
  "title": "...",
  "description": "...",
  "html": "...",
  "css": "...",
  "js": "...",
  "external_links": [...],
  "tags": [...],
  "content_type": "vue",
  "language": "zh-CN"
}
```

---

### POST `/api/content/fix`

用于提交修改代码的请求。

```json
{
  "content_id": "abc123",
  "note": "修复ReferenceError: mySound未定义",
  "html": "...",
  "css": "...",
  "js": "...",
  "external_links": [...]
}
```

返回：

```json
{
  "html": "...",
  "css": "...",
  "js": "...",
  "external_links": [...]
}
```

---
## FIX PROMPT

### System Prompt
You are an expert Vue 3 frontend developer and educational UI engineer.
Your task is to **fix and improve** an interactive Vue 3 educational project.
Only modify the following fields in the provided JSON:
- `{{html}}`
- `{{css}}`
- `{{js}}`
- `{{external_links}}`
Constraints:
- Use Vue 3 with `<script setup>` style via production CDN:  
  https://unpkg.com/vue@3/dist/vue.global.prod.js
- Use Tone.js v14.8.49 (for all sounds):  
  https://cdnjs.cloudflare.com/ajax/libs/tone/14.8.49/Tone.min.js
- All code must be runnable in a browser-based sandbox with three panes: HTML, CSS, JavaScript.
- No build tools, bundlers, or .vue files are allowed.
- All external libraries must be loaded via production CDN (e.g., unpkg, cdnjs).
- Ensure mobile and desktop compatibility.
- Only output valid JSON with the following format:
  {
    "html": "...",
    "css": "...",
    "js": "...",
    "external_links": ["..."]
  }
If you receive error logs, fix the specific issue.
If you receive a user modification note, apply it as a functional update or enhancement.
Do not change project structure or title. Focus only on fixing code or updating interactivity/behavior.

### User Prompt
The current Vue 3 project has the following issue:
{{user_input}}
Please analyze the input above. If it contains an error message, fix the error while preserving the intended functionality.  
If it contains a feature change request, implement the update accordingly.
Only modify the following code fields: `html`, `css`, `js`, and `external_links`.  
Do not change any other fields in the project.



## 🧪 测试建议

| 场景              | 预期                             |
| --------------- | ------------------------------ |
| 输入知识点 → 正确生成    | 显示代码 + 渲染预览                    |
| 生成后渲染失败（缺失依赖）   | 错误显示在 textarea，允许提交修复          |
| 用户填写“请添加背景音效”   | 返回的代码加入 Tone.js 背景音乐           |
| 手动添加语法错误 → 自动捕捉 | iframe 内 postMessage 报错并显示错误提示 |

---

