# 3D 建模模板系统 PRD

## 1. 项目概述

### 1.1 项目名称
3D 建模模板内容管理系统

### 1.2 项目目标
创建一个可复用的 3D 建模模板系统，允许：
- Admin 手动编辑原生 HTML/JavaScript 模板代码
- 普通用户通过自然语言描述，AI 生成纯 JavaScript 代码片段
- 通过代码注入机制将 AI 生成的片段直接插入 HTML 模板
- 使用 `3d/[short_id]` 路由返回纯 HTML 页面（浏览器直接打开）

### 1.3 核心功能
1. **模板管理**：Admin 可以创建、编辑、删除 3D 建模模板
2. **AI 代码生成**：用户输入自然语言，AI 生成代码片段
3. **片段标记**：使用 JSON 标记代码片段的插入位置
4. **内容渲染**：将模板与片段结合，生成最终的 3D 页面
5. **访问路由**：通过 `3d/[short_id]` 访问生成的内容

---

## 2. 需求分析

### 2.1 用户角色

#### 2.1.1 Admin
- 创建和编辑 3D 模板（HTML/JavaScript 格式）
- 定义代码注入占位符（通过 HTML 注释标记）
- 设置模板的默认 Three.js 配置
- 管理模板的可见性和权限

#### 2.1.2 普通用户
- 通过自然语言描述需求
- 查看 AI 生成的 3D 内容
- 编辑和保存自己创建的内容

### 2.2 核心流程

```
用户输入自然语言
    ↓
AI 生成纯 JavaScript 代码字符串（无需编译）
    ↓
系统保存 AI 原始响应到 ai_usage_logs.response_metadata
    ↓
提取 JavaScript 代码片段保存到 3d_contents.code_snippets
    ↓
系统查找对应的 HTML 模板
    ↓
将 AI 生成的 JavaScript 代码注入到模板占位符
    ↓
检测代码中使用的 Three.js 子库
    ↓
自动注入子库 CDN 链接到 HTML <script> 标签
    ↓
生成完整 HTML（rendered_html，可选缓存）
    ↓
通过 3d/[short_id] 直接返回 HTML（浏览器直接打开）
```

---

## 3. 数据结构设计

### 3.1 新增数据库表

#### 3.1.1 `3d_templates` 表（模板库）

```sql
CREATE TABLE 3d_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  template_name TEXT NOT NULL,
  template_key TEXT NOT NULL UNIQUE, -- 模板标识符，如 'threejs-basic'
  description TEXT,
  author_id UUID REFERENCES users(id),
  
  -- 模板内容
  template_code TEXT NOT NULL, -- 完整的 HTML 模板代码（包含占位符）
  
  -- 占位符配置：定义代码注入位置
  -- 格式: ["AI_GENERATED_CODE_1", "AI_GENERATED_CODE_2"]
  placeholders TEXT[] NOT NULL DEFAULT '[]',
  
  -- 模板配置
  default_props JSONB, -- 默认属性
  category TEXT, -- 分类：basic, advanced, interactive
  tags TEXT[], -- 标签数组
  
  -- 可见性
  is_public BOOLEAN DEFAULT false,
  is_active BOOLEAN DEFAULT true,
  
  -- 元数据
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  version INTEGER DEFAULT 1
);
```

**字段说明：**
- `template_key`: 模板的唯一标识符，用于在生成内容时引用
- `template_code`: 完整的 TSX 模板代码，包含标记占位符
- `markers`: JSON 数组，定义可替换的代码块位置
  ```json
  [
    {
      "id": "model-1",
      "selector": ".model-container",
      "type": "object",
      "placeholder": "// MODEL_1",
      "description": "第一个3D模型对象"
    },
    {
      "id": "lighting-1",
      "type": "function",
      "placeholder": "// LIGHTING_CONFIG",
      "description": "光照配置"
    }
  ]
  ```

#### 3.1.2 `3d_contents` 表（生成的内容）

