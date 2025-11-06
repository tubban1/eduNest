# FullHTMLRenderer - 纯 HTML 渲染器

## 概述

`FullHTMLRenderer` 是一个高性能的纯 HTML 渲染器组件，用于直接渲染完整的 HTML 文件，不进行任何代码注入或修改。相比 `SandboxRenderer`，它：

- ✅ **性能更优**：文件大小减少 68-91%，无额外代码注入
- ✅ **执行可靠**：保持原始执行顺序，无执行时机问题
- ✅ **样式完整**：不注入重置样式，保持原始样式
- ✅ **内存占用低**：无额外组装开销

## 使用场景

适用于：
- 渲染完整的 HTML 文件（如 `public/math/*.html`）
- 需要保持原始执行顺序和样式的场景
- 大型 HTML 文件（2000+ 行）
- 性能敏感的应用

不适用于：
- 需要动态修改 HTML/CSS/JS 的场景
- 需要库检测和自动初始化功能的场景
- 需要移动端优化注入的场景

## 基础用法

```tsx
import FullHTMLRenderer from '@/components/FullHTMLRenderer';

function MyComponent() {
  const htmlContent = `<!DOCTYPE html>
<html>
<head>
  <title>示例</title>
</head>
<body>
  <h1>Hello World</h1>
</body>
</html>`;

  return (
    <FullHTMLRenderer
      fullHTML={htmlContent}
      onLoad={() => console.log('加载完成')}
      onError={(error) => console.error('错误:', error)}
    />
  );
}
```

## API

### Props

| Prop | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| `fullHTML` | `string` | - | 完整的 HTML 字符串 |
| `externalUrl` | `string` | - | 外部 URL（当 `useExternalUrl` 为 true 时使用） |
| `useExternalUrl` | `boolean` | `false` | 是否使用外部 URL 模式 |
| `onError` | `(error: string) => void` | - | 错误回调 |
| `onLoad` | `() => void` | - | 加载完成回调 |
| `className` | `string` | - | 容器类名 |
| `style` | `React.CSSProperties` | - | 容器样式 |
| `fixedHeight` | `boolean` | `false` | 固定高度模式（超出显示滚动条） |
| `autoHeight` | `boolean` | `true` | 自动调整高度 |
| `enableHeightListener` | `boolean` | `false` | 是否注入高度监听脚本（可选） |
| `title` | `string` | `'HTML 预览'` | iframe title |

## 使用模式

### 1. 直接渲染 HTML 字符串

```tsx
<FullHTMLRenderer
  fullHTML={htmlContent}
  autoHeight={true}
/>
```

### 2. 使用外部 URL（推荐用于大型文件）

```tsx
<FullHTMLRenderer
  externalUrl="/math/cross-product.html"
  useExternalUrl={true}
  autoHeight={true}
/>
```

### 3. 启用高度自适应

```tsx
<FullHTMLRenderer
  fullHTML={htmlContent}
  autoHeight={true}
  enableHeightListener={true} // 注入轻量级高度监听脚本
  fixedHeight={false}
/>
```

### 4. 固定高度模式

```tsx
<div style={{ height: '600px' }}>
  <FullHTMLRenderer
    fullHTML={htmlContent}
    fixedHeight={true}
    autoHeight={false}
  />
</div>
```

## 性能对比

以 `cross-product.html` (1076 行, 44 KB) 为例：

| 模式 | 最终大小 | 相对原始文件 | 内存占用 | 解析时间 |
|------|---------|------------|---------|---------|
| **FullHTMLRenderer** | 44 KB | 基准 | ~44 KB | 最快 |
| SandboxRenderer (strict=false) | 74-84 KB | +68-91% | ~74-84 KB | 较慢 |
| SandboxRenderer (strict=true) | 44.5 KB | +1% | ~44.5 KB | 稍慢 |

## 与 SandboxRenderer 的区别

| 特性 | FullHTMLRenderer | SandboxRenderer |
|------|-----------------|----------------|
| 代码注入 | ❌ 无（可选高度监听） | ✅ 大量注入 |
| 样式重置 | ❌ 无 | ✅ 有 |
| 库检测 | ❌ 无 | ✅ 有 |
| 执行顺序 | ✅ 保持原始 | ⚠️ 可能改变 |
| 文件大小 | ✅ 最小 | ⚠️ 较大 |
| 性能 | ✅ 最优 | ⚠️ 较慢 |
| 功能丰富度 | ⚠️ 基础 | ✅ 丰富 |

## 最佳实践

### 1. 大型 HTML 文件使用外部 URL

```tsx
// ✅ 推荐：使用外部 URL，避免大字符串在内存中
<FullHTMLRenderer
  externalUrl="/math/cross-product.html"
  useExternalUrl={true}
/>

// ❌ 不推荐：大字符串直接传入
<FullHTMLRenderer fullHTML={veryLargeHTMLString} />
```

### 2. 需要高度自适应时启用监听

```tsx
// ✅ 推荐：启用高度监听，自动调整 iframe 高度
<FullHTMLRenderer
  fullHTML={htmlContent}
  autoHeight={true}
  enableHeightListener={true}
/>

// ⚠️ 注意：enableHeightListener 会注入轻量级脚本（~2KB）
// 如果 HTML 中已有高度监听代码，可以不启用
```

### 3. 智能选择渲染器

```tsx
function SmartRenderer({ html, css, js, fullHTML }) {
  // 检测是否为完整 HTML
  const isFullHTML = fullHTML || 
    (html && (html.includes('<!DOCTYPE') || html.includes('<html>')));
  
  if (isFullHTML) {
    // 使用 FullHTMLRenderer：性能最优
    return <FullHTMLRenderer fullHTML={fullHTML || html} />;
  } else {
    // 使用 SandboxRenderer：功能更丰富
    return <SandboxRenderer html={html} css={css} js={js} />;
  }
}
```

## 注意事项

1. **跨域限制**：如果 HTML 内容来自不同域，可能无法访问 iframe 内容进行高度计算
2. **高度监听**：`enableHeightListener` 会注入约 2KB 的脚本，默认不启用以保持纯渲染
3. **外部 URL**：使用外部 URL 时，确保文件路径正确且可访问
4. **安全性**：iframe 使用 `sandbox` 属性限制权限，确保安全性

## 故障排除

### 问题：高度无法自适应

**解决方案**：
1. 启用 `enableHeightListener={true}`
2. 或在 HTML 中添加高度监听代码：
```javascript
window.parent.postMessage({
  type: 'IFRAME_HEIGHT_CHANGE',
  data: { height: document.body.scrollHeight }
}, '*');
```

### 问题：样式被覆盖

**原因**：可能与其他组件的样式冲突

**解决方案**：
1. 使用 `className` 和 `style` prop 自定义容器样式
2. 确保 HTML 中的样式使用更高的优先级

### 问题：外部 URL 加载失败

**解决方案**：
1. 检查文件路径是否正确
2. 确保文件在 `public` 目录下
3. 检查服务器配置是否允许访问该文件

## 示例

查看 `FullHTMLRenderer.example.tsx` 获取更多使用示例。

