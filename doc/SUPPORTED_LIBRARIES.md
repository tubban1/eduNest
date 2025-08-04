# 沙盒支持的库和框架

## 🎯 当前支持的库

### ✅ **可以直接使用的库**

#### **Vue.js 生态**
```javascript
// Vue 3
https://unpkg.com/vue@3/dist/vue.global.prod.js

// Vue 插件
https://unpkg.com/vue-kinesis@2.0.0/dist/vue-kinesis.min.js
https://unpkg.com/vue3-carousel@0.3.0/dist/carousel.min.js
https://unpkg.com/vue3-lottie@1.4.0/dist/vue3-lottie.min.js
```

#### **动画和视觉效果**
```javascript
// GSAP (GreenSock)
https://cdnjs.cloudflare.com/ajax/libs/gsap/3.12.2/gsap.min.js

// Three.js
https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js

// Anime.js
https://cdnjs.cloudflare.com/ajax/libs/animejs/3.2.1/anime.min.js

// Lottie
https://cdnjs.cloudflare.com/ajax/libs/lottie-web/5.12.2/lottie.min.js
```

#### **音频和音乐**
```javascript
// Tone.js
https://unpkg.com/tone@14.7.77/build/Tone.js

// Howler.js
https://cdnjs.cloudflare.com/ajax/libs/howler/2.2.3/howler.min.js
```

#### **图表和数据可视化**
```javascript
// Chart.js
https://cdnjs.cloudflare.com/ajax/libs/Chart.js/4.4.0/chart.min.js

// D3.js
https://cdnjs.cloudflare.com/ajax/libs/d3/7.8.5/d3.min.js

// ApexCharts
https://cdn.jsdelivr.net/npm/apexcharts@3.45.0/dist/apexcharts.min.js
```

#### **游戏和交互**
```javascript
// Phaser.js
https://cdnjs.cloudflare.com/ajax/libs/phaser/3.70.0/phaser.min.js

// Matter.js (物理引擎)
https://cdnjs.cloudflare.com/ajax/libs/matter-js/0.19.0/matter.min.js

// P5.js
https://cdnjs.cloudflare.com/ajax/libs/p5.js/1.7.0/p5.min.js
```

#### **UI 组件**
```javascript
// Bootstrap
https://cdn.jsdelivr.net/npm/bootstrap@5.3.2/dist/js/bootstrap.bundle.min.js
https://cdn.jsdelivr.net/npm/bootstrap@5.3.2/dist/css/bootstrap.min.css

// Tailwind CSS
https://cdn.tailwindcss.com

// Font Awesome
https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.2/css/all.min.css
```

## ⚠️ **需要特殊处理的库**

### **Fabric.js**
```javascript
// 需要特殊构建版本
https://cdnjs.cloudflare.com/ajax/libs/fabric.js/5.3.0/fabric.min.js

// 使用示例
const canvas = new fabric.Canvas('canvas');
```

### **Konva.js**
```javascript
// 需要特殊构建版本
https://unpkg.com/konva@9.2.0/konva.min.js

// 使用示例
const stage = new Konva.Stage({
  container: 'container',
  width: 800,
  height: 600
});
```

### **Rough.js**
```javascript
// 需要特殊构建版本
https://unpkg.com/rough@0.8.0/bundled/rough.js

// 使用示例
const rc = rough.canvas(document.getElementById('canvas'));
```

### **Kinesis.js**
```javascript
// 需要特殊构建版本
https://unpkg.com/kinesis@1.0.0/dist/kinesis.min.js

// 使用示例
const kinesis = new Kinesis({
  container: document.getElementById('container')
});
```

## 🔧 **解决方案**

### **1. 使用 CDN 版本**
对于不能直接读取的库，可以使用以下CDN：

```javascript
// Fabric.js
https://cdnjs.cloudflare.com/ajax/libs/fabric.js/5.3.0/fabric.min.js

// Konva.js  
https://cdnjs.cloudflare.com/ajax/libs/konva/9.2.0/konva.min.js

// Rough.js
https://cdnjs.cloudflare.com/ajax/libs/rough/0.8.0/rough.min.js
```

### **2. 使用 UMD 版本**
```javascript
// 查找库的 UMD 版本
https://unpkg.com/[package-name]/dist/[package-name].umd.js
```

### **3. 使用 jsDelivr**
```javascript
// jsDelivr 通常有更好的兼容性
https://cdn.jsdelivr.net/npm/[package-name]@[version]/dist/[package-name].min.js
```

## 📝 **使用示例**

### **完整的外部链接配置**
```
https://unpkg.com/vue@3/dist/vue.global.prod.js
https://cdnjs.cloudflare.com/ajax/libs/gsap/3.12.2/gsap.min.js
https://cdnjs.cloudflare.com/ajax/libs/fabric.js/5.3.0/fabric.min.js
https://cdnjs.cloudflare.com/ajax/libs/konva/9.2.0/konva.min.js
```

### **HTML 模板**
```html
<div id="app">
  <canvas id="canvas" width="800" height="600"></canvas>
</div>
```

### **JavaScript 代码**
```javascript
// 等待库加载完成
window.addEventListener('load', function() {
  // 检查库是否可用
  if (typeof fabric !== 'undefined') {
    const canvas = new fabric.Canvas('canvas');
    // 使用 Fabric.js
  }
  
  if (typeof Konva !== 'undefined') {
    const stage = new Konva.Stage({
      container: 'container',
      width: 800,
      height: 600
    });
    // 使用 Konva.js
  }
});
```

## 🚀 **推荐组合**

### **动画 + 交互**
```
https://unpkg.com/vue@3/dist/vue.global.prod.js
https://cdnjs.cloudflare.com/ajax/libs/gsap/3.12.2/gsap.min.js
https://cdnjs.cloudflare.com/ajax/libs/animejs/3.2.1/anime.min.js
```

### **游戏开发**
```
https://unpkg.com/vue@3/dist/vue.global.prod.js
https://cdnjs.cloudflare.com/ajax/libs/phaser/3.70.0/phaser.min.js
https://cdnjs.cloudflare.com/ajax/libs/matter-js/0.19.0/matter.min.js
```

### **数据可视化**
```
https://unpkg.com/vue@3/dist/vue.global.prod.js
https://cdnjs.cloudflare.com/ajax/libs/chart.js/4.4.0/chart.min.js
https://cdnjs.cloudflare.com/ajax/libs/d3/7.8.5/d3.min.js
```

### **创意编程**
```
https://unpkg.com/vue@3/dist/vue.global.prod.js
https://cdnjs.cloudflare.com/ajax/libs/p5.js/1.7.0/p5.min.js
https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js
```

## ⚡ **性能优化建议**

1. **按需加载**: 只加载需要的库
2. **使用压缩版本**: 选择 `.min.js` 文件
3. **CDN 选择**: 优先使用 jsDelivr 或 cdnjs
4. **加载顺序**: CSS 在前，JS 在后
5. **错误处理**: 添加库加载检查

## 🔍 **调试技巧**

```javascript
// 检查库是否加载成功
console.log('Vue:', typeof Vue);
console.log('Fabric:', typeof fabric);
console.log('Konva:', typeof Konva);
console.log('GSAP:', typeof gsap);
``` 