```sql
CREATE TABLE 3d_contents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  short_id TEXT NOT NULL UNIQUE DEFAULT SUBSTRING(md5((gen_random_uuid())::text) FROM 1 FOR 8),
  
  -- 关联信息
  template_id UUID REFERENCES 3d_templates(id),
  content_id UUID REFERENCES content(id), -- 关联到现有的content表
  
  -- 用户信息
  created_by UUID REFERENCES users(id),
  user_query TEXT NOT NULL, -- 用户的自然语言描述
  
  -- AI 生成的纯 JavaScript 代码片段（字符串格式）
  -- 格式: "const geometry = new THREE.SphereGeometry(2);\nconst material = ..."
  code_snippets TEXT NOT NULL,
  
  -- 最终渲染的 HTML
  rendered_html TEXT, -- 完整的 HTML 代码（可直接在浏览器打开）
  
  -- 外部依赖链接
  external_links TEXT[], -- Three.js 子库 CDN 链接
  
  -- 内容信息
  title TEXT,
  description TEXT,
  tags TEXT[],
  
  -- AI 生成元数据
  ai_model TEXT,
  ai_provider TEXT,
  generation_time INTEGER, -- 生成耗时（秒）
  
  -- 状态
  status TEXT DEFAULT 'draft', -- draft, published, archived
  
  -- 元数据
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);
```

#### 3.1.3 `code_snippets` 表（代码片段历史）

```sql
CREATE TABLE code_snippets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  content_id UUID REFERENCES 3d_contents(id),
  marker_id TEXT NOT NULL, -- 对应的标记ID
  snippet_code TEXT NOT NULL, -- 代码内容
  snippet_language TEXT DEFAULT 'javascript', -- 代码语言
  version INTEGER DEFAULT 1,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  created_by UUID REFERENCES users(id)
);
```

### 3.2 扩展现有表

#### 3.2.1 修改 `content` 表
添加字段支持 3D 内容类型：
```sql
ALTER TABLE content 
ADD COLUMN is_3d_content BOOLEAN DEFAULT false,
ADD COLUMN template_id UUID REFERENCES 3d_templates(id),
ADD COLUMN code_snippets JSONB;
```

---

## 4. Three.js 子库导入方案

### 4.1 支持的 Three.js 子库

系统需要支持 Three.js 的官方子库（examples），包括但不限于：

- **OrbitControls** - 轨道控制器
- **GLTFLoader** - GLTF 模型加载器
- **FlyControls** - 飞行控制器
- **TrackballControls** - 轨迹球控制器
- **TransformControls** - 变换控制器
- **PointerLockControls** - 指针锁定控制器
- **VRButton** - VR 按钮
- **XRControllerModelFactory** - XR 控制器模型

### 4.2 CDN 导入方案

#### 方案 A：ES 模块导入（推荐）

```html
<!-- 基础 Three.js -->
<script type="importmap">
{
  "imports": {
    "three": "https://cdn.jsdelivr.net/npm/three@0.158.0/build/three.module.js"
  }
}
</script>

<!-- 子库导入 -->
<script type="module">
import * as THREE from 'three';
import { OrbitControls } from 'https://cdn.jsdelivr.net/npm/three@0.158.0/examples/jsm/controls/OrbitControls.js';
import { GLTFLoader } from 'https://cdn.jsdelivr.net/npm/three@0.158.0/examples/jsm/loaders/GLTFLoader.js';

// 使用
const controls = new OrbitControls(camera, renderer.domElement);
</script>
```

#### 方案 B：UMD 导入（兼容性更好）

```html
<script src="https://cdn.jsdelivr.net/npm/three@0.158.0/build/three.min.js"></script>
<script src="https://cdn.jsdelivr.net/npm/three@0.158.0/examples/js/controls/OrbitControls.js"></script>
<script src="https://cdn.jsdelivr.net/npm/three@0.158.0/examples/js/loaders/GLTFLoader.js"></script>

<script>
// 全局可用
const controls = new THREE.OrbitControls(camera, renderer.domElement);
</script>
```

