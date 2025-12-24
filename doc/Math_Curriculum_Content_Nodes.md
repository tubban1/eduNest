# 数学课程大纲 - Content Node 结构分析

## 数据结构说明

根据 `content_node` 表结构，以下内容适合作为节点：

### Node Type 层级结构
- `grade`: 年级（7年级、8年级、9年级）
- `semester`: 学期（上学期、下学期）
- `chapter`: 章节（第一章、第二章...）
- `section`: 节（1.1、1.2...）
- `subsection`: 小节（1.2.1、1.2.2...）
- `topic`: 知识点（具体的学习内容）

## Content Node 列表

### 层级 1: 年级节点

#### 7年级 (Grade 7)
- **node_type**: `grade`
- **title**: `7年级`
- **key**: `grade_7`
- **path**: `/cn/gb/math/grade7`
- **country_code**: `CN`
- **curriculum_system**: `人教版`
- **language_code**: `zh-CN`
- **order_index**: 1

#### 8年级 (Grade 8)
- **node_type**: `grade`
- **title**: `8年级`
- **key**: `grade_8`
- **path**: `/cn/gb/math/grade8`
- **country_code**: `CN`
- **curriculum_system**: `人教版`
- **language_code**: `zh-CN`
- **order_index**: 2

#### 9年级 (Grade 9)
- **node_type**: `grade`
- **title**: `9年级`
- **key**: `grade_9`
- **path**: `/cn/gb/math/grade9`
- **country_code**: `CN`
- **curriculum_system**: `人教版`
- **language_code**: `zh-CN`
- **order_index**: 3

---

### 层级 2: 学期节点

#### 7年级上学期
- **node_type**: `semester`
- **title**: `上学期`
- **key**: `semester_1`
- **path**: `/cn/gb/math/grade7/semester1`
- **parent_id**: (7年级节点ID)
- **order_index**: 1

#### 7年级下学期
- **node_type**: `semester`
- **title**: `下学期`
- **key**: `semester_2`
- **path**: `/cn/gb/math/grade7/semester2`
- **parent_id**: (7年级节点ID)
- **order_index**: 2

#### 8年级上学期
- **node_type**: `semester`
- **title**: `上学期`
- **key**: `semester_1`
- **path**: `/cn/gb/math/grade8/semester1`
- **parent_id**: (8年级节点ID)
- **order_index**: 1

#### 8年级下学期
- **node_type**: `semester`
- **title**: `下学期`
- **key**: `semester_2`
- **path**: `/cn/gb/math/grade8/semester2`
- **parent_id**: (8年级节点ID)
- **order_index**: 2

#### 9年级上学期
- **node_type**: `semester`
- **title**: `上学期`
- **key**: `semester_1`
- **path**: `/cn/gb/math/grade9/semester1`
- **parent_id**: (9年级节点ID)
- **order_index**: 1

#### 9年级下学期
- **node_type**: `semester`
- **title**: `下学期`
- **key**: `semester_2`
- **path**: `/cn/gb/math/grade9/semester2`
- **parent_id**: (9年级节点ID)
- **order_index**: 2

---

### 层级 3: 章节节点（7年级上学期）

#### 第一章 有理数
- **node_type**: `chapter`
- **title**: `第一章 有理数`
- **key**: `rational_numbers`
- **path**: `/cn/gb/math/grade7/semester1/chapter1_rational_numbers`
- **parent_id**: (7年级上学期节点ID)
- **order_index**: 1

#### 第二章 有理数的运算
- **node_type**: `chapter`
- **title**: `第二章 有理数的运算`
- **key**: `rational_number_operations`
- **path**: `/cn/gb/math/grade7/semester1/chapter2_rational_number_operations`
- **parent_id**: (7年级上学期节点ID)
- **order_index**: 2

#### 第三章 代数式
- **node_type**: `chapter`
- **title**: `第三章 代数式`
- **key**: `algebraic_expressions`
- **path**: `/cn/gb/math/grade7/semester1/chapter3_algebraic_expressions`
- **parent_id**: (7年级上学期节点ID)
- **order_index**: 3

