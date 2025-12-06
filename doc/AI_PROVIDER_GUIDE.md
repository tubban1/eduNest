# AI 提供商切换功能指南

## 功能概述

本系统现在支持多个AI提供商，管理员可以在前端选择不同的AI模型，而普通用户使用默认模型。

## 支持的AI提供商

### 1. ARK (火山引擎)
- **配置变量**: `ARK_API_KEY`, `ARK_URL`, `ARK_MODEL`
- **默认模型**: `kimi-k2-250711`
- **API端点**: `https://ark.cn-beijing.volces.com/api/v3/chat/completions`

### 2. KIMI (Moonshot AI)
- **配置变量**: `KIMI_API_KEY`, `KIMI_URL`, `KIMI_MODEL`
- **默认模型**: `kimi-k2-0905-preview`
- **API端点**: `https://api.moonshot.cn/v1`

## 环境变量配置

在 `.env` 文件中添加以下配置：

```env
# 现有ARK配置
ARK_API_KEY=your-ark-api-key-here
ARK_URL=https://ark.cn-beijing.volces.com/api/v3/chat/completions
ARK_MODEL=kimi-k2-250711

# 新增KIMI配置
KIMI_API_KEY=your-kimi-api-key-here
KIMI_URL=https://api.moonshot.cn/v1
KIMI_MODEL=kimi-k2-0905-preview

# 默认AI提供商 (ark 或 kimi)
DEFAULT_AI_PROVIDER=ark
```

## 使用方法

### 管理员用户
1. 登录系统后，在内容创建页面可以看到"AI 提供商"选择器
2. 可以选择不同的AI提供商和模型
3. 可以测试提供商连接状态
4. 选择后生成内容时会使用指定的提供商

### 普通用户
1. 普通用户看不到AI提供商选择器
2. 自动使用系统默认的AI提供商
3. 无法手动切换模型

## API端点

### 获取可用提供商列表
```http
GET /api/ai/providers
```

### 测试提供商连接
```http
POST /api/ai/test-provider
Content-Type: application/json

{
  "provider": "ark"  // 或 "kimi"
}
```

### 获取默认提供商
```http
GET /api/ai/default-provider
```

## 代码结构

### 后端
- `backend/src/services/aiProviderFactory.js` - AI提供商工厂类
- `backend/src/services/aiService.js` - 更新的AI服务，支持多提供商
- `backend/src/api/ai.js` - API路由，支持provider参数

### 前端
- `frontend/src/components/AIProviderSelector.tsx` - AI提供商选择器组件
- `frontend/src/components/ContentForm.tsx` - 更新的内容表单，集成提供商选择
- `frontend/src/i18n/locales/*/aiProvider.json` - 多语言翻译文件

## 测试

运行测试脚本验证配置：

```bash
node test-ai-providers.js
```

## 权限控制

- 只有管理员用户（`role === 'admin'`）才能看到和选择AI提供商
- 普通用户自动使用默认提供商，无法手动切换
- 权限检查在前端和后端都有实现

## 故障排除

### 常见问题

1. **提供商显示"未配置"**
   - 检查对应的API密钥是否正确设置
   - 确认环境变量名称正确

2. **测试连接失败**
   - 检查网络连接
   - 验证API密钥是否有效
   - 确认API端点URL正确

3. **管理员看不到选择器**
   - 确认用户角色为 `admin`
   - 检查前端是否正确获取用户信息

### 调试

1. 查看浏览器控制台错误信息
2. 检查后端日志
3. 使用测试脚本验证提供商配置

## 扩展

要添加新的AI提供商：

1. 在 `aiProviderFactory.js` 中添加新的提供商配置
2. 更新环境变量示例
3. 添加相应的翻译文件
4. 测试新提供商的集成

## 注意事项

- 确保所有API密钥安全存储
- 定期检查提供商API的可用性
- 监控API使用量和成本
- 保持提供商配置的同步更新
