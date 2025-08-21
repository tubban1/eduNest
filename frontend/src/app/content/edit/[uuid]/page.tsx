import EditClient from './client';

export default function EditPage({ params }: { params: { uuid: string } }) {
	return <EditClient uuid={params.uuid} />;
} 