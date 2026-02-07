#!/usr/bin/env node

/**
 * 补充知识库条目（运营补充）
 * 覆盖 §14.2 自检清单：退款、发票、注册、经销商申请、联系方式等
 * 用法：node scripts/seed-kb-supplement.js [--db]
 * --db: 写入 Supabase；否则只输出 JSON
 */

const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../../.env') });

const SUPPLEMENT_ENTRIES = [
  // === 售后：退款、发票、联系方式 ===
  {
    category: '售后',
    subcategory: '退款',
    title: '如何退款？',
    content: '如需申请退款，请联系客服 info@tubban.com 说明情况。我们将按退款政策处理。',
    content_type: 'support',
    question: '如何退款？',
    answer: '如需申请退款，请联系客服 info@tubban.com 说明情况。我们将按退款政策处理。订阅取消后，当前计费周期结束前仍可继续使用服务。',
    tags: ['退款', '订阅', '取消', '客服'],
    source: '运营补充',
    language_code: 'zh-CN',
  },
  {
    category: '售后',
    subcategory: '发票',
    title: '如何申请发票？',
    content: '如需开具发票，请联系 info@tubban.com，提供订单信息及发票抬头。',
    content_type: 'support',
    question: '如何申请发票？',
    answer: '如需开具发票，请联系 info@tubban.com，提供订单信息及发票抬头（公司名称、税号、地址等）。我们会在收到申请后尽快处理。',
    tags: ['发票', '报销', '客服'],
    source: '运营补充',
    language_code: 'zh-CN',
  },
  {
    category: '售后',
    subcategory: '联系方式',
    title: '如何联系客服？',
    content: '邮箱：info@tubban.com，联系电话 WhatsApp +41 78 889 3391',
    content_type: 'support',
    question: '如何联系客服？联系方式是什么？',
    answer: '邮箱：info@tubban.com，联系电话 WhatsApp +41 78 889 3391。如有产品使用、订阅、合作等方面问题，欢迎联系我们。',
    tags: ['客服', '联系方式', '电话', '邮箱', 'support'],
    source: '运营补充',
    language_code: 'zh-CN',
  },

  // === FAQ：注册、登录、角色 ===
  {
    category: 'FAQ',
    subcategory: '账户',
    title: '如何注册？',
    content: '访问平台注册页面，使用邮箱注册账号，按提示完成验证即可。',
    content_type: 'faq',
    question: '如何注册？',
    answer: '访问平台注册页面，使用邮箱注册账号，按提示完成邮箱验证即可。注册成功后即可使用，新用户会获得免费积分用于体验 AI 生成和 AI Guide 功能。',
    tags: ['注册', '登录', '账户'],
    source: '运营补充',
    language_code: 'zh-CN',
  },
  {
    category: 'FAQ',
    subcategory: '账户',
    title: '教师、学生、家长、机构有什么区别？',
    content: '不同角色对应不同使用场景：教师制作课件、学生自主学习、家长辅导孩子、机构制作课程。',
    content_type: 'faq',
    question: '教师、学生、家长、机构有什么区别？',
    answer: '教师：主要用于制作课件、课堂演示，节省备课时间；学生：自主学习、配合 AI Guide 练习与探索；家长：辅导孩子、查看学习报告；机构：制作系列课程、批量管理内容。注册时可根据身份选择，功能权限相同，使用场景不同。',
    tags: ['教师', '学生', '家长', '机构', '角色'],
    source: '运营补充',
    language_code: 'zh-CN',
  },

  // === 价格：试用、多少钱 ===
  {
    category: '价格',
    subcategory: '试用',
    title: '有没有免费试用？',
    content: '新用户注册赠送初始积分，可免费体验 AI 生成和 AI Guide。',
    content_type: 'pricing',
    question: '有没有免费试用？可以免费体验吗？',
    answer: '新用户注册时会赠送初始积分，可用于免费体验 AI 内容生成和 AI Guide 对话功能。积分用完后可购买积分包（$10 = 500 积分）或订阅 Pro 计划（月付 $29.8/年付 $240）获得无限使用。',
    tags: ['试用', '免费', '积分', '订阅'],
    source: '运营补充',
    language_code: 'zh-CN',
  },
  {
    category: '价格',
    subcategory: '价格',
    title: '月付和年付多少钱？',
    content: '月付 $29.8/月，年付 $240/年（节省 $118）。',
    content_type: 'pricing',
    question: '月付和年付多少钱？订阅多少钱？',
    answer: '月付：$29.8/月；年付：$240/年（节省 $118）。Pro 计划订阅后可无限使用 AI 生成和 AI Guide，不再消耗积分。积分包：$10 = 500 积分，适合偶尔使用的用户。',
    tags: ['月付', '年付', '价格', '订阅', '$29.8', '$240'],
    source: '运营补充',
    language_code: 'zh-CN',
  },

  // === 分销：经销商申请、合作 ===
  {
    category: '分销',
    subcategory: '申请',
    title: '如何成为经销商？',
    content: '请联系销售 info@tubban.com 了解经销商合作流程与条件。',
    content_type: 'distributor',
    question: '如何成为经销商？怎么申请？',
    answer: '如需成为 EduNest 经销商，请发送邮件至 info@tubban.com，说明您的机构类型、预期合作规模及目标市场。我们将安排专人与您对接，介绍合作条件、支持政策和申请流程。',
    tags: ['经销商', '合作', '申请', '销售'],
    source: '运营补充',
    language_code: 'zh-CN',
  },
  {
    category: '分销',
    subcategory: '支持',
    title: '经销商有哪些支持？',
    content: '销售支持（材料、培训、市场活动）、技术支持（培训、问题解答、产品更新）、数据分析支持。',
    content_type: 'distributor',
    question: '经销商有哪些支持？',
    answer: '经销商可获得：销售支持（宣传册、演示 PPT、视频、销售培训、市场活动支持）；技术支持（技术深度培训、问题解答、产品更新通知）；数据分析支持（销售数据、用户使用数据、市场洞察）。详情请联系 info@tubban.com。',
    tags: ['经销商', '销售支持', '技术支持', '培训'],
    source: '运营补充',
    language_code: 'zh-CN',
  },

  // === 产品：这是什么、怎么用、学科覆盖（口语化问法） ===
  {
    category: '产品',
    subcategory: '介绍',
    title: '这是什么？',
    content: 'EduNest 是 AI 驱动的智能教育内容生成与学习分析平台。',
    content_type: 'faq',
    question: '这是什么？',
    answer: '这是 EduNest，一个基于 AI 的智能教育平台。您可以：用 AI 生成交互式课件（输入知识点即可）、通过 AI Guide 获得个性化辅导、查看学习分析报告。支持全学段、全学科，教师、学生、家长、机构都可使用。',
    tags: ['EduNest', '产品', '介绍'],
    source: '运营补充',
    language_code: 'zh-CN',
  },
  {
    category: 'FAQ',
    subcategory: '使用',
    title: '怎么用？如何使用？',
    content: '登录后点击创建/AI 生成，输入知识点选择类型即可生成；打开内容后点 AI Guide 可提问。',
    content_type: 'faq',
    question: '怎么用？如何使用？',
    answer: '1) AI 生成内容：登录后点击「创建」或「AI 生成」，输入知识点（如「分数运算」），选择学习阶段和类型，点击生成。2) AI Guide：打开任意内容，点击「AI Guide」按钮，在对话框提问即可。3) 学习报告：进入学习分析页面，选择报告类型和时间范围查看。新用户有免费积分可体验。',
    tags: ['使用', '怎么用', 'AI生成', 'AI Guide'],
    source: '运营补充',
    language_code: 'zh-CN',
  },
  {
    category: '产品',
    subcategory: '学科',
    title: '只有数学吗？还有什么学科？',
    content: '支持全学段全学科：数学、语文、英语、科学、物理、化学、生物等。',
    content_type: 'faq',
    question: '只有数学吗？还有什么学科？好像很多数学题，还有别的吗？',
    answer: '不只是数学。EduNest 支持从幼儿园到高三全学段，覆盖数学、语文、英语、科学、物理、化学、生物等全学科。输入知识点时可指定年级和学科，AI 会按对应难度生成内容。',
    tags: ['学科', '数学', '语文', '英语', '全学科'],
    source: '运营补充',
    language_code: 'zh-CN',
  },

  // === 产品：数学提示词怎么写（有想象力） ===
  {
    category: 'FAQ',
    subcategory: '提示词',
    title: '数学提示词怎么写？怎么写关于数学的提示词？',
    content: '给数学知识点加故事、场景、人物，越具体越生动，生成效果越好。',
    content_type: 'faq',
    question: '我该怎么写关于数学的提示词？数学提示词怎么写？',
    answer: `写好数学提示词的核心：**加故事、加场景、加人物**，越具体越有想象力，AI 生成的内容越生动。

**小学低年级（趣味场景）**
- 「小明分生日蛋糕：一块蛋糕要分给 4 个小朋友，每人能分到多少？用动画展示切分过程，帮助理解几分之一」
- 「小兔子的萝卜地：一共 12 根萝卜，每 3 根装一筐，可以装几筐？配合数数和小游戏」

**小学高年级 / 初中（情境应用）**
- 「探险家测河宽：荒岛求生，如何用相似三角形原理，站在河这边测出对岸一棵树到河岸的距离？设计互动测量步骤」
- 「过山车与抛物线：设计最刺激的过山车轨道，用二次函数画出不同抛物线，学生调节参数 a、b、c 观察顶点和开口变化」
- 「小明的零花钱之谜：每周固定零花钱，加上做家务奖励，建立一元一次方程，找出小明一共存了多少钱」

**高中数学（抽象 + 应用）**
- 「三角函数测高楼：站在操场用测角仪测楼顶仰角，结合三角函数计算楼高，配合单位圆动画」
- 「班级身高大调查：收集数据、画直方图、算平均数和中位数，谁是最萌身高差？」

**小技巧**：写清年级、知识点、希望的形式（交互式 / 动画 / 游戏），再给一个具体场景，效果会好很多。`,
    tags: ['数学', '提示词', 'AI生成', '分数', '几何', '函数', '方程'],
    source: '运营补充',
    language_code: 'zh-CN',
  },

  // === 产品：EduNest 介绍、年级学科、学生使用 ===
  {
    category: '产品',
    subcategory: '介绍',
    title: 'EduNest 是什么？',
    content: 'EduNest 是 AI 驱动的智能教育内容生成与学习分析平台，支持全学段全学科。',
    content_type: 'feature',
    question: 'EduNest 是什么？',
    answer: 'EduNest 是一个基于 AI 的智能教育平台，主要功能包括：AI 内容生成（输入知识点即可生成交互式或动画式课件）、AI Guide（个性化学习辅导）、学习分析（10 维度评估与报告）。支持从幼儿园到高三全学段、全学科，以及中英德法等多语言。',
    tags: ['EduNest', '产品', 'AI', '教育'],
    source: '运营补充',
    language_code: 'zh-CN',
  },
  {
    category: '产品',
    subcategory: '学科',
    title: '支持哪些年级和学科？',
    content: '支持幼儿园到高三全学段、全学科，包括数学、语文、英语、科学等。',
    content_type: 'feature',
    question: '支持哪些年级和学科？',
    answer: 'EduNest 支持从幼儿园到高三全学段，覆盖数学、语文、英语、科学、物理、化学、生物等全学科。输入知识点时可指定年级和学科，AI 会按对应难度生成内容。',
    tags: ['年级', '学科', '数学', '全学段'],
    source: '运营补充',
    language_code: 'zh-CN',
  },
  {
    category: 'FAQ',
    subcategory: '使用',
    title: '学生可以单独使用吗？',
    content: '可以。学生可自主学习、配合 AI Guide 提问，家长或教师也可查看学习报告。',
    content_type: 'faq',
    question: '学生可以单独使用吗？',
    answer: '可以。学生可独立注册使用，进行自主学习和练习。配合 AI Guide 可随时提问、获得辅导。家长或教师账号可关联查看学生的学习报告，了解学习进度和薄弱点。',
    tags: ['学生', '自主学习', 'AI Guide', '学习报告'],
    source: '运营补充',
    language_code: 'zh-CN',
  },

  // === 以下为占位条目，内容需您补充 ===
  {
    category: '分销',
    subcategory: '价格',
    title: '学校/机构批量采购价格？',
    content: '请联系销售 info@tubban.com 获取机构批量采购价格及方案。',
    content_type: 'distributor',
    question: '学校/机构批量采购多少钱？B 端价格？',
    answer: '学校、机构等批量采购的价格和方案请直接联系销售：info@tubban.com。我们会根据您的规模和使用需求提供定制报价。',
    tags: ['批量', '机构', '学校', 'B端', '价格'],
    source: '运营补充（待完善）',
    language_code: 'zh-CN',
  },
  {
    category: '产品',
    subcategory: '安全',
    title: '数据安全和隐私政策？',
    content: '我们重视用户数据安全，具体政策请查看平台隐私条款或联系 info@tubban.com。',
    content_type: 'support',
    question: '数据安全吗？隐私政策是什么？',
    answer: 'EduNest 重视用户数据安全与隐私保护。具体的数据处理方式、存储与隐私政策请参阅平台隐私条款。如有疑问可联系 info@tubban.com。',
    tags: ['数据', '隐私', '安全'],
    source: '运营补充（待完善）',
    language_code: 'zh-CN',
  },
  {
    category: '售后',
    subcategory: '取消',
    title: '如何取消订阅？',
    content: '进入订阅管理页面可取消订阅，取消后当前周期结束前仍可使用。',
    content_type: 'support',
    question: '如何取消订阅？',
    answer: '进入「订阅管理」页面，选择取消订阅即可。取消后，当前计费周期结束前仍可继续使用 Pro 功能；周期结束后将恢复为积分模式。如需退款，请联系 info@tubban.com。',
    tags: ['取消', '退订', '订阅'],
    source: '运营补充',
    language_code: 'zh-CN',
  },
];

