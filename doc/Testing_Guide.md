# 收藏功能测试指南

## 🚀 快速开始

### 1. 启动服务器
确保前端和后端服务器都在运行：

```bash
# 前端服务器 (端口 3000)
cd edu/frontend && npm run dev

# 后端服务器 (端口 3001)
cd edu/backend && npm run dev
```

### 2. 测试登录功能
访问测试页面：`http://localhost:3000/test-login`

- 使用测试账号：
  - 邮箱：`test@example.com`
  - 密码：`password123`
- 点击"测试登录"按钮验证登录功能

### 3. 访问收藏页面
登录成功后，访问：`http://localhost:3000/collections`

## 📋 功能测试清单

### ✅ 登录功能
- [ ] 访问 `/test-login` 页面
- [ ] 使用测试账号登录
- [ ] 验证登录成功
- [ ] 检查用户信息获取

### ✅ 收藏页面
- [ ] 访问 `/collections` 页面
- [ ] 验证左侧导航栏显示
- [ ] 检查Tab标签分组
- [ ] 查看收藏内容卡片
- [ ] 测试卡片操作按钮

### ✅ API接口测试
```bash
# 1. 登录测试
curl -X POST http://localhost:3001/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"password123"}'

# 2. 获取用户信息
curl -X GET http://localhost:3001/api/auth/me \
  -H "Authorization: Bearer YOUR_TOKEN"

# 3. 获取收藏分组
curl -X GET http://localhost:3001/api/user_collections/groups \
  -H "Authorization: Bearer YOUR_TOKEN"

# 4. 获取收藏内容
curl -X GET http://localhost:3001/api/user_collections/group/all \
  -H "Authorization: Bearer YOUR_TOKEN"
```

## 🎯 预期结果

### 登录成功响应
```json
{
  "success": true,
  "data": {
    "user": {
      "id": "mock-user-1",
      "email": "test@example.com",
      "name": "测试用户",
      "role": "user"
    },
    "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
  }
}
```

### 收藏分组响应
```json
{
  "success": true,
  "data": [
    {
      "id": "all",
      "name": "全部收藏",
      "count": 1
    },
    {
      "id": "mock-list-1",
      "name": "我的收藏",
      "count": 1
    }
  ]
}
```

### 收藏内容响应
```json
{
  "success": true,
  "data": [
    {
      "id": "mock-collection-1",
      "content": {
        "id": "mock-content-1",
        "short_id": "c1234567",
        "title": "示例内容",
        "language": "zh-CN",
        "tags": ["示例"],
        "knowledge_point": ["测试"],
        "created_at": "2025-07-27T23:27:40.829Z"
      },
      "added_at": "2025-07-27T23:27:40.829Z",
      "list_id": "mock-list-1",
      "list_name": "我的收藏"
    }
  ]
}
```

## 🔧 故障排除

### 常见问题

#### 1. 登录失败
**问题**：显示"凭据错误"
**解决**：
- 确保使用正确的测试账号：`test@example.com` / `password123`
- 检查后端服务器是否运行在端口 3001
- 查看后端日志确认开发模式已启用

#### 2. 页面无法访问
**问题**：404错误或页面空白
**解决**：
- 确保前端服务器运行在端口 3000
- 检查浏览器控制台是否有错误
- 清除浏览器缓存

#### 3. API请求失败
**问题**：CORS错误或网络错误
**解决**：
- 确保后端CORS配置正确
- 检查API端点是否正确
- 验证Authorization头格式

#### 4. 收藏页面空白
**问题**：页面加载但无内容
**解决**：
- 确保已登录
- 检查浏览器网络请求
- 验证API响应格式

### 调试步骤

1. **检查服务器状态**
   ```bash
   # 检查前端
   curl http://localhost:3000
   
   # 检查后端
   curl http://localhost:3001/health
   ```

2. **查看服务器日志**
   - 前端：浏览器开发者工具
   - 后端：终端输出

3. **测试API接口**
   - 使用curl命令测试
   - 使用Postman或类似工具

4. **检查网络请求**
   - 打开浏览器开发者工具
   - 查看Network标签页
   - 检查请求和响应

## 📱 移动端测试

### 响应式设计测试
- 使用浏览器开发者工具切换设备模式
- 测试不同屏幕尺寸下的显示效果
- 验证触摸操作是否正常

### 性能测试
- 检查页面加载速度
- 验证图片和资源加载
- 测试滚动和交互流畅度

## 🎉 成功标准

当以下所有功能都正常工作时，表示收藏功能已完全实现：

- ✅ 用户可以成功登录
- ✅ 收藏页面正常显示
- ✅ 左侧导航栏功能正常
- ✅ Tab标签切换正常
- ✅ 收藏卡片显示正确
- ✅ 操作按钮功能正常
- ✅ 响应式设计适配良好
- ✅ API接口返回正确数据

---

**如果遇到任何问题，请检查服务器日志和浏览器控制台，或参考故障排除部分。** 🔧 