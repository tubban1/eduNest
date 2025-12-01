# 🎨 手势变换 3D 粒子 - 使用指南

## 📋 功能概述

通过手势识别,让 3000 个粒子实时变换成不同的 3D 形状,并缓慢旋转展示。

---

## ✋ 支持的手势

| 手势 | 图标 | 形状 | 描述 |
|------|------|------|------|
| **张开五指** | 🖐️ | ❤️ 3D 爱心 | 所有粒子组成立体爱心形状 |
| **食指** | ☝️ | 🌸 3D 花朵 | 所有粒子组成8瓣花朵 |
| **V手势** | ✌️ | 🪐 土星+星环 | 40%粒子组成星球,60%组成星环 |
| **Rock/ILY** | 🤘 | 🙏 3D 佛像 | 粒子组成佛像(头部+身体+底座) |
| **OK手势** | 👌 | ✨ 字母Jenny | 粒子组成"Jenny"文字 |
| **握拳** | ✊ | 🔄 重置 | 粒子恢复自由状态 |

---

## 🎯 手势识别规则

### 1. 张开五指 (Five)
- **条件**: 所有5根手指都伸直
- **识别**: `extendedCount >= 4`
- **形状**: 3D爱心
- **参数方程**:
  ```javascript
  x = 16 * sin³(t)
  y = 13*cos(t) - 5*cos(2t) - 2*cos(3t) - cos(4t)
  z = 随机厚度 (-2.5 到 2.5)
  ```

### 2. 食指 (One)
- **条件**: 只有食指伸直,其他手指弯曲
- **识别**: `isIndexExtended && !others`
- **形状**: 8瓣花朵
- **参数方程**:
  ```javascript
  radius = 3 + 2*sin(8*angle)  // 8片花瓣
  x = radius * cos(angle)
  y = 随机高度 (-1 到 1)
  z = radius * sin(angle)
  ```

### 3. V手势 (Peace)
- **条件**: 食指和中指伸直,其他弯曲
- **识别**: `isIndexExtended && isMiddleExtended && !others`
- **形状**: 土星+星环
- **组成**:
  - 40% 粒子 → 球体(星球)
  - 60% 粒子 → 扁平圆环(星环)

### 4. Rock/ILY
- **条件**: 食指、小指、拇指伸直,中指和无名指弯曲
- **识别**: `isIndexExtended && isPinkyExtended && isThumbExtended && !isMiddleExtended && !isRingExtended`
- **形状**: 佛像
- **组成**:
  - 30% 粒子 → 头部(球体)
  - 50% 粒子 → 身体(圆柱体)
  - 20% 粒子 → 底座(扁平圆盘)

### 5. OK手势
- **条件**: 拇指和食指形成圆圈,其他手指伸直
- **识别**: `thumbIndexDistance < 0.05 && others extended`
- **形状**: 字母Jenny
- **效果**: 粒子组成5个字母 J-e-n-n-y
- **特点**:
  - 每个字母约600个粒子
  - 字母间距3个单位
  - 基于路径点插值生成
  - 添加轻微Z轴深度

### 6. 握拳 (Fist)
- **条件**: 所有手指弯曲
- **识别**: `extendedCount === 0`
- **效果**: 清除形状,粒子恢复自由状态

---

## 🔄 形状变换机制

### 1. 形状生成
```javascript
// 每个手势对应一个形状生成函数
generateHeartShape(particleCount)   // 爱心
generateFlowerShape(particleCount)  // 花朵
generateSaturnShape(particleCount)  // 土星
generateBuddhaShape(particleCount)  // 佛像
generateFireworkShape(particleCount) // 烟花
```

### 2. 粒子移动算法
```javascript
// 使用弹簧力让粒子移动到目标位置
springStrength = 0.05
damping = 0.9

velocity += direction * springStrength * distance
velocity *= damping
```

### 3. 形状旋转
```javascript
// 每帧旋转 0.005 弧度 (约 0.3°)
shapeRotation += 0.005

// 应用Y轴旋转
rotatedX = x * cos(rotation) - z * sin(rotation)
rotatedZ = x * sin(rotation) + z * cos(rotation)
```

---

## 🎨 UI 改进

### 手势提示面板
- **位置**: 右下角 (bottom: 30px, right: 30px)
- **大小**: 缩小版 (180px - 250px)
- **样式**: 
  - 背景: `rgba(0, 0, 0, 0.4)` + 模糊效果
  - 字体: 16px (名称), 12px (描述)
  - 图标: 32px
  - 动画: 向上滑动 5px

