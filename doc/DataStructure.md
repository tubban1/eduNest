[
  {
    "table_name": "ai_usage_logs",
    "column_name": "id",
    "data_type": "uuid",
    "is_nullable": "NO",
    "column_default": "gen_random_uuid()"
  },
  {
    "table_name": "ai_usage_logs",
    "column_name": "user_id",
    "data_type": "uuid",
    "is_nullable": "YES",
    "column_default": null
  },
  {
    "table_name": "ai_usage_logs",
    "column_name": "model_name",
    "data_type": "text",
    "is_nullable": "YES",
    "column_default": null
  },
  {
    "table_name": "ai_usage_logs",
    "column_name": "user_query",
    "data_type": "text",
    "is_nullable": "YES",
    "column_default": null
  },
  {
    "table_name": "ai_usage_logs",
    "column_name": "action_type",
    "data_type": "text",
    "is_nullable": "YES",
    "column_default": null
  },
  {
    "table_name": "ai_usage_logs",
    "column_name": "input_tokens",
    "data_type": "integer",
    "is_nullable": "NO",
    "column_default": "0"
  },
  {
    "table_name": "ai_usage_logs",
    "column_name": "output_tokens",
    "data_type": "integer",
    "is_nullable": "NO",
    "column_default": "0"
  },
  {
    "table_name": "ai_usage_logs",
    "column_name": "request_payload",
    "data_type": "jsonb",
    "is_nullable": "YES",
    "column_default": null
  },
  {
    "table_name": "ai_usage_logs",
    "column_name": "response_metadata",
    "data_type": "jsonb",
    "is_nullable": "YES",
    "column_default": null
  },
  {
    "table_name": "ai_usage_logs",
    "column_name": "created_at",
    "data_type": "timestamp with time zone",
    "is_nullable": "YES",
    "column_default": "now()"
  },
  {
    "table_name": "ai_usage_logs",
    "column_name": "is_json_valid",
    "data_type": "boolean",
    "is_nullable": "NO",
    "column_default": "false"
  },
  {
    "table_name": "ai_usage_logs",
    "column_name": "is_render_success",
    "data_type": "boolean",
    "is_nullable": "NO",
    "column_default": "false"
  },
  {
    "table_name": "ai_usage_logs",
    "column_name": "error_message",
    "data_type": "text",
    "is_nullable": "YES",
    "column_default": null
  },
  {
    "table_name": "ai_usage_logs",
    "column_name": "total_tokens",
    "data_type": "integer",
    "is_nullable": "YES",
    "column_default": "0"
  },
  {
    "table_name": "ai_usage_logs",
    "column_name": "request_id",
    "data_type": "uuid",
    "is_nullable": "YES",
    "column_default": null
  },
  {
    "table_name": "collection_lists",
    "column_name": "id",
    "data_type": "uuid",
    "is_nullable": "NO",
    "column_default": "gen_random_uuid()"
  },
  {
    "table_name": "collection_lists",
    "column_name": "short_id",
    "data_type": "text",
    "is_nullable": "YES",
    "column_default": "SUBSTRING(md5((gen_random_uuid())::text) FROM 1 FOR 8)"
  },
  {
    "table_name": "collection_lists",
    "column_name": "user_id",
    "data_type": "uuid",
    "is_nullable": "YES",
    "column_default": null
  },
  {
    "table_name": "collection_lists",
    "column_name": "name",
    "data_type": "text",
    "is_nullable": "NO",
    "column_default": null
  },
  {
    "table_name": "collection_lists",
    "column_name": "parent_id",
    "data_type": "uuid",
    "is_nullable": "YES",
    "column_default": null
  },
  {
    "table_name": "collection_lists",
    "column_name": "full_path",
    "data_type": "text",
    "is_nullable": "YES",
    "column_default": null
  },
  {
    "table_name": "collection_lists",
    "column_name": "created_at",
    "data_type": "timestamp with time zone",
    "is_nullable": "YES",
    "column_default": "now()"
  },
  {
    "table_name": "collection_lists",
    "column_name": "updated_at",
    "data_type": "timestamp with time zone",
    "is_nullable": "YES",
    "column_default": "now()"
  },
  {
    "table_name": "collection_lists",
    "column_name": "visibility",
    "data_type": "text",
    "is_nullable": "NO",
    "column_default": "'public'::text"
  },
  {
    "table_name": "collection_lists",
    "column_name": "order_index",
    "data_type": "numeric",
    "is_nullable": "NO",
    "column_default": "1000"
  },
  {
    "table_name": "content",
    "column_name": "id",
    "data_type": "uuid",
    "is_nullable": "NO",
    "column_default": "gen_random_uuid()"
  },
  {
    "table_name": "content",
    "column_name": "title",
    "data_type": "text",
    "is_nullable": "NO",
    "column_default": null
  },
  {
    "table_name": "content",
    "column_name": "knowledge_points",
    "data_type": "ARRAY",
    "is_nullable": "YES",
    "column_default": null
  },
  {
    "table_name": "content",
    "column_name": "language_code",
    "data_type": "text",
    "is_nullable": "NO",
    "column_default": "'zh-CN'::text"
  },
  {
    "table_name": "content",
    "column_name": "content_type",
    "data_type": "text",
    "is_nullable": "NO",
    "column_default": "'vue'::text"
  },
  {
    "table_name": "content",
    "column_name": "created_at",
    "data_type": "timestamp with time zone",
    "is_nullable": "YES",
    "column_default": "now()"
  },
  {
    "table_name": "content",
    "column_name": "updated_at",
    "data_type": "timestamp with time zone",
    "is_nullable": "YES",
    "column_default": "now()"
  },
  {
    "table_name": "content",
    "column_name": "code_html",
    "data_type": "text",
    "is_nullable": "YES",
    "column_default": null
  },
  {
    "table_name": "content",
    "column_name": "code_css",
    "data_type": "text",
    "is_nullable": "YES",
    "column_default": null
  },
  {
    "table_name": "content",
    "column_name": "code_js",
    "data_type": "text",
    "is_nullable": "YES",
    "column_default": null
  },
  {
    "table_name": "content",
    "column_name": "short_id",
    "data_type": "text",
    "is_nullable": "NO",
    "column_default": "SUBSTRING(md5((gen_random_uuid())::text) FROM 1 FOR 8)"
  },
  {
    "table_name": "content",
    "column_name": "created_by",
    "data_type": "uuid",
    "is_nullable": "YES",
    "column_default": null
  },
  {
    "table_name": "content",
    "column_name": "tags",
    "data_type": "ARRAY",
    "is_nullable": "YES",
    "column_default": null
  },
  {
    "table_name": "content",
    "column_name": "external_links",
    "data_type": "ARRAY",
    "is_nullable": "YES",
    "column_default": null
  },
  {
    "table_name": "content",
    "column_name": "source_content_id",
    "data_type": "uuid",
    "is_nullable": "YES",
    "column_default": null
  },
  {
    "table_name": "content",
    "column_name": "description",
    "data_type": "text",
    "is_nullable": "YES",
    "column_default": null
  },
  {
    "table_name": "content_likes",
    "column_name": "id",
    "data_type": "uuid",
    "is_nullable": "NO",
    "column_default": "gen_random_uuid()"
  },
  {
    "table_name": "content_likes",
    "column_name": "user_id",
    "data_type": "uuid",
    "is_nullable": "YES",
    "column_default": null
  },
  {
    "table_name": "content_likes",
    "column_name": "content_id",
    "data_type": "uuid",
    "is_nullable": "YES",
    "column_default": null
  },
  {
    "table_name": "content_likes",
    "column_name": "liked_at",
    "data_type": "timestamp with time zone",
    "is_nullable": "YES",
    "column_default": "now()"
  },
  {
    "table_name": "content_versions",
    "column_name": "id",
    "data_type": "uuid",
    "is_nullable": "NO",
    "column_default": "gen_random_uuid()"
  },
  {
    "table_name": "content_versions",
    "column_name": "content_id",
    "data_type": "uuid",
    "is_nullable": "YES",
    "column_default": null
  },
  {
    "table_name": "content_versions",
    "column_name": "created_by",
    "data_type": "uuid",
    "is_nullable": "YES",
    "column_default": null
  },
  {
    "table_name": "content_versions",
    "column_name": "created_at",
    "data_type": "timestamp with time zone",
    "is_nullable": "YES",
    "column_default": "now()"
  },
  {
    "table_name": "content_versions",
    "column_name": "code_html",
    "data_type": "text",
    "is_nullable": "YES",
    "column_default": null
  },
  {
    "table_name": "content_versions",
    "column_name": "code_css",
    "data_type": "text",
    "is_nullable": "YES",
    "column_default": null
  },
  {
    "table_name": "content_versions",
    "column_name": "code_js",
    "data_type": "text",
    "is_nullable": "YES",
    "column_default": null
  },
  {
    "table_name": "content_versions",
    "column_name": "title",
    "data_type": "text",
    "is_nullable": "YES",
    "column_default": null
  },
  {
    "table_name": "content_versions",
    "column_name": "note",
    "data_type": "text",
    "is_nullable": "YES",
    "column_default": null
  },
  {
    "table_name": "payments",
    "column_name": "id",
    "data_type": "uuid",
    "is_nullable": "NO",
    "column_default": "gen_random_uuid()"
  },
  {
    "table_name": "payments",
    "column_name": "user_id",
    "data_type": "uuid",
    "is_nullable": "YES",
    "column_default": null
  },
  {
    "table_name": "payments",
    "column_name": "amount_usd",
    "data_type": "numeric",
    "is_nullable": "NO",
    "column_default": null
  },
  {
    "table_name": "payments",
    "column_name": "currency",
    "data_type": "text",
    "is_nullable": "YES",
    "column_default": "'USD'::text"
  },
  {
    "table_name": "payments",
    "column_name": "plan",
    "data_type": "text",
    "is_nullable": "YES",
    "column_default": null
  },
  {
    "table_name": "payments",
    "column_name": "status",
    "data_type": "text",
    "is_nullable": "YES",
    "column_default": "'pending'::text"
  },
  {
    "table_name": "payments",
    "column_name": "stripe_session_id",
    "data_type": "text",
    "is_nullable": "YES",
    "column_default": null
  },
  {
    "table_name": "payments",
    "column_name": "created_at",
    "data_type": "timestamp with time zone",
    "is_nullable": "YES",
    "column_default": "now()"
  },
  {
    "table_name": "referral_logs",
    "column_name": "id",
    "data_type": "uuid",
    "is_nullable": "NO",
    "column_default": "gen_random_uuid()"
  },
  {
    "table_name": "referral_logs",
    "column_name": "inviter_id",
    "data_type": "uuid",
    "is_nullable": "YES",
    "column_default": null
  },
  {
    "table_name": "referral_logs",
    "column_name": "invitee_id",
    "data_type": "uuid",
    "is_nullable": "YES",
    "column_default": null
  },
  {
    "table_name": "referral_logs",
    "column_name": "referral_code",
    "data_type": "text",
    "is_nullable": "YES",
    "column_default": null
  },
  {
    "table_name": "referral_logs",
    "column_name": "status",
    "data_type": "text",
    "is_nullable": "YES",
    "column_default": "'success'::text"
  },
  {
    "table_name": "referral_logs",
    "column_name": "created_at",
    "data_type": "timestamp with time zone",
    "is_nullable": "YES",
    "column_default": "now()"
  },
  {
    "table_name": "subscriptions",
    "column_name": "id",
    "data_type": "uuid",
    "is_nullable": "NO",
    "column_default": "gen_random_uuid()"
  },
  {
    "table_name": "subscriptions",
    "column_name": "user_id",
    "data_type": "uuid",
    "is_nullable": "YES",
    "column_default": null
  },
  {
    "table_name": "subscriptions",
    "column_name": "plan",
    "data_type": "text",
    "is_nullable": "NO",
    "column_default": null
  },
  {
    "table_name": "subscriptions",
    "column_name": "status",
    "data_type": "text",
    "is_nullable": "YES",
    "column_default": "'active'::text"
  },
  {
    "table_name": "subscriptions",
    "column_name": "start_date",
    "data_type": "timestamp with time zone",
    "is_nullable": "YES",
    "column_default": "now()"
  },
  {
    "table_name": "subscriptions",
    "column_name": "end_date",
    "data_type": "timestamp with time zone",
    "is_nullable": "YES",
    "column_default": null
  },
  {
    "table_name": "subscriptions",
    "column_name": "current_period_start",
    "data_type": "timestamp with time zone",
    "is_nullable": "YES",
    "column_default": null
  },
  {
    "table_name": "subscriptions",
    "column_name": "current_period_end",
    "data_type": "timestamp with time zone",
    "is_nullable": "YES",
    "column_default": null
  },
  {
    "table_name": "subscriptions",
    "column_name": "cancel_at_period_end",
    "data_type": "boolean",
    "is_nullable": "YES",
    "column_default": "false"
  },
  {
    "table_name": "subscriptions",
    "column_name": "created_at",
    "data_type": "timestamp with time zone",
    "is_nullable": "YES",
    "column_default": "now()"
  },
  {
    "table_name": "subscriptions",
    "column_name": "updated_at",
    "data_type": "timestamp with time zone",
    "is_nullable": "YES",
    "column_default": "now()"
  },
  {
    "table_name": "user_collections",
    "column_name": "id",
    "data_type": "uuid",
    "is_nullable": "NO",
    "column_default": "gen_random_uuid()"
  },
  {
    "table_name": "user_collections",
    "column_name": "user_id",
    "data_type": "uuid",
    "is_nullable": "YES",
    "column_default": null
  },
  {
    "table_name": "user_collections",
    "column_name": "content_id",
    "data_type": "uuid",
    "is_nullable": "YES",
    "column_default": null
  },
  {
    "table_name": "user_collections",
    "column_name": "list_id",
    "data_type": "uuid",
    "is_nullable": "YES",
    "column_default": null
  },
  {
    "table_name": "user_collections",
    "column_name": "tags",
    "data_type": "ARRAY",
    "is_nullable": "YES",
    "column_default": null
  },
  {
    "table_name": "user_collections",
    "column_name": "status",
    "data_type": "text",
    "is_nullable": "YES",
    "column_default": null
  },
  {
    "table_name": "user_collections",
    "column_name": "timeline_date",
    "data_type": "date",
    "is_nullable": "YES",
    "column_default": null
  },
  {
    "table_name": "user_collections",
    "column_name": "added_at",
    "data_type": "timestamp with time zone",
    "is_nullable": "YES",
    "column_default": "now()"
  },
  {
    "table_name": "user_collections",
    "column_name": "comment",
    "data_type": "text",
    "is_nullable": "YES",
    "column_default": null
  },
  {
    "table_name": "user_collections",
    "column_name": "is_modified",
    "data_type": "boolean",
    "is_nullable": "YES",
    "column_default": "false"
  },
  {
    "table_name": "user_credits",
    "column_name": "id",
    "data_type": "uuid",
    "is_nullable": "NO",
    "column_default": "gen_random_uuid()"
  },
  {
    "table_name": "user_credits",
    "column_name": "user_id",
    "data_type": "uuid",
    "is_nullable": "YES",
    "column_default": null
  },
  {
    "table_name": "user_credits",
    "column_name": "change_type",
    "data_type": "text",
    "is_nullable": "NO",
    "column_default": null
  },
  {
    "table_name": "user_credits",
    "column_name": "change_amount",
    "data_type": "integer",
    "is_nullable": "NO",
    "column_default": null
  },
  {
    "table_name": "user_credits",
    "column_name": "related_user_id",
    "data_type": "uuid",
    "is_nullable": "YES",
    "column_default": null
  },
  {
    "table_name": "user_credits",
    "column_name": "created_at",
    "data_type": "timestamp with time zone",
    "is_nullable": "YES",
    "column_default": "now()"
  },
  {
    "table_name": "users",
    "column_name": "id",
    "data_type": "uuid",
    "is_nullable": "NO",
    "column_default": null
  },
  {
    "table_name": "users",
    "column_name": "email",
    "data_type": "text",
    "is_nullable": "YES",
    "column_default": null
  },
  {
    "table_name": "users",
    "column_name": "name",
    "data_type": "text",
    "is_nullable": "YES",
    "column_default": null
  },
  {
    "table_name": "users",
    "column_name": "role",
    "data_type": "text",
    "is_nullable": "YES",
    "column_default": "'user'::text"
  },
  {
    "table_name": "users",
    "column_name": "created_at",
    "data_type": "timestamp with time zone",
    "is_nullable": "YES",
    "column_default": "now()"
  },
  {
    "table_name": "users",
    "column_name": "referral_code",
    "data_type": "text",
    "is_nullable": "YES",
    "column_default": null
  }
]


