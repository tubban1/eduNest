# 自建访问统计系统影响分析

## 📊 当前系统状况

- **数据库**: Supabase (PostgreSQL)
- **后端**: Node.js + Express
- **前端**: Next.js 14
- **已有分析工具**: Umami Analytics（用于用户行为分析）
- **内容页面**: `/c/[short_id]` (客户端渲染)

## 📍 当前统计范围

### 已统计的页面
- ✅ **内容详情页** (`/c/[short_id]`) - 已实现

### 未统计的页面
- ❌ 首页 (`/`)
- ❌ 内容列表页 (`/c`)
- ❌ 其他功能页面

### 环境控制
- **生产环境** (`NODE_ENV=production`): ✅ 自动统计
- **开发环境** (`NODE_ENV=development`): ⚠️ 默认不统计（可通过 `NEXT_PUBLIC_ENABLE_PAGE_VIEWS=true` 启用）
- **后端控制**: 可通过 `DISABLE_PAGE_VIEWS=true` 全局禁用统计

### 配置说明
- **前端环境变量**: `NEXT_PUBLIC_ENABLE_PAGE_VIEWS=true` - 在开发环境启用统计
- **后端环境变量**: `DISABLE_PAGE_VIEWS=true` - 全局禁用统计（优先级最高）

---

## 🔍 影响分析

### 一、数据库影响

#### 1.1 新增表结构

**新增表**: `page_views`（仅需一个表）

```sql
CREATE TABLE page_views (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  content_id UUID REFERENCES content(id) ON DELETE CASCADE,
  viewer_ip TEXT NOT NULL,
  viewer_user_agent TEXT,
  referer TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  is_unique BOOLEAN DEFAULT false,
  credits_awarded BOOLEAN DEFAULT false
);
```

**为什么只需要一个表？**

✅ **访问记录**：`page_views` 表记录所有访问
✅ **防刷检测**：通过查询 `page_views` 表（24小时内同一IP）
✅ **积分发放**：通过 `is_unique` 和 `credits_awarded` 字段控制
✅ **积分记录**：积分发放记录在 `user_credits` 表（`change_type = 'page_view'`），无需额外表
✅ **统计查询**：通过聚合查询 `page_views` 表即可

**未来扩展（可选）**：
- 如果需要更复杂的统计（每小时/每日统计），可以考虑物化视图或缓存
- 如果需要异常检测，可以在 `page_views` 表中添加 `is_suspicious` 字段
- 当前阶段，一个表完全够用

**影响评估**:
- ✅ **存储空间**: 每条记录约 200-300 字节
  - 假设每天 10,000 次访问: 约 2-3 MB/天
  - 每月约 60-90 MB
  - 年增长约 720 MB - 1 GB
- ✅ **索引开销**: 3个索引，每个约 10-20% 额外存储
- ⚠️ **数据增长**: 需要定期清理旧数据（建议保留 90 天）

#### 1.2 索引影响

**新增索引**:
```sql
CREATE INDEX idx_page_views_content_created ON page_views(content_id, created_at);
CREATE INDEX idx_page_views_ip_created ON page_views(viewer_ip, created_at);
CREATE INDEX idx_page_views_content_ip_created ON page_views(content_id, viewer_ip, created_at);
```

**影响评估**:
- ✅ **查询性能**: 显著提升防刷检测和统计查询速度
- ⚠️ **写入性能**: 每次插入需要更新 3 个索引，略微降低写入速度（约 5-10%）
- ✅ **存储开销**: 索引占用约 30-50% 额外空间

#### 1.3 对现有表的影响

**`user_credits` 表**:
- 新增 `related_content_id` 字段（可选，用于审计）
- 新增 `page_view` 类型的积分记录
- **影响**: 最小，仅增加少量数据

**`content` 表**:
- 无需修改
- **影响**: 无

---

### 二、API 影响

#### 2.1 新增 API 端点

**新增**: `POST /api/page-views/record`

**请求频率**:
- 每次内容页面访问触发 1 次请求
- 假设每天 10,000 次访问 = 10,000 次 API 调用

**影响评估**:
- ✅ **API 负载**: 新增约 10,000 次/天的 API 调用
- ⚠️ **响应时间**: 需要数据库查询和写入，响应时间约 50-100ms
- ✅ **并发处理**: Express 可以轻松处理（单机可处理数千 QPS）

