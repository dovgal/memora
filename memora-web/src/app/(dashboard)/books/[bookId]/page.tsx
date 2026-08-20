import { BookReader } from '@/components/books/BookReader';

export default async function BookPage({ params }: { params: Promise<{ bookId: string }> }) {
  const { bookId } = await params;
  return <BookReader bookId={bookId} />;
}
