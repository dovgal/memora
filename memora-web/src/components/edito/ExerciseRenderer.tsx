'use client';
import { EditoExercise, ExerciseResult } from '@/lib/courses/edito-a1';
import { Theory } from './Theory';
import { GrammarQuiz } from './GrammarQuiz';
import { GenderQuiz } from './GenderQuiz';
import { NumberQuiz } from './NumberQuiz';
import { FillBlank } from './FillBlank';
import { DialogueExercise } from './DialogueExercise';
import { SentenceBuilder } from './SentenceBuilder';
import { ListeningExercise } from './ListeningExercise';
import { VideoExercise } from './VideoExercise';
import { ErrorHunt } from './ErrorHunt';

export type { ExerciseResult };

interface ExerciseRendererProps {
  exercise: EditoExercise;
  /** result передаётся компонентами, которые считают ошибки (квизы, пропуски, диалоги). */
  onComplete?: (id: string, result?: ExerciseResult) => void;
}

export function ExerciseRenderer({ exercise, onComplete }: ExerciseRendererProps) {
  const handleComplete = (result?: ExerciseResult) => onComplete?.(exercise.id, result);

  switch (exercise.type) {
    case 'theory':
      return <Theory exercise={exercise} />;
    case 'grammar-quiz':
      return <GrammarQuiz exercise={exercise} onComplete={handleComplete} />;
    case 'gender-quiz':
      return <GenderQuiz exercise={exercise} onComplete={handleComplete} />;
    case 'number-quiz':
      return <NumberQuiz exercise={exercise} onComplete={handleComplete} />;
    case 'fill-blank':
      return <FillBlank exercise={exercise} onComplete={handleComplete} />;
    case 'dialogue':
      return <DialogueExercise exercise={exercise} onComplete={handleComplete} />;
    case 'sentence-builder':
      return <SentenceBuilder exercise={exercise} onComplete={handleComplete} />;
    case 'listening':
      return <ListeningExercise exercise={exercise} onComplete={handleComplete} />;
    case 'video':
      return <VideoExercise exercise={exercise} onComplete={handleComplete} />;
    case 'error-hunt':
      return <ErrorHunt exercise={exercise} onComplete={handleComplete} />;
    default:
      return null;
  }
}
