import EditClient from './client';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export default function EditPage({ params }: { params: { uuid: string } }) {
	return <EditClient uuid={params.uuid} />;
} 