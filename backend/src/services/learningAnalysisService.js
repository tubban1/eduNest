/**
 * 学习分析报表服务
 * 基于 ai_messages.metadata (ui_state, teaching_snapshot) 与 ai_usage_logs.request_payload 生成报表
 * 对齐：Interactive_Learning.md、Learning_Analysis_Report_Example.md
 *
 * ========== 报表是如何生成的 ==========
 * 1. 按时间范围查出该用户的「AI Guide 会话」 (ai_conversations, entry_point='ai_guide')
 * 2. 查出这些会话下的「所有消息」 (ai_messages)，每条消息的 metadata 里可能有 teaching_snapshot
 * 3. 查出该时间范围内「AI Guide 调用日志」 (ai_usage_logs, action_type='ai_guide')，request_payload 里可能有 teaching_snapshot
 * 4. buildReportPayload() 把上述数据聚合成报表：
 *    - 从 messages 的 metadata.teaching_snapshot / metadata.teachingSnapshot 提取：topic、current_stage、learning_goal_now
 *    - 从 usageLogs 的 request_payload.teaching_snapshot / teachingSnapshot 同样提取并合并
 *    - 按 content_id 汇总：每个内容的话题、用到的阶段、各阶段消息数、样本 snapshot
 * 5. 得到 report_data：summary（会话数/消息数/请求数）、ai_guide_usage（按内容的统计）、data_sources、recommendations
 * 6. 写入 learning_analysis_reports 表（upsert，同一用户+类型+周期只保留一份）
 */
const { supabase } = require('./database');

/**
 * 生成学习分析报告（基于 AI Guide 对话与记录的 ui_state / teaching_snapshot）
 * @param {string} userId - 用户 UUID
 * @param {string} reportType - weekly | monthly | semester | custom
 * @param {string} periodStart - ISO 日期时间
 * @param {string} periodEnd - ISO 日期时间
 * @returns {Promise<{ id, report_data }>}
 */
async function generateLearningReport(userId, reportType, periodStart, periodEnd) {
  const start = new Date(periodStart).toISOString();
  const end = new Date(periodEnd).toISOString();

  // 1. 该周期内的 AI Guide 会话
  const { data: conversations, error: convError } = await supabase
    .from('ai_conversations')
    .select('id, content_id, created_at, updated_at')
    .eq('user_id', userId)
    .eq('entry_point', 'ai_guide')
    .gte('created_at', start)
    .lte('created_at', end);

  if (convError) throw new Error('查询会话失败: ' + convError.message);
  const convIds = (conversations || []).map((c) => c.id);
  if (convIds.length === 0) {
    const emptyReport = buildReportPayload(reportType, start, end, [], [], []);
    const saved = await saveReport(userId, reportType, start, end, emptyReport);
    return { id: saved.id, report_data: emptyReport };
  }

  // 2. 这些会话下的消息（含 metadata）
  const { data: messages, error: msgError } = await supabase
    .from('ai_messages')
    .select('id, conversation_id, role, content, ui_state, metadata, created_at')
    .in('conversation_id', convIds)
    .order('created_at', { ascending: true });

  if (msgError) throw new Error('查询消息失败: ' + msgError.message);

  // 3. ai_usage_logs 中 action_type=ai_guide 且在该周期内的记录
  const { data: usageLogs, error: logError } = await supabase
    .from('ai_usage_logs')
    .select('id, content_id, user_query, request_payload, created_at')
    .eq('user_id', userId)
    .eq('action_type', 'ai_guide')
    .gte('created_at', start)
    .lte('created_at', end)
    .order('created_at', { ascending: true });

  if (logError) throw new Error('查询使用日志失败: ' + logError.message);

  const reportData = buildReportPayload(
    reportType,
    start,
    end,
    conversations || [],
    messages || [],
    usageLogs || []
  );

  const saved = await saveReport(userId, reportType, start, end, reportData);
  return { id: saved.id, report_data: reportData };
}

