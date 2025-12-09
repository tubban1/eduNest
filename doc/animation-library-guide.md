# 几何动画库选择指南

## 推荐的库组合

对于几何图形变换动画（三角形拼接、平行四边形切补、梯形分割重组），**推荐使用：**

### 🏆 Konva.js + GSAP

**优点：**
- ✅ 精确的2D图形绘制
- ✅ 流畅的动画效果
- ✅ 易于管理图形对象（Group、Layer）
- ✅ 性能优秀（Canvas渲染）
- ✅ 丰富的变换API（移动、旋转、缩放）
- ✅ 完善的文档和社区支持

**适用场景：**
- 几何图形演示
- 数学公式可视化
- 图形变换动画
- 交互式绘图

**库版本：**
- Konva: `10.0.12`
- GSAP: `3.13.0`

## 动画需求分析

### 1. 三角形复制拼接
```javascript
// 使用 Konva 绘制三角形
const triangle = new Konva.Line({
    points: [x1, y1, x2, y2, x3, y3, x1, y1],
    closed: true,
    fill: 'rgba(102, 126, 234, 0.5)',
    stroke: '#667eea'
});

// 使用 GSAP 动画拼接
gsap.to(triangle2, {
    x: targetX,
    y: targetY,
    rotation: 180,
    duration: 1.5,
    ease: 'power2.inOut'
});
```

### 2. 平行四边形切补
```javascript
// 绘制平行四边形和切下的三角形
const para = new Konva.Line({...});
const triangle = new Konva.Line({...});

// 动画移动三角形
gsap.to(triangle, {
    x: newX,
    y: newY,
    duration: 1.5
});
```

### 3. 梯形分割
```javascript
// 绘制分割线
const divider = new Konva.Line({...});

// 显示分割后的三角形
gsap.to([triangle1, triangle2], {
    opacity: 1,
    duration: 0.5
});
```

### 4. 梯形重组
```javascript
// 翻转并移动梯形
gsap.to(trapezoid2, {
    x: targetX,
    y: targetY,
    rotation: 180,
    duration: 1.5
});
```

## 其他可选方案

### Fabric.js
- **优点：** 内置交互功能，适合图形编辑器
- **缺点：** 动画能力不如GSAP，API较复杂
- **适用：** 需要用户交互编辑的场景

### SVG + GSAP/Anime.js
- **优点：** 矢量图形，缩放不失真
- **缺点：** 复杂动画性能不如Canvas
- **适用：** 简单动画，需要打印的场景

### Three.js
- **不推荐：** 这是3D库，对2D几何图形过于复杂

## 实现建议

1. **使用 Konva.Group 管理相关图形**
   - 便于整体移动和变换
   - 简化动画控制

2. **使用 GSAP Timeline 控制复杂动画序列**
   - 多个步骤的动画
   - 同步多个对象的动画

3. **添加边界检查**
   - 确保图形在canvas内
   - 动态调整尺寸

4. **性能优化**
   - 使用 `layer.batchDraw()` 批量绘制
   - 避免频繁的 `destroyChildren()`

## 代码示例结构

```javascript
// 1. 初始化画布
const stage = new Konva.Stage({
    container: 'canvas',
    width: 800,
    height: 400
});
const layer = new Konva.Layer();
stage.add(layer);

// 2. 绘制图形
function drawTriangle(x, y, base, height) {
    return new Konva.Line({
        points: [...],
        closed: true,
        fill: 'rgba(102, 126, 234, 0.5)',
        stroke: '#667eea',
        name: 'triangle'
    });
}

// 3. 执行动画
function animateRecompose() {
    const triangle1 = layer.findOne('.triangle1');
    const triangle2 = layer.findOne('.triangle2');
    
    gsap.to(triangle2, {
        x: targetX,
        y: targetY,
        rotation: 180,
        duration: 1.5,
        ease: 'power2.inOut',
        onUpdate: () => layer.draw()
    });
}
```

## 总结

**最佳选择：Konva.js + GSAP**

这个组合已经在项目中成功使用，非常适合几何图形的变换动画。建议继续使用当前方案。

