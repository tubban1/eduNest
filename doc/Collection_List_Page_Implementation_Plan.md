# Collection List 独立页面实现方案（更新版）

## 一、数据模型扩展

### 1.1 Collection Lists 表字段扩展

**当前字段：**
- `visibility`: 'public' | 'private' (默认 'public')

**需要扩展：添加定价相关字段**

```sql
-- 添加定价相关字段
ALTER TABLE collection_lists ADD COLUMN pricing_mode TEXT DEFAULT 'free';
-- pricing_mode: 
--   'free'          -- 完全免费，所有人可访问全部内容
--   'premium'       -- 付费列表，需要购买才能访问全部内容
--   'free_preview'  -- 免费预览模式，前3条免费，其余需付费（默认行为）

ALTER TABLE collection_lists ADD COLUMN price NUMERIC(10, 2) DEFAULT NULL;
-- price: 列表价格（单位：USD），当 pricing_mode = 'premium' 时必填

ALTER TABLE collection_lists ADD COLUMN currency TEXT DEFAULT 'USD';
-- currency: 货币类型，默认 USD

ALTER TABLE collection_lists ADD COLUMN description TEXT;
-- description: 列表描述（可选）
```

**字段说明：**
- `pricing_mode`: 创建者可设置列表的定价模式
  - `'free'`: 完全免费，所有人可访问全部内容
  - `'premium'`: 付费列表，需要购买才能访问（除前3条免费预览外）
  - `'free_preview'`: 免费预览模式，前3条免费，其余需付费（与 premium 类似，但价格由平台订阅决定）
- `price`: 当 `pricing_mode = 'premium'` 时，创建者设置的价格
- `currency`: 货币类型，支持多币种（USD, CNY, EUR 等）

**visibility 字段保持不变：**
- `'public'`: 公开列表，所有人可访问页面
- `'private'`: 私有列表，仅创建者可访问

**组合逻辑：**
- `visibility = 'public'` + `pricing_mode = 'free'`: 公开免费列表
- `visibility = 'public'` + `pricing_mode = 'premium'`: 公开付费列表（需购买）
- `visibility = 'public'` + `pricing_mode = 'free_preview'`: 公开预览列表（前3条免费，其余需平台订阅）
- `visibility = 'private'`: 私有列表（不受 pricing_mode 影响）

### 1.2 用户订阅状态和购买记录

#### 1.2.1 平台订阅状态判断

**使用现有 subscriptions 表：**
```sql
-- 判断用户是否为平台付费用户
SELECT plan, status, current_period_end 
FROM subscriptions 
WHERE user_id = ? 
  AND status = 'active' 
  AND (plan = 'lite' OR plan = 'pro')
  AND current_period_end > NOW()
```

**平台付费用户定义：**
- `plan` = 'lite' 或 'pro'
- `status` = 'active'
- `current_period_end` > 当前时间

#### 1.2.2 列表购买记录表（新增）

**需要创建新表：`list_purchases`**
```sql
CREATE TABLE list_purchases (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id uuid REFERENCES users(id) ON DELETE CASCADE,
    list_id uuid REFERENCES collection_lists(id) ON DELETE CASCADE,
    price NUMERIC(10, 2) NOT NULL,
    currency TEXT DEFAULT 'USD',
    payment_status TEXT DEFAULT 'pending', -- 'pending' | 'success' | 'failed' | 'refunded'
    stripe_session_id TEXT,
    purchased_at timestamptz DEFAULT now(),
    expires_at timestamptz, -- 可选：购买有效期（如果为空则永久有效）
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now(),
    UNIQUE(user_id, list_id) -- 每个用户对每个列表只能有一条有效购买记录
);

-- 索引优化
CREATE INDEX idx_list_purchases_user_list ON list_purchases(user_id, list_id);
CREATE INDEX idx_list_purchases_list ON list_purchases(list_id);
```

**购买记录用途：**
- 记录用户购买特定列表的访问权限
- 当 `pricing_mode = 'premium'` 时，检查用户是否已购买该列表
- 支持购买有效期（可选功能）