function buildReportPayload(reportType, periodStart, periodEnd, conversations, messages, usageLogs) {
  const byContent = new Map();

  const addSnapshot = (contentId, snapshot) => {
    if (!contentId || !snapshot) return;
    let rec = byContent.get(contentId);
    if (!rec) {
      rec = {
        content_id: contentId,
        topic: snapshot.topic || null,
        stages_used: [],
        stage_message_count: {},
        message_count: 0,
        sample_snapshots: [],
      };
      byContent.set(contentId, rec);
    }
    rec.message_count += 1;
    if (snapshot.current_stage?.index) {
      const key = `${snapshot.current_stage.index}:${snapshot.current_stage.title || ''}`;
      rec.stage_message_count[key] = (rec.stage_message_count[key] || 0) + 1;
      if (!rec.stages_used.find((s) => s.index === snapshot.current_stage.index)) {
        rec.stages_used.push({
          index: snapshot.current_stage.index,
          title: snapshot.current_stage.title || null,
        });
        rec.stages_used.sort((a, b) => a.index - b.index);
      }
    }
    if (rec.sample_snapshots.length < 3) {
      rec.sample_snapshots.push({
        learning_goal_now: snapshot.learning_goal_now,
        current_stage: snapshot.current_stage,
      });
    }
  };

  for (const msg of messages) {
    const meta = msg.metadata || {};
    const snap = meta.teaching_snapshot || meta.teachingSnapshot;
    const conv = conversations.find((c) => c.id === msg.conversation_id);
    const contentId = conv?.content_id || null;
    if (snap) addSnapshot(contentId, snap);
  }

  for (const log of usageLogs) {
    const payload = log.request_payload || {};
    const snap = payload.teaching_snapshot || payload.teachingSnapshot;
    if (snap) addSnapshot(log.content_id || null, snap);
  }

  const summary = {
    total_conversations: conversations.length,
    total_messages: messages.length,
    total_ai_guide_requests: usageLogs.length,
    contents_count: byContent.size,
  };

  const ai_guide_usage = Array.from(byContent.values()).map((rec) => ({
    content_id: rec.content_id,
    topic: rec.topic,
    stages_used: rec.stages_used,
    stage_message_count: rec.stage_message_count,
    message_count: rec.message_count,
    sample_teaching_snapshots: rec.sample_snapshots,
  }));

  return {
    report_type: reportType,
    period: { start: periodStart, end: periodEnd },
    generated_at: new Date().toISOString(),
    summary,
    ai_guide_usage,
    data_sources: 'ai_messages.metadata (ui_state, teaching_snapshot), ai_usage_logs.request_payload',
    recommendations: [],
  };
}

async function saveReport(userId, reportType, periodStart, periodEnd, reportData) {
  const { data, error } = await supabase
    .from('learning_analysis_reports')
    .upsert(
      {
        user_id: userId,
        report_type: reportType,
        report_period_start: periodStart,
        report_period_end: periodEnd,
        report_data: reportData,
        generated_at: new Date().toISOString(),
        generated_by: 'system',
      },
      { onConflict: 'user_id,report_type,report_period_start' }
    )
    .select('id')
    .single();

  if (error) throw new Error('保存报告失败: ' + error.message);
  return data;
}

/**
 * 获取用户某次报告
 */
async function getReport(reportId) {
  const { data, error } = await supabase
    .from('learning_analysis_reports')
    .select('id, user_id, report_type, report_period_start, report_period_end, report_data, generated_at')
    .eq('id', reportId)
    .single();

  if (error || !data) return null;
  return data;
}

/**
 * 获取用户报告列表（按生成时间倒序）
 */
async function listReportsByUser(userId, limit = 20) {
  const { data, error } = await supabase
    .from('learning_analysis_reports')
    .select('id, report_type, report_period_start, report_period_end, generated_at')
    .eq('user_id', userId)
    .order('generated_at', { ascending: false })
    .limit(limit);

  if (error) throw new Error('查询报告列表失败: ' + error.message);
  return data || [];
}

module.exports = {
  generateLearningReport,
  getReport,
  listReportsByUser,
};
