import type { Track, TrackId } from "./types";
import { pythonTrack } from "./python-course";
import { sqlTrack } from "./sql-course";
import { dataAnalystTrack } from "./data-analyst-course";
import { oopTrack } from "./oop-course";
import { statisticsTrack } from "./statistics-course";

export const tracks: Track[] = [pythonTrack, sqlTrack, dataAnalystTrack, oopTrack, statisticsTrack];

export function getTrack(id: string): Track | undefined {
  return tracks.find((t) => t.id === (id as TrackId));
}

export function getLesson(trackId: string, lessonId: string) {
  const track = getTrack(trackId);
  if (!track) return undefined;
  const lesson = track.lessons.find((l) => l.id === lessonId);
  if (!lesson) return undefined;
  return { track, lesson };
}