{"raw": {"id": "0217589433009696a4a79e57bfee6f1241bef9629663f36c7db9b", "model": "kimi-k2-250905", "usage": {"total_tokens": 3631, "prompt_tokens": 1057, "completion_tokens": 2574, "prompt_tokens_details": {"cached_tokens": 0}, "completion_tokens_details": {"reasoning_tokens": 0}}, "object": "chat.completion", "choices": [{"index": 0, "message": {"role": "assistant", "content": "{\"title\":\"西达基奥仑赛研发之旅\",\"description\":\"通过交互式时间轴、动画实验台与声音提示，逐步探索CAR-T细胞疗法西达基奥仑赛从发现到上市的完整研发过程。点击或悬停节点可深入每一阶段。\",\"html\":\"<!-- 完整可运行HTML -->\\n<div id=\\\"app\\\">\\n  <header>\\n    <h1>西达基奥仑赛研发之旅</h1>\\n    <p>点击或悬停时间轴节点，探索每一步科学突破</p>\\n  </header>\\n\\n  <!-- 时间轴 -->\\n  <section class=\\\"timeline\\\">\\n    <div\\n      v-for=\\\"(stage,i) in stages\\\"\\n      :key=\\\"stage.id\\\"\\n      class=\\\"node\\\"\\n      :class=\\\"{active:activeIndex===i}\\\"\\n      :style=\\\"{left:stage.left+'%'}\\\"\\n      @mouseenter=\\\"hoverStage(i)\\\"\\n      @click=\\\"selectStage(i)\\\"\\n    >\\n      <div class=\\\"dot\\\"></div>\\n      <div class=\\\"label\\\">{{stage.year}}</div>\\n    </div>\\n    <div class=\\\"progress\\\" :style=\\\"{width:activeLeft+'%'}\\\"></div>\\n  </section>\\n\\n  <!-- 详情面板 -->\\n  <transition name=\\\"fade\\\">\\n    <section v-if=\\\"activeStage\\\" class=\\\"detail\\\">\\n      <h2>{{activeStage.title}}</h2>\\n      <p>{{activeStage.desc}}</p>\\n      <div class=\\\"viz\\\">\\n        <!-- 动画占位 -->\\n        <canvas ref=\\\"canvas\\\" width=\\\"320\\\" height=\\\"200\\\"></canvas>\\n      </div>\\n      <button @click=\\\"next\\\">下一步 ▸</button>\\n    </section>\\n  </transition>\\n\\n  <!-- 声音开关 -->\\n  <button class=\\\"sound-toggle\\\" @click=\\\"toggleSound\\\">🔊 {{soundOn?'关':'开'}}声音</button>\\n</div>\",\"css\":\"/* 完整可运行CSS */\\n*{\\n  box-sizing:border-box;\\n  margin:0;\\n  padding:0;\\n  font-family:-apple-system,BlinkMacSystemFont,\\\"Segoe UI\\\",Roboto,\\\"Helvetica Neue\\\",Arial,\\\"Noto Sans\\\",sans-serif;\\n}\\nbody{\\n  background:#f5f7fa;\\n  color:#333;\\n}\\nheader{\\n  text-align:center;\\n  padding:24px 16px 16px;\\n}\\nheader h1{\\n  font-size:28px;\\n  margin-bottom:8px;\\n  color:#0b6cff;\\n}\\nheader p{\\n  font-size:14px;\\n  color:#666;\\n}\\n.timeline{\\n  position:relative;\\n  height:60px;\\n  margin:24px auto;\\n  max-width:800px;\\n  background:#e0e6ed;\\n  border-radius:30px;\\n}\\n.progress{\\n  position:absolute;\\n  left:0;\\n  top:0;\\n  height:100%;\\n  background:#0b6cff;\\n  border-radius:30px;\\n  transition:width .6s ease;\\n}\\n.node{\\n  position:absolute;\\n  top:0;\\n  height:100%;\\n  display:flex;\\n  flex-direction:column;\\n  align-items:center;\\n  justify-content:center;\\n  cursor:pointer;\\n  z-index:2;\\n}\\n.dot{\\n  width:24px;\\n  height:24px;\\n  border-radius:50%;\\n  background:#fff;\\n  border:3px solid #0b6cff;\\n  transition:transform .2s;\\n}\\n.node.active .dot{\\n  transform:scale(1.3);\\n  background:#0b6cff;\\n}\\n.label{\\n  margin-top:6px;\\n  font-size:12px;\\n  color:#666;\\n}\\n.detail{\\n  max-width:600px;\\n  margin:0 auto 40px;\\n  padding:24px;\\n  background:#fff;\\n  border-radius:12px;\\n  box-shadow:0 4px 12px rgba(0,0,0,.08);\\n}\\n.detail h2{\\n  font-size:20px;\\n  margin-bottom:12px;\\n  color:#0b6cff;\\n}\\n.detail p{\\n  font-size:15px;\\n  line-height:1.6;\\n  margin-bottom:16px;\\n}\\n.viz{\\n  display:flex;\\n  justify-content:center;\\n  margin-bottom:20px;\\n}\\nbutton{\\n  background:#0b6cff;\\n  color:#fff;\\n  border:none;\\n  padding:10px 20px;\\n  border-radius:6px;\\n  cursor:pointer;\\n  font-size:14px;\\n}\\nbutton:hover{\\n  background:#0957d8;\\n}\\n.sound-toggle{\\n  position:fixed;\\n  bottom:16px;\\n  right:16px;\\n  background:#fff;\\n  color:#0b6cff;\\n  border:1px solid #0b6cff;\\n}\\n.fade-enter-active,.fade-leave-active{\\n  transition:opacity .4s;\\n}\\n.fade-enter-from,.fade-leave-to{\\n  opacity:0;\\n}\\n@media(max-width:600px){\\n  header h1{font-size:22px;}\\n  .timeline{margin:16px 12px;}\\n  .detail{margin:0 12px 24px;padding:16px;}\\n}\",\"js\":\"// 完整可运行JS\\nconst {createApp,ref,computed,onMounted,nextTick}=Vue;\\n\\ncreateApp({\\n  setup(){\\n    const stages=ref([\\n      {id:1,year:'2000-2005',title:'科学发现',desc:'科学家发现BCMA是多发性骨髓瘤理想靶点，奠定CAR-T设计基础。',left:10},\\n      {id:2,year:'2006-2010',title:'早期概念验证',desc:'在体外与动物模型中验证抗BCMA CAR-T可精准杀伤肿瘤细胞。',left:25},\\n      {id:3,year:'2011-2013',title:'载体与工艺开发',desc:'构建含4-1BB共刺激域的慢病毒载体，并建立稳定细胞制备工艺。',left:40},\\n      {id:4,year:'2014-2016',title:'首次人体试验',desc:'I期临床显示深度缓解，但出现CRS与神经毒性，提示需优化剂量。',left:55},\\n      {id:5,year:'2017-2019',title:'关键II期试验',desc:'多中心研究证实总缓解率97%，推动突破性疗法认定与快速审批。',left:70},\\n      {id:6,year:'2020-2022',title:'注册与上市',desc:'凭借CARTITUDE-1数据获FDA批准，成为全球首个靶向BCMA的CAR-T疗法。',left:90}\\n    ]);\\n    const activeIndex=ref(0);\\n    const soundOn=ref(true);\\n    const canvas=ref(null);\\n    let ctx;\\n\\n    const activeStage=computed(()=>stages.value[activeIndex.value]);\\n    const activeLeft=computed(()=>stages.value[activeIndex.value].left);\\n\\n    // 简单音效\\n    const beep=(freq=440,time=0.2)=>{\\n      if(!soundOn.value) return;\\n      const osc=new Tone.Oscillator(freq,'sine').toDestination();\\n      osc.start().stop(`+${time}`);\\n    };\\n\\n    // 悬停\\n    const hoverStage=i=>{\\n      beep(600,0.15);\\n    };\\n\\n    // 选中\\n    const selectStage=i=>{\\n      activeIndex.value=i;\\n      beep(880,0.25);\\n      drawStage(i);\\n    };\\n\\n    // 下一步\\n    const next=()=>{\\n      if(activeIndex.value<stages.value.length-1){\\n        activeIndex.value++;\\n        beep(880,0.25);\\n        drawStage(activeIndex.value);\\n      }\\n    };\\n\\n    // 切换声音\\n    const toggleSound=()=>{\\n      soundOn.value=!soundOn.value;\\n      if(soundOn.value) beep(660,0.2);\\n    };\\n\\n    // 简单动画绘制\\n    const drawStage=i=>{\\n      nextTick(()=>{\\n        if(!canvas.value) return;\\n        ctx=canvas.value.getContext('2d');\\n        ctx.clearRect(0,0,320,200);\\n        // 背景网格\\n        ctx.strokeStyle='#e0e6ed';\\n        ctx.beginPath();\\n        for(let x=0;x<=320;x+=20){ctx.moveTo(x,0);ctx.lineTo(x,200);}\\n        for(let y=0;y<=200;y+=20){ctx.moveTo(0,y);ctx.lineTo(320,y);}\\n        ctx.stroke();\\n        // 阶段图形\\n        ctx.fillStyle='#0b6cff';\\n        ctx.globalAlpha=0.9;\\n        if(i<3){\\n          // 发现/概念：DNA双螺旋\\n          ctx.beginPath();\\n          ctx.moveTo(160,40);ctx.bezierCurveTo(220,60,220,140,160,160);ctx.bezierCurveTo(100,140,100,60,160,40);\\n          ctx.fill();\\n        }else if(i<4){\\n          // 工艺：病毒颗粒\\n          ctx.beginPath();ctx.arc(160,100,40,0,Math.PI*2);ctx.fill();\\n        }else if(i<5){\\n          // 临床：T细胞攻击\\n          ctx.beginPath();ctx.arc(120,100,20,0,Math.PI*2);ctx.fill();\\n          ctx.beginPath();ctx.arc(200,100,30,0,Math.PI*2);ctx.fillStyle='#ff4d4d';ctx.fill();\\n          ctx.beginPath();ctx.moveTo(140,100);ctx.lineTo(170,100);ctx.strokeStyle='#0b6cff';ctx.lineWidth=3;ctx.stroke();\\n        }else{\\n          // 上市：庆祝星星\\n          for(let j=0;j<5;j++){\\n            ctx.save();\\n            ctx.translate(80+j*40,100);\\n            ctx.beginPath();for(let k=0;k<5;k++){ctx.lineTo(Math.cos((k*4*Math.PI)/5)*10,Math.sin((k*4*Math.PI)/5)*10);}ctx.closePath();ctx.fill();\\n            ctx.restore();\\n          }\\n        }\\n        ctx.globalAlpha=1;\\n      });\\n    };\\n\\n    onMounted(()=>{\\n      drawStage(0);\\n      // 初始化Tone\\n      Tone.start();\\n    });\\n\\n    return{stages,activeIndex,soundOn,activeStage,activeLeft,canvas,hoverStage,selectStage,next,toggleSound};\\n  }\\n}).mount('#app');\",\"external_links\":[\"https://unpkg.com/vue@3/dist/vue.global.prod.js\",\"https://cdnjs.cloudflare.com/ajax/libs/tone/14.8.49/Tone.min.js\"],\"tags\":[\"CAR-T\",\"药物研发\",\"时间轴\",\"交互式教学\",\"中文\"],\"content_type\":\"vue\",\"language_code\":\"zh-CN\"}"}, "logprobs": null, "finish_reason": "stop"}], "created": 1758943478, "service_tier": "default"}, "model": "kimi-k2-250905", "provider": "ark"}