#### 2.2 对现有 API 的影响

**无直接影响**:
- 新 API 独立运行，不影响现有 API
- 不修改现有 API 逻辑

**间接影响**:
- 数据库连接池可能增加使用率（但 Supabase 连接池通常足够大）

---

### 三、前端影响

#### 3.1 需要修改的页面

**主要修改**: `edu/frontend/src/app/c/[short_id]/page.tsx`

**修改内容**:
```typescript
// 在 useEffect 中添加
useEffect(() => {
  if (!content?.id) return;
  
  // 异步调用，不阻塞页面渲染
  api.pageViews.record({
    content_id: content.id,
    referer: document.referrer
  }).catch(() => {
    // 静默处理错误，不影响用户体验
  });
}, [content?.id]);
```

**影响评估**:
- ✅ **页面加载**: 异步调用，不阻塞页面渲染
- ✅ **用户体验**: 无感知，后台静默执行
- ⚠️ **网络请求**: 每次访问增加 1 个 HTTP 请求
- ✅ **错误处理**: 失败不影响页面功能

#### 3.2 对现有功能的影响

**无影响**:
- 不修改现有组件逻辑
- 不修改现有 API 调用
- 不修改现有状态管理

---

### 四、性能影响

#### 4.1 数据库性能

**写入性能**:
- 每次访问: 1 次 INSERT + 1 次 SELECT（防刷检测）+ 可能的 1 次 UPDATE（积分发放）
- 总耗时: 约 50-100ms（取决于网络延迟）

**查询性能**:
- 防刷检测查询: 使用索引，约 10-20ms
- 统计查询: 使用索引，约 50-200ms（取决于数据量）

**影响评估**:
- ✅ **Supabase 性能**: PostgreSQL 可以轻松处理每秒数千次写入
- ⚠️ **高峰期**: 如果同时有大量访问，可能需要考虑批量写入
- ✅ **索引优化**: 索引设计合理，查询性能良好

#### 4.2 服务器性能

**CPU 影响**:
- 每次请求: 约 1-2ms CPU 时间
- 每天 10,000 次: 约 10-20 秒 CPU 时间
- **影响**: 可忽略

**内存影响**:
- 新增服务: 约 10-20 MB 内存
- **影响**: 可忽略

**网络影响**:
- 每次请求: 约 1-2 KB 数据传输
- 每天 10,000 次: 约 10-20 MB
- **影响**: 可忽略

---

### 五、成本影响

#### 5.1 Supabase 成本

**存储成本**:
- 每月新增数据: 约 60-90 MB
- Supabase 免费 tier: 500 MB，足够使用
- **成本**: 免费 tier 内，无额外成本

**API 调用成本**:
- 每天 10,000 次 API 调用
- Supabase 免费 tier: 50,000 次/天
- **成本**: 免费 tier 内，无额外成本

**数据库连接成本**:
- 新增连接: 可忽略（使用现有连接池）
- **成本**: 无额外成本

#### 5.2 服务器成本

**后端服务器**:
- CPU/内存: 可忽略
- **成本**: 无额外成本

**前端部署**:
- 无影响（静态资源不变）
- **成本**: 无额外成本

---

### 六、维护影响

#### 6.1 代码维护

**新增代码**:
- 后端 API: 约 100-200 行代码
- 前端调用: 约 10-20 行代码
- 数据库迁移: 约 50 行 SQL

**维护成本**:
- ✅ **代码量**: 较少，易于维护
- ✅ **复杂度**: 低，逻辑简单
- ⚠️ **测试**: 需要添加单元测试和集成测试

#### 6.2 监控和告警

**需要监控的指标**:
- API 响应时间
- 数据库写入性能
- 积分发放成功率
- 防刷检测准确性

**告警设置**:
- API 错误率 > 5%
- 响应时间 > 500ms
- 积分发放失败

**影响评估**:
- ⚠️ **监控成本**: 需要配置监控（可使用现有监控系统）
- ✅ **告警成本**: 可忽略（使用现有告警系统）

#### 6.3 数据维护

**数据清理**:
- 建议保留 90 天的访问记录
- 需要定期清理旧数据（可设置定时任务）

**数据备份**:
- 使用 Supabase 自动备份
- **影响**: 无额外成本

---

### 七、安全性影响

