# 首页性能优化方案

## 一、当前问题分析

### 潜在性能问题

1. **一次性加载所有内容**
   - 当前首页会加载所有匹配的内容（无 limit）
   - 如果内容很多（如 100+ 卡片），会导致：
     - 初始渲染慢（大量 DOM 节点）
     - 内存占用高（所有卡片同时渲染）
     - 网络请求大（一次性传输所有数据）

2. **每个卡片复杂度高**
   - SVG 内联渲染（`dangerouslySetInnerHTML`）
   - 图片懒加载（但初始仍会创建大量元素）
   - 状态管理（生成状态轮询、SSE 连接等）

3. **无虚拟滚动**
   - 所有卡片都在 DOM 中，即使不可见

---

## 二、优化方案对比

| 方案 | 实现难度 | 性能提升 | 用户体验 | 推荐度 |
|------|---------|---------|---------|--------|
| **1. 分页加载** | ⭐⭐ | ⭐⭐⭐⭐ | ⭐⭐⭐⭐ | ⭐⭐⭐⭐⭐ |
| **2. 无限滚动** | ⭐⭐⭐ | ⭐⭐⭐⭐⭐ | ⭐⭐⭐⭐⭐ | ⭐⭐⭐⭐⭐ |
| **3. 虚拟滚动** | ⭐⭐⭐⭐ | ⭐⭐⭐⭐⭐ | ⭐⭐⭐ | ⭐⭐⭐⭐ |
| **4. 限制初始数量** | ⭐ | ⭐⭐⭐ | ⭐⭐⭐⭐ | ⭐⭐⭐⭐ |
| **5. React.memo** | ⭐ | ⭐⭐ | ⭐⭐⭐ | ⭐⭐⭐ |

---

## 三、推荐方案：分页 + 无限滚动（最佳平衡）

### 方案说明

**组合使用：**
1. **初始加载限制**：只加载前 12-18 个卡片
2. **无限滚动**：滚动到底部时自动加载更多
3. **React.memo**：优化卡片组件渲染

**优点：**
- ✅ 实现相对简单
- ✅ 性能提升明显
- ✅ 用户体验好（无需手动翻页）
- ✅ 兼容性好（不依赖复杂库）

---

## 四、实现方案

### 方案 A：简单分页（快速实现）

**实现步骤：**

1. **后端已支持 limit**（`database.js` 第 124-127 行）
2. **前端添加 limit 参数**
3. **添加"加载更多"按钮**

**代码修改：**

```typescript
// page.tsx
const [contents, setContents] = useState<Content[]>([]);
const [page, setPage] = useState(1);
const [hasMore, setHasMore] = useState(true);
const ITEMS_PER_PAGE = 18; // 每页加载 18 个

const refreshContent = useCallback(async (pageNum = 1, append = false) => {
  const filters: any = {
    limit: ITEMS_PER_PAGE,
    offset: (pageNum - 1) * ITEMS_PER_PAGE
  };
  
  // ... 现有筛选逻辑 ...
  
  const data = await api.content.getFiltered(filters);
  const list = Array.isArray(data) ? data : [];
  const finalContent = processListData(list);
  
  if (append) {
    setContents(prev => [...prev, ...finalContent]);
  } else {
    setContents(finalContent);
  }
  
  // 如果返回的数量少于 limit，说明没有更多了
  setHasMore(finalContent.length === ITEMS_PER_PAGE);
}, [user, i18n.language]);

const loadMore = () => {
  if (!hasMore || isLoading) return;
  setPage(prev => {
    refreshContent(prev + 1, true);
    return prev + 1;
  });
};
```

---

### 方案 B：无限滚动（推荐）

**实现步骤：**

1. **使用 Intersection Observer 检测滚动到底部**
2. **自动加载更多内容**
3. **显示加载状态**

**代码修改：**

```typescript
// page.tsx
const [contents, setContents] = useState<Content[]>([]);
const [page, setPage] = useState(1);
const [hasMore, setHasMore] = useState(true);
const [isLoadingMore, setIsLoadingMore] = useState(false);
const ITEMS_PER_PAGE = 18;

// 无限滚动检测
const loadMoreRef = useRef<HTMLDivElement>(null);

useEffect(() => {
  if (!loadMoreRef.current || !hasMore || isLoadingMore) return;
  
  const observer = new IntersectionObserver(
    (entries) => {
      if (entries[0].isIntersecting) {
        loadMore();
      }
    },
    { threshold: 0.1 }
  );
  
  observer.observe(loadMoreRef.current);
  return () => observer.disconnect();
}, [hasMore, isLoadingMore]);

const loadMore = async () => {
  if (!hasMore || isLoadingMore) return;
  setIsLoadingMore(true);
  const nextPage = page + 1;
  
  try {
    const filters: any = {
      limit: ITEMS_PER_PAGE,
      offset: (nextPage - 1) * ITEMS_PER_PAGE
    };
    // ... 筛选逻辑 ...
    
    const data = await api.content.getFiltered(filters);
    const list = Array.isArray(data) ? data : [];
    const finalContent = processListData(list);
    
    setContents(prev => [...prev, ...finalContent]);
    setHasMore(finalContent.length === ITEMS_PER_PAGE);
    setPage(nextPage);
  } catch (error) {
    console.error('Failed to load more:', error);
  } finally {
    setIsLoadingMore(false);
  }
};
```

