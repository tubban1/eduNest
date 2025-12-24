# 缓存实现说明

## 概述

为了解决列表页面、收藏列表和 short_id 页面每次都要重新读取数据库的问题，我们实现了一个简单的内存缓存层。

## 实现的功能

### 1. 缓存工具类 (`edu/frontend/src/lib/cache.ts`)

- **内存缓存**：使用 `Map` 存储缓存数据
- **TTL 支持**：每个缓存项都有过期时间（Time To Live）
- **自动清理**：每分钟自动清理过期缓存
- **模式匹配删除**：支持使用通配符批量删除缓存

### 2. 已添加缓存的 API 方法

#### 内容相关
- `content.getFiltered()` - 内容列表查询（缓存 2 分钟）
- `content.getByShortId()` - 根据 short_id 获取内容（缓存 10 分钟）
- `content.create()` - 创建内容时清除相关缓存
- `content.update()` - 更新内容时清除相关缓存
- `content.delete()` - 删除内容时清除所有内容缓存

#### 收藏相关
- `getCollectionLists()` - 获取收藏列表（缓存 5 分钟）
- `collectionList.getByShortId()` - 根据 short_id 获取收藏列表详情（缓存 10 分钟）
- `getLikedContent()` - 获取点赞内容（缓存 1 分钟）
- `getCollectionsByContent()` - 获取内容的收藏状态（缓存 1 分钟）

#### 缓存失效
- `likeContent()` / `unlikeContent()` - 点赞/取消点赞时清除用户状态缓存
- `addContentToList()` / `removeContentFromList()` - 添加/移除收藏时清除相关缓存
- `deleteCollectionList()` - 删除收藏列表时清除所有相关缓存

## 缓存配置

```typescript
export const CACHE_CONFIG = {
  CONTENT_LIST: 2 * 60 * 1000,      // 2 分钟 - 内容列表
  CONTENT_DETAIL: 10 * 60 * 1000,   // 10 分钟 - 单个内容
  COLLECTION_LIST: 5 * 60 * 1000,   // 5 分钟 - 收藏列表
  COLLECTION_DETAIL: 10 * 60 * 1000, // 10 分钟 - 收藏详情
  USER_STATUS: 1 * 60 * 1000,       // 1 分钟 - 用户状态（点赞/收藏）
};
```

## 缓存键命名规则

- 内容列表：`content:filtered?{filters}`
- 单个内容：`content:short:{shortId}`
- 收藏列表：`collection_lists:all`
- 收藏详情：`collection_list:short:{shortId}`
- 点赞内容：`user_content:liked`
- 内容收藏状态：`user_collections:content:{contentId}`

## 使用效果

### 优化前
- 每次访问列表页面都会重新查询数据库
- 每次访问内容详情页都会重新查询数据库
- 每次访问收藏列表都会重新查询数据库

### 优化后
- 列表页面在 2 分钟内使用缓存，减少数据库查询
- 内容详情页在 10 分钟内使用缓存
- 收藏列表在 5 分钟内使用缓存
- 用户状态在 1 分钟内使用缓存

## 注意事项

1. **内存缓存**：缓存存储在浏览器内存中，刷新页面会清空缓存
2. **数据一致性**：更新/删除操作会自动清除相关缓存，确保数据一致性
3. **缓存过期**：过期缓存会自动清理，不会占用过多内存
4. **用户隔离**：缓存键不包含用户 ID，不同用户可能看到相同缓存（如果需要用户隔离，可以修改缓存键生成逻辑）

## 未来优化建议

1. **持久化缓存**：可以考虑使用 `localStorage` 或 `sessionStorage` 持久化缓存
2. **用户隔离**：为需要用户隔离的缓存添加用户 ID
3. **缓存预热**：在用户访问前预加载常用数据
4. **缓存统计**：添加缓存命中率统计，优化缓存策略

