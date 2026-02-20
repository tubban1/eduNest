'use client';

import React, { useState, useEffect, useRef } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import { api } from '@/lib/api';
import { useAuth } from '@/hooks/useAuth';
import { useTranslation } from 'react-i18next';

function getBaseName(name: string): string {
  const last = name.lastIndexOf('.');
  return last <= 0 ? name : name.slice(0, last);
}

export default function ListImportPage() {
  const params = useParams();
  const { user } = useAuth();
  const { t } = useTranslation(['common', 'collections']);
  const [loading, setLoading] = useState(true);
  const [listData, setListData] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const [importing, setImporting] = useState(false);
  const [result, setResult] = useState<{ created: number; failed: number; results?: any[]; errors?: any[] } | null>(null);
  const [mounted, setMounted] = useState(false);
  const [pairedItems, setPairedItems] = useState<Array<{ baseName: string; full_html: string; title?: string; description?: string; tags?: string[]; language_code?: string; content_type?: string; svg_thumbnail?: string }>>([]);
  const folderInputRef = useRef<HTMLInputElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => { setMounted(true); }, []);

  useEffect(() => {
    const fetchList = async () => {
      if (!mounted || !user?.id) {
        setLoading(false);
        return;
      }
      try {
        setLoading(true);
        setError(null);
        const shortId = params.short_id as string;
        const data = await api.collectionList.getByShortId(shortId);
        if (!data?.list || !data?.user_access?.is_owner) {
          setError(t('collections:list.noPermission') || 'No permission');
          setListData(null);
        } else {
          setListData(data);
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Load failed');
        setListData(null);
      } finally {
        setLoading(false);
      }
    };
    if (params.short_id && mounted) fetchList();
  }, [params.short_id, user?.id, mounted, t]);

  const readFilesAsPairs = async (fileList: FileList | null): Promise<void> => {
    if (!fileList || fileList.length === 0) return;
    const byBase: Record<string, { html?: string; json?: Record<string, unknown> }> = {};
    const files = Array.from(fileList);
    for (const file of files) {
      const base = getBaseName(file.name);
      const ext = file.name.slice(base.length).toLowerCase();
      if (ext === '.html' || file.name.toLowerCase().endsWith('.html')) {
        const text = await file.text();
        if (!byBase[base]) byBase[base] = {};
        byBase[base].html = text;
      } else if (ext === '.json' || file.name.toLowerCase().endsWith('.json')) {
        try {
          const text = await file.text();
          const data = JSON.parse(text) as Record<string, unknown>;
          if (!byBase[base]) byBase[base] = {};
          byBase[base].json = data;
        } catch {
          // 忽略无效 json
        }
      }
    }
    const paired: Array<{ baseName: string; full_html: string; title?: string; description?: string; tags?: string[]; language_code?: string; content_type?: string; svg_thumbnail?: string }> = [];
    for (const [baseName, v] of Object.entries(byBase)) {
      if (!v.html?.trim()) continue;
      const j = v.json || {};
      paired.push({
        baseName,
        full_html: v.html,
        title: typeof j.title === 'string' ? j.title.trim() : undefined,
        description: typeof j.description === 'string' ? j.description : undefined,
        tags: Array.isArray(j.tags) ? j.tags.map(String) : undefined,
        language_code: typeof j.language_code === 'string' ? j.language_code : undefined,
        content_type: typeof j.content_type === 'string' ? j.content_type : undefined,
        svg_thumbnail: typeof j.svg_thumbnail === 'string' ? j.svg_thumbnail : undefined,
      });
    }
    paired.sort((a, b) => a.baseName.localeCompare(b.baseName));
    setPairedItems(paired);
    setError(null);
    setResult(null);
  };

  const onFolderChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    readFilesAsPairs(e.target.files ?? null);
    e.target.value = '';
  };

  const onFilesChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    readFilesAsPairs(e.target.files ?? null);
    e.target.value = '';
  };

  const handleImport = async () => {
    if (!listData?.list?.id) return;
    if (pairedItems.length === 0) {
      setError('请先选择文件夹或选择多个 .html/.json 文件');
      return;
    }
    if (pairedItems.length > 100) {
      setError('单次最多 100 条');
      return;
    }
    const items = pairedItems.map(({ baseName: _, ...rest }) => rest);
    try {
      setImporting(true);
      setError(null);
      setResult(null);
      const res = await api.collectionList.importItems(listData.list.id, items);
      setResult({
        created: res?.created ?? 0,
        failed: res?.failed ?? 0,
        results: res?.results,
        errors: res?.errors,
      });
      api.collectionList.invalidateCache(listData.list.short_id);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Import failed');
    } finally {
      setImporting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4" />
          <p className="text-muted-foreground">{mounted ? '加载中...' : 'Loading...'}</p>
        </div>
      </div>
    );
  }

  if (error && !listData) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center max-w-md px-4">
          <p className="text-destructive mb-4">{error}</p>
          <Link href={`/list/${params.short_id}`} className="text-primary hover:underline">
            ← {t('collections:list.backToList')}
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="bg-white shadow-sm border-b">
        <div className="max-w-4xl mx-auto px-4 py-4">
          <div className="flex items-center mb-4">
            <Link
              href={`/list/${params.short_id}/settings`}
              className="px-3 py-2 text-gray-600 hover:text-gray-800 transition-colors mr-3"
            >
              ← {t('collections:list.listSettingsTitle')}
            </Link>
            <h1 className="flex-1 font-bold text-gray-900 text-xl">
              {t('collections:settings.batchImport')}
            </h1>
            <Link href="/" className="ml-3">
              <Image src="/favicon.png" alt="EduNest" width={32} height={32} className="w-8 h-8" />
            </Link>
          </div>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 py-6">
        <div className="bg-white rounded-lg shadow-sm border p-6">
          <p className="text-sm text-gray-500 mb-4">
            Skill 输出为成对文件：<code className="bg-gray-100 px-1 rounded">abc.html</code> + <code className="bg-gray-100 px-1 rounded">abc.json</code>。选择包含这些文件的文件夹（或同时多选所有 .html/.json），系统会按主文件名自动配对，单次最多 100 条。
          </p>
          {error && (
            <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded text-red-700 text-sm">
              {error}
            </div>
          )}
          {result && (
            <div className="mb-4 p-3 bg-green-50 border border-green-200 rounded text-green-800 text-sm">
              成功 {result.created} 条，失败 {result.failed} 条
              {result.errors?.length ? (
                <pre className="mt-2 text-xs overflow-auto max-h-24">{JSON.stringify(result.errors, null, 2)}</pre>
              ) : null}
            </div>
          )}
          <div className="flex flex-wrap gap-3 mb-4">
            <input
              ref={folderInputRef}
              type="file"
              className="hidden"
              {...({ webkitdirectory: '', directory: '' } as React.InputHTMLAttributes<HTMLInputElement>)}
              multiple
              onChange={onFolderChange}
            />
            <button
              type="button"
              onClick={() => folderInputRef.current?.click()}
              className="px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:opacity-90"
            >
              📁 选择文件夹
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept=".html,.json"
              className="hidden"
              multiple
              onChange={onFilesChange}
            />
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="px-4 py-2 border border-input rounded-lg hover:bg-gray-50"
            >
              📄 选择多个文件
            </button>
          </div>
          {pairedItems.length > 0 && (
            <div className="mb-4 p-3 bg-gray-50 rounded text-sm">
              <span className="font-medium">已配对 {pairedItems.length} 条：</span>
              <ul className="mt-1 text-gray-600 list-disc list-inside">
                {pairedItems.slice(0, 20).map((p) => (
                  <li key={p.baseName}>{p.baseName} {p.title ? `（${p.title}）` : ''}</li>
                ))}
                {pairedItems.length > 20 && <li>... 等 {pairedItems.length - 20} 条</li>}
              </ul>
            </div>
          )}
          <div className="flex gap-2">
            <button
              type="button"
              onClick={handleImport}
              disabled={importing || pairedItems.length === 0}
              className="px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:opacity-90 disabled:opacity-50"
            >
              {importing ? '导入中...' : '导入'}
            </button>
            <Link
              href={`/list/${params.short_id}`}
              className="px-4 py-2 border border-input rounded-lg hover:bg-gray-50"
            >
              {t('collections:settings.cancel')}
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
