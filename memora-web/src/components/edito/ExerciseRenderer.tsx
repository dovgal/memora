'use client';
import { EditoExercise } from '@/lib/courses/edito-a1';
import { Theory } from './Theory';
import { GrammarQuiz } from './GrammarQuiz';
import { GenderQuiz } from './GenderQuiz';
import { NumberQuiz } from './NumberQuiz';
import { FillBlank } from './FillBlank';
import { DialogueExercise } from './DialogueExercise';
import { SentenceBuilder } from './SentenceBuilder';

interface ExerciseRendererProps {
  exercise: EditoExercise;
  onComplete?: (id: string) => void;
}

export function ExerciseRenderer({ exercise, onComplete }: ExerciseRendererProps) {
  const handleComplete = () => onComplete?.(exercise.id);

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
    default:
      return null;
  }
}