---

## 二、后端 API 实现

### 2.1 新增 API 端点

**文件：** `edu/backend/src/api/collection_lists.js`

```javascript
// GET /api/collection_lists/by-short-id/:short_id
// 根据 short_id 获取 collection_list 及其内容
// 需要处理权限和付费逻辑
```

**请求参数：**
- `short_id`: collection_list 的 short_id
- 用户信息：从 `req.user` 获取（可选，未登录用户也可访问 public 列表）

**响应格式：**
```json
{
  "success": true,
  "data": {
    "list": {
      "id": "uuid",
      "name": "列表名称",
      "short_id": "abc12345",
      "visibility": "public",
      "pricing_mode": "premium",
      "price": 9.99,
      "currency": "USD",
      "user_id": "创建者ID",
      "created_at": "2024-01-01T00:00:00Z",
      "description": "列表描述（可选）"
    },
    "contents": [
      {
        "content": { /* content 对象 */ },
        "added_at": "2024-01-01T00:00:00Z",
        "index": 0,  // 在列表中的位置（从0开始）
        "is_accessible": true,  // 是否可访问
        "requires_premium": false  // 是否需要付费
      }
    ],
    "total": 10,
    "free_count": 3,  // 免费内容数量
    "premium_count": 7,  // 付费内容数量
    "user_access": {
      "is_owner": false,  // 是否为创建者
      "is_platform_premium": false,  // 是否为平台付费用户
      "has_purchased_list": false,  // 是否已购买该列表
      "can_access_all": false  // 是否可以访问全部内容
    },
    "pricing": {
      "mode": "premium",
      "price": 9.99,
      "currency": "USD",
      "formatted_price": "$9.99"
    }
  }
}
```

### 2.2 Database Service 方法

**文件：** `edu/backend/src/services/database.js`

