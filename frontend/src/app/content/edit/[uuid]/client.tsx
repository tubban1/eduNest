'use client';
import ContentForm from '@/components/ContentForm';

export default function EditClient({ uuid }: { uuid: string }) {
	return <ContentForm mode="edit" contentId={uuid} />;
}