#### 7.1 数据安全

**IP 地址存储**:
- ⚠️ **隐私考虑**: IP 地址属于个人数据（GDPR）
- ✅ **解决方案**: 
  - 可以哈希存储 IP（但会影响防刷检测）
  - 或定期清理旧数据（90 天后删除）

**访问日志**:
- ✅ **访问控制**: 使用 RLS 策略限制访问
- ✅ **数据加密**: Supabase 自动加密

#### 7.2 防刷安全

**防刷机制**:
- 24小时内同一IP仅计1次
- 异常流量检测（90%点击来自同一地区）

**安全风险**:
- ⚠️ **IP 伪造**: 可能通过代理伪造 IP
- ✅ **缓解措施**: 
  - 结合 UA、Referer 等多维度检测
  - 设置访问频率限制

---

### 八、对现有功能的影响

#### 8.1 页面加载速度

**影响评估**:
- ✅ **无影响**: 异步调用，不阻塞页面渲染
- ✅ **用户体验**: 无感知

#### 8.2 现有 API 性能

**影响评估**:
- ✅ **无影响**: 新 API 独立运行
- ✅ **数据库**: 使用独立表，不影响现有查询

#### 8.3 现有功能稳定性

**影响评估**:
- ✅ **无影响**: 不修改现有代码
- ✅ **向后兼容**: 完全兼容现有功能

---

## 📈 总结

### 正面影响 ✅

1. **业务价值**: 实现积分奖励系统，提升用户活跃度
2. **数据控制**: 完全控制数据，可精确实现业务逻辑
3. **实时性**: 实时积分发放，无需等待第三方同步
4. **成本**: 免费 tier 内，无额外成本

### 负面影响 ⚠️

1. **开发成本**: 需要开发约 200-300 行代码
2. **维护成本**: 需要监控和维护（但成本较低）
3. **数据增长**: 需要定期清理旧数据
4. **隐私考虑**: IP 地址存储需要考虑 GDPR

### 风险评估

| 风险 | 等级 | 缓解措施 |
|------|------|----------|
| 数据库性能 | 低 | 索引优化，定期清理数据 |
| 高并发访问 | 中 | 考虑批量写入，使用队列 |
| 数据隐私 | 中 | 定期清理，考虑哈希存储 |
| 防刷绕过 | 中 | 多维度检测，频率限制 |

### 建议

1. **实施优先级**: 高（核心业务功能）
2. **实施方式**: 分阶段实施
   - 阶段1: 基础功能（记录访问、防刷检测）
   - 阶段2: 积分发放
   - 阶段3: 异常检测和优化
3. **监控重点**: API 性能、积分发放成功率
4. **数据保留**: 建议保留 90 天，定期清理

---

---

## 📊 用户行为分析功能扩展

### 九、可实现的用户行为分析功能

基于 `page_views` 表，可以实现以下简单的用户行为分析功能：

#### 9.1 基础统计（无需额外字段）

**1. 访问量统计**
```sql
-- 总访问量
SELECT COUNT(*) FROM page_views WHERE content_id = $1;

-- 唯一访问量（24小时内）
SELECT COUNT(*) FROM page_views 
WHERE content_id = $1 AND is_unique = true;

-- 每日访问趋势
SELECT DATE(created_at) as date, COUNT(*) as views
FROM page_views
WHERE content_id = $1
GROUP BY DATE(created_at)
ORDER BY date DESC;
```

**2. 来源分析（Referer）**
```sql
-- 访问来源分布
SELECT 
  CASE 
    WHEN referer IS NULL OR referer = '' THEN '直接访问'
    WHEN referer LIKE '%google%' THEN 'Google'
    WHEN referer LIKE '%baidu%' THEN '百度'
    WHEN referer LIKE '%zhihu%' THEN '知乎'
    WHEN referer LIKE '%xiaohongshu%' THEN '小红书'
    ELSE '其他'
  END as source,
  COUNT(*) as count
FROM page_views
WHERE content_id = $1
GROUP BY source
ORDER BY count DESC;
```

**3. 设备分析（User Agent）**
```sql
-- 设备类型分布
SELECT 
  CASE 
    WHEN viewer_user_agent LIKE '%Mobile%' THEN '移动设备'
    WHEN viewer_user_agent LIKE '%Tablet%' THEN '平板'
    ELSE '桌面'
  END as device_type,
  COUNT(*) as count
FROM page_views
WHERE content_id = $1
GROUP BY device_type;
```