```javascript
/**
 * 根据 short_id 获取 collection_list 及其内容
 * @param {string} shortId - collection_list 的 short_id
 * @param {string} userId - 当前用户ID（可选）
 * @returns {Promise<{data: object, error: Error}>}
 */
const getCollectionListByShortId = async (shortId, userId = null) => {
  try {
    // 1. 查询 collection_list
    const { data: list, error: listError } = await supabase
      .from('collection_lists')
      .select('*')
      .eq('short_id', shortId)
      .single();
    
    if (listError || !list) {
      return { data: null, error: new Error('列表不存在') };
    }
    
    // 2. 权限检查
    const isOwner = userId && list.user_id === userId;
    const isPrivate = list.visibility === 'private';
    
    // private 列表：仅创建者可访问
    if (isPrivate && !isOwner) {
      return { data: null, error: new Error('无权限访问此列表') };
    }
    
    // 3. 获取用户订阅和购买状态（如果已登录）
    let isPlatformPremium = false;
    let hasPurchasedList = false;
    
    if (userId) {
      // 3.1 检查平台订阅状态
      const { data: subscription } = await supabase
        .from('subscriptions')
        .select('plan, status, current_period_end')
        .eq('user_id', userId)
        .eq('status', 'active')
        .in('plan', ['lite', 'pro'])
        .gt('current_period_end', new Date().toISOString())
        .single();
      
      isPlatformPremium = !!subscription;
      
      // 3.2 检查是否已购买该列表（仅当 pricing_mode = 'premium' 时）
      if (list.pricing_mode === 'premium') {
        const { data: purchase } = await supabase
          .from('list_purchases')
          .select('id, expires_at')
          .eq('user_id', userId)
          .eq('list_id', list.id)
          .eq('payment_status', 'success')
          .single();
        
        if (purchase) {
          // 检查是否过期（如果设置了有效期）
          if (!purchase.expires_at || new Date(purchase.expires_at) > new Date()) {
            hasPurchasedList = true;
          }
        }
      }
    }
    
    // 4. 判断访问权限
    const FREE_PREVIEW_COUNT = 3;  // 免费预览数量
    
    // 访问权限逻辑：
    // - 创建者：始终可访问全部
    // - 免费列表（pricing_mode = 'free'）：所有人可访问全部
    // - 付费列表（pricing_mode = 'premium'）：已购买或平台订阅用户可访问全部，其他用户只能看前3条
    // - 预览列表（pricing_mode = 'free_preview'）：平台订阅用户可访问全部，其他用户只能看前3条
    const canAccessAll = isOwner || 
                        (list.pricing_mode === 'free') ||
                        (list.pricing_mode === 'premium' && (hasPurchasedList || isPlatformPremium)) ||
                        (list.pricing_mode === 'free_preview' && isPlatformPremium);
    
    // 5. 获取列表内容
    const { data: collections, error: collectionsError } = await supabase
      .from('user_collections')
      .select(`
        id,
        added_at,
        content_id,
        content:content_id (
          id,
          short_id,
          title,
          description,
          tags,
          language_code,
          created_at
        )
      `)
      .eq('list_id', list.id)
      .order('added_at', { ascending: false });
    
    if (collectionsError) {
      throw collectionsError;
    }
    
    // 6. 处理内容访问权限
    const processedContents = collections.map((item, index) => {
      const isFreePreview = index < FREE_PREVIEW_COUNT;
      
      // 判断是否需要付费：
      // - 免费列表：不需要付费
      // - 付费/预览列表：前3条免费，其余需付费
      const requiresPayment = list.pricing_mode !== 'free' && !isFreePreview;
      const isAccessible = canAccessAll || isFreePreview;
      
      return {
        ...item,
        index,
        is_accessible: isAccessible,
        requires_payment: requiresPayment,
        is_free_preview: isFreePreview
      };
    });
    
    // 7. 统计信息
    let freeCount = 0;
    let premiumCount = 0;
    
    if (list.pricing_mode === 'free') {
      // 免费列表：全部免费
      freeCount = processedContents.length;
      premiumCount = 0;
    } else {
      // 付费/预览列表：前3条免费，其余付费
      freeCount = Math.min(FREE_PREVIEW_COUNT, processedContents.length);
      premiumCount = Math.max(0, processedContents.length - FREE_PREVIEW_COUNT);
    }
    
    // 8. 格式化价格
    const formattedPrice = list.price 
      ? new Intl.NumberFormat('en-US', {
          style: 'currency',
          currency: list.currency || 'USD'
        }).format(list.price)
      : null;
    
    return {
      data: {
        list,
        contents: processedContents,
        total: processedContents.length,
        free_count: freeCount,
        premium_count: premiumCount,
        user_access: {
          is_owner: isOwner,
          is_platform_premium: isPlatformPremium,
          has_purchased_list: hasPurchasedList,
          can_access_all: canAccessAll
        },
        pricing: {
          mode: list.pricing_mode,
          price: list.price,
          currency: list.currency || 'USD',
          formatted_price: formattedPrice
        }
      },
      error: null
    };
  } catch (error) {
    return { data: null, error };
  }
};
```

---

## 三、前端实现

### 3.1 动态路由页面

**文件：** `edu/frontend/src/app/list/[short_id]/page.tsx`

**核心功能：**
1. 根据 `short_id` 获取列表信息
2. 显示列表元信息
3. 根据访问权限显示内容：
   - 可访问：正常显示，可点击
   - 不可访问：灰色显示，点击跳转购买页面
4. 显示"升级解锁全部内容"提示

**关键代码结构：**
```typescript
interface CollectionListData {
  list: {
    id: string;
    name: string;
    short_id: string;
    visibility: string;
    user_id: string;
    created_at: string;
  };
  contents: Array<{
    content: Content;
    added_at: string;
    index: number;
    is_accessible: boolean;
    requires_premium: boolean;
  }>;
  total: number;
  free_count: number;
  premium_count: number;
  user_access: {
    is_owner: boolean;
    is_premium: boolean;
    can_access_all: boolean;
  };
}
```

