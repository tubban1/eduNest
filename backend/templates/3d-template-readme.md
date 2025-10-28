# 3D 基础模板说明

## 📋 模板概述

这是一个可复用的 3D 建模 HTML 模板，支持：
- Three.js 基础功能
- OrbitControls 轨道控制器
- 基础光照和材质
- 响应式布局
- 交互控制面板

## 🎯 模板结构

### 1. HTML 结构

```html
<!DOCTYPE html>
<html>
<head>
  <!-- 引入 Three.js 和 OrbitControls -->
</head>
<body>
  <div id="container"></div>  <!-- 3D 渲染容器 -->
  <div class="controls">...</div>  <!-- 控制面板 -->
</body>
</html>
```

### 2. 占位符说明

模板中包含以下占位符，AI 生成的代码会注入到这里：

#### 2.1 AI_GENERATED_CODE（主要占位符）
```javascript
// ==================== AI_GENERATED_CODE 占位符 ====================
// AI 生成的代码会插入到这里
// 例如：添加几何体、材质、动画等
```
**位置**：在示例代码之后，动画循环之前

**用途**：AI 生成的 Three.js 代码（几何体、材质、动画等）会替换这部分的示例代码

### 3. 可用功能

模板预置了以下功能供测试：

#### 3.1 控制面板功能
- **重置视角**：相机回到初始位置 (5, 5, 8)
- **切换线框**：所有对象显示线框模式
- **更换背景**：在 4 种颜色之间切换
- **添加随机对象**：随机位置添加彩色球体

#### 3.2 场景元素
- **坐标轴**：红色(X)、绿色(Y)、蓝色(Z)
- **网格**：半透明网格辅助
- **光照**：环境光 + 定向光
- **控制器**：轨道控制器（鼠标拖拽、缩放、旋转）

## 🧪 测试方法

### 方法 1：直接在浏览器打开

1. 使用浏览器打开 `3d-basic-template.html`
2. 应该能看到：
   - 一个蓝色半透明的立方体
   - 坐标轴和网格
   - 左下角的控制面板
3. 尝试交互：
   - 鼠标左键拖拽旋转场景
   - 鼠标滚轮缩放
   - 点击控制面板按钮测试功能

### 方法 2：通过本地服务器

```bash
# 在 templates 目录下启动服务器
cd edu/backend/templates
python3 -m http.server 8080

# 访问 http://localhost:8080/3d-basic-template.html
```

### 方法 3：集成到 Next.js

```typescript
// /3d/test/route.ts
import { readFileSync } from 'fs';
import { join } from 'path';

export async function GET() {
  const template = readFileSync(
    join(process.cwd(), 'backend/templates/3d-basic-template.html'),
    'utf-8'
  );
  
  return new Response(template, {
    headers: { 'Content-Type': 'text/html' }
  });
}
```

访问：`http://localhost:3000/3d/test`

## ✏️ AI 代码生成示例

当用户输入："创建一个红色球体，放置在右侧"时，AI 应生成：

```javascript
// AI 生成的代码会替换占位符
const geometry = new THREE.SphereGeometry(1.5);
const material = new THREE.MeshPhongMaterial({ color: 0xff0000 });
const mesh = new THREE.Mesh(geometry, material);
mesh.position.set(3, 0, 0);
scene.add(mesh);
```

这段代码会直接插入到 `AI_GENERATED_CODE` 占位符位置。

## 🎨 可自定义部分

### 修改光照
```javascript
// 调整环境光强度
ambientLight.intensity = 0.8;

// 调整定向光位置
directionalLight.position.set(10, 20, 10);
```

### 修改相机初始位置
```javascript
camera.position.set(10, 5, 10); // 调整初始视角
```

### 修改控制器设置
```javascript
controls.autoRotate = true;  // 自动旋转
controls.autoRotateSpeed = 0.5; // 旋转速度
```

### 修改背景
```javascript
// 纯色背景
scene.background = new THREE.Color(0x87ceeb);

// 或者使用贴图
const loader = new THREE.TextureLoader();
scene.background = loader.load('path/to/texture.jpg');
```

## 📝 注意事项

1. **Three.js 版本**：使用 v0.158.0，确保 CDN 链接版本一致
2. **OrbitControls 路径**：
   - UMD 版本：`https://cdn.jsdelivr.net/npm/three@0.158.0/examples/js/controls/OrbitControls.js`
   - ES 模块版本：`https://cdn.jsdelivr.net/npm/three@0.158.0/examples/jsm/controls/OrbitControls.js`
   - 本模板使用 UMD 版本，可直接使用 `THREE.OrbitControls`
3. **模板位置**：模板放在 `backend/templates` 因为：
   - 服务端需要读取模板进行代码注入
   - 最终会生成完整的 HTML 返回给前端
   - 前端只需要访问，不需要管理模板文件
4. **占位符位置**：AI 代码会替换示例代码，保留控制面板功能
5. **控制面板**：可以删除，不影响 3D 渲染
6. **移动端**：模板已支持响应式，可在移动设备上查看

## 🔧 常见问题

### Q: 为什么 THREE.OrbitControls 报错？
A: 确保使用了正确的 CDN 路径，必须是 `/examples/js/controls/` 而不是 `/examples/jsm/`  
UMD 版本使用 `THREE.OrbitControls`，ES 模块版本需要使用 `import { OrbitControls } from '...'`

### Q: 为什么模板放在后端？
A: 
- 后端需要读取模板进行 AI 代码注入
- 最终生成的是完整的 HTML，直接返回给浏览器
- 前端通过 `/3d/[short_id]` 路由访问，无需关心模板文件

## 🚀 后续开发

- [ ] 添加更多 Three.js 子库支持（GLTFLoader, EffectComposer 等）
- [ ] 添加材质编辑器面板
- [ ] 添加动画时间轴控制
- [ ] 支持导入外部模型

