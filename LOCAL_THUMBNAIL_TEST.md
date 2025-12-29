# 本地缩略图生成测试指南

## 前置条件

1. **确保后端服务运行**
   ```bash
   cd edu/backend
   npm run dev
   ```

2. **确保前端服务运行**
   ```bash
   cd edu/frontend
   npm run dev
   ```

3. **环境变量配置**
   
   在 `edu/backend/.env` 文件中确保有以下配置：
   ```env
   FRONTEND_BASE_URL=http://localhost:3000
   FREEIMAGE_HOST_API_KEY=your_api_key_here
   ```

## 测试步骤

### 方法一：使用测试页面（推荐）⭐

1. **打开浏览器**
   - 访问：`http://localhost:3000/test-thumbnail`
   - 确保已登录（使用 Google OAuth 或邮箱登录）

2. **查看内容列表**
   - 页面会显示所有内容及其缩略图状态
   - 状态包括：`pending`、`generating`、`ready`、`failed`

3. **生成单个缩略图**
   - 找到要测试的内容卡片
   - 点击 "🎨 生成缩略图" 按钮
   - 观察状态变化：`pending` → `generating` → `ready`/`failed`

4. **查看结果**
   - 生成成功后，缩略图会显示在卡片顶部
   - 如果失败，状态会显示为 `failed`，可以点击按钮重试

5. **批量生成（仅管理员）**
   - 如果用户是管理员，可以看到 "批量操作" 区域
   - 点击 "批量重新生成" 可以处理所有 `pending`/`failed` 状态的缩略图

### 方法二：使用 API 直接测试

1. **获取认证 Token**
   
   在浏览器控制台（F12）执行：
   ```javascript
   // 获取 Supabase token
   const token = JSON.parse(localStorage.getItem('sb-zayoczhybuegvtpcsgso-auth-token'))?.access_token;
   console.log('Token:', token);
   // 复制这个 token
   ```

2. **获取内容列表**
   ```bash
   curl -X GET "http://localhost:3001/api/content" \
     -H "Authorization: Bearer YOUR_TOKEN_HERE"
   ```
   
   从返回结果中找到要测试的内容 `id`。

3. **触发缩略图生成**
   ```bash
   curl -X POST "http://localhost:3001/api/content/CONTENT_ID/generate-thumbnail" \
     -H "Authorization: Bearer YOUR_TOKEN_HERE" \
     -H "Content-Type: application/json"
   ```

4. **检查生成状态**
   ```bash
   curl -X GET "http://localhost:3001/api/content/CONTENT_ID" \
     -H "Authorization: Bearer YOUR_TOKEN_HERE"
   ```
   
   查看返回的 `thumbnail_status` 和 `thumbnail_url`。

## 测试检查点

### ✅ 基础功能
- [ ] 点击生成按钮后，状态立即变为 `generating`
- [ ] 后端日志显示开始处理
- [ ] 生成成功后，状态变为 `ready`，`thumbnail_url` 有值
- [ ] 缩略图可以正常显示

### ✅ 错误处理
- [ ] 如果内容没有 `full_html`，应该返回错误
- [ ] 如果 Freeimage.host API 失败，状态应该变为 `failed`
- [ ] 失败后可以重试

### ✅ 不同内容类型
- [ ] **有图片的内容**：应该提取第一张图片
- [ ] **有 SVG 的内容**：应该转换为 PNG
- [ ] **没有图片的内容**：应该生成占位图（渐变背景 + 标题）

## 后端日志示例

成功生成时的日志：
```
[Thumbnail] Processing thumbnail for content xxx (short_id: xxx)
[Thumbnail] No image found in HTML, generating placeholder
[Thumbnail] Uploading thumbnail to Freeimage.host...
[Freeimage Upload] ✅ Image uploaded successfully
[Thumbnail] ✅ Thumbnail generated successfully: https://iili.io/xxxxx.png
```

失败时的日志：
```
[Thumbnail] Processing thumbnail for content xxx (short_id: xxx)
[Thumbnail] No image found in HTML, generating placeholder
[Thumbnail] Uploading thumbnail to Freeimage.host...
[Freeimage Upload] Upload failed - details: {...}
[Thumbnail] Generation failed: Bad Request
```

## 常见问题

### 1. 缩略图一直显示 "生成中"
- 检查后端服务是否正常运行
- 查看后端日志是否有错误
- 检查 `FREEIMAGE_HOST_API_KEY` 是否正确

### 2. 生成失败
- 检查 `FREEIMAGE_HOST_API_KEY` 是否有效
- 检查网络连接（Freeimage.host 需要访问外网）
- 查看后端日志获取详细错误信息

### 3. 占位图显示不正确
- 检查 `sharp` 或 `pngjs` 是否正常安装
- 查看后端日志中的警告信息

## 性能预期

- **简单占位图生成**：1-3 秒
- **提取外部图片**：2-5 秒（取决于网络）
- **SVG 转换**：2-4 秒
- **上传到 Freeimage.host**：1-2 秒

**总计**：通常在 5-10 秒内完成