**4. 时间分布分析**
```sql
-- 每小时访问分布
SELECT 
  EXTRACT(HOUR FROM created_at) as hour,
  COUNT(*) as views
FROM page_views
WHERE content_id = $1
GROUP BY hour
ORDER BY hour;

-- 每周访问分布
SELECT 
  EXTRACT(DOW FROM created_at) as day_of_week,
  COUNT(*) as views
FROM page_views
WHERE content_id = $1
GROUP BY day_of_week
ORDER BY day_of_week;
```

#### 9.2 需要添加字段的分析功能

**1. 访问时长分析（需要添加字段）**

**表结构扩展**：
```sql
ALTER TABLE page_views 
ADD COLUMN IF NOT EXISTS view_duration INTEGER; -- 访问时长（秒）
ADD COLUMN IF NOT EXISTS scroll_depth INTEGER; -- 滚动深度（百分比）
ADD COLUMN IF NOT EXISTS exit_time TIMESTAMPTZ; -- 离开时间
```

**前端实现**：
```typescript
// 记录访问开始时间
const startTime = Date.now();

// 监听页面离开
window.addEventListener('beforeunload', () => {
  const duration = Math.floor((Date.now() - startTime) / 1000);
  const scrollDepth = Math.floor(
    (window.scrollY + window.innerHeight) / document.documentElement.scrollHeight * 100
  );
  
  // 发送访问时长和滚动深度
  api.pageViews.update({
    content_id: content.id,
    view_duration: duration,
    scroll_depth: scrollDepth,
    exit_time: new Date().toISOString()
  });
});
```

**分析查询**：
```sql
-- 平均访问时长
SELECT AVG(view_duration) as avg_duration
FROM page_views
WHERE content_id = $1 AND view_duration IS NOT NULL;

-- 访问时长分布
SELECT 
  CASE 
    WHEN view_duration < 10 THEN '0-10秒'
    WHEN view_duration < 30 THEN '10-30秒'
    WHEN view_duration < 60 THEN '30-60秒'
    WHEN view_duration < 180 THEN '1-3分钟'
    ELSE '3分钟以上'
  END as duration_range,
  COUNT(*) as count
FROM page_views
WHERE content_id = $1 AND view_duration IS NOT NULL
GROUP BY duration_range;
```

**2. 用户访问路径（需要关联 user_id）**

**表结构扩展**：
```sql
ALTER TABLE page_views 
ADD COLUMN IF NOT EXISTS viewer_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL;
```

**分析查询**：
```sql
-- 用户访问路径（按时间顺序）
SELECT 
  viewer_user_id,
  content_id,
  created_at,
  referer
FROM page_views
WHERE viewer_user_id = $1
ORDER BY created_at ASC;

-- 用户最常访问的内容
SELECT 
  content_id,
  COUNT(*) as visit_count
FROM page_views
WHERE viewer_user_id = $1
GROUP BY content_id
ORDER BY visit_count DESC
LIMIT 10;
```

**3. 内容关联分析（需要添加字段）**

**表结构扩展**：
```sql
ALTER TABLE page_views 
ADD COLUMN IF NOT EXISTS previous_content_id UUID REFERENCES content(id) ON DELETE SET NULL;
```

**分析查询**：
```sql
-- 内容关联分析（用户从内容A跳转到内容B）
SELECT 
  previous_content_id,
  content_id,
  COUNT(*) as transition_count
FROM page_views
WHERE previous_content_id IS NOT NULL
GROUP BY previous_content_id, content_id
ORDER BY transition_count DESC;
```

#### 9.3 高级分析功能（需要额外计算）

**1. 热门内容排行**
```sql
-- 按访问量排序
SELECT 
  content_id,
  COUNT(*) as total_views,
  COUNT(*) FILTER (WHERE is_unique = true) as unique_views
FROM page_views
WHERE created_at > NOW() - INTERVAL '7 days'
GROUP BY content_id
ORDER BY unique_views DESC
LIMIT 20;
```

