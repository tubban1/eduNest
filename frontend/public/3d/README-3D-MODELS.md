# 3D模型预导入指南

## 概述

本指南说明如何在手势交互页面中预导入3D模型文件，并实现手势旋转、缩放和查看功能。

## 支持的模型格式

- **GLTF/GLB**（推荐）：Three.js 原生支持，文件小，加载快
- **OBJ**：需要额外加载器
- **FBX**：需要额外加载器

## 方法一：使用本地文件（推荐）

### 1. 创建模型目录

在项目中创建模型存储目录：

```bash
edu/frontend/public/3d/models/
```

### 2. 放置模型文件

将你的3D模型文件（.gltf 或 .glb）放入该目录：

```
edu/frontend/public/3d/models/
  ├── beaker.glb
  ├── microscope.glb
  ├── test-tube.glb
  └── ...
```

### 3. 修改代码加载本地模型

在 `gesture-3d-viewer.html` 或 `lab-equipment-gesture.html` 中添加：

```javascript
// 预定义的模型列表
const modelLibrary = {
  'beaker': '/3d/models/beaker.glb',
  'microscope': '/3d/models/microscope.glb',
  'test-tube': '/3d/models/test-tube.glb',
  'flask': '/3d/models/flask.glb'
};

// 加载模型函数
function loadModelFromLibrary(modelKey) {
  const modelPath = modelLibrary[modelKey];
  if (modelPath) {
    loadGLTFModel(modelPath);
  } else {
    console.error('模型不存在:', modelKey);
  }
}
```

### 4. 在页面初始化时预加载

```javascript
// 页面加载时预加载常用模型
window.addEventListener('DOMContentLoaded', () => {
  // 预加载第一个模型
  loadModelFromLibrary('beaker');
  
  // 或者预加载所有模型到缓存
  Object.keys(modelLibrary).forEach(key => {
    const loader = new THREE.GLTFLoader();
    loader.load(modelLibrary[key], (gltf) => {
      // 存储到缓存
      modelCache[key] = gltf.scene.clone();
      console.log(`预加载完成: ${key}`);
    });
  });
});
```

## 方法二：使用CDN或外部URL

### 1. 使用在线模型库

推荐模型资源：
- **Sketchfab**：https://sketchfab.com
- **Poly Haven**：https://polyhaven.com
- **TurboSquid**：https://www.turbosquid.com

### 2. 在代码中使用URL

```javascript
const externalModels = {
  'robot': 'https://example.com/models/robot.glb',
  'car': 'https://example.com/models/car.glb'
};

function loadExternalModel(modelKey) {
  const url = externalModels[modelKey];
  if (url) {
    loadGLTFModel(url);
  }
}
```

## 方法三：内嵌模型数据（小型模型）

对于非常小的模型，可以转换为Base64编码内嵌：

```javascript
// 将GLB文件转换为Base64
// 使用工具：https://base64.guru/converter/encode/file

const embeddedModel = 'data:model/gltf-binary;base64,AAAAIG1w...'; // Base64字符串

function loadEmbeddedModel() {
  const loader = new THREE.GLTFLoader();
  loader.parse(embeddedModel, '', (gltf) => {
    const model = gltf.scene;
    scene.add(model);
  });
}
```

## 完整示例：预加载多个模型

```javascript
// 模型库配置
const MODEL_LIBRARY = {
  equipment: {
    'beaker': {
      path: '/3d/models/beaker.glb',
      name: '烧杯',
      description: '用于盛放和加热液体'
    },
    'microscope': {
      path: '/3d/models/microscope.glb',
      name: '显微镜',
      description: '用于观察微小物体'
    },
    'test-tube': {
      path: '/3d/models/test-tube.glb',
      name: '试管',
      description: '用于少量试剂的反应'
    }
  }
};

// 模型缓存
const modelCache = {};

// 预加载所有模型
function preloadModels() {
  const loader = new THREE.GLTFLoader();
  
  Object.keys(MODEL_LIBRARY.equipment).forEach(key => {
    const modelInfo = MODEL_LIBRARY.equipment[key];
    
    loader.load(
      modelInfo.path,
      (gltf) => {
        // 克隆模型并存储
        modelCache[key] = {
          scene: gltf.scene.clone(),
          info: modelInfo
        };
        console.log(`✓ 预加载完成: ${modelInfo.name}`);
      },
      (progress) => {
        console.log(`加载 ${modelInfo.name}: ${(progress.loaded / progress.total * 100).toFixed(0)}%`);
      },
      (error) => {
        console.error(`加载失败 ${modelInfo.name}:`, error);
      }
    );
  });
}

// 从缓存加载模型（快速切换）
function loadCachedModel(key) {
  if (modelCache[key]) {
    // 清除当前模型
    while (modelGroup.children.length > 0) {
      modelGroup.remove(modelGroup.children[0]);
    }
    
    // 添加缓存的模型
    const cached = modelCache[key].scene.clone();
    modelGroup.add(cached);
    currentModel = cached;
    
    // 更新信息
    document.getElementById('model-name').textContent = modelCache[key].info.name;
    document.getElementById('equipment-usage').textContent = modelCache[key].info.description;
    
    // 重置变换
    resetModel();
  } else {
    console.warn('模型未缓存:', key);
    // 如果未缓存，实时加载
    loadGLTFModel(MODEL_LIBRARY.equipment[key].path);
  }
}

// 页面加载时预加载
window.addEventListener('DOMContentLoaded', () => {
  preloadModels();
});
```

