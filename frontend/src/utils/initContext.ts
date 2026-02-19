/**
 * init_context：选角色后收集的 role、region、age/teachingAgeRanges、subjects 等；访客存 visitor_init_context（含 role），注册后 role 写入 user.role。
 * 不在此页选语言，language 可由后端/前端按浏览器或 region 推断。Phase 1 存 localStorage，key: init_context
 */

export const INIT_CONTEXT_KEY = 'init_context';

export interface InitContext {
  /** 身份：与 user.role 一致；访客填写时写入 context，注册后同步到 user.role */
  role: 'student' | 'parent' | 'teacher';
  region: string;
  /** 可选，可由浏览器/region 推断 */
  language?: string;
  /** 学生：本人出生年；家长：被辅导孩子的出生年。一次填写长期有效，用于按当前年计算年龄 */
  birthYear?: number;
  /** 学生：本人年龄；家长：被辅导孩子的年龄。若存在 birthYear 则应由 getAgeFromContext 计算，此字段仅作向后兼容。提示词中须按 role 区分：student=本人，parent=孩子 */
  age?: number;
  /** 老师：关注的教学对象年龄段（多选） */
  teachingAgeRanges?: string[];
  /** canonical subject keys，如 math, physics */
  subjects: string[];
  expectations?: string;
  child_interests?: string;
  child_talents?: string;
}

export function getInitContext(): InitContext | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = localStorage.getItem(INIT_CONTEXT_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as InitContext;
    return parsed?.region != null && Array.isArray(parsed?.subjects) && parsed?.role != null ? parsed : null;
  } catch {
    return null;
  }
}

export function setInitContext(ctx: InitContext): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem(INIT_CONTEXT_KEY, JSON.stringify(ctx));
}

/** 从 context 得到当前年龄（优先用 birthYear 计算，否则用 age）。用于展示或上报，避免年龄每年过期。 */
export function getAgeFromContext(ctx: InitContext | null): number | null {
  if (!ctx) return null;
  const year = new Date().getFullYear();
  if (ctx.birthYear != null && ctx.birthYear > 0) {
    const age = year - ctx.birthYear;
    return age >= 0 && age <= 120 ? age : null;
  }
  return ctx.age != null ? ctx.age : null;
}

export function hasInitContext(): boolean {
  return getInitContext() != null;
}

/** 科目 canonical key 列表（中美欧通用，展示用 i18n onboard.subjects.*） */
export const SUBJECT_OPTIONS = [
  'math',
  'physics',
  'chemistry',
  'biology',
  'science',
  'astronomy',
  'medicine',
  'programming',
  'chinese',
  'english',
  'french',
  'japanese',
  'german',
  'spanish',
  'geography',
  'history',
  'politics',
  'social_studies',
  'economics',
  'philosophy',
  'art',
  'music',
  'sports',
  'drama',
  'life_skills',
] as const;

export type SubjectKey = (typeof SUBJECT_OPTIONS)[number];

/** 用于 UI 分组展示，未在分组中的科目会归入「其他」 */
export const SUBJECT_GROUPS: { key: string; subjects: SubjectKey[] }[] = [
  { key: 'languages', subjects: ['chinese', 'english', 'french', 'japanese', 'german', 'spanish'] },
  { key: 'stem', subjects: ['math', 'physics', 'chemistry', 'biology', 'science', 'astronomy', 'medicine', 'programming'] },
  { key: 'humanities', subjects: ['geography', 'history', 'politics', 'social_studies', 'economics', 'philosophy'] },
  { key: 'arts_others', subjects: ['art', 'music', 'sports', 'drama', 'life_skills'] },
];

/** 自定义科目前缀，存储时用 other:xxx，展示时只显示 xxx */
export const SUBJECT_OTHER_PREFIX = 'other:';

/** 老师教学对象年龄段（可多选），范围更宽、更灵活 */
export const TEACHING_AGE_RANGES = [
  { value: 'preschool' },
  { value: 'primary_low' },
  { value: 'primary_high' },
  { value: 'junior' },
  { value: 'senior' },
  { value: 'all_k12' },
  { value: 'adult' },
] as const;
