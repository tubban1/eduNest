"use client";

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslation } from 'react-i18next';
import { useAuth } from '@/hooks/useAuth';
import { api } from '@/lib/api';
import { getOrderedRegionCodes } from '@/data/regionCodes';
import {
  getInitContext,
  hasInitContext,
  setInitContext,
  SUBJECT_OPTIONS,
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
  const [teachingAgeRanges, setTeachingAgeRanges] = useState<string[]>(['junior']);
  const [subjects, setSubjects] = useState<string[]>([]);
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
      if (hasRole && hasInitContext()) {
        router.replace('/');
        return;
      }
      if (hasRole) setSelectedRole(existingRole as RoleType);
    }
  }, [user, authLoading, hasRole, existingRole, router]);

  useEffect(() => {
    const init = getInitContext();
    if (init?.birthYear != null) setBirthYear(init.birthYear);
    else if (init?.age != null) setBirthYear(currentYear - init.age);
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
      if (!hasRole) {
        const res = await api.auth.updateRole(role);
        if (!res?.success) throw new Error(res?.message || res?.error || '更新角色失败');
      }
      const finalRegion =
        regionCode || (typeof window !== 'undefined' ? detectUserRegion().code : 'CN');
      const ctx: InitContext = {
        role,
        region: finalRegion,
        subjects: subjects.length ? subjects : [SUBJECT_OPTIONS[0]],
      };
      if (isTeacher) {
        ctx.teachingAgeRanges =
          teachingAgeRanges.length > 0
            ? teachingAgeRanges
            : [TEACHING_AGE_RANGES[0].value];
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
    <div className="min-h-screen flex items-center justify-center bg-slate-50 p-4 relative">
      <div className="absolute top-4 right-4">
        <LanguageSelector variant="button" />
      </div>
      <form
        onSubmit={handleSubmit}
        className="w-full max-w-md rounded-xl border border-gray-200 bg-white p-6 shadow-sm"
      >
        <h2 className="text-lg font-semibold text-gray-900 mb-1">
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
                onClick={() => !hasRole && setSelectedRole(r)}
                disabled={hasRole}
                className={`rounded-lg border px-4 py-2.5 text-sm font-medium transition-colors ${
                  effectiveRole === r
                    ? 'border-blue-500 bg-blue-50 text-blue-700'
                    : hasRole
                      ? 'border-gray-200 bg-gray-50 text-gray-400 cursor-default'
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
                  min={currentYear - 25}
                  max={currentYear - 3}
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
              <div className="flex flex-wrap gap-2">
                {SUBJECT_OPTIONS.map((s: SubjectKey) => (
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
