# 缩略图生成功能 - 管理员测试指南

## 📋 前置条件

1. ✅ 已安装 Playwright 依赖：
   ```bash
   cd edu/backend
   npm install
   npx playwright install chromium
   ```

2. ✅ 已配置环境变量（`.env` 文件）：
   ```bash
   FREEIMAGE_HOST_API_KEY=your_api_key_here
   FRONTEND_BASE_URL=http://localhost:3000  # 开发环境
   # 或
   FRONTEND_BASE_URL=https://edunest.app  # 生产环境
   ```

3. ✅ 数据库已更新（`thumbnail_url`, `thumbnail_status`, `thumbnail_updated_at` 字段已存在）

4. ✅ 后端服务正在运行

---

## 🧪 测试方法

### 方法一：使用 API 端点测试（推荐）

#### 1. 获取认证 Token

**方法 A：邮箱密码登录（传统登录）**

```bash
# 登录获取 token
curl -X POST http://localhost:3001/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "your-admin-email@example.com",
    "password": "your-password"
  }'

# 返回示例：
# {
#   "success": true,
#   "data": {
#     "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
#     "user": { "id": "...", "role": "admin" }
#   }
# }
```

**方法 B：Google OAuth 登录（推荐）⭐**

如果你使用 Google 登录，没有密码，需要从浏览器获取 token：

1. **打开浏览器，访问你的应用并登录**
2. **打开浏览器控制台（F12）**
3. **执行以下代码：**
   ```javascript
   const token = JSON.parse(localStorage.getItem('sb-zayoczhybuegvtpcsgso-auth-token'))?.access_token;
   console.log('Token:', token);
   // 复制输出的 token
   ```
4. **将 token 保存到环境变量或直接使用：**
   ```bash
   export TOKEN="your-token-from-browser"
   ```

#### 2. 获取内容列表（找到要测试的内容 ID）

```bash
# 获取所有内容
curl -X GET http://localhost:3001/api/content \
  -H "Authorization: Bearer YOUR_TOKEN_HERE"

# 或获取特定用户的内容
curl -X GET "http://localhost:3001/api/content?created_by=USER_ID" \
  -H "Authorization: Bearer YOUR_TOKEN_HERE"
```

从返回结果中找到：
- `id`: 内容的 UUID（用于 API 调用）
- `short_id`: 内容的短 ID（用于前端访问）
- `thumbnail_status`: 当前缩略图状态（`pending` / `generating` / `ready` / `failed`）

#### 3. 测试单个内容缩略图生成

```bash
# 替换 CONTENT_ID 为实际的内容 ID
curl -X POST http://localhost:3001/api/content/CONTENT_ID/generate-thumbnail \
  -H "Authorization: Bearer YOUR_TOKEN_HERE" \
  -H "Content-Type: application/json"

# 成功响应：
# {
#   "success": true,
#   "message": "Thumbnail generation task started"
# }
```

#### 4. 批量重新生成缩略图（仅管理员）

```bash
# 批量重新生成所有 pending/failed 状态的缩略图（最多 100 个）
curl -X POST http://localhost:3001/api/content/regenerate-thumbnails \
  -H "Authorization: Bearer YOUR_TOKEN_HERE" \
  -H "Content-Type: application/json"

# 成功响应：
# {
#   "success": true,
#   "message": "Started thumbnail generation for 5 items",
#   "count": 5
# }
```

#### 5. 检查缩略图生成状态

```bash
# 获取内容详情，查看 thumbnail_status 和 thumbnail_url
curl -X GET http://localhost:3001/api/content/CONTENT_ID \
  -H "Authorization: Bearer YOUR_TOKEN_HERE"

# 返回示例：
# {
#   "success": true,
#   "data": {
#     "id": "...",
#     "title": "...",
#     "thumbnail_url": "https://iili.io/xxxxx.png",  # 生成成功后会有 URL
#     "thumbnail_status": "ready",  # pending -> generating -> ready/failed
#     "thumbnail_updated_at": "2024-01-01T12:00:00Z"
#   }
# }
```

---

### 方法二：使用前端测试页面（最简单）⭐

**这是最推荐的测试方法，提供了完整的图形界面！**

1. **访问测试页面**
   - 打开浏览器，访问：`http://localhost:3000/test-thumbnail`（开发环境）
   - 或生产环境对应的 URL
   - **需要先登录**（Google OAuth 或邮箱密码登录）

