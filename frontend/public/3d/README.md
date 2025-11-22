# 3D 交互页面使用说明

## 手势指挥 3D 粒子轨迹

### ⚠️ 重要提示

**不能直接双击 HTML 文件打开！** 必须使用 HTTP 服务器运行。

### 为什么需要 HTTP 服务器？

浏览器的安全策略不允许 `file://` 协议访问摄像头。必须通过 HTTP/HTTPS 协议访问。

### 快速启动方法

#### 方法 1：使用 Python（推荐，最简单）

```bash
# 进入项目根目录
cd edu/frontend

# Python 3
python3 -m http.server 8000

# 或 Python 2
python -m SimpleHTTPServer 8000
```

然后在浏览器访问：
```
http://localhost:8000/public/3d/gesture-particles.html
```

#### 方法 2：使用 Node.js http-server

```bash
# 安装 http-server（如果还没安装）
npm install -g http-server

# 进入项目目录
cd edu/frontend

# 启动服务器
http-server -p 8000
```

然后在浏览器访问：
```
http://localhost:8000/public/3d/gesture-particles.html
```

#### 方法 3：使用 VS Code Live Server

1. 安装 VS Code 扩展 "Live Server"
2. 右键点击 `gesture-particles.html`
3. 选择 "Open with Live Server"

#### 方法 4：使用项目自带的开发服务器

如果项目有 Next.js 或其他开发服务器：

```bash
# 在项目根目录
cd edu/frontend
npm run dev
```

然后访问对应的 URL（通常是 `http://localhost:3000/3d/gesture-particles.html`）

### 使用步骤

1. **启动 HTTP 服务器**（使用上述任一方法）
2. **在浏览器中打开页面**（使用 `http://localhost:xxxx` 而不是 `file://`）
3. **点击"启动摄像头"按钮**
4. **允许浏览器访问摄像头权限**
5. **开始使用手势控制粒子！**

### 手势说明

- 👆 **食指指向**：吸引粒子
- ✋ **张开手掌**：分散粒子
- ✊ **握拳**：聚集粒子
- 🤏 **捏合**：旋转粒子
- 👋 **和平手势**：清除并重置粒子

### 常见问题

**Q: 提示"无法访问摄像头"**
- 检查是否使用了 HTTP 服务器（不是 file://）
- 检查浏览器是否允许摄像头权限
- 检查摄像头是否被其他应用占用

**Q: 手势识别不准确**
- 确保光线充足
- 手部与摄像头保持适当距离（30-60cm）
- 背景尽量简洁

**Q: 页面加载慢**
- MediaPipe 模型文件较大，首次加载需要时间
- 确保网络连接正常（需要从 CDN 加载资源）

### 技术栈

- **MediaPipe Hands**: 手势识别
- **Three.js**: 3D 粒子系统
- **WebRTC**: 摄像头访问