### 3.2 内容卡片组件（更新版）

**需要修改：** `edu/frontend/src/components/CollectionCard.tsx` 或创建新组件

**功能：**
- 支持禁用状态（灰色显示）
- 点击禁用内容时跳转购买页面
- 显示"需要付费"提示

**样式：**
```css
/* 可访问的内容 */
.content-card {
  cursor: pointer;
  opacity: 1;
}

/* 不可访问的内容（灰色） */
.content-card.disabled {
  cursor: not-allowed;
  opacity: 0.5;
  filter: grayscale(50%);
  position: relative;
}

.content-card.disabled::after {
  content: '🔒 需要付费解锁';
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  background: rgba(0, 0, 0, 0.8);
  color: white;
  padding: 8px 16px;
  border-radius: 4px;
  font-size: 14px;
  pointer-events: none;
}
```

### 3.3 购买页面集成

#### 3.3.1 列表购买页面

**购买页面路径：** `/purchase/list/[short_id]` 或 `/purchase/list?list_id={short_id}`

**功能：**
- 显示列表信息和价格
- 显示购买按钮
- 使用 Stripe 支付
- 支付成功后：
  - 创建 `list_purchases` 记录
  - 返回列表页面并自动刷新

**页面内容：**
```
┌─────────────────────────────────────┐
│  购买列表访问权限                    │
├─────────────────────────────────────┤
│  列表名称：{list.name}               │
│  包含 {total} 个内容                 │
│  前 {free_count} 个免费预览          │
│  其余 {premium_count} 个需付费      │
├─────────────────────────────────────┤
│  价格：{formatted_price}            │
│  [立即购买] 按钮                     │
├─────────────────────────────────────┤
│  或升级到 Pro 订阅                   │
│  [查看订阅计划]                      │
└─────────────────────────────────────┘
```

#### 3.3.2 平台订阅页面

**订阅页面路径：** `/subscription?source=list&list_id={short_id}`

**功能：**
- 显示订阅计划（Lite / Pro）
- 支付成功后返回列表页面
- 支持从列表页面跳转，携带来源信息

#### 3.3.3 购买流程

**流程1：购买单个列表（pricing_mode = 'premium'）**
```
用户点击灰色内容或"购买列表"按钮
    ↓
跳转到 /purchase/list/{short_id}
    ↓
显示列表信息和价格
    ↓
点击"立即购买"
    ↓
创建 Stripe Checkout Session
    ↓
跳转到 Stripe 支付页面
    ↓
支付成功 → Webhook 处理
    ↓
创建 list_purchases 记录
    ↓
重定向回列表页面
    ↓
自动刷新，显示全部内容
```

**流程2：升级平台订阅（pricing_mode = 'free_preview'）**
```
用户点击"升级解锁"按钮
    ↓
跳转到 /subscription?source=list&list_id={short_id}
    ↓
选择订阅计划（Lite / Pro）
    ↓
支付成功
    ↓
更新 subscriptions 表
    ↓
重定向回列表页面
    ↓
自动刷新，显示全部内容
```

---

## 四、权限控制逻辑（详细）

### 4.1 访问权限矩阵

#### 4.1.1 免费列表（pricing_mode = 'free'）

| visibility | 用户类型 | 访问权限 | 说明 |
|-----------|---------|---------|------|
| public | 所有人 | ✅ 全部可访问 | 完全免费 |
| private | 创建者 | ✅ 全部可访问 | 仅创建者可访问 |
| private | 其他人 | ❌ 403错误 | 无权限访问 |

#### 4.1.2 付费列表（pricing_mode = 'premium'）

