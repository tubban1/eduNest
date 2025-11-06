/**
 * FullHTMLRenderer 使用示例
 * 
 * 这个文件展示了如何使用 FullHTMLRenderer 组件来渲染完整的 HTML 文件
 */

import FullHTMLRenderer from './FullHTMLRenderer';

// 示例 1: 基础用法 - 直接渲染完整 HTML
export function BasicExample() {
  const htmlContent = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>示例页面</title>
  <style>
    body { font-family: Arial; padding: 20px; }
    h1 { color: #333; }
  </style>
</head>
<body>
  <h1>Hello World</h1>
  <p>这是一个基础示例</p>
</body>
</html>`;

  return (
    <FullHTMLRenderer
      fullHTML={htmlContent}
      onLoad={() => console.log('页面加载完成')}
      onError={(error) => console.error('加载错误:', error)}
    />
  );
}

// 示例 2: 使用外部 URL（推荐用于大型 HTML 文件）
export function ExternalUrlExample() {
  return (
    <FullHTMLRenderer
      externalUrl="/math/cross-product.html"
      useExternalUrl={true}
      autoHeight={true}
      enableHeightListener={true}
      onLoad={() => console.log('外部文件加载完成')}
    />
  );
}

// 示例 3: 启用高度自适应
export function AutoHeightExample() {
  const htmlContent = `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>自适应高度示例</title>
</head>
<body>
  <div style="height: 2000px; background: linear-gradient(to bottom, #ff6b6b, #4ecdc4);">
    <h1>这是一个很高的内容</h1>
    <p>iframe 会自动调整高度以适应内容</p>
  </div>
</body>
</html>`;

  return (
    <FullHTMLRenderer
      fullHTML={htmlContent}
      autoHeight={true}
      enableHeightListener={true} // 启用高度监听脚本
      fixedHeight={false}
    />
  );
}

// 示例 4: 固定高度模式（带滚动条）
export function FixedHeightExample() {
  const htmlContent = `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>固定高度示例</title>
</head>
<body>
  <div style="height: 3000px; background: #f0f0f0;">
    <h1>固定高度内容</h1>
    <p>内容超出时会显示滚动条</p>
  </div>
</body>
</html>`;

  return (
    <div style={{ height: '600px' }}>
      <FullHTMLRenderer
        fullHTML={htmlContent}
        fixedHeight={true}
        autoHeight={false}
      />
    </div>
  );
}

// 示例 5: 在 ContentPage 中使用（替换 SandboxRenderer）
export function ContentPageExample({ htmlContent }: { htmlContent: string }) {
  // 检测是否为完整 HTML（简单检测：包含 <!DOCTYPE 或 <html>）
  const isFullHTML = htmlContent.includes('<!DOCTYPE') || htmlContent.includes('<html>');

  if (isFullHTML) {
    // 使用 FullHTMLRenderer 渲染完整 HTML
    return (
      <FullHTMLRenderer
        fullHTML={htmlContent}
        autoHeight={true}
        enableHeightListener={true}
        className="w-full"
        style={{
          width: '100%',
          height: 'auto',
          minHeight: 'calc(100vh - 160px)',
        }}
        onError={(error) => console.error('渲染错误:', error)}
        onLoad={() => console.log('渲染完成')}
      />
    );
  } else {
    // 使用 SandboxRenderer 渲染分离的 HTML/CSS/JS
    // import SandboxRenderer from './SandboxRenderer';
    // return <SandboxRenderer html={htmlContent} css={css} js={js} />;
    return null;
  }
}

// 示例 6: 从文件读取 HTML 内容
export async function FileBasedExample() {
  // 假设从 API 或文件系统读取 HTML
  const response = await fetch('/math/cross-product.html');
  const htmlContent = await response.text();

  return (
    <FullHTMLRenderer
      fullHTML={htmlContent}
      autoHeight={true}
      enableHeightListener={true}
    />
  );
}

