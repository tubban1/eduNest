'use client';
import { useParams } from 'next/navigation';
import ContentForm from '@/components/ContentForm';

export default function EditPage() {
  const params = useParams();
  const contentId = params?.uuid as string;
  return <ContentForm mode="edit" contentId={contentId} />;
} 