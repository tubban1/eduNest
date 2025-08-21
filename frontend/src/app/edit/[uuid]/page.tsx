import { redirect } from 'next/navigation';

export default function EditRedirectPage({ params }: { params: { uuid: string } }) {
	redirect(`/content/edit/${params.uuid}`);
}