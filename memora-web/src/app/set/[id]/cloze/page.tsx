import { ClozeTrainer } from '@/components/cloze/ClozeTrainer';

export default async function ClozePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <ClozeTrainer setId={id} />;
}
