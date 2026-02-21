"use client";

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslation } from 'react-i18next';
import { useAuth } from '@/hooks/useAuth';
import { api } from '@/lib/api';
import { getOrderedRegionCodes } from '@/data/regionCodes';
import {
  getInitContext,
  setInitContext,
  SUBJECT_GROUPS,
  SUBJECT_OPTIONS,
  SUBJECT_OTHER_PREFIX,
  TEACHING_AGE_RANGES,
  type InitContext,
  type SubjectKey,
} from '@/utils/initContext';
import { detectUserRegion, getRegionDisplayNameI18n } from '@/utils/regionUtils';
import LanguageSelector from '@/components/LanguageSelector';

type RoleType = 'student' | 'parent' | 'teacher';

export default function OnboardRolePage() {
  const { t } = useTranslation('onboard');
  const { user, loading: authLoading, refreshUser } = useAuth();
  const router = useRouter();
  const [selectedRole, setSelectedRole] = useState<RoleType | null>(null);
  const [regionCode, setRegionCode] = useState<string>('');
  const currentYear = useMemo(() => new Date().getFullYear(), []);
  const [birthYear, setBirthYear] = useState<number | ''>(currentYear - 12);
  const [teachingAgeRanges, setTeachingAgeRanges] = useState<string[]>([]);
  const [subjects, setSubjects] = useState<string[]>([]);
  const [otherSubjectText, setOtherSubjectText] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [roleError, setRoleError] = useState<string | null>(null);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const existingRole = user?.role as string | undefined;
  const hasRole = ['student', 'parent', 'teacher'].includes(existingRole || '');
  const effectiveRole: RoleType | null = hasRole
    ? (existingRole as RoleType)
    : selectedRole;
  const isTeacher = effectiveRole === 'teacher';
  const regionCodes = useMemo(() => getOrderedRegionCodes(), []);
  const { i18n } = useTranslation();

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const detected = detectUserRegion();
    setRegionCode(detected.code);
  }, []);

  useEffect(() => {
    if (!authLoading) {
      if (!user) {
        router.replace('/login');
        return;
      }
      // 允许用户再次进入修改 role，不再强制重定向
      if (hasRole) setSelectedRole(existingRole as RoleType);
    }
  }, [user, authLoading, hasRole, existingRole, router]);

  useEffect(() => {
    const init = getInitContext();
    if (init?.birthYear != null) setBirthYear(init.birthYear);
    else if (init?.age != null) setBirthYear(currentYear - init.age);
    if (init?.subjects?.length) {
      const list: string[] = [];
      const otherParts: string[] = [];
      for (const s of init.subjects) {
        if (s.startsWith(SUBJECT_OTHER_PREFIX)) {
          otherParts.push(s.slice(SUBJECT_OTHER_PREFIX.length).trim());
        } else {
          list.push(s);
        }
      }
      setSubjects(list);
      setOtherSubjectText(otherParts.join('，'));
    }
    if (init?.teachingAgeRanges?.length) {
      setTeachingAgeRanges(init.teachingAgeRanges);
    }
  }, [currentYear]);

  const handleToggleSubject = (s: string) => {
    setSubjects((prev) =>
      prev.includes(s) ? prev.filter((x) => x !== s) : [...prev, s]
    );
  };

  const handleToggleTeachingAge = (value: string) => {
    setTeachingAgeRanges((prev) =>
      prev.includes(value)
        ? prev.filter((x) => x !== value)
        : [...prev, value]
    );
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const role = effectiveRole;
    if (!role) {
      setRoleError(t('pleaseSelectRole'));
      return;
    }
    setRoleError(null);
    setSubmitting(true);
    try {
      // 如果用户还没有 role，或者选择的 role 与当前不同，则更新 role
      if (!hasRole || existingRole !== role) {
        const res = await api.auth.updateRole(role);
        if (!res?.success) throw new Error(res?.message || res?.error || '更新角色失败');
      }
      const finalRegion =
        regionCode || (typeof window !== 'undefined' ? detectUserRegion().code : 'CN');
      const otherEntries = otherSubjectText
        .split(/[,，、;；\s]+/)
        .map((x) => x.trim())
        .filter(Boolean)
        .map((x) => SUBJECT_OTHER_PREFIX + x);
      const allSubjects = [
        ...(subjects.length ? subjects : [SUBJECT_OPTIONS[0]]),
        ...otherEntries,
      ];
      const ctx: InitContext = {
        role,
        region: finalRegion,
        subjects: allSubjects,
      };
      if (isTeacher) {
        ctx.teachingAgeRanges = teachingAgeRanges;
      } else {
        const year = birthYear === '' ? currentYear - 12 : Number(birthYear);
        ctx.birthYear = year;
        ctx.age = currentYear - year;
      }
      setInitContext(ctx);
      const saveRes = await api.onboard.saveContext(ctx);
      if (!saveRes?.success) throw new Error(saveRes?.message || saveRes?.error || '保存失败');
      await refreshUser();
      router.replace('/');
    } catch (err: any) {
      setRoleError(err?.message || t('saveFailed'));
    } finally {
      setSubmitting(false);
    }
  };

  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center" suppressHydrationWarning>
        <p className="text-gray-500">{mounted ? t('loading') : 'Loading...'}</p>
      </div>
    );
  }
  if (!user) {
    return null;
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 p-4">
      <form
        onSubmit={handleSubmit}
        className="w-full max-w-md rounded-xl border border-gray-200 bg-white p-6 shadow-sm relative"
      >
        <div className="absolute top-4 right-4">
          <LanguageSelector variant="button" />
        </div>
        <h2 className="text-lg font-semibold text-gray-900 mb-1 pr-20">
          {t('title')}
        </h2>
        <p className="text-sm text-gray-500 mb-6">
          {t('subtitle')}
        </p>

        {/* Step 1：身份 */}
        <div className="mb-6">
          <label className="block text-sm font-medium text-gray-700 mb-2">
            {t('yourIdentity')}
          </label>
          <div className="flex flex-wrap gap-3">
            {(['student', 'parent', 'teacher'] as const).map((r) => (
              <button
                key={r}
                type="button"
                onClick={() => setSelectedRole(r)}
                className={`rounded-lg border px-4 py-2.5 text-sm font-medium transition-colors ${
                  effectiveRole === r
                    ? 'border-blue-500 bg-blue-50 text-blue-700'
                    : 'border-gray-300 bg-white text-gray-700 hover:bg-gray-50'
                }`}
              >
                {r === 'student' && t('roleStudent')}
                {r === 'parent' && t('roleParent')}
                {r === 'teacher' && t('roleTeacher')}
              </button>
            ))}
          </div>
          {roleError && (
            <p className="mt-2 text-sm text-red-500">{roleError}</p>
          )}
        </div>

        {/* Step 1.5 + 2：仅当已选身份时展示 */}
        {effectiveRole && (
          <>
            <div className="mb-6">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                {t('regionLabel')}
              </label>
              <select
                value={regionCode || regionCodes[0]}
                onChange={(e) => setRegionCode(e.target.value)}
                className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                {regionCodes.map((code) => (
                  <option key={code} value={code}>
                    {getRegionDisplayNameI18n(code, i18n.language)} ({code})
                  </option>
                ))}
              </select>
            </div>

            {isTeacher ? (
              <div className="mb-6">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  {t('teachingAgeLabel')}
                </label>
                <div className="flex flex-wrap gap-2">
                  {TEACHING_AGE_RANGES.map((opt: (typeof TEACHING_AGE_RANGES)[number]) => (
                    <button
                      key={opt.value}
                      type="button"
                      onClick={() => handleToggleTeachingAge(opt.value)}
                      className={`rounded-full border px-3 py-1.5 text-sm transition-colors ${
                        teachingAgeRanges.includes(opt.value)
                          ? 'border-blue-500 bg-blue-50 text-blue-700'
                          : 'border-gray-300 bg-white text-gray-600 hover:bg-gray-50'
                      }`}
                    >
                      {t(`ageRange.${opt.value}`)}
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              <div className="mb-6">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  {effectiveRole === 'parent'
                    ? t('childBirthYearLabel')
                    : t('birthYearLabel')}
                </label>
                <input
                  type="number"
                  min={currentYear - 120}
                  max={currentYear}
                  value={birthYear}
                  onChange={(e) =>
                    setBirthYear(
                      e.target.value === '' ? '' : Number(e.target.value)
                    )
                  }
                  className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder={t('birthYearPlaceholder')}
                />
              </div>
            )}

            <div className="mb-6">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                {isTeacher ? t('subjectsLabelTeacher') : t('subjectsLabelOther')}
              </label>
              <div className="space-y-4">
                {SUBJECT_GROUPS.map((group) => (
                  <div key={group.key}>
                    <div className="text-xs font-medium text-gray-500 mb-1.5">
                      {t(`subjectGroups.${group.key}`)}
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {group.subjects.map((s: SubjectKey) => (
                        <button
                          key={s}
                          type="button"
                          onClick={() => handleToggleSubject(s)}
                          className={`rounded-full border px-3 py-1.5 text-sm transition-colors ${
                            subjects.includes(s)
                              ? 'border-blue-500 bg-blue-50 text-blue-700'
                              : 'border-gray-300 bg-white text-gray-600 hover:bg-gray-50'
                          }`}
                        >
                          {t(`subjects.${s}`)}
                        </button>
                      ))}
                    </div>
                  </div>
                ))}
                <div>
                  <div className="text-xs font-medium text-gray-500 mb-1.5">
                    {t('subjectGroups.other')}
                  </div>
                  <input
                    type="text"
                    value={otherSubjectText}
                    onChange={(e) => setOtherSubjectText(e.target.value)}
                    placeholder={t('subjectsOtherPlaceholder')}
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm placeholder:text-gray-400 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                  />
                </div>
              </div>
            </div>
          </>
        )}

        <div className="flex justify-end">
          <button
            type="submit"
            disabled={!effectiveRole || submitting}
            className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {submitting ? t('saving') : t('saveAndEnter')}
          </button>
        </div>
      </form>
    </div>
  );
}
