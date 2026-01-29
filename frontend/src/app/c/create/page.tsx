'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import ContentForm from '@/components/ContentForm';
import { useTranslation } from 'react-i18next';

export default function CreateContentPage() {
  const router = useRouter();
  const { t } = useTranslation();

  return (
    <div className="min-h-screen bg-background">
      {/* 内容区域 */}
      <div className="w-full">
        <div className="w-full h-screen">
          <ContentForm
            mode="create"
            className="w-full h-full"
            style={{ 
              width: '100%',
              height: '100vh',
              border: 'none',
              margin: '0',
              padding: '0'
            }}
          />
        </div>
      </div>
    </div>
  );
}