#### 第四章 整式的加减
- **node_type**: `chapter`
- **title**: `第四章 整式的加减`
- **key**: `polynomial_addition_subtraction`
- **path**: `/cn/gb/math/grade7/semester1/chapter4_polynomial_addition_subtraction`
- **parent_id**: (7年级上学期节点ID)
- **order_index**: 4

#### 第五章 一元一次方程
- **node_type**: `chapter`
- **title**: `第五章 一元一次方程`
- **key**: `linear_equation_one_variable`
- **path**: `/cn/gb/math/grade7/semester1/chapter5_linear_equation_one_variable`
- **parent_id**: (7年级上学期节点ID)
- **order_index**: 5

#### 第六章 几何图形初步
- **node_type**: `chapter`
- **title**: `第六章 几何图形初步`
- **key**: `geometric_shapes_intro`
- **path**: `/cn/gb/math/grade7/semester1/chapter6_geometric_shapes_intro`
- **parent_id**: (7年级上学期节点ID)
- **order_index**: 6

---

### 层级 4: 节节点（以第一章为例）

#### 1.1 正数和负数
- **node_type**: `section`
- **title**: `1.1 正数和负数`
- **key**: `positive_negative_numbers`
- **path**: `/cn/gb/math/grade7/semester1/chapter1_rational_numbers/section1_1_positive_negative_numbers`
- **parent_id**: (第一章节点ID)
- **order_index**: 1

#### 1.2 有理数及其大小比较
- **node_type**: `section`
- **title**: `1.2 有理数及其大小比较`
- **key**: `rational_numbers_comparison`
- **path**: `/cn/gb/math/grade7/semester1/chapter1_rational_numbers/section1_2_rational_numbers_comparison`
- **parent_id**: (第一章节点ID)
- **order_index**: 2

---

### 层级 5: 小节节点（以1.2为例）

#### 1.2.1 有理数的概念
- **node_type**: `subsection`
- **title**: `1.2.1 有理数的概念`
- **key**: `rational_number_concept`
- **path**: `/cn/gb/math/grade7/semester1/chapter1_rational_numbers/section1_2_rational_numbers_comparison/subsection1_2_1_rational_number_concept`
- **parent_id**: (1.2节节点ID)
- **order_index**: 1

#### 1.2.2 数轴
- **node_type**: `subsection`
- **title**: `1.2.2 数轴`
- **key**: `number_line`
- **path**: `/cn/gb/math/grade7/semester1/chapter1_rational_numbers/section1_2_rational_numbers_comparison/subsection1_2_2_number_line`
- **parent_id**: (1.2节节点ID)
- **order_index**: 2

#### 1.2.3 相反数
- **node_type**: `subsection`
- **title**: `1.2.3 相反数`
- **key**: `opposite_numbers`
- **path**: `/cn/gb/math/grade7/semester1/chapter1_rational_numbers/section1_2_rational_numbers_comparison/subsection1_2_3_opposite_numbers`
- **parent_id**: (1.2节节点ID)
- **order_index**: 3

#### 1.2.4 绝对值
- **node_type**: `subsection`
- **title**: `1.2.4 绝对值`
- **key**: `absolute_value`
- **path**: `/cn/gb/math/grade7/semester1/chapter1_rational_numbers/section1_2_rational_numbers_comparison/subsection1_2_4_absolute_value`
- **parent_id**: (1.2节节点ID)
- **order_index**: 4

#### 1.2.5 有理数的大小比较
- **node_type**: `subsection`
- **title**: `1.2.5 有理数的大小比较`
- **key**: `rational_number_comparison`
- **path**: `/cn/gb/math/grade7/semester1/chapter1_rational_numbers/section1_2_rational_numbers_comparison/subsection1_2_5_rational_number_comparison`
- **parent_id**: (1.2节节点ID)
- **order_index**: 5

---

### 层级 6: 知识点节点（可选）

对于每个小节，可以进一步细分为具体的知识点（topic），例如：