| visibility | 用户类型 | 前3条内容 | 其余内容 | 说明 |
|-----------|---------|----------|---------|------|
| public | 未登录 | ✅ 可访问 | ❌ 灰色，需购买列表 | 显示"购买列表"按钮 |
| public | 免费用户 | ✅ 可访问 | ❌ 灰色，需购买列表 | 显示"购买列表"按钮 |
| public | 已购买用户 | ✅ 可访问 | ✅ 可访问 | 已购买该列表 |
| public | 平台订阅用户 | ✅ 可访问 | ✅ 可访问 | Pro/Lite 用户 |
| public | 创建者 | ✅ 可访问 | ✅ 可访问 | 全部可访问 |
| private | 创建者 | ✅ 可访问 | ✅ 可访问 | 全部可访问 |
| private | 其他人 | ❌ 403错误 | ❌ 403错误 | 无权限访问 |

#### 4.1.3 预览列表（pricing_mode = 'free_preview'）

| visibility | 用户类型 | 前3条内容 | 其余内容 | 说明 |
|-----------|---------|----------|---------|------|
| public | 未登录 | ✅ 可访问 | ❌ 灰色，需平台订阅 | 显示"升级订阅"按钮 |
| public | 免费用户 | ✅ 可访问 | ❌ 灰色，需平台订阅 | 显示"升级订阅"按钮 |
| public | 平台订阅用户 | ✅ 可访问 | ✅ 可访问 | Pro/Lite 用户 |
| public | 创建者 | ✅ 可访问 | ✅ 可访问 | 全部可访问 |
| private | 创建者 | ✅ 可访问 | ✅ 可访问 | 全部可访问 |
| private | 其他人 | ❌ 403错误 | ❌ 403错误 | 无权限访问 |

### 4.2 前端权限判断逻辑

```typescript
const canAccessContent = (
  item: ContentItem, 
  userAccess: UserAccess, 
  pricingMode: string
) => {
  // 创建者：全部可访问
  if (userAccess.is_owner) return true;
  
  // 免费列表：全部可访问
  if (pricingMode === 'free') return true;
  
  // 前3条：免费预览
  if (item.is_free_preview) return true;
  
  // 付费列表：已购买或平台订阅用户可访问
  if (pricingMode === 'premium') {
    return userAccess.has_purchased_list || userAccess.is_platform_premium;
  }
  
  // 预览列表：平台订阅用户可访问
  if (pricingMode === 'free_preview') {
    return userAccess.is_platform_premium;
  }
  
  return false;
};
```

---

## 五、UI/UX 设计

### 5.1 页面布局

```
┌─────────────────────────────────────────┐
│  列表名称 (Collection Name)            │
│  创建者 | 创建时间 | 10个内容           │
│  [前3条免费预览，其余需付费解锁]        │
├─────────────────────────────────────────┤
│  [分享] [收藏] (如果登录)                │
├─────────────────────────────────────────┤
│  内容网格                                │
│  ┌────┐ ┌────┐ ┌────┐                  │
│  │ ✅ │ │ ✅ │ │ ✅ │  (前3条，可点击)  │
│  └────┘ └────┘ └────┘                  │
│  ┌────┐ ┌────┐ ┌────┐                  │
│  │ 🔒 │ │ 🔒 │ │ 🔒 │  (灰色，不可点击) │
│  └────┘ └────┘ └────┘                  │
│  ┌────┐ ┌────┐                          │
│  │ 🔒 │ │ 🔒 │                          │
│  └────┘ └────┘                          │
├─────────────────────────────────────────┤
│  💎 升级解锁全部内容                     │
│  [立即升级] 按钮                         │
└─────────────────────────────────────────┘
```

### 5.2 灰色内容交互

**点击灰色内容时：**
1. 根据定价模式显示不同提示：
   - **付费列表**：显示"需要购买此列表才能查看，价格：{formatted_price}"
     - "立即购买" → 跳转 `/purchase/list/{short_id}`
     - "升级订阅" → 跳转 `/subscription?source=list&list_id={short_id}`
     - "取消"
   - **预览列表**：显示"需要升级订阅才能查看此内容"
     - "立即升级" → 跳转 `/subscription?source=list&list_id={short_id}`
     - "取消"
2. 显示模态框或 Toast 提示

**悬停效果：**
- 鼠标悬停时显示提示：
  - 付费列表："🔒 需要购买列表解锁"
  - 预览列表："🔒 需要订阅解锁"