### 4.3 自动检测和注入

系统需要自动检测代码中使用的 Three.js 子库，并自动注入对应的 CDN 链接：

```typescript
function detectThreeJSLibraries(code: string): string[] {
  const libraries = [];
  
  if (code.includes('OrbitControls')) {
    libraries.push('https://cdn.jsdelivr.net/npm/three@0.158.0/examples/js/controls/OrbitControls.js');
  }
  if (code.includes('GLTFLoader')) {
    libraries.push('https://cdn.jsdelivr.net/npm/three@0.158.0/examples/js/loaders/GLTFLoader.js');
  }
  if (code.includes('FlyControls')) {
    libraries.push('https://cdn.jsdelivr.net/npm/three@0.158.0/examples/js/controls/FlyControls.js');
  }
  
  // 完整的检测逻辑...
  
  return libraries;
}
```

### 4.4 模板中的子库支持

在 `3d_templates.markers` 中定义子库需求：

```json
{
  "required_libraries": [
    "three@0.158.0",
    "three/examples/controls/OrbitControls",
    "three/examples/loaders/GLTFLoader"
  ]
}
```

---

## 5. JSON 标记系统设计

### 5.1 标记格式

#### 4.1.1 模板标记（在 TSX 模板中）
```tsx
// 在模板代码中定义占位符
const Template3D = () => {
  const scene = new THREE.Scene();
  
  // 标记: MODEL_1
  const model1 = <mesh>...</mesh>; // MODEL_1
  
  // 标记: LIGHTING_CONFIG
  const lights = []; // LIGHTING_CONFIG
  
  return (
    <div className="canvas-container">
      {/* MODEL_1 */}
      {/* LIGHTING_CONFIG */}
    </div>
  );
};
```

#### 4.1.2 JSON 片段格式
用户输入自然语言后，AI 返回的 JSON：
```json
{
  "template_key": "threejs-basic",
  "snippets": [
    {
      "marker_id": "MODEL_1",
      "code": "const model1 = addModel('sphere', { radius: 2, color: 0x0077ff });",
      "language": "javascript",
      "description": "添加一个蓝色球体"
    },
    {
      "marker_id": "LIGHTING_CONFIG",
      "code": "const light = new THREE.DirectionalLight(0xffffff, 1); light.position.set(5, 5, 5); scene.add(light);",
      "language": "javascript",
      "description": "添加定向光源"
    }
  ]
}
```

### 4.2 标记匹配规则

1. **精确匹配**：通过 `marker_id` 精确匹配占位符
2. **类型验证**：根据 `markers` 配置验证代码类型
3. **代码注入**：将生成的代码替换对应的占位符
4. **语法检查**：注入后检查 TSX 语法正确性

---

## 5. API 设计

### 5.1 Admin API

#### 5.1.1 创建模板
```
POST /api/admin/3d-templates
Request Body:
{
  "template_name": "基础3D模型",
  "template_key": "threejs-basic",
  "template_code": "...", // 完整的 HTML 代码（包含占位符）
  "placeholders": ["AI_GENERATED_MODEL", "AI_GENERATED_LIGHT"], // 占位符列表
  "description": "基础Three.js模板",
  "category": "basic",
  "tags": ["3d", "threejs"],
  "is_public": true
}
```

#### 5.1.2 更新模板
```
PUT /api/admin/3d-templates/:template_id
```

#### 5.1.3 获取所有模板
```
GET /api/admin/3d-templates
```

### 5.2 用户 API

#### 5.2.1 AI 生成 3D 内容
```
POST /api/3d/generate
Request Body:
{
  "template_key": "threejs-basic",
  "user_query": "创建一个蓝色的球体，半径为2",
  "language_code": "zh-CN"
}

Response:
{
  "success": true,
  "data": {
    "short_id": "abc123",
    "content_id": "uuid",
    "code_snippets": "const geometry = new THREE.SphereGeometry(2);\n...", // 纯 JS 代码字符串
    "title": "蓝色球体",
    "rendered_html": "<!DOCTYPE html>..." // 完整 HTML
  }
}
```

