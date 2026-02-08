# 3D 不渲染：Vue 3 中 ref 在 v-for 下的行为

## 原因

模板里：

```html
<div v-for="(s, i) in stages" :key="i" v-show="currentStageIndex === i">
  ...
  <div v-if="s.showCanvas" class="canvas-container" ref="canvasContainer">
```

在 **Vue 3** 中，`ref="canvasContainer"` 用在 `v-for` 循环内的元素上时，`canvasContainer` 会是一个**数组**，按顺序包含每个阶段对应的 DOM 元素，而不是“当前阶段”的那一个。

于是 `initThree` 里：

```js
if (!canvasContainer.value) return;
// ...
camera = new THREE.PerspectiveCamera(45, canvasContainer.value.clientWidth / canvasContainer.value.clientHeight, ...);
renderer.setSize(canvasContainer.value.clientWidth, canvasContainer.value.clientHeight);
canvasContainer.value.appendChild(renderer.domElement);
```

- `canvasContainer.value` 是数组，没有 `clientWidth` / `clientHeight`，得到 `undefined`
- 相机宽高比变成 `NaN`，`setSize` 收到 `undefined`，画布尺寸异常
- 3D 无法正常渲染

**与 rendererEngine 无关**：修复前（AI 输出）和修复后（替换 CDN、注入脚本）都会这样，因为问题出在业务代码对 ref 的使用方式。

## 修复方式

在 `initThree` 里先根据“当前阶段”从 ref 中取出**当前可见的容器**，再用于 Three.js 初始化和挂载 canvas。

### 方式一：在 initThree 内解析“当前容器”（推荐）

在 `initThree` 开头把“当前容器”单独取出来，再沿用原来的相机/渲染器/挂载逻辑：

```javascript
const initThree = () => {
  // Vue 3：ref 在 v-for 下是数组，取当前阶段对应的容器
  const raw = canvasContainer.value;
  const container = Array.isArray(raw) ? raw[currentStageIndex.value] : raw;
  if (!container) return;

  scene = new THREE.Scene();
  camera = new THREE.PerspectiveCamera(45, container.clientWidth / container.clientHeight, 0.1, 1000);
  renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
  renderer.setSize(container.clientWidth, container.clientHeight);
  container.appendChild(renderer.domElement);
  // ... 其余不变
};
```

同时，在 `nextStage` / `prevStage` 里把 canvas 挂回**当前阶段**的容器时，也要用“当前容器”而不是整个 ref：

```javascript
const getCanvasContainer = () => {
  const raw = canvasContainer.value;
  return Array.isArray(raw) ? raw[currentStageIndex.value] : raw;
};

const nextStage = () => {
  currentStageIndex.value++;
  nextTick(() => {
    if (stages[currentStageIndex.value].showCanvas) {
      const container = getCanvasContainer();
      if (!renderer) initThree();
      else if (container && renderer.domElement) container.appendChild(renderer.domElement);
    }
  });
};

const prevStage = () => {
  currentStageIndex.value--;
  nextTick(() => {
    if (stages[currentStageIndex.value].showCanvas) {
      const container = getCanvasContainer();
      if (container && renderer.domElement) container.appendChild(renderer.domElement);
    }
  });
};
```

### 方式二：模板只保留一个 3D 容器（避免 ref 成数组）

若希望 `canvasContainer` 始终是单个元素，可把 3D 容器提到 v-for 外，用 v-show 控制显示，例如只保留“当前阶段”的一个容器，这样 ref 就不会变成数组。实现上需要根据你的阶段数据结构稍作调整，这里不展开。

---

总结：**3D 不渲染是因为 ref 在 v-for 下是数组，导致没有用“当前阶段”的 DOM 做宽高和挂载。** 按上面方式一改 `initThree` 和阶段切换逻辑后即可正常显示 3D。