async function main() {
  const args = process.argv.slice(2);
  const writeDb = args.includes('--db');

  if (!writeDb) {
    console.log(JSON.stringify(SUPPLEMENT_ENTRIES, null, 2));
    console.error('\n提示：加 --db 可写入 Supabase');
    return;
  }

  const { createClient } = require('@supabase/supabase-js');
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_KEY;
  if (!url || !key) {
    console.error('需要 SUPABASE_URL、SUPABASE_SERVICE_KEY');
    process.exit(1);
  }

  const supabase = createClient(url, key);
  const toRow = (e) => ({
    category: e.category,
    subcategory: e.subcategory || null,
    title: e.title || '',
    content: e.content || '',
    content_type: e.content_type,
    question: e.question || null,
    answer: e.answer || null,
    tags: e.tags || [],
    source: e.source || null,
    language_code: e.language_code || 'zh-CN',
  });

  let inserted = 0;
  for (const e of SUPPLEMENT_ENTRIES) {
    const { error } = await supabase.from('kb_entries').insert(toRow(e));
    if (error) {
      console.error('插入失败:', e.title || e.question, error.message);
      continue;
    }
    inserted++;
  }
  console.log(`已补充 ${inserted}/${SUPPLEMENT_ENTRIES.length} 条，请运行 sync-kb-embeddings.js 生成 embedding`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