**2. 用户留存分析（如果关联 user_id）**
```sql
-- 首次访问和回访统计
SELECT 
  viewer_user_id,
  MIN(created_at) as first_visit,
  COUNT(*) as total_visits,
  COUNT(DISTINCT DATE(created_at)) as active_days
FROM page_views
WHERE viewer_user_id IS NOT NULL
GROUP BY viewer_user_id
HAVING COUNT(*) > 1; -- 回访用户
```

**3. 访问质量分析**
```sql
-- 高质量访问（访问时长 > 30秒 且 滚动深度 > 50%）
SELECT 
  content_id,
  COUNT(*) FILTER (
    WHERE view_duration > 30 AND scroll_depth > 50
  ) as quality_views,
  COUNT(*) as total_views,
  ROUND(
    COUNT(*) FILTER (WHERE view_duration > 30 AND scroll_depth > 50)::numeric / 
    COUNT(*)::numeric * 100, 
    2
  ) as quality_rate
FROM page_views
WHERE content_id = $1
GROUP BY content_id;
```

#### 9.4 推荐实现的功能（按优先级）

**优先级 1：基础统计（无需额外字段）**
- ✅ 访问量统计（总访问、唯一访问）
- ✅ 来源分析（Referer 分布）
- ✅ 设备分析（移动/桌面）
- ✅ 时间分布（每小时、每天）

**优先级 2：访问质量（需要添加字段）**
- ⚠️ 访问时长（`view_duration`）
- ⚠️ 滚动深度（`scroll_depth`）
- ⚠️ 离开时间（`exit_time`）

**优先级 3：用户行为（需要关联 user_id）**
- ⚠️ 用户访问路径
- ⚠️ 用户留存分析
- ⚠️ 内容关联分析

#### 9.5 表结构扩展建议

**最小扩展（推荐）**：
```sql
ALTER TABLE page_views 
ADD COLUMN IF NOT EXISTS view_duration INTEGER,
ADD COLUMN IF NOT EXISTS scroll_depth INTEGER,
ADD COLUMN IF NOT EXISTS viewer_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL;
```

**完整扩展（可选）**：
```sql
ALTER TABLE page_views 
ADD COLUMN IF NOT EXISTS view_duration INTEGER,
ADD COLUMN IF NOT EXISTS scroll_depth INTEGER,
ADD COLUMN IF NOT EXISTS exit_time TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS viewer_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS previous_content_id UUID REFERENCES content(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS is_bounce BOOLEAN DEFAULT false; -- 是否跳出（访问时长 < 10秒）
```

#### 9.6 API 扩展建议

**新增 API 端点**：

1. **统计 API**：
   - `GET /api/page-views/stats/:contentId` - 获取内容统计
   - `GET /api/page-views/trends/:contentId` - 获取访问趋势
   - `GET /api/page-views/sources/:contentId` - 获取来源分析

2. **更新 API**：
   - `PATCH /api/page-views/:id` - 更新访问时长和滚动深度

3. **分析 API**：
   - `GET /api/page-views/analytics/popular` - 热门内容
   - `GET /api/page-views/analytics/user-path/:userId` - 用户访问路径

#### 9.7 前端实现建议

**访问时长和滚动深度追踪**：
```typescript
// 在内容页面组件中
useEffect(() => {
  if (!content?.id) return;
  
  const startTime = Date.now();
  let maxScrollDepth = 0;
  
  // 记录滚动深度
  const handleScroll = () => {
    const scrollTop = window.scrollY;
    const docHeight = document.documentElement.scrollHeight;
    const winHeight = window.innerHeight;
    const scrollPercent = Math.floor(
      (scrollTop + winHeight) / docHeight * 100
    );
    maxScrollDepth = Math.max(maxScrollDepth, scrollPercent);
  };
  
  window.addEventListener('scroll', handleScroll);
  
  // 页面离开时发送数据
  const handleBeforeUnload = () => {
    const duration = Math.floor((Date.now() - startTime) / 1000);
    
    // 发送更新请求（使用 sendBeacon 确保发送成功）
    navigator.sendBeacon('/api/page-views/update', JSON.stringify({
      content_id: content.id,
      view_duration: duration,
      scroll_depth: maxScrollDepth
    }));
  };
  
  window.addEventListener('beforeunload', handleBeforeUnload);
  
  return () => {
    window.removeEventListener('scroll', handleScroll);
    window.removeEventListener('beforeunload', handleBeforeUnload);
  };
}, [content?.id]);
```

---

*最后更新: 2025-01-XX*