#### 有理数的概念 - 定义
- **node_type**: `topic`
- **title**: `有理数的定义`
- **key**: `rational_number_definition`
- **path**: `/cn/gb/math/grade7/semester1/chapter1_rational_numbers/section1_2_rational_numbers_comparison/subsection1_2_1_rational_number_concept/topic_definition`
- **parent_id**: (1.2.1小节节点ID)
- **order_index**: 1

---

## 完整节点结构示例（7年级上学期第一章）

```
grade_7 (7年级)
  └── semester_1 (上学期)
      └── chapter1_rational_numbers (第一章 有理数)
          ├── section1_1_positive_negative_numbers (1.1 正数和负数)
          └── section1_2_rational_numbers_comparison (1.2 有理数及其大小比较)
              ├── subsection1_2_1_rational_number_concept (1.2.1 有理数的概念)
              ├── subsection1_2_2_number_line (1.2.2 数轴)
              ├── subsection1_2_3_opposite_numbers (1.2.3 相反数)
              ├── subsection1_2_4_absolute_value (1.2.4 绝对值)
              └── subsection1_2_5_rational_number_comparison (1.2.5 有理数的大小比较)
```

---

## 不适合作为 Content Node 的内容

以下内容**不适合**作为独立的 content_node：

1. **"小结"** - 这是章节总结，应该作为章节的 metadata 或关联内容
2. **"阅读与思考"** - 可以作为章节的 metadata 中的阅读材料
3. **"数学活动"** - 可以作为章节的 metadata 中的活动
4. **"复习题"** - 可以作为章节的 metadata 中的练习题
5. **"构建知识体系"** - 这是复习内容，可以作为章节的 metadata
6. **"习题训练"** - 可以作为章节的 metadata 中的练习
7. **"专题复习"** - 这是复习内容，可以作为独立的复习节点（node_type: `exam_scope`）

---

## 特殊处理

### 专题复习部分

专题复习可以作为独立的节点，使用 `node_type: exam_scope`：

- **node_type**: `exam_scope`
- **title**: `专题复习`
- **key**: `topic_review`
- **path**: `/cn/gb/math/grade9/semester2/topic_review`
- **parent_id**: (9年级下学期节点ID)
- **order_index**: 100

每个专题可以作为子节点：
- 各类函数解析式中参数的作用
- 二次函数专题
- 函数学习经验专题复习
- 等等...

---

## 数据导入建议

### 1. 导入顺序
1. 先导入年级节点
2. 再导入学期节点
3. 然后导入章节节点
4. 接着导入节节点
5. 最后导入小节节点

### 2. Key 命名规范
- 使用英文小写
- 单词间用下划线分隔
- 保持简洁但具有描述性
- 同一层级内唯一

### 3. Path 规范
- 格式：`/cn/gb/math/{grade}/{semester}/{chapter}/{section}/{subsection}`
- 使用 key 而不是 title 构建 path
- 保持路径唯一性

### 4. Metadata 建议
对于每个节点，可以在 metadata 中存储：
- 教学目标
- 学习时长建议
- 难度等级
- 关联的练习题
- 阅读材料
- 数学活动

---

## 统计信息

### 节点数量估算

- **年级节点**: 3个（7、8、9年级）
- **学期节点**: 6个（每个年级2个学期）
- **章节节点**: 约29个（7年级上学期6章，下学期6章，8年级上学期3章，下学期4章，9年级上学期5章，下学期4章，加上重复的第十六章）
- **节节点**: 约100+个
- **小节节点**: 约200+个

**总计**: 约340+个节点

---

## 注意事项

1. **重复章节**: 8年级下学期有"第十六章 二次根式"，与上学期"第十六章 整式的乘法"重复编号，需要区分
2. **跨学期内容**: 某些专题复习跨越多个章节，需要特殊处理
3. **可选内容**: 标记为 `*` 的内容（如 `*10.4 三元一次方程组的解法`）可以作为可选的子节点
4. **语言支持**: 当前大纲是中文，如果需要支持多语言，需要为每个节点提供多语言标题