2. **页面功能**
   - ✅ **自动加载内容列表**：显示所有内容及其缩略图状态
   - ✅ **缩略图预览**：实时显示生成的缩略图
   - ✅ **状态标签**：Pending / Generating / Ready / Failed
   - ✅ **单个生成按钮**：点击"生成缩略图"按钮手动触发
   - ✅ **批量重新生成**：管理员专用，一键处理所有待处理/失败的任务
   - ✅ **统计信息**：显示总内容数、已生成、生成中、待处理/失败的数量
   - ✅ **自动刷新**：生成后自动更新状态

3. **使用步骤**
   - 登录后，页面会自动加载所有内容
   - 查看每个内容的缩略图状态和预览
   - 点击"生成缩略图"按钮测试单个内容
   - 管理员可以点击"批量重新生成"处理所有待处理的任务
   - 点击"刷新列表"按钮手动更新状态

4. **优势**
   - 🎨 图形界面，操作简单
   - 👀 实时预览缩略图
   - 📊 统计信息一目了然
   - 🔄 自动状态更新
   - ✅ 无需手动输入 API 端点或 Token

---

### 方法三：使用浏览器开发者工具测试（用于调试）

1. **打开前端页面并登录为管理员**
   - 访问 `http://localhost:3000/c` 或生产环境
   - 使用 Google 账号登录（或任何 OAuth 登录方式）

2. **打开浏览器开发者工具（F12）**
   - 切换到 Console 标签

3. **获取认证 Token（Google OAuth 用户）**
   ```javascript
   // 在 Console 中执行 - 从 localStorage 获取 Supabase session
   const sessionStr = localStorage.getItem('sb-zayoczhybuegvtpcsgso-auth-token');
   if (sessionStr) {
     const session = JSON.parse(sessionStr);
     const token = session?.access_token;
     console.log('✅ Token found:', token?.substring(0, 30) + '...');
     console.log('Full token:', token);
     
     // 复制到剪贴板（可选）
     navigator.clipboard.writeText(token).then(() => {
       console.log('✅ Token copied to clipboard!');
     });
   } else {
     console.error('❌ No session found. Please make sure you are logged in.');
   }
   ```

   **或者使用一行代码：**
   ```javascript
   const token = JSON.parse(localStorage.getItem('sb-zayoczhybuegvtpcsgso-auth-token'))?.access_token;
   console.log('Token:', token);
   ```

4. **测试单个内容缩略图生成**
   ```javascript
   // 替换 CONTENT_ID 为实际的内容 ID
   const contentId = 'YOUR_CONTENT_ID_HERE';
   
   fetch(`http://localhost:3001/api/content/${contentId}/generate-thumbnail`, {
     method: 'POST',
     headers: {
       'Authorization': `Bearer ${token}`,
       'Content-Type': 'application/json'
     }
   })
   .then(res => res.json())
   .then(data => console.log('Result:', data))
   .catch(err => console.error('Error:', err));
   ```

5. **批量重新生成**
   ```javascript
   fetch('http://localhost:3001/api/content/regenerate-thumbnails', {
     method: 'POST',
     headers: {
       'Authorization': `Bearer ${token}`,
       'Content-Type': 'application/json'
     }
   })
   .then(res => res.json())
   .then(data => console.log('Batch Result:', data))
   .catch(err => console.error('Error:', err));
   ```

6. **检查生成状态**
   ```javascript
   const contentId = 'YOUR_CONTENT_ID_HERE';
   
   fetch(`http://localhost:3001/api/content/${contentId}`, {
     headers: {
       'Authorization': `Bearer ${token}`
     }
   })
   .then(res => res.json())
   .then(data => {
     console.log('Thumbnail Status:', data.data.thumbnail_status);
     console.log('Thumbnail URL:', data.data.thumbnail_url);
   });
   ```

---

### 方法四：查看后端日志

缩略图生成过程会在后端控制台输出详细日志：

```bash
# 查看后端日志
cd edu/backend
npm run dev

