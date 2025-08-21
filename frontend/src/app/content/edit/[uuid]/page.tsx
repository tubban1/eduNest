export const dynamic = 'force-dynamic';
export const dynamicParams = true;
export const revalidate = 0;

import ContentForm from '@/components/ContentForm';

export default function EditPage({ params }: { params: { uuid: string } }) {
	return <ContentForm mode="edit" contentId={params.uuid} />;
} 