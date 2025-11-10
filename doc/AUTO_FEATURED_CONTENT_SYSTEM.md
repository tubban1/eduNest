# 自动精选内容系统设计

## 概述

所有精选内容自动从 admin 账号中提取，无需手动运营配置。系统会根据内容的质量指标自动排序和展示。

## 核心原则

1. **自动筛选**：所有 `created_by` 为 admin 账号的内容自动成为候选精选内容
2. **智能排序**：根据质量指标（点赞数、收藏数、浏览量、时间等）自动排序
3. **动态更新**：精选内容实时从数据库获取，无需手动配置
4. **分类展示**：支持按内容分类（画图动画、高考压轴题等）自动分组

## 系统架构

### 1. 数据库层面

#### 1.1 获取 Admin 用户 ID

```javascript
// 在 database.js 中添加函数
const getAdminUserId = async () => {
  // 方案1: 从环境变量获取固定的 admin ID
  const adminId = process.env.ADMIN_USER_ID;
  if (adminId) return adminId;
  
  // 方案2: 从数据库查询 role='admin' 的用户
  const { data, error } = await supabase
    .from('users')
    .select('id')
    .eq('role', 'admin')
    .limit(1)
    .single();
  
  return data?.id || null;
};
```

#### 1.2 获取精选内容

```javascript
// 获取 admin 账号的所有内容
const getFeaturedContents = async (options = {}) => {
  const {
    limit = 20,
    offset = 0,
    category = null,        // 内容分类
    sortBy = 'quality_score', // 排序方式: quality_score, created_at, likes_count, collections_count
    tags = null,            // 标签过滤
    language_code = null    // 语言过滤
  } = options;
  
  const adminId = await getAdminUserId();
  if (!adminId) return { data: [], error: null };
  
  let query = supabase
    .from('content')
    .select(`
      *,
      likes_count:content_likes(count),
      collections_count:user_collections(count)
    `)
    .eq('created_by', adminId)
    .eq('is_deleted', false);
  
  // 分类过滤（通过 tags 或自定义字段）
  if (category) {
    query = query.contains('tags', [category]);
  }
  
  // 标签过滤
  if (tags && Array.isArray(tags)) {
    tags.forEach(tag => {
      query = query.contains('tags', [tag]);
    });
  }
  
  // 语言过滤
  if (language_code) {
    query = query.eq('language_code', language_code);
  }
  
  // 排序
  if (sortBy === 'quality_score') {
    // 质量评分 = 点赞数 * 2 + 收藏数 * 3 + 时间衰减因子
    // 这里需要在数据库层面计算，或者使用应用层排序
    query = query.order('created_at', { ascending: false });
  } else if (sortBy === 'likes_count') {
    query = query.order('likes_count', { ascending: false });
  } else if (sortBy === 'collections_count') {
    query = query.order('collections_count', { ascending: false });
  } else {
    query = query.order('created_at', { ascending: false });
  }
  
  // 分页
  query = query.range(offset, offset + limit - 1);
  
  const { data, error } = await query;
  
  if (error) {
    return { data: [], error };
  }
  
  // 计算质量评分（如果需要）
  const contentsWithScore = data.map(content => {
    const likesCount = content.likes_count?.[0]?.count || 0;
    const collectionsCount = content.collections_count?.[0]?.count || 0;
    const daysSinceCreation = (Date.now() - new Date(content.created_at).getTime()) / (1000 * 60 * 60 * 24);
    const timeDecay = Math.max(0.5, 1 - daysSinceCreation / 365); // 一年内的时间衰减
    
    const qualityScore = (likesCount * 2 + collectionsCount * 3) * timeDecay;
    
    return {
      ...content,
      quality_score: qualityScore,
      likes_count: likesCount,
      collections_count: collectionsCount
    };
  });
  
  // 如果按质量评分排序，重新排序
  if (sortBy === 'quality_score') {
    contentsWithScore.sort((a, b) => b.quality_score - a.quality_score);
  }
  
  return { data: contentsWithScore, error: null };
};
```

#### 1.3 获取分类统计

```javascript
// 获取 admin 账号内容的分类统计
const getFeaturedContentCategories = async () => {
  const adminId = await getAdminUserId();
  if (!adminId) return { data: [], error: null };
  
  const { data, error } = await supabase
    .from('content')
    .select('tags')
    .eq('created_by', adminId)
    .eq('is_deleted', false);
  
  if (error) {
    return { data: [], error };
  }
  
  // 统计每个标签的出现次数
  const tagCounts = {};
  data.forEach(content => {
    if (content.tags && Array.isArray(content.tags)) {
      content.tags.forEach(tag => {
        tagCounts[tag] = (tagCounts[tag] || 0) + 1;
      });
    }
  });
  
  // 转换为数组并排序
  const categories = Object.entries(tagCounts)
    .map(([tag, count]) => ({ tag, count }))
    .sort((a, b) => b.count - a.count);
  
  return { data: categories, error: null };
};
```

### 2. API 层面

#### 2.1 公开 API（无需认证）

```javascript
// GET /api/content/featured
router.get('/featured', async (req, res) => {
  try {
    const {
      limit = 20,
      offset = 0,
      category = null,
      sortBy = 'quality_score',
      tags = null,
      language_code = null
    } = req.query;
    
    const result = await DatabaseService.getFeaturedContents({
      limit: parseInt(limit),
      offset: parseInt(offset),
      category: category || null,
      sortBy: sortBy || 'quality_score',
      tags: tags ? (Array.isArray(tags) ? tags : [tags]) : null,
      language_code: language_code || null
    });
    
    if (result.error) {
      return res.status(500).json({ error: result.error.message });
    }
    
    res.json({ success: true, data: result.data });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// GET /api/content/featured/categories
router.get('/featured/categories', async (req, res) => {
  try {
    const result = await DatabaseService.getFeaturedContentCategories();
    
    if (result.error) {
      return res.status(500).json({ error: result.error.message });
    }
    
    res.json({ success: true, data: result.data });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});
```