# 日志示例：
# [Thumbnail] Visiting page: http://localhost:3000/full-html/abc123?thumbnail=1
# [Thumbnail] ✅ Detected Canvas element, size: 800 x 600
# [Freeimage Upload] ✅ Image uploaded successfully
# [Thumbnail] ✅ Thumbnail generated successfully: https://iili.io/xxxxx.png
```

---

## 🔍 测试检查清单

### ✅ 基础功能测试

- [ ] **单个内容生成**
  - [ ] 调用 API 后立即返回成功消息
  - [ ] 后端日志显示开始生成
  - [ ] `thumbnail_status` 从 `pending` 变为 `generating`，最终变为 `ready` 或 `failed`
  - [ ] 生成成功后 `thumbnail_url` 有值

- [ ] **批量生成**
  - [ ] 管理员可以调用批量接口
  - [ ] 非管理员调用返回 403 错误
  - [ ] 批量接口返回正确的数量统计

- [ ] **前端显示**
  - [ ] 在 `/c` 页面可以看到缩略图
  - [ ] `generating` 状态显示加载动画
  - [ ] `ready` 状态显示图片
  - [ ] `failed` 状态显示占位符

### ✅ 不同内容类型测试

- [ ] **Canvas 内容**（Three.js、图表等）
  - [ ] 能正确检测到 Canvas 元素
  - [ ] 截图尺寸合理

- [ ] **SVG 内容**
  - [ ] 能正确检测到 SVG 元素
  - [ ] 截图清晰

- [ ] **普通 HTML 内容**
  - [ ] 能检测到最大可见元素或使用视口截图
  - [ ] 截图比例正确（16:9）

- [ ] **Video 内容**
  - [ ] 能检测到 Video 元素
  - [ ] 截图显示视频帧

### ✅ 错误处理测试

- [ ] **内容不存在**
  - [ ] 调用不存在的 `content_id` 返回 404

- [ ] **缺少 short_id**
  - [ ] 如果内容没有 `short_id`，返回错误

- [ ] **网络错误**
  - [ ] 如果 `FRONTEND_BASE_URL` 无法访问，记录错误
  - [ ] `thumbnail_status` 更新为 `failed`

- [ ] **Freeimage.host 上传失败**
  - [ ] 如果 API Key 无效，记录错误
  - [ ] `thumbnail_status` 更新为 `failed`

---

## 🐛 常见问题排查

### 问题 1: 缩略图一直显示 "生成中"

**可能原因：**
- Playwright 浏览器未正确安装
- 后端服务未运行
- `FRONTEND_BASE_URL` 配置错误

**解决方法：**
```bash
# 1. 检查 Playwright 安装
npx playwright install chromium

# 2. 检查后端日志
# 查看是否有错误信息

# 3. 检查环境变量
echo $FRONTEND_BASE_URL
# 或查看 .env 文件
```

### 问题 2: 返回 403 错误（权限不足）

**可能原因：**
- 用户不是管理员角色
- Token 已过期

**解决方法：**
```bash
# 1. 检查用户角色
curl -X GET http://localhost:3001/api/auth/me \
  -H "Authorization: Bearer YOUR_TOKEN"

# 2. 重新登录获取新 token
```

### 问题 3: 缩略图生成失败（status = failed）

**可能原因：**
- `FREEIMAGE_HOST_API_KEY` 无效
- 页面无法访问（`FRONTEND_BASE_URL` 错误）
- 页面加载超时

**解决方法：**
```bash
# 1. 检查 API Key
# 在 freeimage.host 网站验证 API Key 是否有效

# 2. 检查前端 URL
# 确保 FRONTEND_BASE_URL 可以访问
curl http://localhost:3000/full-html/TEST_SHORT_ID?thumbnail=1

# 3. 查看后端详细日志
# 查看具体的错误信息
```

### 问题 4: 检测不到 Canvas/SVG 元素

**这是正常的**，系统会按优先级自动降级：
1. Canvas → 2. SVG → 3. Video → 4. iframe → 5. 最大可见元素 → 6. 视口截图

如果前几项都检测不到，会使用"最大可见元素"或"视口截图"方案，这也是有效的。

---

## 📊 性能测试

### 测试生成时间

```bash
# 记录开始时间
start_time=$(date +%s)

# 触发生成
curl -X POST http://localhost:3001/api/content/CONTENT_ID/generate-thumbnail \
  -H "Authorization: Bearer YOUR_TOKEN"

# 轮询检查状态（每 2 秒检查一次）
while true; do
  status=$(curl -s -X GET http://localhost:3001/api/content/CONTENT_ID \
    -H "Authorization: Bearer YOUR_TOKEN" | jq -r '.data.thumbnail_status')
  
  if [ "$status" = "ready" ] || [ "$status" = "failed" ]; then
    end_time=$(date +%s)
    duration=$((end_time - start_time))
    echo "Thumbnail generation completed in ${duration} seconds"
    break
  fi
  
  echo "Status: $status, waiting..."
  sleep 2
done
```

**预期时间：**
- 简单 HTML：5-10 秒
- Canvas/SVG：10-15 秒
- 复杂页面：15-30 秒

---

## 🎯 快速测试脚本

### 脚本 A：使用邮箱密码登录（适用于传统登录用户）

创建一个测试脚本 `test-thumbnail.sh`：

```bash
#!/bin/bash