- 轻微放大效果（scale(1.02)）

### 5.3 购买/升级提示横幅

**位置：** 内容列表上方或下方

**内容（根据定价模式）：**

**付费列表（pricing_mode = 'premium'）：**
```
💎 购买此列表解锁全部 7 个付费内容
价格：$9.99
[立即购买] [升级订阅] [了解更多]
```

**预览列表（pricing_mode = 'free_preview'）：**
```
💎 升级到 Pro 解锁全部 7 个付费内容
[立即升级] [了解更多]
```

**显示条件：**
- 列表有付费内容（premium_count > 0）
- 用户不是创建者
- 用户未购买列表（付费列表）或不是平台订阅用户（预览列表）

---

## 六、API 客户端方法

**文件：** `edu/frontend/src/lib/api.ts`

```typescript
// 新增方法
api.collectionList = {
  /**
   * 根据 short_id 获取 collection_list
   */
  getByShortId: async (shortId: string): Promise<CollectionListData> => {
    const response = await fetch(`/api/collection_lists/by-short-id/${shortId}`, {
      credentials: 'include'
    });
    
    if (!response.ok) {
      if (response.status === 404) {
        throw new Error('列表不存在');
      }
      if (response.status === 403) {
        throw new Error('无权限访问此列表');
      }
      throw new Error('获取列表失败');
    }
    
    const data = await response.json();
    if (!data.success) {
      throw new Error(data.error || '获取列表失败');
    }
    
    return data.data;
  }
};
```

---

## 七、SEO 优化

### 7.1 Meta 标签

```typescript
// 在页面中动态设置
useEffect(() => {
  if (listData) {
    document.title = `${listData.list.name} - 收藏列表 - EduNest AI`;
    
    // 设置 meta 标签
    const metaDescription = document.querySelector('meta[name="description"]');
    if (metaDescription) {
      metaDescription.setAttribute(
        'content',
        `查看 ${listData.list.name} 收藏列表，包含 ${listData.total} 个内容。前 ${listData.free_count} 个内容免费预览。`
      );
    }
    
    // Open Graph 标签
    const ogTitle = document.querySelector('meta[property="og:title"]');
    if (ogTitle) {
      ogTitle.setAttribute('content', listData.list.name);
    }
  }
}, [listData]);
```

---

## 八、创建者管理功能

### 8.1 列表设置页面

**路径：** `/list/[short_id]/settings` 或 `/collections/[list_id]/settings`

**功能：**
- 创建者可以编辑列表设置
- 设置定价模式：
  - 免费：完全免费
  - 付费：设置价格（必填）
  - 预览：使用平台订阅模式
- 设置价格和货币
- 设置列表描述
- 设置可见性（public/private）

**表单字段：**
```typescript
interface ListSettings {
  name: string;
  description?: string;
  visibility: 'public' | 'private';
  pricing_mode: 'free' | 'premium' | 'free_preview';
  price?: number;  // 当 pricing_mode = 'premium' 时必填
  currency?: string;  // 默认 'USD'
}
```

### 8.2 API 端点

**文件：** `edu/backend/src/api/collection_lists.js`

```javascript
// PUT /api/collection_lists/:id/settings
// 更新列表设置（仅创建者）
router.put('/:id/settings', authenticateToken, async (req, res) => {
  try {
    const listId = req.params.id;
    const { pricing_mode, price, currency, description, visibility } = req.body;
    
    // 验证权限：仅创建者可修改
    const { data: list } = await supabase
      .from('collection_lists')
      .select('user_id')
      .eq('id', listId)
      .single();
    
    if (!list || list.user_id !== req.user.id) {
      return res.status(403).json({ error: '无权限修改此列表' });
    }
    
    // 验证价格（如果设置为付费）
    if (pricing_mode === 'premium') {
      if (!price || price <= 0) {
        return res.status(400).json({ error: '付费列表必须设置有效价格' });
      }
    }
    
    // 更新列表
    const updateData = {
      pricing_mode: pricing_mode || 'free',
      price: pricing_mode === 'premium' ? price : null,
      currency: currency || 'USD',
      description,
      visibility,
      updated_at: new Date().toISOString()
    };
    
    const { error } = await supabase
      .from('collection_lists')
      .update(updateData)
      .eq('id', listId);
    
    if (error) {
      throw error;
    }
    
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});
```