### 3. 前端层面

#### 3.1 API 客户端

```typescript
// 在 api.ts 中添加
async getFeaturedContents(options?: {
  limit?: number;
  offset?: number;
  category?: string;
  sortBy?: 'quality_score' | 'created_at' | 'likes_count' | 'collections_count';
  tags?: string[];
  language_code?: string;
}) {
  const params = new URLSearchParams();
  if (options?.limit) params.append('limit', options.limit.toString());
  if (options?.offset) params.append('offset', options.offset.toString());
  if (options?.category) params.append('category', options.category);
  if (options?.sortBy) params.append('sortBy', options.sortBy);
  if (options?.tags) options.tags.forEach(tag => params.append('tags', tag));
  if (options?.language_code) params.append('language_code', options.language_code);
  
  return this.get(`/content/featured?${params.toString()}`);
}

async getFeaturedContentCategories() {
  return this.get('/content/featured/categories');
}
```

#### 3.2 首页组件

```typescript
// app/page.tsx 或 app/home/page.tsx
'use client';

import { useState, useEffect } from 'react';
import { api } from '@/lib/api';
import ContentCard from '@/components/ContentCard';

export default function HomePage() {
  const [featuredContents, setFeaturedContents] = useState([]);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  
  useEffect(() => {
    loadFeaturedContents();
    loadCategories();
  }, [selectedCategory]);
  
  const loadFeaturedContents = async () => {
    setLoading(true);
    try {
      const response = await api.content.getFeaturedContents({
        limit: 20,
        category: selectedCategory || undefined,
        sortBy: 'quality_score'
      });
      setFeaturedContents(response.data || []);
    } catch (error) {
      console.error('加载精选内容失败:', error);
    } finally {
      setLoading(false);
    }
  };
  
  const loadCategories = async () => {
    try {
      const response = await api.content.getFeaturedContentCategories();
      setCategories(response.data || []);
    } catch (error) {
      console.error('加载分类失败:', error);
    }
  };
  
  return (
    <div className="container mx-auto px-4 py-8">
      <h1 className="text-3xl font-bold mb-8">精选内容</h1>
      
      {/* 分类导航 */}
      <div className="flex flex-wrap gap-2 mb-6">
        <button
          onClick={() => setSelectedCategory(null)}
          className={`px-4 py-2 rounded-full ${
            selectedCategory === null
              ? 'bg-blue-600 text-white'
              : 'bg-gray-200 text-gray-700'
          }`}
        >
          全部
        </button>
        {categories.map(category => (
          <button
            key={category.tag}
            onClick={() => setSelectedCategory(category.tag)}
            className={`px-4 py-2 rounded-full ${
              selectedCategory === category.tag
                ? 'bg-blue-600 text-white'
                : 'bg-gray-200 text-gray-700'
            }`}
          >
            {category.tag} ({category.count})
          </button>
        ))}
      </div>
      
      {/* 内容列表 */}
      {loading ? (
        <div>加载中...</div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {featuredContents.map(content => (
            <ContentCard
              key={content.id}
              content={content}
              isAuthenticated={false}
              editMode={false}
            />
          ))}
        </div>
      )}
    </div>
  );
}
```

## 内容分类定义

### 预定义分类标签

建议在 admin 创建内容时，使用以下标签分类：

1. **画图动画** (`drawing-animation`)
   - 几何辅助线绘制
   - 图形构造动画
   - 示例：三角形内心、外心、重心等

2. **高考压轴题** (`gaokao-final`)
   - 高考数学压轴题解析
   - 高考物理压轴题解析
   - 逐步推导和启发引导

3. **考点解析** (`knowledge-point`)
   - 核心概念讲解
   - 易错点分析
   - 变式题训练

4. **实验演示** (`experiment`)
   - 物理实验动画
   - 化学实验演示
   - 数学模型演示

5. **故事化知识** (`story`)
   - 知识点的故事化讲解
   - 角色扮演式教学
   - 趣味性内容

## 质量评分算法

### 计算公式

```
quality_score = (likes_count × 2 + collections_count × 3) × time_decay_factor

其中：
- likes_count: 点赞数
- collections_count: 收藏数
- time_decay_factor: 时间衰减因子
  = max(0.5, 1 - days_since_creation / 365)
  （一年内的内容保持较高权重，超过一年逐渐衰减）
```

### 排序优先级

1. **质量评分**（默认）：综合考虑点赞、收藏和时间
2. **最新发布**：按创建时间倒序
3. **最受欢迎**：按点赞数倒序
4. **最多收藏**：按收藏数倒序

## 环境变量配置

在 `.env` 文件中添加：

```bash
# Admin 用户 ID（可选，如果不设置则从数据库查询 role='admin' 的用户）
ADMIN_USER_ID=your-admin-user-id-here
```

## 实施步骤

1. **数据库层**：实现 `getAdminUserId`, `getFeaturedContents`, `getFeaturedContentCategories`
2. **API 层**：添加 `/api/content/featured` 和 `/api/content/featured/categories` 端点
3. **前端层**：创建首页组件，展示精选内容
4. **测试**：确保 admin 账号的内容能正确展示

## 优势

1. **零运营成本**：无需手动配置，自动从 admin 账号提取
2. **动态更新**：新内容自动进入候选池
3. **智能排序**：根据用户反馈自动调整展示顺序
4. **分类清晰**：支持按标签自动分类展示
5. **易于扩展**：可以轻松添加新的排序规则和过滤条件

