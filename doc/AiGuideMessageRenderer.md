# 📘 aiGuideMessageRenderer 设计文档（Engineering Spec）

## 1. 背景与目标

### 1.1 背景

aiGuide 是 eduNest 中的 **AI 教学助手**，其输出内容具有以下特征：

* 高比例包含：

  * 数学公式（LaTeX）
  * 代码示例
  * 表格、列表、推理结构
  * 教学强调（注意 / 结论 / 错误）
* 内容 **由 AI 动态生成**
* 内容 **会随着对话不断更新**
* 使用场景以 **学习理解** 为主，而非闲聊

因此，**aiGuide 消息不能按普通 chat message 直接渲染字符串**。

---

### 1.2 目标

`aiGuideMessageRenderer` 的目标是：

1. **稳定**：

   * 不因 React/Vue 重渲染而丢 Canvas / KaTeX
   * 不出现公式源码闪烁
2. **可扩展**：

   * 未来可支持 SVG / 图示 / 交互提示
3. **安全**：

   * 不直接 innerHTML 渲染 AI 输出
4. **教学友好**：

   * 结构清晰、层次明确、强调突出

---

## 2. 职责边界（非常重要）

### aiGuideMessageRenderer **负责**

* 将 **AI 输出文本** → **结构化教学内容**
* 渲染：

  * 数学公式（KaTeX）
  * 代码块
  * 表格
  * 列表
  * 教学提示（callout）
* 管理渲染生命周期（DOM ready / nextTick / watch）

### aiGuideMessageRenderer **不负责**

* AI prompt 设计
* 对话状态管理（messages array）
* 网络请求 / streaming
* 语音合成触发逻辑（只接收按钮回调）

---

## 3. 输入 / 输出接口定义

### 3.1 输入 Props（推荐）

```ts
interface AIGuideMessageRendererProps {
  /** AI 输出的原始内容（Markdown + LaTeX） */
  content: string;

  /** 消息唯一 id，用于 key / effect */
  messageId: string;

  /** 是否为最新消息（可用于动画或强调） */
  isLatest?: boolean;
}
```

> ⚠️ 约束
>
> * `content` 永远是 **纯文本**
> * 不允许传 HTML 字符串

---

### 3.2 输出

* 一个 **安全、完整渲染的 React/Vue 节点**
* 不返回 string
* 不返回 dangerouslySetInnerHTML

---

## 4. 支持的内容类型（MUST）

### 4.1 数学公式（KaTeX）

#### 输入形式（AI 输出）

* 行内：

  ```
  $a^2 + b^2 = c^2$
  ```
* 块级：

  ```
  $$\int_0^1 x^2 dx$$
  ```

#### 强制规则

* ❌ 禁止直接显示 `$...$`
* ✅ 必须使用 KaTeX 渲染
* ✅ 必须在 **DOM 更新完成后再渲染**

#### 工程要求（Cursor 必须实现）

```ts
function renderMath(container: HTMLElement): void {
  if (typeof renderMathInElement !== 'function') return;

  try {
    renderMathInElement(container, {
      delimiters: [
        { left: '$$', right: '$$', display: true },
        { left: '$', right: '$', display: false }
      ],
      throwOnError: false
    });
  } catch (e) {
    console.error('KaTeX render failed', e);
  }
}
```

触发时机（至少一个）：

* message content 改变后
* stage / v-if / conditional render 后
* nextTick / useEffect / mounted 之后

---

### 4.2 代码块（Code Blocks）

#### 输入形式

````markdown
```js
function add(a, b) {
  return a + b;
}
```
````

#### 渲染要求

* 使用 `<pre><code>`
* 保留缩进
* 禁止执行
* 可选：copy button

#### 推荐组件

```tsx
<CodeBlock language="js" code="..." />
```

---

### 4.3 表格（Tables）

#### 输入形式

```markdown
| Step | Action | Result |
|------|--------|--------|
| 1    | Input  | 5      |
```

#### 渲染要求

* 转换为 `<table>`
* 外层必须可横向滚动（移动端）

---

### 4.4 列表（Lists）

支持：

* 有序列表
* 无序列表
* 嵌套列表（至少 2 层）

---

### 4.5 教学强调 / Callout（强烈推荐）

#### AI 常见输出

```
⚠️ 注意：这是一个常见错误
✅ 正确做法是……
❌ 错误示例
👉 结论
```

#### 推荐映射

| 触发文本    | 渲染组件                         |
| ------- | ---------------------------- |
| ⚠️ / 注意 | `<Callout type="warning" />` |
| ✅       | `<Callout type="success" />` |
| ❌       | `<Callout type="error" />`   |
| 👉      | `<Callout type="info" />`    |

---

## 5. 渲染管线（Cursor 实现重点）

### 5.1 推荐流程

```
AI raw text
   ↓
Markdown parser
   ↓
AST / React nodes
   ↓
Render to DOM
   ↓
nextTick / useEffect
   ↓
KaTeX render
```

---

### 5.2 生命周期强制要求

#### React 示例（伪代码）

```tsx
const containerRef = useRef<HTMLDivElement>(null);

useEffect(() => {
  if (!containerRef.current) return;

  requestAnimationFrame(() => {
    renderMath(containerRef.current!);
  });
}, [content]);
```

#### Vue 示例（伪代码）

```ts
watch(
  () => props.content,
  async () => {
    await nextTick();
    renderMath(containerRef.value);
  }
);
```

---

## 6. 安全要求（MUST）

* ❌ 禁止 `dangerouslySetInnerHTML`
* ❌ 禁止直接渲染 AI 输出 HTML
* ❌ 禁止 SVG 中的 `<script>`
* ✅ Markdown → React/Vue nodes
* ✅ 白名单标签

---

## 7. Web Speech API 规则（重申）

* ❌ 禁止自动朗读
* ✅ **只能**由用户点击按钮触发
* aiGuideMessageRenderer **不直接调用** speech API
* 只暴露 callback / hook

---

## 8. 最小实现清单（Cursor Checklist）

Cursor 在实现时，**至少完成以下项才算合格**：

* [ ] Markdown 渲染（非 innerHTML）
* [ ] KaTeX 二次渲染（nextTick 后）
* [ ] 代码块组件
* [ ] 表格可滚动
* [ ] 列表结构正常
* [ ] 不因 message 更新导致公式失效
* [ ] 不出现 `$...$` 源码裸露
* [ ] 无控制台报错

---

## 9. 未来扩展（非当前必做）

* SVG / diagram renderer
* Mermaid 支持
* 可交互教学提示（highlight UI）
* AI 输出 → JSON AST（下一阶段）

---

## 10. 一句话给 Cursor 的“总指令”

> **This renderer is not a chat bubble.
> It is a structured educational content renderer.
> Stability and clarity are more important than visual effects.**

---
