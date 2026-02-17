/**
 * TeachingSnapshot Builder
 * 
 * 生成「老师此刻站在学生旁边能感知到的一切」的快照
 * 供 AI Guide 和 Realtime 使用，提供当前步骤、学习目标、学生状态、教学约束等上下文
 * 
 * 参考：edu/doc/RUNTIME_TEACHING_LAYER.md
 */

/**
 * 构建 TeachingSnapshot
 * 
 * @param {Object} params
 * @param {Object} params.meta - metadata_json.canonical（固定 schema：topic, language, stages, learning_objectives 等）
 * @param {Object|null} params.currentStage - { stageId: string, stageIndex: number } | null
 * @param {Object|null} params.uiState - Record<string, unknown> | null（来自 getUIState）
 * @returns {Object} TeachingSnapshot
 */
function buildTeachingSnapshot({ meta, currentStage, uiState }) {
  const stages = meta?.stages || [];
  // 从 meta.stages 中找到当前阶段的信息（先按 index 匹配，再按数组位置回退）
  let stageFromMeta = null;
  if (currentStage?.stageIndex && stages.length > 0) {
    stageFromMeta = stages.find(s => s.index === currentStage.stageIndex);
    if (!stageFromMeta && currentStage.stageIndex >= 1 && currentStage.stageIndex <= stages.length) {
      stageFromMeta = stages[currentStage.stageIndex - 1] || null;
    }
  }

  // 推断当前学习目标
  const learningGoalNow = inferLearningGoal(currentStage, stageFromMeta, meta);

  // 构建 current_stage 对象（currentStage 已由调用方规范为 { stageIndex, stageId }）
  const stageIndex = currentStage?.stageIndex;
  const stageId = currentStage?.stageId;
  const currentStageObj = currentStage ? {
    index: stageIndex,
    title: stageFromMeta?.title || (stageId != null && String(stageId).trim() !== '') ? String(stageId) : (stageIndex != null ? `阶段 ${stageIndex}` : '当前阶段'),
    visible_expression: uiState?.visibleExpression || 
                       uiState?.formula || 
                       stageFromMeta?.formula || 
                       null,
    key_rule: stageFromMeta?.key_concept || 
              stageFromMeta?.keyConcept || 
              uiState?.keyRule || 
              null,
  } : null;

  // 从 uiState 提取学生状态信号
  const studentState = {
    has_interacted: uiState?.hasInteracted ?? 
                    uiState?.has_interacted ?? 
                    (uiState?.sqrt3Value !== undefined || Object.keys(uiState || {}).length > 0),
    time_on_step_sec: uiState?.timeOnStepSec ?? 
                      uiState?.time_on_step_sec ?? 
                      0,
    requested_hint: uiState?.requestedHint ?? 
                    uiState?.requested_hint ?? 
                    false,
    made_error: uiState?.madeError ?? 
                uiState?.made_error ?? 
                false,
  };

  // 教学约束（固定）
  const constraints = {
    no_final_answer: true,
    ask_questions_only: true,
  };

  const topic = meta?.topic || '当前内容';
  const snapshot = {
    role: 'ai_learning_guide',
    topic,
    language: meta?.language || 'zh-CN',
    current_stage: currentStageObj,
    learning_goal_now: learningGoalNow,
    student_state: studentState,
    constraints: constraints,
  };
  if (Array.isArray(meta?.learning_objectives) && meta.learning_objectives.length > 0) {
    snapshot.learning_objectives = meta.learning_objectives;
  }
  if (stages.length > 0) {
    snapshot.stages_summary = stages.map(s => ({
      index: s.index,
      title: s.title || s.name,
      key_concept: s.key_concept || s.keyConcept
    })).filter(s => s.title || s.key_concept);
  }
  // 单行「当前题目」摘要，供 Realtime 模型优先看到、不可说「看不到题目」
  snapshot.current_problem = buildCurrentProblemSummary({ topic, currentStageObj, learningGoalNow });
  return snapshot;
}

/**
 * 生成一句「当前题目」描述，确保模型明确知道学生在看什么
 */
function buildCurrentProblemSummary({ topic, currentStageObj, learningGoalNow }) {
  const parts = [`主题：${topic}`];
  if (currentStageObj) {
    parts.push(`当前步骤：第 ${currentStageObj.index} 步 - ${currentStageObj.title || '未命名'}`);
    if (currentStageObj.visible_expression) {
      parts.push(`可见式子/题目：${currentStageObj.visible_expression}`);
    }
    if (currentStageObj.key_rule) {
      parts.push(`本步关键：${currentStageObj.key_rule}`);
    }
  }
  if (learningGoalNow) {
    parts.push(`本步目标：${learningGoalNow}`);
  }
  return parts.join('；') || '当前学习内容（见下方 topic 与 current_stage）';
}

/**
 * 推断当前学习目标
 * 
 * @param {Object|null} currentStage 
 * @param {Object|null} stageFromMeta 
 * @param {Object} meta 
 * @returns {string}
 */
function inferLearningGoal(currentStage, stageFromMeta, meta) {
  // 优先使用 stageFromMeta 的 description
  if (stageFromMeta?.description) {
    return stageFromMeta.description;
  }

  // 其次使用 stageFromMeta 的 key_concept
  if (stageFromMeta?.key_concept) {
    return `理解并应用：${stageFromMeta.key_concept}`;
  }

  // 再次使用 stageFromMeta 的 title
  if (stageFromMeta?.title) {
    return `完成：${stageFromMeta.title}`;
  }

  // 如果 currentStage 有 stageId，尝试从 learning_objectives 匹配
  if (currentStage?.stageId && meta?.learning_objectives) {
    // 简单匹配：如果 stageId 包含数字，尝试匹配对应的 learning_objectives 索引
    const stageNum = parseInt(currentStage.stageId.match(/\d+/)?.[0] || '0');
    if (stageNum > 0 && meta.learning_objectives[stageNum - 1]) {
      return meta.learning_objectives[stageNum - 1];
    }
  }

  // 默认值
  return currentStage 
    ? `理解当前步骤（阶段 ${currentStage.stageIndex}）`
    : '理解当前内容';
}

module.exports = {
  buildTeachingSnapshot,
  inferLearningGoal,
};