---

## 九、实现步骤（优先级）

### Phase 1: 数据模型和核心功能（必须）
1. ✅ 数据库迁移：添加定价相关字段
2. ✅ 创建 `list_purchases` 表
3. ✅ 后端 API：`getCollectionListByShortId`（包含定价逻辑）
4. ✅ 前端路由：`/list/[short_id]/page.tsx`
5. ✅ 基础页面渲染
6. ✅ 权限控制逻辑（public/private + 定价模式）

### Phase 2: 付费逻辑（核心）
7. ✅ 用户订阅状态判断
8. ✅ 列表购买状态判断
9. ✅ 内容访问权限判断（根据定价模式）
10. ✅ 灰色内容显示和交互
11. ✅ 购买页面跳转（区分列表购买和平台订阅）

### Phase 3: 购买流程
12. ✅ 列表购买页面：`/purchase/list/[short_id]`
13. ✅ Stripe 支付集成（列表购买）
14. ✅ Webhook 处理（创建购买记录）
15. ✅ 支付成功后状态刷新

### Phase 4: 创建者管理
16. ✅ 列表设置页面
17. ✅ 更新列表设置 API
18. ✅ 价格设置表单验证

### Phase 5: UI/UX 优化
19. ✅ 购买/升级提示横幅（根据定价模式）
20. ✅ 灰色内容悬停效果
21. ✅ 加载状态和错误处理
22. ✅ 价格显示格式化

### Phase 6: 增强功能
23. ✅ SEO 优化
24. ✅ 分享功能
25. ✅ 收藏列表功能
26. ✅ 购买记录查询

---

## 十、数据流（更新版）

```
用户访问 /list/abc12345
    ↓
前端调用 api.collectionList.getByShortId('abc12345')
    ↓
后端 GET /api/collection_lists/by-short-id/abc12345
    ↓
DatabaseService.getCollectionListByShortId('abc12345', userId?)
    ↓
1. 查询列表信息
2. 检查 visibility：
   - private → 检查是否为创建者
   - public → 继续
3. 查询用户订阅状态（如果已登录）
4. 获取列表内容
5. 处理内容访问权限：
   - 前3条：is_accessible = true
   - 其余：is_accessible = (is_owner || is_premium)
    ↓
返回 { list, contents, user_access }
    ↓
前端渲染：
- 可访问内容：正常显示
- 不可访问内容：灰色显示，点击跳转购买
```

---

## 十、注意事项

### 10.1 安全性
1. ✅ **权限验证**：private 列表必须验证创建者身份
2. ✅ **订阅验证**：验证订阅状态时检查有效期
3. ✅ **SQL 注入防护**：使用参数化查询

### 10.2 性能
1. ✅ **内容分页**：如果内容很多，考虑分页加载
2. ✅ **缓存策略**：
   - public 列表：可缓存（但需考虑内容更新）
   - private 列表：不缓存
3. ✅ **订阅状态缓存**：用户订阅状态可缓存5-10分钟

### 10.3 用户体验
1. ✅ **加载状态**：显示加载动画
2. ✅ **错误处理**：友好的错误提示
3. ✅ **购买后刷新**：支付成功后自动刷新列表状态

### 10.4 业务逻辑
1. ✅ **免费预览数量**：可配置（当前设为3）
2. ✅ **定价模式**：
   - `free`：完全免费
   - `premium`：付费列表，创建者设置价格
   - `free_preview`：预览模式，使用平台订阅
3. ✅ **付费判断**：
   - 平台订阅：lite 和 pro 都算付费用户
   - 列表购买：检查 `list_purchases` 表