### 移动端适配
- 面板位置: `bottom: 20px, right: 20px`
- 最小宽度: 150px
- 字体缩小: 14px / 11px
- 图标缩小: 24px

---

## 🚀 性能优化

### 粒子数量
- **总数**: 3000 个粒子
- **大小**: 0.25 (带距离衰减)
- **不透明度**: 0.95

### 渲染优化
- **材质**: `THREE.PointsMaterial` + `AdditiveBlending`
- **更新**: 只更新 `position` 属性
- **旋转**: 预计算旋转矩阵

### 形状切换
- **平滑过渡**: 使用弹簧力,自然过渡
- **无延迟**: 手势识别后立即切换
- **持续旋转**: 形状保持缓慢旋转

---

## 📊 技术参数

| 参数 | 值 | 说明 |
|------|-----|------|
| 粒子数量 | 3000 | 足够形成复杂形状 |
| 粒子大小 | 0.25 | 清晰可见 |
| 弹簧强度 | 0.05 | 平滑移动 |
| 阻尼系数 | 0.9 | 快速稳定 |
| 旋转速度 | 0.005 rad/frame | 约 17秒/圈 |
| 形状缩放 | 0.3 - 6.0 | 适应屏幕 |

---

## 🎯 使用流程

1. **启动摄像头**: 点击"启动摄像头"按钮
2. **等待识别**: 将手放在摄像头前
3. **做出手势**: 参考右下角提示
4. **观看变换**: 粒子自动变换成对应形状
5. **持续旋转**: 形状会缓慢旋转展示
6. **切换形状**: 做出其他手势切换
7. **重置粒子**: 握拳恢复自由状态

---

## 🐛 故障排查

### 问题 1: 手势识别不准确
**解决方案**:
- 确保手完全在摄像头视野内
- 保持手势稳定 1-2 秒
- 调整手与摄像头的距离(30-50cm)
- 确保光线充足

### 问题 2: 形状变换太慢
**解决方案**:
- 调整 `springStrength` (增大到 0.1)
- 减小 `damping` (改为 0.85)

### 问题 3: 形状不完整
**解决方案**:
- 检查粒子数量是否足够
- 确保形状生成函数正确
- 查看浏览器控制台是否有错误

---

## 🎨 自定义形状

### 添加新形状的步骤

1. **创建形状生成函数**:
```javascript
function generateMyShape(particleCount) {
  const positions = [];
  for (let i = 0; i < particleCount; i++) {
    // 计算每个粒子的位置
    const x = ...;
    const y = ...;
    const z = ...;
    positions.push(new THREE.Vector3(x, y, z));
  }
  return positions;
}
```

2. **添加手势识别**:
```javascript
// 在 recognizeGesture 函数中添加
else if (/* 你的手势条件 */) {
  gesture = 'mygesture';
}
```

3. **关联形状**:
```javascript
// 在 setTargetShape 函数中添加
case 'mygesture':
  currentShape = 'myshape';
  targetShapePositions = generateMyShape(particleCount);
  break;
```

4. **更新手势信息**:
```javascript
// 在 gestureInfo 中添加
'mygesture': {
  icon: '🎯',
  name: '我的手势',
  desc: '我的形状'
}
```

---

## 📝 代码结构

```
gesture-particles.html
├── 样式定义 (CSS)
│   ├── 容器布局
│   ├── 手势提示面板 (右下角)
│   └── 移动端适配
├── 全局变量
│   ├── Three.js 对象
│   ├── MediaPipe 对象
│   └── 形状变换变量
├── 形状生成函数
│   ├── generateHeartShape()
│   ├── generateFlowerShape()
│   ├── generateSaturnShape()
│   ├── generateBuddhaShape()
│   └── generateFireworkShape()
├── 手势识别
│   ├── recognizeGesture()
│   └── 手势信息映射
├── 粒子控制
│   ├── setTargetShape()
│   ├── applyGestureEffect()
│   └── updateParticles()
└── 动画循环
    ├── 形状旋转
    ├── 相机运动
    └── 渲染
```

---

## 🎉 总结

通过手势识别和粒子系统的结合,实现了:
- ✅ 6种不同的手势识别
- ✅ 5种3D形状变换
- ✅ 平滑的形状过渡
- ✅ 缓慢的形状旋转
- ✅ 优化的UI布局
- ✅ 良好的性能表现

享受手势控制粒子的乐趣吧! 🎨✨

