# 数学课程大纲 - Content Node 开发文档

## 📋 目录

1. [数据结构说明](#数据结构说明)
2. [命名规范](#命名规范)
3. [完整节点列表](#完整节点列表)
4. [数据导入指南](#数据导入指南)
5. [注意事项](#注意事项)

---

## 数据结构说明

### Node Type 层级结构

根据 `content_node` 表结构，节点类型按以下层级组织：

| 层级 | node_type | 说明 | 示例 |
|------|-----------|------|------|
| 1 | `grade` | 年级 | 7年级、8年级、9年级 |
| 2 | `semester` | 学期 | 上学期、下学期 |
| 3 | `chapter` | 章节 | 第一章 有理数、第二章 有理数的运算 |
| 4 | `section` | 节 | 1.1 正数和负数、1.2 有理数及其大小比较 |
| 5 | `subsection` | 小节 | 1.2.1 有理数的概念、1.2.2 数轴 |
| 6 | `topic` | 知识点（可选） | 用于进一步细分知识点 |
| 特殊 | `exam_scope` | 专题复习 | 专题复习节点 |

### 通用配置

所有节点共享以下配置：

- **country_code**: `CN`
- **curriculum_system**: `人教版`
- **language_code**: `zh-CN`
- **visibility**: `public`

---

## 命名规范

### 核心原则

1. **title**: 包含章节编号（显示给用户看）
   - 例如：`第一章 有理数`、`1.1 正数和负数`、`1.2.1 有理数的概念`

2. **key**: **不包含**章节编号，使用内容描述
   - 例如：`rational_numbers` 而不是 `chapter1_rational_numbers`
   - 原因：key 是跨语言的规范化标识，章节编号在不同语言/国家可能不同

3. **path**: 使用 key 构建，**不包含**章节编号
   - 格式：`/cn/gb/math/{grade}/{semester}/{chapter_key}/{section_key}/{subsection_key}`
   - 例如：`/cn/gb/math/grade7/semester1/rational_numbers`
   - 而不是：`/cn/gb/math/grade7/semester1/chapter1_rational_numbers`

4. **order_index**: 同一层级的索引（兄弟节点索引）
   - 所有章节中，第一章 order_index=1，第二章 order_index=2，以此类推
   - 同一章节内的节，按顺序编号：1, 2, 3...

### 命名示例

#### 章节节点

| title | key | path | order_index |
|-------|-----|------|-------------|
| `第一章 有理数` | `rational_numbers` | `/cn/gb/math/grade7/semester1/rational_numbers` | 1 |
| `第二章 有理数的运算` | `rational_number_operations` | `/cn/gb/math/grade7/semester1/rational_number_operations` | 2 |
| `第十七章 二次根式` | `quadratic_radicals` | `/cn/gb/math/grade8/semester2/quadratic_radicals` | 17 |

#### 节节点

| title | key | path | order_index |
|-------|-----|------|-------------|
| `1.1 正数和负数` | `positive_negative_numbers` | `/cn/gb/math/grade7/semester1/rational_numbers/positive_negative_numbers` | 1 |
| `1.2 有理数及其大小比较` | `rational_numbers_comparison` | `/cn/gb/math/grade7/semester1/rational_numbers/rational_numbers_comparison` | 2 |
| `17.1 二次根式` | `quadratic_radicals` | `/cn/gb/math/grade8/semester2/quadratic_radicals/quadratic_radicals` | 1 |

#### 小节节点

| title | key | path | order_index |
|-------|-----|------|-------------|
| `1.2.1 有理数的概念` | `rational_number_concept` | `/cn/gb/math/grade7/semester1/rational_numbers/rational_numbers_comparison/rational_number_concept` | 1 |
| `1.2.2 数轴` | `number_line` | `/cn/gb/math/grade7/semester1/rational_numbers/rational_numbers_comparison/number_line` | 2 |

### Key 命名规则

- 使用英文小写
- 单词间用下划线分隔
- **不包含章节编号**（章节编号在不同语言/国家可能不同）
- 使用内容描述性名称，如 `rational_numbers` 而不是 `chapter1_rational_numbers`
- 保持简洁但具有描述性
- 同一层级内唯一

### Path 构建规则

- 格式：`/cn/gb/math/{grade}/{semester}/{chapter_key}/{section_key}/{subsection_key}`
- 使用 key 构建 path，不使用 title
- 通过拼接父节点的 path 和当前节点的 key 构建
- 保持路径唯一性

---

## 完整节点列表

### 7年级 (Grade 7)

#### 7年级上学期 (Semester 1)

##### 第一章 有理数
- **node_type**: `chapter`
- **title**: `第一章 有理数`
- **key**: `rational_numbers`
- **path**: `/cn/gb/math/grade7/semester1/rational_numbers`
- **order_index**: 1

**子节点：**

1. **1.1 正数和负数**
   - **node_type**: `section`
   - **title**: `1.1 正数和负数`
   - **key**: `positive_negative_numbers`
   - **path**: `/cn/gb/math/grade7/semester1/rational_numbers/positive_negative_numbers`
   - **order_index**: 1

2. **1.2 有理数及其大小比较**
   - **node_type**: `section`
   - **title**: `1.2 有理数及其大小比较`
   - **key**: `rational_numbers_comparison`
   - **path**: `/cn/gb/math/grade7/semester1/rational_numbers/rational_numbers_comparison`
   - **order_index**: 2

   **子节点：**
   - 1.2.1 有理数的概念 (`subsection`, `rational_number_concept`)
   - 1.2.2 数轴 (`subsection`, `number_line`)
   - 1.2.3 相反数 (`subsection`, `opposite_numbers`)
   - 1.2.4 绝对值 (`subsection`, `absolute_value`)
   - 1.2.5 有理数的大小比较 (`subsection`, `rational_number_comparison`)

##### 第二章 有理数的运算
- **node_type**: `chapter`
- **title**: `第二章 有理数的运算`
- **key**: `rational_number_operations`
- **path**: `/cn/gb/math/grade7/semester1/rational_number_operations`
- **order_index**: 2

**子节点：**

1. **2.1 有理数的加法与减法**
   - **node_type**: `section`
   - **key**: `addition_subtraction`
   - **order_index**: 1
   - **子节点**:
     - 2.1.1 有理数的加法 (`subsection`, `rational_addition`)
     - 2.1.2 有理数的减法 (`subsection`, `rational_subtraction`)

2. **2.2 有理数的乘法与除法**
   - **node_type**: `section`
   - **key**: `multiplication_division`
   - **order_index**: 2
   - **子节点**:
     - 2.2.1 有理数的乘法 (`subsection`, `rational_multiplication`)
     - 2.2.2 有理数的除法 (`subsection`, `rational_division`)

3. **2.3 有理数的乘方**
   - **node_type**: `section`
   - **key**: `exponentiation`
   - **order_index**: 3
   - **子节点**:
     - 2.3.1 乘方 (`subsection`, `exponentiation`)
     - 2.3.2 科学记数法 (`subsection`, `scientific_notation`)
     - 2.3.3 近似数 (`subsection`, `approximation`)

##### 第三章 代数式
- **node_type**: `chapter`
- **title**: `第三章 代数式`
- **key**: `algebraic_expressions`
- **path**: `/cn/gb/math/grade7/semester1/algebraic_expressions`
- **order_index**: 3

**子节点：**
- 3.1 列代数式表示数量关系 (`section`, `algebraic_expression_representation`)
- 3.2 代数式的值 (`section`, `algebraic_expression_value`)

##### 第四章 整式的加减
- **node_type**: `chapter`
- **title**: `第四章 整式的加减`
- **key**: `polynomial_addition_subtraction`
- **path**: `/cn/gb/math/grade7/semester1/polynomial_addition_subtraction`
- **order_index**: 4

**子节点：**
- 4.1 整式 (`section`, `polynomial`)
- 4.2 整式的加法与减法 (`section`, `polynomial_addition_subtraction`)

##### 第五章 一元一次方程
- **node_type**: `chapter`
- **title**: `第五章 一元一次方程`
- **key**: `linear_equation_one_variable`
- **path**: `/cn/gb/math/grade7/semester1/linear_equation_one_variable`
- **order_index**: 5

**子节点：**
- 5.1 方程 (`section`, `equation`)
  - 5.1.1 从算式到方程 (`subsection`, `from_expression_to_equation`)
  - 5.1.2 等式的性质 (`subsection`, `equation_properties`)
- 5.2 解一元一次方程 (`section`, `solve_linear_equation`)
- 5.3 实际问题与一元一次方程 (`section`, `word_problems_linear_equation`)

##### 第六章 几何图形初步
- **node_type**: `chapter`
- **title**: `第六章 几何图形初步`
- **key**: `geometric_shapes_intro`
- **path**: `/cn/gb/math/grade7/semester1/geometric_shapes_intro`
- **order_index**: 6

**子节点：**
- 6.1 几何图形 (`section`, `geometric_shapes`)
  - 6.1.1 立体图形与平面图形 (`subsection`, `3d_2d_shapes`)
  - 6.1.2 点、线、面、体 (`subsection`, `point_line_plane_body`)
- 6.2 直线、射线、线段 (`section`, `lines_rays_segments`)
  - 6.2.1 直线、射线、线段 (`subsection`, `lines_rays_segments`)
  - 6.2.2 线段的比较与运算 (`subsection`, `segment_comparison_operations`)
- 6.3 角 (`section`, `angles`)
  - 6.3.1 角的概念 (`subsection`, `angle_concept`)
  - 6.3.2 角的比较与运算 (`subsection`, `angle_comparison_operations`)
  - 6.3.3 余角和补角 (`subsection`, `complementary_supplementary_angles`)

#### 7年级下学期 (Semester 2)

##### 第七章 相交线与平行线
- **node_type**: `chapter`
- **title**: `第七章 相交线与平行线`
- **key**: `intersecting_parallel_lines`
- **path**: `/cn/gb/math/grade7/semester2/intersecting_parallel_lines`
- **order_index**: 7

**子节点：**
- 7.1 相交线 (`section`, `intersecting_lines`)
  - 7.1.1 两条直线相交 (`subsection`, `two_lines_intersect`)
  - 7.1.2 两条直线垂直 (`subsection`, `two_lines_perpendicular`)
  - 7.1.3 两条直线被第三条直线所截 (`subsection`, `transversal`)
- 7.2 平行线 (`section`, `parallel_lines`)
  - 7.2.1 平行线的概念 (`subsection`, `parallel_lines_concept`)
  - 7.2.2 平行线的判定 (`subsection`, `parallel_lines_judgment`)
  - 7.2.3 平行线的性质 (`subsection`, `parallel_lines_properties`)
- 7.3 定义、命题、定理 (`section`, `definitions_propositions_theorems`)
- 7.4 平移 (`section`, `translation`)

##### 第八章 实数
- **node_type**: `chapter`
- **title**: `第八章 实数`
- **key**: `real_numbers`
- **path**: `/cn/gb/math/grade7/semester2/real_numbers`
- **order_index**: 8

**子节点：**
- 8.1 平方根 (`section`, `square_root`)
- 8.2 立方根 (`section`, `cube_root`)
- 8.3 实数及其简单运算 (`section`, `real_numbers_operations`)

##### 第九章 平面直角坐标系
- **node_type**: `chapter`
- **title**: `第九章 平面直角坐标系`
- **key**: `cartesian_coordinate_system`
- **path**: `/cn/gb/math/grade7/semester2/cartesian_coordinate_system`
- **order_index**: 9

**子节点：**
- 9.1 用坐标描述平面内点的位置 (`section`, `coordinate_representation`)
  - 9.1.1 平面直角坐标系的概念 (`subsection`, `cartesian_system_concept`)
  - 9.1.2 用坐标描述简单几何图形 (`subsection`, `coordinate_geometric_shapes`)
- 9.2 坐标方法的简单应用 (`section`, `coordinate_applications`)
  - 9.2.1 用坐标表示地理位置 (`subsection`, `coordinate_location`)
  - 9.2.2 用坐标表示平移 (`subsection`, `coordinate_translation`)

##### 第十章 二元一次方程组
- **node_type**: `chapter`
- **title**: `第十章 二元一次方程组`
- **key**: `system_linear_equations_two_variables`
- **path**: `/cn/gb/math/grade7/semester2/system_linear_equations_two_variables`
- **order_index**: 10

**子节点：**
- 10.1 二元一次方程组的概念 (`section`, `system_linear_equations_concept`)
- 10.2 消元——解二元一次方程组 (`section`, `elimination_method`)
  - 10.2.1 代入消元法 (`subsection`, `substitution_method`)
  - 10.2.2 加减消元法 (`subsection`, `addition_subtraction_method`)
- 10.3 实际问题与二元一次方程组 (`section`, `word_problems_system_equations`)
- *10.4 三元一次方程组的解法 (`section`, `system_linear_equations_three_variables`, **可选**)

##### 第十一章 不等式与不等式组
- **node_type**: `chapter`
- **title**: `第十一章 不等式与不等式组`
- **key**: `inequalities_inequality_systems`
- **path**: `/cn/gb/math/grade7/semester2/inequalities_inequality_systems`
- **order_index**: 11

**子节点：**
- 11.1 不等式 (`section`, `inequalities`)
  - 11.1.1 不等式及其解集 (`subsection`, `inequality_solution_set`)
  - 11.1.2 不等式的性质 (`subsection`, `inequality_properties`)
- 11.2 一元一次不等式 (`section`, `linear_inequality_one_variable`)
- 11.3 一元一次不等式组 (`section`, `linear_inequality_system_one_variable`)

##### 第十二章 数据的收集、整理与描述
- **node_type**: `chapter`
- **title**: `第十二章 数据的收集、整理与描述`
- **key**: `data_collection_organization_description`
- **path**: `/cn/gb/math/grade7/semester2/data_collection_organization_description`
- **order_index**: 12

**子节点：**
- 12.1 统计调查 (`section`, `statistical_survey`)
  - 12.1.1 全面调查 (`subsection`, `complete_survey`)
  - 12.1.2 抽样调查 (`subsection`, `sampling_survey`)
- 12.2 用统计图描述数据 (`section`, `statistical_charts`)
  - 12.2.1 扇形图、条形图和折线图 (`subsection`, `pie_bar_line_charts`)
  - 12.2.2 直方图 (`subsection`, `histogram`)
  - 12.2.3 趋势图 (`subsection`, `trend_chart`)

### 8年级 (Grade 8)

#### 8年级上学期 (Semester 1)

##### 第十三章 三角形
- **node_type**: `chapter`
- **title**: `第十三章 三角形`
- **key**: `triangles`
- **path**: `/cn/gb/math/grade8/semester1/triangles`
- **order_index**: 13

**子节点：**
- 13.1 三角形的概念 (`section`, `triangle_concept`)
- 13.2 与三角形有关的线段 (`section`, `triangle_segments`)
- 13.3 三角形的内角与外角 (`section`, `triangle_angles`)

##### 第十四章 全等三角形
- **node_type**: `chapter`
- **title**: `第十四章 全等三角形`
- **key**: `congruent_triangles`
- **path**: `/cn/gb/math/grade8/semester1/congruent_triangles`
- **order_index**: 14

**子节点：**
- 14.1 全等三角形及其性质 (`section`, `congruent_triangles_properties`)
- 14.2 三角形全等的判定 (`section`, `triangle_congruence_criteria`)
- 14.3 角的平分线 (`section`, `angle_bisector`)

##### 第十五章 轴对称
- **node_type**: `chapter`
- **title**: `第十五章 轴对称`
- **key**: `axial_symmetry`
- **path**: `/cn/gb/math/grade8/semester1/axial_symmetry`
- **order_index**: 15

**子节点：**
- 15.1 图形的轴对称 (`section`, `axial_symmetry`)
- 15.2 画轴对称的图形 (`section`, `draw_axial_symmetric_shapes`)
- 15.3 等腰三角形 (`section`, `isosceles_triangle`)

##### 第十六章 整式的乘法
- **node_type**: `chapter`
- **title**: `第十六章 整式的乘法`
- **key**: `polynomial_multiplication`
- **path**: `/cn/gb/math/grade8/semester1/polynomial_multiplication`
- **order_index**: 16

**子节点：**
- 16.1 幂的运算 (`section`, `power_operations`)
- 16.2 整式的乘法 (`section`, `polynomial_multiplication`)
- 16.3 乘法公式 (`section`, `multiplication_formulas`)

#### 8年级下学期 (Semester 2)

##### 第十七章 二次根式
- **node_type**: `chapter`
- **title**: `第十七章 二次根式`
- **key**: `quadratic_radicals`
- **path**: `/cn/gb/math/grade8/semester2/quadratic_radicals`
- **order_index**: 17

**子节点：**
- 17.1 二次根式 (`section`, `quadratic_radicals`)
- 17.2 二次根式的乘除 (`section`, `quadratic_radicals_multiplication_division`)
  - 二次根式的乘法 (`subsection`, `quadratic_radicals_multiplication`)
  - 二次根式的除法 (`subsection`, `quadratic_radicals_division`)
- 17.3 二次根式的加减 (`section`, `quadratic_radicals_addition_subtraction`)
  - 二次根式的加减运算 (`subsection`, `quadratic_radicals_addition_subtraction`)

##### 第十八章 勾股定理
- **node_type**: `chapter`
- **title**: `第十八章 勾股定理`
- **key**: `pythagorean_theorem`
- **path**: `/cn/gb/math/grade8/semester2/pythagorean_theorem`
- **order_index**: 18

**子节点：**
- 18.1 勾股定理 (`section`, `pythagorean_theorem`)
  - 18.1.1 勾股定理 (`subsection`, `pythagorean_theorem`)
  - 18.1.2 勾股定理应用 (`subsection`, `pythagorean_theorem_applications`)
- 18.2 勾股定理的逆定理 (`section`, `pythagorean_theorem_converse`)
  - 原（逆）命题、原（逆）定理 (`subsection`, `proposition_theorem_converse`)
  - 勾股定理的逆定理 (`subsection`, `pythagorean_theorem_converse`)
  - 勾股定理及其逆定理的综合应用 (`subsection`, `pythagorean_theorem_comprehensive`)

##### 第十九章 平行四边形
- **node_type**: `chapter`
- **title**: `第十九章 平行四边形`
- **key**: `parallelograms`
- **path**: `/cn/gb/math/grade8/semester2/parallelograms`
- **order_index**: 19

**子节点：**
- 19.1 平行四边形 (`section`, `parallelograms`)
  - 19.1.1 平行四边形的性质 (`subsection`, `parallelogram_properties`)
  - 19.1.2 平行四边形的判定 (`subsection`, `parallelogram_judgment`)
  - 19.1.3 平行四边形的判定应用 (`subsection`, `parallelogram_judgment_applications`)
- 19.2 特殊的平行四边形 (`section`, `special_parallelograms`)
  - 19.2.1 矩形 (`subsection`, `rectangle`)
  - 19.2.2 菱形 (`subsection`, `rhombus`)
  - 19.2.3 正方形 (`subsection`, `square`)

##### 第二十章 一次函数
- **node_type**: `chapter`
- **title**: `第二十章 一次函数`
- **key**: `linear_functions`
- **path**: `/cn/gb/math/grade8/semester2/linear_functions`
- **order_index**: 20

**子节点：**
- 20.1 函数 (`section`, `functions`)
  - 20.1.1 变量与函数 (`subsection`, `variables_functions`)
  - 20.1.2 函数的图象 (`subsection`, `function_graphs`)
- 20.2 一次函数 (`section`, `linear_functions`)
  - 20.2.1 正比例函数 (`subsection`, `direct_proportion`)
    - 正比例函数 (`topic`, `topic_direct_proportion_function`)
    - 正比例函数图象及性质 (`topic`, `topic_direct_proportion_graph_properties`)
  - 20.2.2 一次函数 (`subsection`, `linear_functions`)
    - 一次函数的概念 (`topic`, `topic_linear_function_concept`)
    - 一次函数的图象与性质 (`topic`, `topic_linear_function_graph_properties`)
    - 待定系数法求一次函数的解析式 (`topic`, `topic_linear_function_undetermined_coefficients`)
  - 20.2.3 一次函数与方程、不等式 (`subsection`, `linear_function_equations_inequalities`)
    - 一次函数与一元一次方程 (`topic`, `topic_linear_function_linear_equation`)
    - 一次函数与一元一次不等式 (`topic`, `topic_linear_function_linear_inequality`)
    - 一次函数与二元一次方程组 (`topic`, `topic_linear_function_system_equations`)
- 20.3 课题学习——选择方案 (`section`, `project_learning_choose_solution`)

##### 第二十一章 数据的分析
- **node_type**: `chapter`
- **title**: `第二十一章 数据的分析`
- **key**: `data_analysis`
- **path**: `/cn/gb/math/grade8/semester2/data_analysis`
- **order_index**: 21

**子节点：**
- 21.1 数据的集中趋势 (`section`, `central_tendency`)
  - 21.1.1 平均数 (`subsection`, `mean`)
  - 21.1.2 中位数和众数 (`subsection`, `median_mode`)
- 21.2 数据的波动程度 (`section`, `data_variability`)
  - 方差 (`subsection`, `variance`)
- 21.3 课题学习 体质健康测试中的数据分析 (`section`, `project_learning_health_data_analysis`)

### 9年级 (Grade 9)

#### 9年级上学期 (Semester 1)

##### 第二十二章 一元二次方程
- **node_type**: `chapter`
- **title**: `第二十二章 一元二次方程`
- **key**: `quadratic_equations_one_variable`
- **path**: `/cn/gb/math/grade9/semester1/quadratic_equations_one_variable`
- **order_index**: 22

**子节点：**
- 22.1 一元二次方程 (`section`, `quadratic_equations`)
- 22.2 解一元二次方程 (`section`, `solve_quadratic_equations`)
  - 22.2.1 配方法 (`subsection`, `completing_square`)
  - 22.2.2 公式法 (`subsection`, `quadratic_formula`)
  - 22.2.3 因式分解法 (`subsection`, `factoring`)
  - *22.2.4 一元二次方程的根与系数的关系 (`subsection`, `quadratic_roots_coefficients_relation`, **可选**)
- 22.3 实际问题与一元二次方程 (`section`, `word_problems_quadratic_equations`)

##### 第二十三章 二次函数
- **node_type**: `chapter`
- **title**: `第二十三章 二次函数`
- **key**: `quadratic_functions`
- **path**: `/cn/gb/math/grade9/semester1/quadratic_functions`
- **order_index**: 23

**子节点：**
- 23.1 二次函数的图象和性质 (`section`, `quadratic_function_graphs_properties`)
  - 23.1.1 二次函数 (`subsection`, `quadratic_functions`)
  - 23.1.2 二次函数y=ax² 的图象和性质 (`subsection`, `quadratic_ax_squared`)
  - 23.1.3 二次函数y=a(x-h)² + k的图象和性质 (`subsection`, `quadratic_vertex_form`)
  - 23.1.4 二次函数y=ax²+bx+c的图象和性质 (`subsection`, `quadratic_standard_form`)
- 23.2 二次函数与一元二次方程 (`section`, `quadratic_function_quadratic_equation`)
- 23.3 实际问题与二次函数 (`section`, `word_problems_quadratic_functions`)

##### 第二十四章 旋转
- **node_type**: `chapter`
- **title**: `第二十四章 旋转`
- **key**: `rotation`
- **path**: `/cn/gb/math/grade9/semester1/rotation`
- **order_index**: 24

**子节点：**
- 24.1 图形的旋转 (`section`, `graph_rotation`)
- 24.2 中心对称 (`section`, `central_symmetry`)
  - 24.2.1 中心对称 (`subsection`, `central_symmetry`)
  - 24.2.2 中心对称图形 (`subsection`, `central_symmetric_shapes`)
  - 24.2.3 关于原点对称的点的坐标 (`subsection`, `origin_symmetric_coordinates`)
- 24.3 课题学习 图案设计 (`section`, `project_learning_pattern_design`)

##### 第二十五章 圆
- **node_type**: `chapter`
- **title**: `第二十五章 圆`
- **key**: `circles`
- **path**: `/cn/gb/math/grade9/semester1/circles`
- **order_index**: 25

**子节点：**
- 25.1 圆的有关性质 (`section`, `circle_properties`)
  - 25.1.1 圆 (`subsection`, `circle`)
  - 25.1.2 垂直于弦的直径 (`subsection`, `perpendicular_chord_diameter`)
  - 25.1.3 弧、弦、圆心角 (`subsection`, `arc_chord_central_angle`)
  - 25.1.4 圆周角 (`subsection`, `inscribed_angle`)
- 25.2 点和圆、直线和圆的位置关系 (`section`, `point_line_circle_positions`)
  - 25.2.1 点和圆的位置关系 (`subsection`, `point_circle_position`)
  - 25.2.2 直线和圆的位置关系 (`subsection`, `line_circle_position`)
- 25.3 正多边形和圆 (`section`, `regular_polygons_circle`)
- 25.4 弧长和扇形面积 (`section`, `arc_length_sector_area`)
  - 探究圆的弧长、扇形面积公式 (`subsection`, `arc_length_sector_area_formulas`)
  - 计算圆锥的侧面积和全面积 (`subsection`, `cone_surface_area`)

##### 第二十六章 概率初步
- **node_type**: `chapter`
- **title**: `第二十六章 概率初步`
- **key**: `probability_intro`
- **path**: `/cn/gb/math/grade9/semester1/probability_intro`
- **order_index**: 26

**子节点：**
- 26.1 随机事件与概率 (`section`, `random_events_probability`)
  - 26.1.1 随机事件 (`subsection`, `random_events`)
  - 26.1.2 概率 (`subsection`, `probability`)
- 26.2 用列举法求概率 (`section`, `listing_method_probability`)
  - 用列表法求概率 (`subsection`, `table_method_probability`)
  - 画树状图求概率 (`subsection`, `tree_diagram_probability`)
  - 日常生活中的概率问题 (`subsection`, `daily_life_probability`)
- 26.3 用频率估计概率 (`section`, `frequency_estimate_probability`)

#### 9年级下学期 (Semester 2)

##### 第二十七章 反比例函数
- **node_type**: `chapter`
- **title**: `第二十七章 反比例函数`
- **key**: `inverse_proportion_functions`
- **path**: `/cn/gb/math/grade9/semester2/inverse_proportion_functions`
- **order_index**: 27

**子节点：**
- 27.1 反比例函数 (`section`, `inverse_proportion_functions`)
  - 27.1.1 反比例函数 (`subsection`, `inverse_proportion_function`)
  - 27.1.2 反比例函数的图象和性质 (`subsection`, `inverse_proportion_graph_properties`)
- 27.2 实际问题与反比例函数 (`section`, `word_problems_inverse_proportion`)
  - 反比例函数在实际中的应用 (`subsection`, `inverse_proportion_practical_applications`)
  - 反比函数在物理学中的应用 (`subsection`, `inverse_proportion_physics_applications`)

##### 第二十八章 相似
- **node_type**: `chapter`
- **title**: `第二十八章 相似`
- **key**: `similarity`
- **path**: `/cn/gb/math/grade9/semester2/similarity`
- **order_index**: 28

**子节点：**
- 28.1 图形的相似 (`section`, `similar_shapes`)
- 28.2 相似三角形 (`section`, `similar_triangles`)
  - 28.2.1 相似三角形的判定 (`subsection`, `similar_triangle_judgment`)
  - 28.2.2 相似三角形的性质 (`subsection`, `similar_triangle_properties`)
  - 28.2.3 相似三角形应用举例 (`subsection`, `similar_triangle_applications`)
- 28.3 位似 (`section`, `homothetic`)
  - 位似图形概念 (`subsection`, `homothetic_concept`)
  - 两个位似图形坐标之间的关系 (`subsection`, `homothetic_coordinates`)
  - 在平面直角坐标系中画位似图形 (`subsection`, `draw_homothetic_shapes`)

##### 第二十九章 锐角三角函数
- **node_type**: `chapter`
- **title**: `第二十九章 锐角三角函数`
- **key**: `acute_angle_trigonometry`
- **path**: `/cn/gb/math/grade9/semester2/acute_angle_trigonometry`
- **order_index**: 29

**子节点：**
- 29.1 锐角三角函数 (`section`, `acute_angle_trigonometry`)
  - 29.1.1 锐角的正弦 (`subsection`, `sine`)
  - 29.1.2 锐角的余弦、正切 (`subsection`, `cosine_tangent`)
  - 29.1.3 求锐角三角函数值 (`subsection`, `calculate_trigonometric_values`)
- 29.2 解直角三角形及其应用 (`section`, `solve_right_triangles_applications`)
  - 29.2.1 解直角三角形 (`subsection`, `solve_right_triangles`)
  - 29.2.2 应用举例 (`subsection`, `application_examples`)

##### 第三十章 投影与视图
- **node_type**: `chapter`
- **title**: `第三十章 投影与视图`
- **key**: `projection_views`
- **path**: `/cn/gb/math/grade9/semester2/projection_views`
- **order_index**: 30

**子节点：**
- 30.1 投影 (`section`, `projection`)
- 30.2 三视图 (`section`, `three_views`)
  - 三视图及其画法 (`subsection`, `three_views_drawing`)
  - 例5立体图形、展开图、三视图 (`subsection`, `example5_3d_expansion_views`)
- 30.3 课题学习 制作立体模型 (`section`, `project_learning_3d_model`)

### 专题复习 (Topic Review)

#### 专题复习节点
- **node_type**: `exam_scope`
- **title**: `专题复习`
- **key**: `topic_review`
- **path**: `/cn/gb/math/grade9/semester2/topic_review`
- **parent_id**: (9年级下学期节点ID)
- **order_index**: 100

**子节点（所有专题复习项）：**

1. 各类函数解析式中参数的作用 (`topic`, `topic_function_parameters_role`)
2. 二次函数专题 (`topic`, `topic_quadratic_function_review`)
3. 函数学习经验专题复习 (`topic`, `topic_function_learning_experience`)
4. 构造全等解决几何综合题 (`topic`, `topic_construct_congruent_geometric_problems`)
5. 几何综合题专题 (`topic`, `topic_geometric_comprehensive_problems`)
6. 分式方程 (`topic`, `topic_rational_equations`)
7. 不等式与不等式组 (`topic`, `topic_inequalities_systems`)
8. 函数及其图象 (`topic`, `topic_functions_graphs`)
9. 一次函数 (`topic`, `topic_linear_functions_review`)
10. 二次函数 (`topic`, `topic_quadratic_functions_review`)
11. 反比例函数 (`topic`, `topic_inverse_proportion_functions_review`)
12. 等腰三角形 (`topic`, `topic_isosceles_triangles`)
13. 全等三角形 (`topic`, `topic_congruent_triangles_review`)
14. 多边形及平行四边形 (`topic`, `topic_polygons_parallelograms`)
15. 矩形、菱形、正方形 (`topic`, `topic_rectangle_rhombus_square`)
16. 相似 (`topic`, `topic_similarity_review`)
17. 锐角三角函数 (`topic`, `topic_acute_angle_trigonometry_review`)
18. 圆的概念与性质 (`topic`, `topic_circle_concept_properties`)
19. 与圆有关的位置关系 (`topic`, `topic_circle_position_relations`)
20. 统计复习 (`topic`, `topic_statistics_review`)
21. 概率复习 (`topic`, `topic_probability_review`)
22. 与圆有关的计算 (`topic`, `topic_circle_calculations`)
23. 一元二次方程 (`topic`, `topic_quadratic_equations_review`)
24. 图形变化：平移 (`topic`, `topic_transformation_translation`)
25. 图形变化：轴对称 (`topic`, `topic_transformation_axial_symmetry`)
26. 图形变化：旋转 (`topic`, `topic_transformation_rotation`)
27. 尺规作图 (`topic`, `topic_compass_straightedge_construction`)
28. 巧用中点 (`topic`, `topic_midpoint_techniques`)
29. 与四边形有关的证明和计算 (`topic`, `topic_quadrilateral_proof_calculation`)
30. 解直角三角形综合问题 (`topic`, `topic_right_triangle_comprehensive_problems`)
31. 一次函数与反比例函数综合题 (`topic`, `topic_linear_inverse_proportion_comprehensive`)
32. 用数学模型解决实际问题 (`topic`, `topic_mathematical_modeling`)
33. 再看圆的定义 (`topic`, `topic_circle_definition_review`)
34. 圆中求线段长度的常用方法 (`topic`, `topic_circle_segment_length_methods`)
35. 创新作图 (`topic`, `topic_innovative_construction`)
36. 数学方法之观察与实验法 (`topic`, `topic_math_method_observation_experiment`)
37. 数学方法之归纳与类比法 (`topic`, `topic_math_method_induction_analogy`)
38. 数学方法之猜想与推理法 (`topic`, `topic_math_method_conjecture_reasoning`)
39. 数学方法应用——选择题 (`topic`, `topic_math_method_application_multiple_choice`)
40. 数学方法应用——填空题 (`topic`, `topic_math_method_application_fill_blank`)

---

## 不适合作为 Content Node 的内容

以下内容**不应**作为独立的 content_node，应作为 metadata 或关联内容：

1. **"小结"** - 章节总结，存储在章节节点的 metadata 中
2. **"阅读与思考"** - 阅读材料，存储在对应章节的 metadata 中
3. **"数学活动"** - 活动内容，存储在对应章节的 metadata 中
4. **"复习题"** - 练习题，存储在对应章节的 metadata 中
5. **"构建知识体系"** - 复习内容，存储在对应章节的 metadata 中
6. **"习题训练"** - 练习内容，存储在对应章节的 metadata 中
7. **"信息技术应用"** - 应用内容，存储在对应章节的 metadata 中
8. **"实验与探究"** - 实验内容，存储在对应章节的 metadata 中

---

## 数据导入指南

### 1. 导入顺序

必须按照以下顺序导入，确保父节点先于子节点创建：

1. **年级节点**（grade）
2. **学期节点**（semester）
3. **章节节点**（chapter）
4. **节节点**（section）
5. **小节节点**（subsection）
6. **知识点节点**（topic，可选）
7. **专题复习节点**（exam_scope）

### 2. Key 命名规范

- ✅ 使用英文小写
- ✅ 单词间用下划线分隔
- ✅ **不包含章节编号**（章节编号在不同语言/国家可能不同）
- ✅ 使用内容描述性名称，如 `rational_numbers` 而不是 `chapter1_rational_numbers`
- ✅ 保持简洁但具有描述性
- ✅ 同一层级内唯一

### 3. Path 构建规则

- 格式：`/cn/gb/math/{grade}/{semester}/{chapter_key}/{section_key}/{subsection_key}`
- 使用 key 构建 path，不使用 title
- 通过拼接父节点的 path 和当前节点的 key 构建
- 保持路径唯一性
- **不包含章节编号**

### 4. Order Index 规则

- `order_index` 是同一层级内的兄弟节点索引
- 所有章节中，第一章 order_index=1，第二章 order_index=2，以此类推
- 同一章节内的节，按顺序编号：1, 2, 3...
- 专题复习节点的 order_index 设置为 100（确保在所有章节之后）

### 5. Metadata 建议

对于每个节点，可以在 metadata 中存储：

```json
{
  "learning_objectives": ["目标1", "目标2"],
  "estimated_duration": 45,
  "difficulty_level": "medium",
  "prerequisites": ["前置知识点key"],
  "related_exercises": ["练习题ID"],
  "reading_materials": ["阅读材料"],
  "math_activities": ["活动内容"],
  "summary": "章节小结内容",
  "review_questions": ["复习题"],
  "info_tech_applications": ["信息技术应用"],
  "experiments": ["实验与探究"]
}
```

### 6. 数据导入脚本示例

```javascript
// 伪代码示例
async function importNodes() {
  // 1. 导入年级节点
  const grade7 = await createNode({
    node_type: 'grade',
    title: '7年级',
    key: 'grade_7',
    path: '/cn/gb/math/grade7',
    country_code: 'CN',
    curriculum_system: '人教版',
    language_code: 'zh-CN',
    order_index: 1
  });

  // 2. 导入学期节点
  const semester1 = await createNode({
    node_type: 'semester',
    title: '上学期',
    key: 'semester_1',
    path: '/cn/gb/math/grade7/semester1',
    parent_id: grade7.id,
    order_index: 1
  });

  // 3. 导入章节节点
  const chapter1 = await createNode({
    node_type: 'chapter',
    title: '第一章 有理数',
    key: 'rational_numbers',
    path: '/cn/gb/math/grade7/semester1/rational_numbers',
    parent_id: semester1.id,
    order_index: 1
  });

  // 4. 导入节节点
  const section1_1 = await createNode({
    node_type: 'section',
    title: '1.1 正数和负数',
    key: 'positive_negative_numbers',
    path: '/cn/gb/math/grade7/semester1/rational_numbers/positive_negative_numbers',
    parent_id: chapter1.id,
    order_index: 1
  });

  // ... 继续导入其他节点
}
```

---

## 节点统计

### 按类型统计

- **grade 节点**: 3个（7、8、9年级）
- **semester 节点**: 6个（每个年级2个学期）
- **chapter 节点**: 30个
- **section 节点**: 约120+个
- **subsection 节点**: 约200+个
- **topic 节点**: 约50+个（专题复习和部分详细知识点）
- **exam_scope 节点**: 1个（专题复习）

**总计**: 约410+个节点

---

## 注意事项

### 1. 章节编号规则

- **8年级下学期从第十七章开始**（二次根式），后续所有章节编号依次后移
- 所有章节的 `order_index` 应该与章节编号对应（第一章=1，第二章=2，...，第三十章=30）

### 2. 可选内容

- 标记为 `*` 的内容（如 `*10.4 三元一次方程组的解法`、`*22.2.4 一元二次方程的根与系数的关系`）可以作为可选的子节点
- 导入时可以根据实际需求决定是否包含这些可选节点

### 3. 专题复习

- 专题复习部分适合作为 `exam_scope` 类型的节点
- 所有专题复习项作为 `topic` 类型的子节点
- `order_index` 设置为 100，确保在所有章节之后显示

### 4. 多语言支持

- 当前大纲是中文，如需支持多语言，需要为每个节点提供多语言标题
- `key` 和 `path` 保持英文，不随语言变化
- `title` 可以根据 `language_code` 提供不同语言的版本

### 5. 数据完整性

- 确保所有节点的 `parent_id` 正确指向父节点
- 确保所有节点的 `path` 正确构建（通过父节点 path + 当前节点 key）
- 确保同一层级内的 `order_index` 唯一且连续

### 6. 性能优化

- 导入大量节点时，建议使用批量插入
- 可以考虑使用事务确保数据一致性
- 导入后验证所有节点的层级关系是否正确

---

## 开发检查清单

在导入数据前，请确认：

- [ ] 所有节点的 `key` 不包含章节编号
- [ ] 所有节点的 `path` 使用 key 构建，不包含章节编号
- [ ] 所有节点的 `order_index` 在同一层级内唯一且连续
- [ ] 所有节点的 `parent_id` 正确指向父节点
- [ ] 章节编号从 1 到 30 连续（8年级下学期从第17章开始）
- [ ] 专题复习节点的 `order_index` 设置为 100
- [ ] 所有节点的通用配置（country_code, curriculum_system, language_code, visibility）正确设置
- [ ] 可选内容（标记为 `*`）已根据需求决定是否导入

---

## 参考文档

- `DATABASE_SETUP.md` - 数据库表结构定义
- `Math_Curriculum.md` - 原始数学课程大纲