---

### 方案 C：虚拟滚动（高性能，复杂）

**使用库：** `react-window` 或 `react-virtualized`

**优点：**
- 只渲染可见区域
- 性能最优（即使有 1000+ 卡片）

**缺点：**
- 实现复杂
- 需要固定高度
- 可能影响用户体验（滚动条行为）

**适用场景：**
- 内容数量 > 100
- 卡片高度固定

---

## 五、其他优化建议

### 1. React.memo 优化卡片组件

```typescript
// ContentCard.tsx
export default React.memo(ContentCard, (prevProps, nextProps) => {
  // 自定义比较逻辑
  return (
    prevProps.content.id === nextProps.content.id &&
    prevProps.content.thumbnail_url === nextProps.content.thumbnail_url &&
    prevProps.content.svg_thumbnail === nextProps.content.svg_thumbnail &&
    prevProps.content.generation_status === nextProps.content.generation_status
  );
});
```

### 2. 图片懒加载优化

```typescript
// ContentCard.tsx - 使用 Intersection Observer
const imgRef = useRef<HTMLImageElement>(null);

useEffect(() => {
  if (!imgRef.current || hasValidSvgThumbnail) return;
  
  const observer = new IntersectionObserver(
    (entries) => {
      if (entries[0].isIntersecting) {
        // 图片进入视口时才加载
        if (imgRef.current && thumbnailUrl) {
          imgRef.current.src = thumbnailUrl;
        }
        observer.disconnect();
      }
    },
    { rootMargin: '50px' } // 提前 50px 开始加载
  );
  
  observer.observe(imgRef.current);
  return () => observer.disconnect();
}, [thumbnailUrl, hasValidSvgThumbnail]);
```

### 3. 限制初始加载数量

```typescript
// 后端 database.js
const DEFAULT_LIMIT = 18; // 默认只加载 18 个
const MAX_LIMIT = 50; // 最大限制 50 个

if (filters.limit) {
  const limit = Math.max(1, Math.min(parseInt(filters.limit, 10) || DEFAULT_LIMIT, MAX_LIMIT));
  query = query.limit(limit);
} else {
  query = query.limit(DEFAULT_LIMIT); // 如果没有指定，默认限制
}
```

### 4. 缓存优化

```typescript
// 使用缓存，避免重复请求
const cacheKey = generateCacheKey('content:filtered', { ...filters, page });
const cached = cache.get<any[]>(cacheKey);

if (cached !== null) {
  // 使用缓存
  return;
}

// 请求后缓存
cache.set(cacheKey, data, CACHE_CONFIG.TTL);
```

---

## 六、性能测试建议

### 测试指标

1. **初始加载时间**：首屏渲染时间
2. **内存占用**：Chrome DevTools Memory
3. **FPS**：滚动时的帧率
4. **网络请求**：数据量大小

### 测试场景

- 10 个卡片
- 50 个卡片
- 100+ 个卡片

---

## 七、推荐实施方案

### 阶段 1：快速优化（立即实施）

1. ✅ **限制初始加载数量**：默认 18 个
2. ✅ **添加"加载更多"按钮**：简单分页

**预计时间：** 30 分钟
**性能提升：** 30-50%

### 阶段 2：进阶优化（推荐）

1. ✅ **无限滚动**：自动加载更多
2. ✅ **React.memo**：优化卡片渲染

**预计时间：** 1-2 小时
**性能提升：** 50-70%

### 阶段 3：高级优化（可选）

1. ✅ **虚拟滚动**：如果内容 > 100
2. ✅ **图片懒加载优化**：Intersection Observer

**预计时间：** 2-3 小时
**性能提升：** 70-90%

---

## 八、实施检查清单

- [ ] 1. 后端添加默认 limit（如果没有指定）
- [ ] 2. 前端添加 limit 和 offset 参数
- [ ] 3. 实现分页或无限滚动
- [ ] 4. 添加加载状态指示器
- [ ] 5. 使用 React.memo 优化卡片组件
- [ ] 6. 测试不同数量的内容
- [ ] 7. 监控性能指标

---

## 九、代码示例（完整实现）

见下一节详细代码实现。

