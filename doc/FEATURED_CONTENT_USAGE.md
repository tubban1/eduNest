# 自动精选内容系统使用指南

## 系统概述

所有精选内容自动从 **admin 账号**中提取，无需手动运营配置。系统会根据内容的质量指标（点赞数、收藏数、时间衰减）自动排序和展示。

## 配置 Admin 账号

### 方式 1: 环境变量（推荐）

在 `.env` 文件中添加：

```bash
ADMIN_USER_ID=your-admin-user-uuid-here
```

### 方式 2: 数据库自动查询

系统会自动查询 `users` 表中 `role='admin'` 的用户。确保至少有一个用户的 `role` 字段为 `'admin'`。

## API 端点

### 1. 获取精选内容

**公开接口**（无需认证）

```
GET /api/content/featured
```

**查询参数**：
- `limit` (number, 默认: 20): 返回数量
- `offset` (number, 默认: 0): 偏移量
- `category` (string, 可选): 分类标签过滤
- `sortBy` (string, 默认: 'quality_score'): 排序方式
  - `quality_score`: 质量评分（推荐）
  - `created_at`: 最新发布
  - `likes_count`: 最受欢迎
  - `collections_count`: 最多收藏
- `tags` (string[], 可选): 标签过滤（多个）
- `language_code` (string, 可选): 语言代码过滤

**示例**：
```bash
# 获取前20个精选内容（按质量评分）
GET /api/content/featured

# 获取"画图动画"分类的前10个内容
GET /api/content/featured?category=画图动画&limit=10

# 获取最新发布的精选内容
GET /api/content/featured?sortBy=created_at

# 获取中文精选内容
GET /api/content/featured?language_code=zh-CN
```

### 2. 获取分类统计

**公开接口**（无需认证）

```
GET /api/content/featured/categories
```

**返回**：所有 admin 账号内容的标签统计，按数量排序

**示例响应**：
```json
{
  "success": true,
  "data": [
    { "tag": "画图动画", "count": 15 },
    { "tag": "高考压轴题", "count": 12 },
    { "tag": "考点解析", "count": 8 }
  ]
}
```

## 前端使用

### 1. 在首页展示精选内容

```typescript
import { api } from '@/lib/api';

// 获取精选内容
const featuredContents = await api.content.getFeaturedContents({
  limit: 20,
  sortBy: 'quality_score'
});

// 获取分类
const categories = await api.content.getFeaturedContentCategories();
```

### 2. 按分类筛选

```typescript
// 获取"画图动画"分类的内容
const drawingContents = await api.content.getFeaturedContents({
  category: '画图动画',
  limit: 10
});
```

### 3. 完整示例（首页组件）

```typescript
'use client';

import { useState, useEffect } from 'react';
import { api } from '@/lib/api';
import ContentCard from '@/components/ContentCard';

export default function HomePage() {
  const [featuredContents, setFeaturedContents] = useState([]);
  const [categories, setCategories] = useState([]);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  
  useEffect(() => {
    loadFeaturedContents();
    loadCategories();
  }, [selectedCategory]);
  
  const loadFeaturedContents = async () => {
    setLoading(true);
    try {
      const data = await api.content.getFeaturedContents({
        limit: 20,
        category: selectedCategory || undefined,
        sortBy: 'quality_score'
      });
      setFeaturedContents(data);
    } catch (error) {
      console.error('加载精选内容失败:', error);
    } finally {
      setLoading(false);
    }
  };
  
  const loadCategories = async () => {
    try {
      const data = await api.content.getFeaturedContentCategories();
      setCategories(data);
    } catch (error) {
      console.error('加载分类失败:', error);
    }
  };
  
  return (
    <div>
      {/* 分类导航 */}
      <div className="flex gap-2 mb-6">
        <button onClick={() => setSelectedCategory(null)}>
          全部
        </button>
        {categories.map(cat => (
          <button
            key={cat.tag}
            onClick={() => setSelectedCategory(cat.tag)}
          >
            {cat.tag} ({cat.count})
          </button>
        ))}
      </div>
      
      {/* 内容列表 */}
      {loading ? (
        <div>加载中...</div>
      ) : (
        <div className="grid grid-cols-4 gap-4">
          {featuredContents.map(content => (
            <ContentCard key={content.id} content={content} />
          ))}
        </div>
      )}
    </div>
  );
}
```

## 内容分类标签建议

为了便于自动分类，建议 admin 创建内容时使用以下标签：

1. **画图动画** (`drawing-animation` 或 `画图动画`)
   - 几何辅助线绘制
   - 图形构造动画
   - 示例：三角形内心、外心、重心

2. **高考压轴题** (`gaokao-final` 或 `高考压轴题`)
   - 高考数学压轴题解析
   - 高考物理压轴题解析
   - 逐步推导和启发引导

3. **考点解析** (`knowledge-point` 或 `考点解析`)
   - 核心概念讲解
   - 易错点分析
   - 变式题训练

4. **实验演示** (`experiment` 或 `实验演示`)
   - 物理实验动画
   - 化学实验演示
   - 数学模型演示

5. **故事化知识** (`story` 或 `故事化知识`)
   - 知识点的故事化讲解
   - 角色扮演式教学

## 质量评分算法

精选内容按以下公式计算质量评分：

```
quality_score = (likes_count × 2 + collections_count × 3) × time_decay_factor

其中：
- likes_count: 点赞数
- collections_count: 收藏数
- time_decay_factor: 时间衰减因子
  = max(0.5, 1 - days_since_creation / 365)
  （一年内的内容保持较高权重，超过一年逐渐衰减）
```

## 优势

1. **零运营成本**：无需手动配置，自动从 admin 账号提取
2. **动态更新**：新内容自动进入候选池
3. **智能排序**：根据用户反馈自动调整展示顺序
4. **分类清晰**：支持按标签自动分类展示
5. **易于扩展**：可以轻松添加新的排序规则和过滤条件

## 注意事项

1. **Admin 账号设置**：确保至少有一个 admin 账号，或者设置 `ADMIN_USER_ID` 环境变量
2. **标签规范**：建议统一使用标签命名规范，便于分类筛选
3. **内容质量**：只有 admin 账号创建的内容才会出现在精选内容中
4. **性能考虑**：大量内容时，建议使用分页和缓存

## 下一步

1. 更新首页，使用精选内容 API
2. 创建分类页面，展示不同分类的精选内容
3. 优化质量评分算法（如需要）
4. 添加缓存机制（提高性能）

