# Android 端数据加载问题排查

## 现象
在 Android Chrome 下：
- 数据库的卡片读取不出来
- 积分读取不出来
- 用户已通过 Google 登录

## 已实施的修复

1. **Token 获取重试**：`getLatestToken` 在返回 null 时会延迟 400ms 重试，应对 Supabase session 恢复延迟
2. **Supabase 安全 storage**：localStorage 抛错时回退到内存
3. **fetch mode: 'cors'**：显式指定 CORS 模式
4. **VisitorId**：localStorage 受限时的内存兜底

## 排查步骤

1. **Chrome 远程调试**：USB 连接电脑，`chrome://inspect` 查看 Console 与 Network
2. **API 地址**：确认 `NEXT_PUBLIC_API_BASE_URL` 在手机上可访问（不用 localhost）
3. **CORS**：确认后端对前端域名返回 `Access-Control-Allow-Origin`