## 手势控制说明

### 已实现的手势操作

1. **指向（食指）**：选中模型，显示高亮
2. **张开手掌**：旋转模型（跟随手部移动）
3. **握拳**：缩放模型（上下移动手部）
4. **捏合（拇指+食指）**：重置视角和缩放

### 手势控制代码位置

在 `gesture-3d-viewer.html` 的 `onResults` 函数中：

```javascript
case 'open':
  // 旋转模型
  const deltaX = currentHandPos.x - lastHandPosition.x;
  const deltaY = currentHandPos.y - lastHandPosition.y;
  modelGroup.rotation.y += deltaX * 5;
  modelGroup.rotation.x += deltaY * 5;
  break;

case 'fist':
  // 缩放模型
  const deltaY = lastHandPosition.y - currentHandPos.y;
  currentScale += deltaY * 2;
  currentScale = Math.max(0.3, Math.min(3.0, currentScale));
  modelGroup.scale.set(currentScale, currentScale, currentScale);
  break;
```

## 模型优化建议

### 1. 文件大小优化

- 使用 GLB 格式（二进制，比 GLTF 小）
- 压缩纹理贴图
- 减少模型面数
- 使用 Draco 压缩（Three.js 支持）

### 2. 性能优化

```javascript
// 预加载时使用低质量模型
const lowQualityLoader = new THREE.GLTFLoader();
lowQualityLoader.load(modelPath, (gltf) => {
  // 简化模型
  gltf.scene.traverse((child) => {
    if (child.isMesh) {
      child.geometry = simplifyGeometry(child.geometry);
    }
  });
  modelCache[key] = gltf.scene;
});

// 需要高质量时再加载完整模型
function loadHighQualityModel(key) {
  // 加载完整模型
}
```

## 测试模型资源

### 免费测试模型

1. **Three.js 官方示例模型**：
   - https://threejs.org/examples/models/gltf/
   - 包括：Duck, Flamingo, Parrot 等

2. **GLTF Sample Models**：
   - https://github.com/KhronosGroup/glTF-Sample-Models
   - 各种格式和复杂度的测试模型

### 快速测试代码

```javascript
// 使用 Three.js 官方示例模型测试
const testModels = {
  'duck': 'https://threejs.org/examples/models/gltf/Duck/glTF-Binary/Duck.glb',
  'flamingo': 'https://threejs.org/examples/models/gltf/Flamingo/glTF-Binary/Flamingo.glb'
};

// 测试加载
loadGLTFModel(testModels.duck);
```

## 常见问题

### Q: 模型加载很慢怎么办？

A: 
1. 使用模型缓存（预加载）
2. 压缩模型文件
3. 使用 CDN 加速
4. 显示加载进度条

### Q: 模型太大或太小？

A: 在加载后调整缩放：

```javascript
loader.load(url, (gltf) => {
  const model = gltf.scene;
  
  // 计算边界并自动缩放
  const box = new THREE.Box3().setFromObject(model);
  const size = box.getSize(new THREE.Vector3());
  const maxDim = Math.max(size.x, size.y, size.z);
  const scale = 2 / maxDim; // 缩放到2个单位大小
  model.scale.multiplyScalar(scale);
});
```

### Q: 如何添加模型选择器？

A: 参考 `gesture-3d-viewer.html` 中的模型选择器代码：

```html
<select id="model-select">
  <option value="beaker">烧杯</option>
  <option value="microscope">显微镜</option>
</select>
```

```javascript
document.getElementById('model-select').addEventListener('change', (e) => {
  loadCachedModel(e.target.value);
});
```

## 下一步

1. 将你的3D模型文件放入 `public/3d/models/` 目录
2. 修改代码中的 `MODEL_LIBRARY` 配置
3. 测试模型加载和手势交互
4. 根据需要调整手势控制灵敏度

