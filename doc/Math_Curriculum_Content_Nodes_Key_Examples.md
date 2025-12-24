# Key 和 Path 命名规范示例

## 原则

1. **title**: 包含章节编号（显示给用户看）
   - 例如：`第一章 有理数`、`1.1 正数和负数`

2. **key**: **不包含**章节编号，使用内容描述
   - 例如：`rational_numbers` 而不是 `chapter1_rational_numbers`
   - 原因：key 是跨语言的规范化标识，章节编号在不同语言/国家可能不同

3. **path**: 使用 key 构建，**不包含**章节编号
   - 例如：`/cn/gb/math/grade7/semester1/rational_numbers`
   - 而不是：`/cn/gb/math/grade7/semester1/chapter1_rational_numbers`

4. **order_index**: 同一层级的索引
   - 所有章节中，第一章 order_index=1，第二章 order_index=2，以此类推

## 示例对比

### 章节节点

| title | key | path | order_index |
|-------|-----|------|-------------|
| `第一章 有理数` | `rational_numbers` | `/cn/gb/math/grade7/semester1/rational_numbers` | 1 |
| `第二章 有理数的运算` | `rational_number_operations` | `/cn/gb/math/grade7/semester1/rational_number_operations` | 2 |
| `第十七章 二次根式` | `quadratic_radicals` | `/cn/gb/math/grade8/semester2/quadratic_radicals` | 17 |

### 节节点

| title | key | path | order_index |
|-------|-----|------|-------------|
| `1.1 正数和负数` | `positive_negative_numbers` | `/cn/gb/math/grade7/semester1/rational_numbers/positive_negative_numbers` | 1 |
| `1.2 有理数及其大小比较` | `rational_numbers_comparison` | `/cn/gb/math/grade7/semester1/rational_numbers/rational_numbers_comparison` | 2 |
| `17.1 二次根式` | `quadratic_radicals` | `/cn/gb/math/grade8/semester2/quadratic_radicals/quadratic_radicals` | 1 |

### 小节节点

| title | key | path | order_index |
|-------|-----|------|-------------|
| `1.2.1 有理数的概念` | `rational_number_concept` | `/cn/gb/math/grade7/semester1/rational_numbers/rational_numbers_comparison/rational_number_concept` | 1 |
| `1.2.2 数轴` | `number_line` | `/cn/gb/math/grade7/semester1/rational_numbers/rational_numbers_comparison/number_line` | 2 |

## 注意事项

- key 应该简洁且具有描述性
- 同一层级内 key 必须唯一
- path 通过拼接父节点的 path 和当前节点的 key 构建
- order_index 用于同一层级内的排序，与章节编号对应