#### 5.2.2 获取内容
```
GET /api/3d/:short_id
Response:
{
  "id": "uuid",
  "short_id": "abc123",
  "template_id": "uuid",
  "rendered_html": "完整HTML代码",
  "title": "标题",
  "description": "描述"
}
```

#### 5.2.3 更新内容
```
PUT /api/3d/:short_id
Request Body:
{
  "code_snippets": [...], // 修改的片段
  "title": "新标题"
}
```

### 5.3 AI 服务集成

#### 5.3.1 AI 生成提示词
```javascript
const generate3DPrompt = (userQuery) => `
You are a Three.js code generator.
Generate PURE JAVASCRIPT code based on: "${userQuery}"

CRITICAL REQUIREMENTS:
1. Generate VANILLA JAVASCRIPT only (NO React, NO TSX, NO JSX)
2. NO imports/exports (code will be inserted directly into <script> tag)
3. Use global THREE object (already loaded)
4. Use existing variables: scene, camera, renderer
5. Return ONLY executable JavaScript code

Available Three.js objects:
- THREE.Scene, THREE.PerspectiveCamera, THREE.WebGLRenderer
- THREE.BoxGeometry, THREE.SphereGeometry, THREE.ConeGeometry
- THREE.MeshBasicMaterial, THREE.MeshPhongMaterial
- THREE.AmbientLight, THREE.DirectionalLight, THREE.PointLight
- And other THREE.* classes

Example output:
const geometry = new THREE.SphereGeometry(2);
const material = new THREE.MeshPhongMaterial({ color: 0x0077ff });
const mesh = new THREE.Mesh(geometry, material);
mesh.position.set(0, 0, 0);
scene.add(mesh);

Return ONLY the JavaScript code as a plain string.
`;
```

#### 5.3.2 AI 响应处理

AI 返回的原始代码字符串会保存在 `ai_usage_logs.response_metadata` 中：

```json
{
  "provider": "ark",
  "model": "kimi-k2-250905",
  "raw": "const geometry = new THREE.SphereGeometry(2);\nconst material = new THREE.MeshPhongMaterial({ color: 0x0077ff });\nconst mesh = new THREE.Mesh(geometry, material);\nscene.add(mesh);"
}
```

系统会将代码字符串直接保存到 `3d_contents.code_snippets`。

#### 5.3.3 Three.js 子库自动注入

系统会自动检测 `code_snippets`（JavaScript 字符串）中使用的 Three.js 子库，并生成对应的 CDN 链接：

```typescript
const detectThreeJSLibraries = (codeString: string): string[] => {
  const libraries = [];
  
  // 检测 Three.js 基础库
  libraries.push('https://cdn.jsdelivr.net/npm/three@0.158.0/build/three.min.js');
  
  // 检测子库
  if (codeString.includes('OrbitControls')) {
    libraries.push('https://cdn.jsdelivr.net/npm/three@0.158.0/examples/js/controls/OrbitControls.js');
  }
  if (codeString.includes('GLTFLoader')) {
    libraries.push('https://cdn.jsdelivr.net/npm/three@0.158.0/examples/js/loaders/GLTFLoader.js');
  }
  if (codeString.includes('FlyControls')) {
    libraries.push('https://cdn.jsdelivr.net/npm/three@0.158.0/examples/js/controls/FlyControls.js');
  }
  // ... 更多检测
  
  return libraries;
};
```

---

## 6. 前端页面设计

### 6.1 路由结构

```
/3d                          # 3D内容列表页
/3d/create                   # 创建3D内容页
/3d/[short_id]              # 3D内容详情页（渲染页面）
/3d/[short_id]/edit         # 编辑3D内容
/admin/3d-templates          # Admin：模板管理
/admin/3d-templates/new      # Admin：创建模板
/admin/3d-templates/[id]     # Admin：编辑模板
```

### 6.2 页面组件

