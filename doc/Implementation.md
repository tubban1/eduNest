[MODE: PLAN]

基于小规模测试的成功结果，我将开始重构content页面。现在制定详细的实施计划。

## **重构计划详细规格**

### **目标**
将`MyContentList`和`CollectionTree`从普通函数重构为正确的React组件，修复Hook使用错误，确保i18n功能正常工作。

### **重构策略**
1. 将函数组件改为React函数组件
2. 正确使用React Hooks
3. 保持现有功能和样式
4. 确保i18n翻译正常工作

## **IMPLEMENTATION CHECKLIST**

1. **重构MyContentList函数**
   - 将`function MyContentList`改为`const MyContentList: React.FC`
   - 添加正确的TypeScript类型定义
   - 确保`useTranslation`在组件顶部正确使用
   - 修复语法错误（第16行的换行问题）

2. **重构CollectionTree函数**
   - 将`function CollectionTree`改为`const CollectionTree: React.FC`
   - 添加正确的TypeScript类型定义
   - 确保`useTranslation`在组件顶部正确使用
   - 修复语法错误（第71行的换行问题）

3. **修复语法错误**
   - 修复第16行：`const { t } = useTranslation();  const [loading, setLoading] = useState(true);`
   - 修复第71行：`const { t } = useTranslation();  const [collections, setCollections] = useState<UserCollection[]>([]);`
   - 确保每个Hook调用都在单独的行上

4. **验证组件结构**
   - 确保所有组件都正确导出
   - 验证Props类型定义
   - 检查组件间的依赖关系

5. **测试重构结果**
   - 构建项目验证语法正确性
   - 检查是否还有Hook使用错误
   - 验证i18n功能是否正常工作

6. **清理测试文件**
   - 删除测试组件和测试页面
   - 恢复项目到生产状态

这个计划将确保重构后的代码完全符合React Hooks规则，同时保持所有现有功能。每个步骤都是原子性的，可以独立验证。

您是否同意这个重构计划？如果同意，我将开始执行重构。