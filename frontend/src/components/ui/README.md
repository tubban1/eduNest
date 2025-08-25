# UI组件使用说明

## ContentActionButtons 内容操作按钮组

这是一个组合组件，包含了点赞、收藏、分享三个按钮，样式和操作逻辑与collections页面保持一致。

### 基本用法

```tsx
import ContentActionButtons from '@/components/ui/ContentActionButtons';

<ContentActionButtons
  contentId="content-123"
  shortId="abc123"
  title="内容标题"
  initialLiked={false}
  initialCollected={false}
  initialLikeCount={5}
  initialCollectionCount={2}
  size="md"
  showCount={true}
  showText={true}
  onLikeChange={(liked, count) => {
    console.log('点赞状态变化:', liked, count);
  }}
  onCollectChange={(collected, count) => {
    console.log('收藏状态变化:', collected, count);
  }}
  onShare={() => {
    console.log('分享按钮被点击');
  }}
/>
```

### 属性说明

| 属性 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| `contentId` | `string` | - | 内容ID（必填） |
| `shortId` | `string` | - | 短ID，用于生成分享链接 |
| `title` | `string` | - | 内容标题，用于分享 |
| `initialLiked` | `boolean` | `false` | 初始点赞状态 |
| `initialCollected` | `boolean` | `false` | 初始收藏状态 |
| `initialLikeCount` | `number` | `0` | 初始点赞数量 |
| `initialCollectionCount` | `number` | `0` | 初始收藏数量 |
| `size` | `'sm' \| 'md' \| 'lg'` | `'md'` | 按钮大小 |
| `showCount` | `boolean` | `true` | 是否显示数量 |
| `showText` | `boolean` | `true` | 是否显示文字 |
| `className` | `string` | `''` | 自定义CSS类 |
| `onLikeChange` | `function` | - | 点赞状态变化回调 |
| `onCollectChange` | `function` | - | 收藏状态变化回调 |
| `onShare` | `function` | - | 分享按钮点击回调 |
| `layout` | `'horizontal' \| 'vertical'` | `'horizontal'` | 按钮布局 |
| `spacing` | `'tight' \| 'normal' \| 'loose'` | `'normal'` | 按钮间距 |

### 单独使用各个按钮

#### LikeButton 点赞按钮

```tsx
import LikeButton from '@/components/ui/LikeButton';

<LikeButton
  contentId="content-123"
  initialLiked={false}
  initialLikeCount={5}
  size="md"
  showCount={true}
  showText={true}
  onLikeChange={(liked, count) => {
    console.log('点赞状态变化:', liked, count);
  }}
/>
```

#### CollectButton 收藏按钮

```tsx
import CollectButton from '@/components/ui/CollectButton';

<CollectButton
  contentId="content-123"
  initialCollected={false}
  initialCollectionCount={2}
  size="md"
  showCount={true}
  showText={true}
  onCollectChange={(collected, count) => {
    console.log('收藏状态变化:', collected, count);
  }}
/>
```

#### ShareButton 分享按钮

```tsx
import ShareButton from '@/components/ui/ShareButton';

<ShareButton
  contentId="content-123"
  shortId="abc123"
  title="内容标题"
  size="md"
  showText={true}
  onShare={() => {
    console.log('分享按钮被点击');
  }}
/>
```

### 功能特性

1. **状态管理**: 自动管理点赞、收藏状态
2. **API集成**: 自动调用后端API进行状态更新
3. **国际化支持**: 支持多语言显示
4. **响应式设计**: 支持不同屏幕尺寸
5. **无障碍访问**: 包含适当的ARIA标签和键盘导航
6. **错误处理**: 自动处理API调用失败情况
7. **性能优化**: 使用React hooks优化渲染性能

### 样式定制

所有按钮都使用Tailwind CSS类，可以通过`className`属性进行样式定制：

```tsx
<ContentActionButtons
  className="bg-gray-100 p-2 rounded-lg"
  // ... 其他属性
/>
```

### 注意事项

1. 确保在使用前已经配置了正确的API客户端
2. 点赞和收藏功能需要用户登录状态
3. 分享功能支持原生分享API和降级方案
4. 组件会自动处理loading状态和错误状态 