# 配置
API_URL="http://localhost:3001"
EMAIL="your-admin@example.com"
PASSWORD="your-password"
CONTENT_ID="your-content-id"

# 1. 登录获取 token
echo "Logging in..."
LOGIN_RESPONSE=$(curl -s -X POST "$API_URL/api/auth/login" \
  -H "Content-Type: application/json" \
  -d "{\"email\":\"$EMAIL\",\"password\":\"$PASSWORD\"}")

TOKEN=$(echo $LOGIN_RESPONSE | jq -r '.data.token')

if [ "$TOKEN" = "null" ] || [ -z "$TOKEN" ]; then
  echo "Login failed!"
  exit 1
fi

echo "Token obtained: ${TOKEN:0:20}..."
```

### 脚本 B：使用浏览器 Token（适用于 Google OAuth 用户）⭐

**步骤 1：在浏览器控制台获取 Token**

打开浏览器控制台（F12），执行：
```javascript
const token = JSON.parse(localStorage.getItem('sb-zayoczhybuegvtpcsgso-auth-token'))?.access_token;
console.log('Token:', token);
// 复制这个 token
```

**步骤 2：创建测试脚本 `test-thumbnail-oauth.sh`：**

```bash
#!/bin/bash

# 配置
API_URL="http://localhost:3001"
# 从浏览器控制台复制的 token（直接粘贴在这里）
TOKEN="your-token-from-browser-console"
CONTENT_ID="your-content-id"

# 验证 token 是否设置
if [ -z "$TOKEN" ] || [ "$TOKEN" = "your-token-from-browser-console" ]; then
  echo "❌ Error: Please set TOKEN variable!"
  echo "   1. Open browser console (F12)"
  echo "   2. Run: JSON.parse(localStorage.getItem('sb-zayoczhybuegvtpcsgso-auth-token'))?.access_token"
  echo "   3. Copy the token and paste it in this script"
  exit 1
fi

echo "Using token: ${TOKEN:0:30}..."

# 2. 触发缩略图生成
echo "Triggering thumbnail generation..."
RESPONSE=$(curl -s -X POST "$API_URL/api/content/$CONTENT_ID/generate-thumbnail" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json")

echo "Response: $RESPONSE"

# 3. 等待并检查状态
echo "Waiting for generation to complete..."
for i in {1..30}; do
  STATUS_RESPONSE=$(curl -s -X GET "$API_URL/api/content/$CONTENT_ID" \
    -H "Authorization: Bearer $TOKEN")
  
  STATUS=$(echo $STATUS_RESPONSE | jq -r '.data.thumbnail_status')
  URL=$(echo $STATUS_RESPONSE | jq -r '.data.thumbnail_url')
  
  echo "[$i] Status: $STATUS"
  
  if [ "$STATUS" = "ready" ]; then
    echo "✅ Success! Thumbnail URL: $URL"
    exit 0
  elif [ "$STATUS" = "failed" ]; then
    echo "❌ Generation failed!"
    exit 1
  fi
  
  sleep 2
done

echo "⏱️  Timeout after 60 seconds"
exit 1
```

**使用方法：**

- **脚本 A（邮箱密码登录）：**
  ```bash
  chmod +x test-thumbnail.sh
  ./test-thumbnail.sh
  ```

- **脚本 B（Google OAuth）：**
  ```bash
  # 1. 先在浏览器控制台获取 token（见上方步骤 1）
  # 2. 将 token 粘贴到脚本中的 TOKEN 变量
  chmod +x test-thumbnail-oauth.sh
  ./test-thumbnail-oauth.sh
  ```

---

## 📝 测试记录模板

```
测试日期: 2024-XX-XX
测试人员: [你的名字]
环境: [开发/生产]

测试内容 ID: [填写]
内容类型: [Canvas/SVG/HTML/Video]
short_id: [填写]

测试步骤:
1. [ ] 调用单个生成 API
2. [ ] 检查返回状态
3. [ ] 等待生成完成
4. [ ] 验证 thumbnail_url
5. [ ] 验证前端显示

结果:
- API 响应: [成功/失败]
- 生成时间: [XX 秒]
- 最终状态: [ready/failed]
- 缩略图 URL: [填写]
- 前端显示: [正常/异常]

问题记录:
[如有问题，记录 here]
```

---

## 🚀 下一步

测试通过后，可以：
1. 监控生产环境的生成成功率
2. 根据实际使用情况调整超时时间
3. 优化检测逻辑（如果需要）
4. 添加更多内容类型的支持

