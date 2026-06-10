'use client';
// Разговорная практика для Édito A1.

import { ConversationPractice } from '@/components/courses/ConversationPractice';

export default function EditoTalkPage() {
  return (
    <ConversationPractice
      title="Édito A1"
      backHref="/dashboard/student/courses/edito-a1"
      language="французский"
      level="A1"
      speechLang="fr-FR"
      voice="Alain"
    />
  );
}