#### 6.2.1 3D 内容列表页
- 显示所有用户创建的 3D 内容
- 支持筛选、搜索
- 每个卡片显示预览图

#### 6.2.2 3D 内容详情页（`/3d/[short_id]`）
- 渲染完整的 TSX 页面
- 使用自定义渲染器支持 3D
- 支持交互操作

#### 6.2.3 创建 3D 内容页
- 选择模板
- 输入自然语言描述
- AI 生成预览
- 保存内容

#### 6.2.4 Admin 模板管理页
- 模板列表
- 创建/编辑/删除模板
- 定义标记位置

---

## 7. 技术实现细节

### 7.1 模板代码结构

#### 7.1.1 模板 HTML 结构
```html
<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <title>${title}</title>
  <style>
    body { margin: 0; overflow: hidden; }
    #container { width: 100vw; height: 100vh; }
  </style>
  <!-- THREE_JS_LIBRARIES_PLACEHOLDER -->
</head>
<body>
  <div id="container"></div>
  <script>
    // 场景初始化（模板提供）
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(window.innerWidth, window.innerHeight);
    document.getElementById('container').appendChild(renderer.domElement);
    
    // 相机位置
    camera.position.set(5, 5, 8);
    
    // AI_GENERATED_CODE 占位符（AI 生成的代码会插入这里）
    
    // 渲染循环（模板提供）
    function animate() {
      requestAnimationFrame(animate);
      renderer.render(scene, camera);
    }
    animate();
    
    // 窗口大小调整（模板提供）
    window.addEventListener('resize', () => {
      camera.aspect = window.innerWidth / window.innerHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(window.innerWidth, window.innerHeight);
    });
  </script>
</body>
</html>
```

### 7.2 代码注入逻辑

```typescript
function injectCodeIntoTemplate(
  templateHtml: string,
  aiCode: string, // AI 生成的纯 JavaScript 代码字符串
  requiredLibraries: string[] // Three.js 子库 CDN 链接
): string {
  let renderedHtml = templateHtml;
  
  // 1. 注入 AI 生成的代码到占位符
  renderedHtml = renderedHtml.replace(
    '<!-- AI_GENERATED_CODE 占位符（AI 生成的代码会插入这里） -->',
    aiCode
  );
  
  // 2. 注入 Three.js 库链接
  const libraryTags = requiredLibraries
    .map(lib => `<script src="${lib}"></script>`)
    .join('\n  ');
  
  renderedHtml = renderedHtml.replace(
    '<!-- THREE_JS_LIBRARIES_PLACEHOLDER -->',
    libraryTags
  );
  
  // 3. 注入标题（如果有）
  const title = extractTitle(aiCode) || '3D Model';
  renderedHtml = renderedHtml.replace('${title}', title);
  
  return renderedHtml;
}
```

### 7.3 路由处理

```typescript
// /3d/[short_id]/route.ts
export async function GET(request: Request, { params }: { params: { short_id: string } }) {
  // 1. 从数据库获取 3D 内容
  const content = await get3DContentByShortId(params.short_id);
  
  // 2. 如果已有缓存 HTML，直接返回
  if (content.rendered_html) {
    return new Response(content.rendered_html, {
      headers: { 'Content-Type': 'text/html' }
    });
  }
  
  // 3. 否则，构建 HTML
  const html = injectCodeIntoTemplate(
    content.template_code, // HTML 模板
    content.code_snippets, // AI 生成的 JS 代码
    content.external_links // Three.js 库链接
  );
  
  // 4. 可选：缓存 HTML
  await cacheRenderedHtml(content.id, html);
  
  // 5. 返回 HTML
  return new Response(html, {
    headers: { 'Content-Type': 'text/html' }
  });
}
```

### 7.4 方案优势

采用纯 JavaScript + HTML 方案的优势：

