import React, { useState, useEffect, useRef } from 'react';
import { Home, BookOpen, Target, PlayCircle, Menu, RefreshCw } from 'lucide-react';
import { JournalEntry, Project, Track, Counter, AppSettings } from './types';
import { todayKey, keyOf, uid, DEFAULT_CATS, getJournalFolderParts, fmtLong } from './utils';
import {
  registerDriveCallbacks,
  getDriveState,
  setupGIS,
  ensurePath,
  writeBinary,
  buildEntryIndex,
  readDocxAsText,
  writeFile,
  deleteFile,
  makeDocx
} from './drive';

// Subcomponents
import LockScreen from './components/LockScreen';
import HomeTab from './components/HomeTab';
import JournalTab from './components/JournalTab';
import ProjectsTab from './components/ProjectsTab';
import MediaTab from './components/MediaTab';
import MenuTab from './components/MenuTab';

export default function App() {
  const [locked, setLocked] = useState(true);
  const [tab, setTab] = useState<'home' | 'journal' | 'projects' | 'media' | 'menu'>('home');

  // Application Data States
  const [entries, setEntries] = useState<Record<string, JournalEntry>>({});
  const [projects, setProjects] = useState<Record<string, Project>>({});
  const [tracks, setTracks] = useState<Record<string, Track>>({});
  const [counters, setCounters] = useState<Record<string, Counter>>({});
  const [settings, setSettings] = useState<AppSettings>({
    pin: '1998',
    bio: false,
    autolock: 0,
    cats: DEFAULT_CATS
  });

  // Selected date state for journal picker
  const today = new Date();
  const [selDate, setSelDate] = useState({
    y: today.getFullYear(),
    m: today.getMonth(),
    d: today.getDate()
  });

  // Drive sync states
  const [entryIndex, setEntryIndex] = useState<Record<string, string>>({});
  const [driveStatus, setDriveStatus] = useState<'live' | 'connecting' | 'error'>('error');
  const [driveError, setDriveError] = useState('');

  const idleTimerRef = useRef<any>(null);

  // 1) Load data from LocalStorage on mount
  useEffect(() => {
    try {
      const storedEntries = localStorage.getItem('phm-entries');
      if (storedEntries) setEntries(JSON.parse(storedEntries));

      const storedProjects = localStorage.getItem('phm-projects');
      if (storedProjects) setProjects(JSON.parse(storedProjects));

      const storedTracks = localStorage.getItem('phm-tracks');
      if (storedTracks) {
        setTracks(JSON.parse(storedTracks));
      } else {
        // Initial default demo track
        const defaultTracks: Record<string, Track> = {
          'demo-1': { id: 'demo-1', name: 'Rosary loop placeholder (Demo)', duration: 33, autoCount: 0, demo: true }
        };
        setTracks(defaultTracks);
        localStorage.setItem('phm-tracks', JSON.stringify(defaultTracks));
      }

      const storedCounters = localStorage.getItem('phm-counters');
      if (storedCounters) setCounters(JSON.parse(storedCounters));

      const storedSettings = localStorage.getItem('phm-settings');
      if (storedSettings) {
        const parsed = JSON.parse(storedSettings);
        if (!parsed.cats) parsed.cats = DEFAULT_CATS;
        setSettings(parsed);
        // If there's no PIN set, don't lock the app on startup
        if (!parsed.pin) {
          setLocked(false);
        }
      } else {
        setLocked(false);
      }
    } catch (e) {}

    // Initialize GIS client on mount
    setupGIS();
  }, []);

  // 2) Save settings, entries, projects, etc. to LocalStorage whenever they change
  const saveToLocalStorage = (key: string, data: any) => {
    try {
      localStorage.setItem(key, JSON.stringify(data));
    } catch (e) {}
  };

  // Register Google Drive connection callbacks
  useEffect(() => {
    registerDriveCallbacks(
      (status, errDetail) => {
        setDriveStatus(status);
        if (status === 'error' && errDetail) {
          setDriveError(errDetail);
        } else {
          setDriveError('');
        }
      },
      async () => {
        // Callback when connection becomes live: build file index
        try {
          const idx = await buildEntryIndex();
          setEntryIndex(idx);
          // Auto sync entries from drive index that are missing locally
          // (Can download missing keys if needed, or wait for click)
        } catch (e) {}
      }
    );
  }, []);

  // 3) Idle Auto-Lock Timer listener
  useEffect(() => {
    const handleActivity = () => {
      if (settings.autolock > 0 && !locked) {
        if (idleTimerRef.current) clearTimeout(idleTimerRef.current);
        idleTimerRef.current = setTimeout(() => {
          setLocked(true);
        }, settings.autolock * 60 * 1000);
      }
    };

    if (settings.autolock > 0 && !locked) {
      window.addEventListener('mousemove', handleActivity);
      window.addEventListener('keydown', handleActivity);
      window.addEventListener('click', handleActivity);
      window.addEventListener('touchstart', handleActivity);
      handleActivity(); // trigger first init
    } else {
      if (idleTimerRef.current) clearTimeout(idleTimerRef.current);
    }

    return () => {
      window.removeEventListener('mousemove', handleActivity);
      window.removeEventListener('keydown', handleActivity);
      window.removeEventListener('click', handleActivity);
      window.removeEventListener('touchstart', handleActivity);
      if (idleTimerRef.current) clearTimeout(idleTimerRef.current);
    };
  }, [settings.autolock, locked]);

  // 4) Unified Data Persister Handlers
  const handleSaveEntry = async (dk: string, text: string) => {
    const updated = {
      ...entries,
      [dk]: { text, updatedAt: Date.now() }
    };
    setEntries(updated);
    saveToLocalStorage('phm-entries', updated);

    // Sync to Google Drive silently if connected
    const ds = getDriveState();
    if (ds.ready) {
      try {
        const parts = getJournalFolderParts(dk);
        const folderId = await ensurePath(parts);
        if (folderId) {
          const bytes = makeDocx(fmtLong(dk), text);
          const name = `${dk}.docx`;
          const resp = await writeBinary(
            name,
            folderId,
            bytes,
            'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
          );
          if (resp && resp.id) {
            setEntryIndex((prev) => ({ ...prev, [dk]: resp.id }));
          }
        }
      } catch (e) {}
    }
  };

  const handleLoadEntryFromDrive = async (dk: string): Promise<string | null> => {
    const fileId = entryIndex[dk];
    if (!fileId) return null;
    try {
      const text = await readDocxAsText(fileId);
      if (text !== null) {
        const updated = {
          ...entries,
          [dk]: { text, updatedAt: Date.now() }
        };
        setEntries(updated);
        saveToLocalStorage('phm-entries', updated);
        return text;
      }
    } catch (e) {}
    return null;
  };

  const handleSaveProject = async (p: Project) => {
    const updated = {
      ...projects,
      [p.id]: { ...p, updatedAt: Date.now() }
    };
    setProjects(updated);
    saveToLocalStorage('phm-projects', updated);

    // Sync project config to Drive
    const ds = getDriveState();
    if (ds.ready) {
      try {
        const folderId = await ensurePath(['projects']);
        if (folderId) {
          await writeFile(`${p.id}.json`, folderId, JSON.stringify(p), 'application/json');
        }
      } catch (e) {}
    }
  };

  const handleDeleteProject = async (id: string) => {
    const updated = { ...projects };
    delete updated[id];
    setProjects(updated);
    saveToLocalStorage('phm-projects', updated);

    // Delete project file on Drive
    const ds = getDriveState();
    if (ds.ready) {
      try {
        const folderId = await ensurePath(['projects']);
        if (folderId) {
          await deleteFile(`${id}.json`, folderId);
        }
      } catch (e) {}
    }
  };

  const handleSaveTrack = async (tr: Track) => {
    let updated: Record<string, Track>;
    if (tr._deleted) {
      updated = { ...tracks };
      delete updated[tr.id];
    } else {
      updated = {
        ...tracks,
        [tr.id]: tr
      };
    }
    setTracks(updated);
    saveToLocalStorage('phm-tracks', updated);

    // Sync tracks config to Drive
    const ds = getDriveState();
    if (ds.ready) {
      try {
        const folderId = await ensurePath(['media']);
        if (folderId) {
          await writeFile('tracks.json', folderId, JSON.stringify(updated), 'application/json');
        }
      } catch (e) {}
    }
  };

  const handleSaveCounter = async (c: Counter) => {
    const updated = {
      ...counters,
      [c.id]: c
    };
    setCounters(updated);
    saveToLocalStorage('phm-counters', updated);

    // Sync counters config to Drive
    const ds = getDriveState();
    if (ds.ready) {
      try {
        const folderId = await ensurePath(['media']);
        if (folderId) {
          await writeFile('counters.json', folderId, JSON.stringify(updated), 'application/json');
        }
      } catch (e) {}
    }
  };

  const handleDeleteCounter = async (id: string) => {
    const updated = { ...counters };
    delete updated[id];
    setCounters(updated);
    saveToLocalStorage('phm-counters', updated);

    // Sync counters deletion config to Drive
    const ds = getDriveState();
    if (ds.ready) {
      try {
        const folderId = await ensurePath(['media']);
        if (folderId) {
          await writeFile('counters.json', folderId, JSON.stringify(updated), 'application/json');
        }
      } catch (e) {}
    }
  };

  const handleSaveSettings = async (s: AppSettings) => {
    setSettings(s);
    saveToLocalStorage('phm-settings', s);
  };

  // 5) JSON Backup Import/Export Handlers
  const handleExportJSON = () => {
    const payload = {
      entries,
      projects,
      tracks,
      counters,
      settings
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `project-hail-mary-backup-${todayKey()}.json`;
    document.body.appendChild(a);
    a.click();
    a.remove();
  };

  const handleImportJSON = async (jsonStr: string) => {
    const parsed = JSON.parse(jsonStr);
    if (parsed.entries) {
      setEntries(parsed.entries);
      saveToLocalStorage('phm-entries', parsed.entries);
    }
    if (parsed.projects) {
      setProjects(parsed.projects);
      saveToLocalStorage('phm-projects', parsed.projects);
    }
    if (parsed.tracks) {
      setTracks(parsed.tracks);
      saveToLocalStorage('phm-tracks', parsed.tracks);
    }
    if (parsed.counters) {
      setCounters(parsed.counters);
      saveToLocalStorage('phm-counters', parsed.counters);
    }
    if (parsed.settings) {
      setSettings(parsed.settings);
      saveToLocalStorage('phm-settings', parsed.settings);
    }
  };

  const handleJumpDate = (y: number, m: number, d: number) => {
    setSelDate({ y, m, d });
    setTab('journal');
  };

  // Explicit sync / reload function
  const handleRefresh = async () => {
    const ds = getDriveState();
    if (!ds.ready) {
      alert('Google Drive is not connected. Go to "Settings" tab and click "Authorize Google Drive".');
      return;
    }

    try {
      // Re-build index
      const idx = await buildEntryIndex();
      setEntryIndex(idx);
      setDriveStatus('live');
      alert('File index synchronized perfectly!');
    } catch (e: any) {
      setDriveStatus('error');
      setDriveError(e.message || 'Unknown refresh error');
    }
  };

  return (
    <div className="w-full h-screen bg-[#07100F] text-[#EAF2F1] flex flex-col md:flex-row overflow-hidden relative">
      
      {locked ? (
        <LockScreen settings={settings} onUnlock={() => setLocked(false)} />
      ) : (
        <>
          {/* Side / Rail navigation layout on desktop, or top status banner */}
          <div className="md:w-[84px] bg-[#0E1A1A] border-b md:border-b-0 md:border-r border-[rgba(255,255,255,0.06)] flex flex-row md:flex-col items-center justify-around md:justify-start md:py-8 gap-1 shrink-0 z-10 select-none order-2 md:order-1 h-[68px] md:h-auto w-full md:w-auto">
            {/* Brand Logo only on desktop */}
            <div className="hidden md:grid w-11 h-11 rounded-xl bg-linear-to-br from-[#132726] to-[#0B1716] border border-[rgba(47,212,196,0.1)] place-items-center mb-6">
              <span className="text-[#2FD4C4] font-black text-xs">PHM</span>
            </div>

            {[
              { id: 'home', icon: Home, label: 'Home' },
              { id: 'journal', icon: BookOpen, label: 'Journal' },
              { id: 'projects', icon: Target, label: 'Goals' },
              { id: 'media', icon: PlayCircle, label: 'Media' },
              { id: 'menu', icon: Menu, label: 'Settings' }
            ].map((item) => {
              const Icon = item.icon;
              const isActive = tab === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => setTab(item.id as any)}
                  className={`flex flex-col items-center gap-1 p-2 md:w-16 md:h-16 rounded-xl transition duration-150 ${
                    isActive ? 'text-[#2FD4C4] bg-[rgba(47,212,196,0.05)]' : 'text-[#5E7977] hover:text-[#cfe6e3]'
                  }`}
                >
                  <Icon className="w-5 h-5" />
                  <span className="text-[10px] font-bold tracking-wide">{item.label}</span>
                </button>
              );
            })}

            {/* Locked screen secure lock trigger button */}
            {settings.pin && (
              <button
                onClick={() => setLocked(true)}
                className="flex flex-col items-center gap-1 p-2 text-[#5E7977] hover:text-[#E26D7A] md:mt-auto"
                title="Lock Application"
              >
                <span className="text-xs">🔒</span>
                <span className="text-[9px] font-bold">Lock</span>
              </button>
            )}
          </div>

          {/* Active page components container */}
          <div className="flex-1 flex flex-col overflow-hidden order-1 md:order-2 h-[calc(100vh-68px)] md:h-auto">
            {tab === 'home' && (
              <HomeTab
                entries={entries}
                projects={projects}
                onRefresh={handleRefresh}
                onOpenEditor={(dk) => {
                  setSelDate({
                    y: +dk.slice(0, 4),
                    m: +dk.slice(4, 6) - 1,
                    d: +dk.slice(6, 8)
                  });
                  setTab('journal');
                }}
                onOpenProjectForm={() => {
                  setTab('projects');
                }}
                onOpenProjectDetail={(id) => {
                  setTab('projects');
                }}
              />
            )}

            {tab === 'journal' && (
              <JournalTab
                entries={entries}
                entryIndex={entryIndex}
                onRefresh={handleRefresh}
                onSaveEntry={handleSaveEntry}
                onLoadEntryFromDrive={handleLoadEntryFromDrive}
                selDate={selDate}
                setSelDate={setSelDate}
              />
            )}

            {tab === 'projects' && (
              <ProjectsTab
                projects={projects}
                categories={settings.cats || DEFAULT_CATS}
                onSaveProject={handleSaveProject}
                onDeleteProject={handleDeleteProject}
              />
            )}

            {tab === 'media' && (
              <MediaTab
                tracks={tracks}
                counters={counters}
                onSaveTrack={handleSaveTrack}
                onSaveCounter={handleSaveCounter}
                onDeleteCounter={handleDeleteCounter}
                onRefresh={handleRefresh}
              />
            )}

            {tab === 'menu' && (
              <MenuTab
                settings={settings}
                onSaveSettings={handleSaveSettings}
                entries={entries}
                projects={projects}
                tracks={tracks}
                counters={counters}
                onImportJSON={handleImportJSON}
                onExportJSON={handleExportJSON}
                onJumpDate={handleJumpDate}
                driveStatus={driveStatus}
                driveError={driveError}
              />
            )}
          </div>
        </>
      )}

    </div>
  );
}
