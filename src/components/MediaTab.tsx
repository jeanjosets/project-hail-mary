import React, { useState, useEffect, useRef } from 'react';
import { Plus, Play, Pause, RotateCw, SkipBack, SkipForward, Music, Trash, RefreshCw } from 'lucide-react';
import { Track, Counter } from '../types';
import { mmss, uid } from '../utils';
import {
  saveLocalAudio,
  loadLocalAudio,
  removeLocalAudio,
  getDriveState
} from '../drive';

interface MediaTabProps {
  tracks: Record<string, Track>;
  counters: Record<string, Counter>;
  onSaveTrack: (t: Track) => Promise<void>;
  onSaveCounter: (c: Counter) => Promise<void>;
  onDeleteCounter: (id: string) => Promise<void>;
  onRefresh: () => void;
}

export default function MediaTab({
  tracks,
  counters,
  onSaveTrack,
  onSaveCounter,
  onDeleteCounter,
  onRefresh
}: MediaTabProps) {
  const [activeTrackId, setActiveTrackId] = useState<string | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isLoop, setIsLoop] = useState(true);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [hasLocalFile, setHasLocalFile] = useState<Record<string, boolean>>({});
  const [localUrls, setLocalUrls] = useState<Record<string, string>>({});
  const [syncStatus, setSyncStatus] = useState('');

  const audioRef = useRef<HTMLAudioElement | null>(null);
  const progressTimerRef = useRef<any>(null);
  const playPromiseRef = useRef<any>(null);
  const countedRef = useRef(false);

  const activeTrack = activeTrackId ? tracks[activeTrackId] : null;

  // Initial load
  useEffect(() => {
    // Instantiate HTMLAudioElement
    const audio = new Audio();
    audioRef.current = audio;

    audio.addEventListener('loadedmetadata', () => {
      setDuration(audio.duration || 0);
    });

    audio.addEventListener('ended', () => {
      if (isLoop) {
        audio.currentTime = 0;
        safePlay();
      } else {
        setIsPlaying(false);
      }
    });

    // Check IndexedDB files on mount
    const checkIDB = async () => {
      const status: Record<string, boolean> = {};
      const urls: Record<string, string> = {};

      for (const trackId of Object.keys(tracks)) {
        if (tracks[trackId].demo) continue;
        const blob = await loadLocalAudio(trackId);
        if (blob) {
          status[trackId] = true;
          urls[trackId] = URL.createObjectURL(blob);
        } else {
          status[trackId] = false;
        }
      }
      setHasLocalFile(status);
      setLocalUrls(urls);

      // Select first non-demo track if available, or first demo
      const nonDemo = Object.keys(tracks).find((id) => !tracks[id].demo);
      const firstId = nonDemo || Object.keys(tracks)[0];
      if (firstId) {
        setActiveTrackId(firstId);
      }
    };

    checkIDB();

    return () => {
      audio.pause();
      if (progressTimerRef.current) clearInterval(progressTimerRef.current);
    };
  }, []);

  // Update track duration if changed or computed
  useEffect(() => {
    if (activeTrack && duration > 0 && Math.round(duration) !== activeTrack.duration) {
      onSaveTrack({
        ...activeTrack,
        duration: Math.round(duration)
      });
    }
  }, [duration, activeTrackId]);

  // Keep progress bar updated
  useEffect(() => {
    if (isPlaying) {
      progressTimerRef.current = setInterval(() => {
        if (audioRef.current) {
          const cur = audioRef.current.currentTime;
          setCurrentTime(cur);

          // Track play counts past 90%
          if (duration > 0 && !countedRef.current && cur / duration >= 0.9) {
            countedRef.current = true;
            incrementPlayCount();
          }
        }
      }, 250);
    } else {
      if (progressTimerRef.current) clearInterval(progressTimerRef.current);
    }
    return () => {
      if (progressTimerRef.current) clearInterval(progressTimerRef.current);
    };
  }, [isPlaying, duration]);

  const safePlay = () => {
    if (!audioRef.current) return;
    setIsPlaying(true);
    playPromiseRef.current = audioRef.current.play();
    playPromiseRef.current?.then(() => {
      playPromiseRef.current = null;
    }).catch(() => {
      playPromiseRef.current = null;
    });
  };

  const safePause = () => {
    if (!audioRef.current) return;
    setIsPlaying(false);
    if (playPromiseRef.current) {
      playPromiseRef.current.then(() => {
        audioRef.current?.pause();
        playPromiseRef.current = null;
      }).catch(() => {
        playPromiseRef.current = null;
      });
    } else {
      audioRef.current.pause();
    }
  };

  const loadAndPlayTrack = (trackId: string, autoPlay: boolean) => {
    const audio = audioRef.current;
    if (!audio) return;

    safePause();
    audio.src = '';
    audio.load();

    setActiveTrackId(trackId);
    countedRef.current = false;
    setCurrentTime(0);

    const localUrl = localUrls[trackId];
    if (localUrl) {
      audio.src = localUrl;
      if (autoPlay) {
        setTimeout(safePlay, 50);
      }
    } else {
      // Demo files placeholder stream url
      if (tracks[trackId].demo) {
        audio.src = 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3'; // safe public testing audio
        if (autoPlay) {
          setTimeout(safePlay, 50);
        }
      } else {
        alert('No audio file saved on this device. Click "Load audio file" below.');
      }
    }
  };

  const handleTogglePlay = () => {
    if (!activeTrackId) return;
    const audio = audioRef.current;
    if (!audio) return;

    if (!audio.src || audio.src === window.location.href) {
      loadAndPlayTrack(activeTrackId, true);
      return;
    }

    if (isPlaying) {
      safePause();
    } else {
      safePlay();
    }
  };

  const handleSkip = (dir: number) => {
    const ids = Object.keys(tracks);
    if (ids.length === 0) return;
    const curIdx = ids.indexOf(activeTrackId || '');
    const nextIdx = (curIdx + dir + ids.length) % ids.length;
    loadAndPlayTrack(ids[nextIdx], true);
  };

  const incrementPlayCount = async () => {
    if (!activeTrack) return;
    const updatedCount = (activeTrack.autoCount || 0) + 1;
    const updated = {
      ...activeTrack,
      autoCount: updatedCount
    };
    await onSaveTrack(updated);

    // Drive play counts delta sync
    const ds = getDriveState();
    if (ds.ready) {
      setSyncStatus('✓');
      setTimeout(() => setSyncStatus(''), 3000);
    }
  };

  // Add Manual Counter
  const handleAddCounter = async () => {
    const name = prompt('Counter name (e.g. Rosary, Push-ups):');
    if (name && name.trim()) {
      const c: Counter = {
        id: uid('c'),
        name: name.trim(),
        count: 0
      };
      await onSaveCounter(c);
    }
  };

  const handleIncrementCounter = async (c: Counter) => {
    const updated = { ...c, count: c.count + 1 };
    await onSaveCounter(updated);
  };

  const handleDecrementCounter = async (c: Counter) => {
    if (c.count <= 0) return;
    const updated = { ...c, count: c.count - 1 };
    await onSaveCounter(updated);
  };

  const handleResetCounter = async (c: Counter) => {
    if (confirm(`Reset ${c.name} to 0?`)) {
      const updated = { ...c, count: 0 };
      await onSaveCounter(updated);
    }
  };

  const handleRenameCounter = async (c: Counter) => {
    const name = prompt('Rename counter to:', c.name);
    if (name && name.trim()) {
      const updated = { ...c, name: name.trim() };
      await onSaveCounter(updated);
    }
  };

  // Load custom device file
  const handleLoadFile = (trackId: string) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'audio/*';
    input.onchange = async () => {
      const file = input.files?.[0];
      if (!file) return;

      try {
        await saveLocalAudio(trackId, file);
        const url = URL.createObjectURL(file);
        setLocalUrls((prev) => ({ ...prev, [trackId]: url }));
        setHasLocalFile((prev) => ({ ...prev, [trackId]: true }));

        // Pre-compute duration
        const tempAudio = new Audio();
        tempAudio.src = url;
        tempAudio.onloadedmetadata = () => {
          onSaveTrack({
            ...tracks[trackId],
            duration: Math.round(tempAudio.duration || 600)
          });
        };
      } catch (err: any) {
        alert('Failed to save audio blob to IndexedDB: ' + err.message);
      }
    };
    input.click();
  };

  const handleRemoveLocalFile = async (trackId: string) => {
    if (confirm('Erase local device file? You can re-upload it later.')) {
      if (activeTrackId === trackId) {
        safePause();
        if (audioRef.current) audioRef.current.src = '';
      }
      await removeLocalAudio(trackId);
      setHasLocalFile((prev) => ({ ...prev, [trackId]: false }));
      if (localUrls[trackId]) {
        URL.revokeObjectURL(localUrls[trackId]);
        setLocalUrls((prev) => {
          const copy = { ...prev };
          delete copy[trackId];
          return copy;
        });
      }
    }
  };

  const handleRemoveTrack = async (trackId: string) => {
    if (confirm('Completely delete this audio track from the app?')) {
      if (activeTrackId === trackId) {
        safePause();
        if (audioRef.current) audioRef.current.src = '';
        setActiveTrackId(null);
      }
      await removeLocalAudio(trackId);
      await onSaveTrack({ id: trackId, name: '', duration: 0, autoCount: 0, _deleted: true });
    }
  };

  // First counter for widget preview
  const firstCounter = Object.values(counters)[0];

  return (
    <div className="scroll flex-1 overflow-y-auto px-4 py-6 md:px-10 md:py-8 scrollable-y">
      <div className="max-w-[760px] mx-auto flex flex-col gap-4">
        {/* Header bar */}
        <div className="flex items-center justify-between">
          <h2 className="text-2xl font-extrabold tracking-tight text-[#EAF2F1]">Media</h2>
          <button
            onClick={onRefresh}
            className="px-3.5 py-1.5 rounded-lg text-xs font-bold border border-[rgba(47,212,196,0.16)] text-[#2FD4C4] hover:bg-[rgba(47,212,196,0.08)] flex items-center gap-1.5 transition"
          >
            <RefreshCw className="w-3.5 h-3.5" /> Refresh
          </button>
        </div>

        {/* 1) Manual counters */}
        <div className="flex items-center justify-between mt-1.5 mb-1.5">
          <span className="text-xs font-black tracking-widest text-[#5E7977] uppercase">Manual Counters</span>
          <button
            onClick={handleAddCounter}
            className="text-[#2FD4C4] font-bold text-xs flex items-center gap-1 hover:bg-[rgba(47,212,196,0.05)] px-2.5 py-1.5 rounded-lg transition"
          >
            <Plus className="w-4 h-4" /> New counter
          </button>
        </div>

        {Object.values(counters).length === 0 ? (
          <div className="text-xs italic text-[#5E7977] bg-[#0B1716] p-4 rounded-xl border border-dashed border-[rgba(255,255,255,0.06)]">
            No counters configured. Create one to log repetitions (e.g. Prayer loops, Fitness reps).
          </div>
        ) : (
          Object.values(counters).map((c) => (
            <div key={c.id} className="bg-[#0B1716] border border-[rgba(255,255,255,0.06)] rounded-xl p-4 flex flex-col items-center text-center gap-3 fade">
              <div className="font-extrabold text-sm text-[#EAF2F1]">{c.name}</div>
              <div className="text-4xl font-black text-[#2FD4C4]">{c.count}</div>

              <button
                onClick={() => handleIncrementCounter(c)}
                className="w-full py-3.5 rounded-xl font-extrabold bg-linear-to-r from-[#2FD4C4] to-[#0E7E78] text-[#04201D] hover:opacity-95 transition-all flex items-center justify-center gap-2"
              >
                <Plus className="w-5 h-5 stroke-[3px]" /> Count one
              </button>

              <div className="flex gap-2 w-full mt-1.5">
                <button
                  onClick={() => handleRenameCounter(c)}
                  className="flex-1 py-2 text-xs font-bold text-[#84A09D] border border-[rgba(255,255,255,0.06)] rounded-lg hover:bg-[rgba(255,255,255,0.02)] transition"
                >
                  Rename
                </button>
                <button
                  onClick={() => handleDecrementCounter(c)}
                  className="flex-1 py-2 text-xs font-bold text-[#84A09D] border border-[rgba(255,255,255,0.06)] rounded-lg hover:bg-[rgba(255,255,255,0.02)] transition"
                >
                  −1
                </button>
                <button
                  onClick={() => handleResetCounter(c)}
                  className="flex-1 py-2 text-xs font-bold text-[#E26D7A] border border-[rgba(255,255,255,0.06)] rounded-lg hover:bg-[rgba(255,255,255,0.02)] transition"
                >
                  Reset
                </button>
                <button
                  onClick={() => onDeleteCounter(c.id)}
                  className="px-3.5 py-2 text-xs font-bold text-[#E26D7A] border border-[rgba(255,255,255,0.06)] rounded-lg hover:bg-[rgba(255,255,255,0.02)] transition"
                  title="Delete"
                >
                  <Trash className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          ))
        )}

        {/* 2) Media Audio Player */}
        <span className="text-xs font-black tracking-widest text-[#5E7977] uppercase mt-4">Audio Player</span>
        
        <div className="bg-gradient-to-br from-[#132726] to-[#0B1716] border border-[rgba(47,212,196,0.16)] rounded-2xl p-5 flex flex-col gap-3.5 fade">
          <div className="font-extrabold text-base text-[#EAF2F1]">
            {activeTrack ? activeTrack.name : 'No track loaded'}
          </div>

          {/* Progress Slider */}
          <div className="flex flex-col gap-1.5">
            <div className="h-1.5 w-full bg-[#0B1716] rounded-full overflow-hidden">
              <div
                className="h-full bg-[#2FD4C4] rounded-full transition-all duration-300"
                style={{ width: `${duration > 0 ? (currentTime / duration) * 100 : 0}%` }}
              />
            </div>
            <div className="flex justify-between text-[11px] text-[#84A09D] font-bold">
              <span>{mmss(currentTime)}</span>
              <span>{activeTrack ? mmss(activeTrack.duration) : '0:00'}</span>
            </div>
          </div>

          {/* Player Controls */}
          <div className="flex items-center justify-center gap-5 mt-1">
            <button
              onClick={() => handleSkip(-1)}
              className="p-2.5 rounded-full bg-[#0B1716] text-[#84A09D] hover:text-[#2FD4C4] hover:bg-[#132726] transition"
            >
              <SkipBack className="w-4 h-4 fill-current" />
            </button>
            <button
              onClick={() => setIsLoop(!isLoop)}
              className={`p-2.5 rounded-full bg-[#0B1716] transition ${
                isLoop ? 'text-[#2FD4C4] bg-[#132726]' : 'text-[#5E7977]'
              }`}
              title="Toggle repeat"
            >
              <RotateCw className="w-4 h-4" />
            </button>
            <button
              onClick={handleTogglePlay}
              className="p-4 rounded-full bg-[#2FD4C4] text-[#04201D] hover:opacity-90 transition shadow-lg"
            >
              {isPlaying ? <Pause className="w-6 h-6 fill-current" /> : <Play className="w-6 h-6 fill-current ml-0.5" />}
            </button>
            <button
              onClick={() => handleSkip(1)}
              className="p-2.5 rounded-full bg-[#0B1716] text-[#84A09D] hover:text-[#2FD4C4] hover:bg-[#132726] transition"
            >
              <SkipForward className="w-4 h-4 fill-current" />
            </button>
          </div>

          {/* Play count */}
          <div className="flex justify-between items-center border-t border-[rgba(255,255,255,0.06)] pt-3 text-xs">
            <div className="flex items-center gap-2">
              <span className="text-[#84A09D] font-black uppercase tracking-wider text-[10px]">Total Plays</span>
              <span className="text-sm font-bold text-[#2FD4C4]">{activeTrack ? activeTrack.autoCount || 0 : 0}</span>
              {syncStatus && <span className="text-xs text-[#2FD4C4] ml-1">{syncStatus}</span>}
            </div>
            <span className="text-[10px] text-[#5E7977]">Counts once per play past 90%</span>
          </div>
        </div>

        {/* 3) Home-screen widget preview */}
        <span className="text-xs font-black tracking-widest text-[#5E7977] uppercase mt-4">Home-screen widget · preview</span>
        <div className="flex items-center gap-4 bg-gradient-to-br from-[#0d2b29] to-[#0a201f] border border-[rgba(47,212,196,0.16)] rounded-2xl p-4 fade">
          <button
            onClick={handleTogglePlay}
            className="p-3.5 rounded-full bg-[#2FD4C4] text-[#04201D] shadow-md"
          >
            {isPlaying ? <Pause className="w-5 h-5 fill-current" /> : <Play className="w-5 h-5 fill-current ml-0.5" />}
          </button>
          <div className="flex-1 flex flex-col gap-1">
            <div className="flex gap-6">
              <div>
                <div className="text-2xl font-black text-[#2FD4C4]">
                  {activeTrack ? activeTrack.autoCount || 0 : 0}
                </div>
                <div className="text-[10px] text-[#84A09D] font-bold uppercase tracking-wider">Plays</div>
              </div>
              {firstCounter && (
                <div>
                  <div className="text-2xl font-black text-[#2BA8C4]">{firstCounter.count}</div>
                  <div className="text-[10px] text-[#84A09D] font-bold uppercase tracking-wider">
                    {firstCounter.name}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* 4) Audio Track Lists */}
        <span className="text-xs font-black tracking-widest text-[#5E7977] uppercase mt-4">Audio Tracks</span>

        <div className="flex flex-col gap-2">
          {Object.values(tracks)
            .filter((tr) => !tr._deleted)
            .map((tr) => {
              const isActive = activeTrackId === tr.id;
              const hasFile = hasLocalFile[tr.id] === true || !!localUrls[tr.id] || tr.demo;

              return (
                <div
                  key={tr.id}
                  onClick={() => hasFile && loadAndPlayTrack(tr.id, true)}
                  className={`bg-[#0B1716] border rounded-xl p-3.5 flex items-center justify-between gap-3 transition ${
                    hasFile ? 'cursor-pointer hover:border-[rgba(47,212,196,0.2)]' : 'opacity-85'
                  } ${isActive ? 'border-[#2FD4C4] bg-[#0E1A1A]' : 'border-[rgba(255,255,255,0.06)]'}`}
                >
                  <Music className={`w-4 h-4 ${isActive ? 'text-[#2FD4C4]' : 'text-[#84A09D]'}`} />

                  <div className="flex-1 min-w-0">
                    <div className="font-extrabold text-sm text-[#EAF2F1] truncate">{tr.name}</div>
                    <div className="flex gap-2 items-center text-xs text-[#5E7977] mt-0.5">
                      <span>{mmss(tr.duration)}</span>
                      <span>•</span>
                      <span>{tr.autoCount || 0} plays</span>
                      {hasFile && !tr.demo && (
                        <span className="text-[10px] text-[#2FD4C4] font-bold bg-[rgba(47,212,196,0.08)] px-1.5 py-0.5 rounded-md ml-1">
                          ● On device
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
                    {!hasFile && !tr.demo && (
                      <button
                        onClick={() => handleLoadFile(tr.id)}
                        className="px-2.5 py-1.5 bg-[#2FD4C4] border border-[#2FD4C4] text-[#04201D] rounded-lg text-xs font-extrabold hover:opacity-95"
                      >
                        Load audio file
                      </button>
                    )}

                    {hasFile && !tr.demo && (
                      <button
                        onClick={() => handleRemoveLocalFile(tr.id)}
                        className="px-2.5 py-1.5 text-xs text-[#84A09D] hover:bg-[rgba(255,255,255,0.03)] border border-[rgba(255,255,255,0.06)] rounded-lg font-bold"
                      >
                        Remove file
                      </button>
                    )}

                    {!tr.demo && (
                      <button
                        onClick={() => handleRemoveTrack(tr.id)}
                        className="p-1.5 text-[#5E7977] hover:text-[#E26D7A] transition"
                        title="Delete track"
                      >
                        <Trash className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
        </div>
      </div>
    </div>
  );
}
