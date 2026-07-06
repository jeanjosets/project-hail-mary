export interface JournalEntry {
  text: string;
  updatedAt: number;
}

export interface SubtaskFile {
  id: string;
  name: string;
  kind: 'photo' | 'graph' | 'file';
}

export interface Subtask {
  id: string;
  title: string;
  done: boolean;
  files: SubtaskFile[];
}

export interface ProjectUpdate {
  id: string;
  ts: number;
  text: string;
}

export interface ProjectFile {
  id: string;
  name: string;
  kind: 'photo' | 'graph' | 'file';
}

export interface Project {
  id: string;
  title: string;
  category: string;
  note: string;
  start: string; // YYYYMMDD
  target: string | null; // YYYYMMDD
  end: string | null; // YYYYMMDD
  progress: number | null; // manual progress %
  subtasks: Subtask[];
  updates: ProjectUpdate[];
  files: ProjectFile[];
  createdAt: number;
  updatedAt?: number;
}

export interface Track {
  id: string;
  name: string;
  duration: number; // in seconds
  autoCount: number;
  demo?: boolean;
  driveId?: string;
  _deleted?: boolean;
}

export interface Counter {
  id: string;
  name: string;
  count: number;
}

export interface AppSettings {
  pin: string;
  bio: boolean;
  autolock: number; // minutes before lock, 0 to disable
  cats?: string[];
  credentialIds?: string[];
}

export interface DateState {
  y: number;
  m: number;
  d: number;
}

export interface CalendarState {
  y: number;
  m: number;
}
