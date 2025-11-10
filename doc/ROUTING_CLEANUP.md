# 路由清理完成总结

## ✅ 清理完成

所有 `content` 相关的页面和路由已删除，前端现在只使用 `c` 列表和 `c/[short_id]`。

## 📋 已完成的清理工作

### 1. 删除的页面
- ✅ `app/content/page.tsx` - 内容列表页（已删除）
- ✅ `app/content/create/page.tsx` - 创建内容页（已删除）
- ✅ `app/content/[short_id]/page.tsx` - 内容详情页（已删除）
- ✅ `app/content/edit/[uuid]/page.tsx` - 编辑内容页（已删除）
- ✅ 整个 `app/content/` 目录（已删除）

### 2. 更新的路由引用
- ✅ `ContentForm.tsx`: 所有 `/content` 路由改为 `/c`
- ✅ `Sidebar.tsx`: 菜单项链接改为 `/c`
- ✅ `ContentCard.tsx`: 默认 `linkPathPrefix` 改为 `/c`
- ✅ `ShareButton.tsx`: 分享链接改为 `/c/[short_id]`
- ✅ `CollectionCard.tsx`: 链接改为 `/c/[short_id]`
- ✅ `navigation.ts`: 返回目标改为 `/c`
- ✅ `login/page.tsx`: 登录后跳转改为 `/c`
- ✅ `auth/callback/page.tsx`: 登录后跳转改为 `/c`
- ✅ `test-retry/page.tsx`: 链接改为 `/c`
- ✅ `page.tsx` (首页): 所有链接改为 `/c`

### 3. 删除的功能
- ✅ `EditButton` 组件的使用（已删除，因为编辑路由不存在）
- ✅ 编辑按钮功能（暂时移除）

### 4. 保留的页面
- ✅ `app/c/page.tsx` - 完整 HTML 内容列表页
- ✅ `app/c/[short_id]/page.tsx` - 内容详情页（使用 FullHTMLRenderer）

## 🎯 当前路由结构

```
/c                    - 完整 HTML 内容列表（公开，所有用户可查看）
/c/[short_id]         - 内容详情页（使用 FullHTMLRenderer）
/standalone/[short_id] - 独立页面（直接返回 full_html）
```

## 📝 注意事项

1. **API 路由**: 后端 API 路径（如 `/api/content`）保持不变，只是前端路由改变
2. **编辑功能**: 编辑功能暂时移除，如果需要可以：
   - 在 `c/[short_id]` 页面中添加编辑按钮（仅对内容创建者显示）
   - 创建新的编辑路由 `/c/edit/[id]`
   - 使用模态框进行编辑
3. **ContentForm**: ContentForm 组件仍然保留，可以在需要的地方使用（如 admin 创建页面）

## 🚀 下一步

1. **可选**: 如果需要编辑功能，可以在 `c/[short_id]` 页面中添加
2. **可选**: 创建 admin 专用的创建/编辑页面
3. **可选**: 删除不再使用的 EditButton 组件文件