1. **无需编译**：AI 生成的是纯 JavaScript 代码字符串，无需任何编译步骤
2. **直接运行**：生成的代码可直接注入 `<script>` 标签，浏览器立即执行
3. **性能最优**：无 React/TSX 编译开销，无虚拟 DOM，原生性能
4. **兼容性强**：纯 JavaScript 兼容所有现代浏览器，包括移动端
5. **缓存友好**：静态 HTML 可直接缓存，CDN 友好
6. **调试方便**：生成的代码可直接在浏览器 DevTools 中调试
7. **简化架构**：不需要构建工具链，简化部署流程

---

## 8. 数据流程图

### 8.1 用户创建 3D 内容流程

```
1. 用户访问 /3d/create
2. 选择模板（从 3d_templates 表）
3. 输入自然语言描述
4. 前端调用 POST /api/3d/generate
5. 后端调用 AI 服务生成 code_snippets
6. AI 返回 JSON 格式的片段
7. 后端查找对应模板
8. 注入代码片段到模板
9. 生成最终的 rendered_code
10. 保存到 3d_contents 表
11. 返回 short_id
12. 前端跳转到 /3d/[short_id]
```

### 8.2 Admin 创建模板流程

```
1. Admin 访问 /admin/3d-templates/new
2. 输入模板代码（TSX格式）
3. 定义 markers（JSON数组）
4. 前端调用 POST /api/admin/3d-templates
5. 后端保存到 3d_templates 表
6. 返回模板ID
```

---

## 9. 安全性考虑

### 9.1 权限控制
- Admin 模板管理需要管理员权限
- 用户只能修改自己创建的内容
- 公共模板需要 is_public=true

### 9.2 代码注入安全
- 验证 JSON 片段格式
- 限制可执行的代码类型
- 白名单验证 Three.js API
- 防止恶意代码执行

### 9.3 数据验证
- TSX 语法验证
- 模板代码完整性检查
- 标记位置合法性验证

---

## 10. 扩展性设计

### 10.1 模板市场
- 用户提交自己的模板
- 模板审核机制
- 模板评分系统

### 10.2 更多 3D 库支持
- Babylon.js
- A-Frame
- WebXR

### 10.3 协作功能
- 多人编辑
- 版本控制
- 分享链接

---

## 11. 测试计划

### 11.1 单元测试
- JSON 片段生成
- 代码注入逻辑
- 模板解析

### 11.2 集成测试
- 端到端创建流程
- AI 生成准确性
- 渲染正确性

### 11.3 性能测试
- 大量 3D 对象的渲染性能
- AI 生成响应时间
- 并发用户处理

---

## 12. 部署计划

### 12.1 数据库迁移
```sql
-- 创建 3d_templates 表
-- 创建 3d_contents 表
-- 创建 code_snippets 表
-- 修改 content 表
```

### 12.2 后端 API 部署
- 新增 API 路由
- AI 服务集成
- 测试验证

### 12.3 前端页面部署
- 新增路由
- 新增组件
- 更新导航

---

## 13. 里程碑

### 阶段 1：基础框架（2周）
- 数据库表设计
- Admin 模板管理
- 模板 CRUD API

### 阶段 2：AI 集成（2周）
- AI 生成服务
- 代码片段标记系统
- 代码注入逻辑

### 阶段 3：用户界面（2周）
- 创建页面
- 列表页面
- 详情页面

### 阶段 4：测试与优化（1周）
- 单元测试
- 集成测试
- 性能优化

---

## 14. 风险评估

| 风险 | 影响 | 概率 | 缓解措施 |
|------|------|------|----------|
| AI 生成代码不准确 | 高 | 中 | 增加人工审核，提供编辑功能 |
| 模板系统复杂度高 | 中 | 高 | 简化标记系统，提供示例 |
| 性能问题 | 中 | 低 | 代码优化，缓存机制 |
| 安全漏洞 | 高 | 低 | 严格的代码审查和验证 |

---

## 15. 成功指标

- 模板数量：至少 10 个基础模板
- 用户生成内容：月均 100+ 个 3D 内容
- AI 生成准确率：>80%
- 页面加载时间：<3秒
- 用户满意度：>4.0/5.0