4. ✅ **创建者特权**：创建者始终可访问全部内容，可设置定价
5. ✅ **价格验证**：付费列表必须设置有效价格（> 0）
6. ✅ **货币支持**：支持多币种，默认 USD

---

## 十二、扩展性考虑

### 12.1 未来可能的扩展
1. **自定义免费预览数量**：每个列表可设置不同的免费预览数量
2. **部分内容付费**：某些特定内容标记为付费，而非按位置
3. **时间限制**：
   - 免费预览有时间限制（如7天）
   - 购买列表有有效期（如30天、90天、永久）
4. **分享奖励**：分享列表后获得额外免费预览
5. **折扣和优惠码**：支持创建者设置折扣码
6. **批量购买**：购买多个列表的套餐
7. **收入分成**：平台和创建者收入分成统计
8. **多币种定价**：同一列表支持不同货币的不同价格

### 12.2 数据统计
- 记录列表访问量
- 记录付费转化率（从列表页面到购买页面）
- 记录内容点击率（区分免费和付费内容）

---

## 十三、测试用例

### 13.1 功能测试

#### 免费列表（pricing_mode = 'free'）
1. ✅ public 免费列表，所有人：全部可访问
2. ✅ private 免费列表，创建者：全部可访问
3. ✅ private 免费列表，其他人：403错误

#### 付费列表（pricing_mode = 'premium'）
4. ✅ public 付费列表，未登录用户：前3条可访问，其余灰色
5. ✅ public 付费列表，免费用户：前3条可访问，其余灰色
6. ✅ public 付费列表，已购买用户：全部可访问
7. ✅ public 付费列表，平台订阅用户：全部可访问
8. ✅ public 付费列表，创建者：全部可访问

#### 预览列表（pricing_mode = 'free_preview'）
9. ✅ public 预览列表，未登录用户：前3条可访问，其余灰色
10. ✅ public 预览列表，免费用户：前3条可访问，其余灰色
11. ✅ public 预览列表，平台订阅用户：全部可访问
12. ✅ public 预览列表，创建者：全部可访问

#### 创建者功能
13. ✅ 创建者可以设置列表为免费
14. ✅ 创建者可以设置列表为付费并设置价格
15. ✅ 创建者可以设置列表为预览模式
16. ✅ 创建者修改价格后，已购买用户仍可访问

### 13.2 交互测试
1. ✅ 点击灰色内容（付费列表）：显示"购买列表"提示，跳转购买页面
2. ✅ 点击灰色内容（预览列表）：显示"升级订阅"提示，跳转订阅页面
3. ✅ 点击"立即购买"：跳转列表购买页面
4. ✅ 点击"升级订阅"：跳转平台订阅页面
5. ✅ 列表购买成功后返回：自动刷新，显示全部内容
6. ✅ 平台订阅成功后返回：自动刷新，显示全部内容
7. ✅ 创建者修改列表设置：保存成功，页面更新

### 13.3 支付测试
1. ✅ 列表购买支付流程：Stripe Checkout → Webhook → 创建购买记录
2. ✅ 平台订阅支付流程：Stripe Checkout → Webhook → 更新订阅状态
3. ✅ 支付失败处理：显示错误提示
4. ✅ 支付取消处理：返回列表页面

---

## 总结

该方案提供：
- ✅ 基于 `short_id` 的独立页面访问
- ✅ 灵活的权限控制（public/private + 定价模式）
- ✅ **创建者可自定义定价**：
  - 免费列表：完全免费
  - 付费列表：创建者设置价格
  - 预览列表：使用平台订阅模式
- ✅ 免费预览机制（前3条）
- ✅ 付费内容保护（灰色显示）
- ✅ 双重购买模式：
  - 购买单个列表（付费列表）
  - 升级平台订阅（预览列表）
- ✅ 创建者管理功能（设置定价）
- ✅ SEO 支持
- ✅ 良好的用户体验

该方案支持**内容创作者变现**，同时保持用户体验友好。创建者可以根据内容价值灵活设置定价策略。

