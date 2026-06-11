'use client';
// Разговорная практика для Édito A2.

import { ConversationPractice } from '@/components/courses/ConversationPractice';

export default function EditoA2TalkPage() {
  return (
    <ConversationPractice
      title="Édito A2"
      backHref="/dashboard/student/courses/edito-a2"
      language="французский"
      level="A2"
      speechLang="fr-FR"
      voice="Alain"
    />
  );
}
