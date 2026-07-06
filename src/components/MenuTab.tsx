import React, { useState } from 'react';
import { Calendar, Search, Shield, Key, Plus, Trash, Settings, Download, Upload, Info, RefreshCw } from 'lucide-react';
import { AppSettings, JournalEntry, Project, Track, Counter } from '../types';
import { MONTHS, todayKey, keyOf, fmtMed, MON3 } from '../utils';
import { connectDrive, disconnectDrive } from '../drive';

interface MenuTabProps {
  settings: AppSettings;
  onSaveSettings: (s: AppSettings) => Promise<void>;
  entries: Record<string, JournalEntry>;
  projects: Record<string, Project>;
  tracks: Record<string, Track>;
  counters: Record<string, Counter>;
  onImportJSON: (jsonStr: string) => Promise<void>;
  onExportJSON: () => void;
  onJumpDate: (y: number, m: number, d: number) => void;
  driveStatus: 'live' | 'connecting' | 'error';
  driveError: string;
}

export default function MenuTab({
  settings,
  onSaveSettings,
  entries,
  projects,
  tracks,
  counters,
  onImportJSON,
  onExportJSON,
  onJumpDate,
  driveStatus,
  driveError
}: MenuTabProps) {
  const [sub, setSub] = useState<'sync' | 'calendar' | 'security' | 'categories' | 'import' | 'info'>('sync');

  // Search journal entries
  const [query, setQuery] = useState('');
  const [searchResults, setSearchResults] = useState<Array<{ dk: string; text: string }>>([]);

  // Password & Security settings
  const [pinInput, setPinInput] = useState(settings.pin);
  const [securityStatus, setSecurityStatus] = useState('');

  // Custom categories setup
  const [newCat, setNewCat] = useState('');

  const handleSearch = (q: string) => {
    setQuery(q);
    if (!q.trim()) {
      setSearchResults([]);
      return;
    }
    const cleanQ = q.toLowerCase();
    const matches: Array<{ dk: string; text: string }> = [];
    Object.keys(entries).forEach((dk) => {
      const entry = entries[dk];
      if (entry && entry.text.toLowerCase().includes(cleanQ)) {
        matches.push({ dk, text: entry.text });
      }
    });
    matches.sort((a, b) => b.dk.localeCompare(a.dk));
    setSearchResults(matches);
  };

  const handleUpdateSecurity = async () => {
    if (pinInput.length < 4) {
      alert('Password must be at least 4 digits');
      return;
    }
    const updated = {
      ...settings,
      pin: pinInput
    };
    await onSaveSettings(updated);
    setSecurityStatus('✓ Settings saved successfully');
    setTimeout(() => setSecurityStatus(''), 3000);
  };

  const handleToggleBio = async () => {
    const updated = {
      ...settings,
      bio: !settings.bio
    };
    await onSaveSettings(updated);
  };

  const handleUpdateAutolock = async (minutes: number) => {
    const updated = {
      ...settings,
      autolock: minutes
    };
    await onSaveSettings(updated);
  };

  const handleAddCategory = async () => {
    if (!newCat.trim()) return;
    const cats = [...(settings.cats || ['Learning', 'Health', 'Fitness'])];
    if (cats.includes(newCat.trim())) {
      alert('Category already exists');
      return;
    }
    const updated = {
      ...settings,
      cats: [...cats, newCat.trim()]
    };
    await onSaveSettings(updated);
    setNewCat('');
  };

  const handleDeleteCategory = async (cat: string) => {
    if (confirm(`Remove "${cat}" from categories list?`)) {
      const cats = (settings.cats || []).filter((c) => c !== cat);
      const updated = {
        ...settings,
        cats
      };
      await onSaveSettings(updated);
    }
  };

  const handleImportFile = () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json';
    input.onchange = async () => {
      const file = input.files?.[0];
      if (!file) return;
      const r = new FileReader();
      r.onload = async () => {
        try {
          await onImportJSON(r.result as string);
          alert('Database restored successfully from JSON backup!');
        } catch (e: any) {
          alert('Failed to restore backup: ' + e.message);
        }
      };
      r.readAsText(file);
    };
    input.click();
  };

  const totalEntriesCount = Object.keys(entries).length;
  const activeProjectsCount = Object.values(projects).filter((p) => !p.end).length;
  const completedProjectsCount = Object.values(projects).filter((p) => p.end).length;
  const totalTracksCount = Object.values(tracks).filter((tr) => !tr._deleted).length;

  return (
    <div className="flex-1 flex flex-col md:flex-row overflow-hidden">
      {/* Settings Navigation Menu column */}
      <div className="md:w-[240px] bg-[#0B1716] border-r border-[rgba(255,255,255,0.06)] flex flex-row md:flex-col overflow-x-auto md:overflow-x-visible md:overflow-y-auto shrink-0 scrollbar-none select-none scrollable-x">
        {[
          { id: 'sync', label: 'Cloud Drive' },
          { id: 'calendar', label: 'Search & Calendar' },
          { id: 'security', label: 'Lock & Security' },
          { id: 'categories', label: 'Categories' },
          { id: 'import', label: 'Import / Export' },
          { id: 'info', label: 'Local Database Info' }
        ].map((item) => (
          <button
            key={item.id}
            onClick={() => setSub(item.id as any)}
            className={`whitespace-nowrap px-4 py-4 md:py-3.5 text-xs font-black uppercase tracking-wider text-left transition md:w-full border-b md:border-b-0 md:border-l-2 ${
              sub === item.id
                ? 'text-[#2FD4C4] bg-[rgba(47,212,196,0.04)] border-[#2FD4C4]'
                : 'text-[#84A09D] border-transparent hover:text-[#cfe6e3]'
            }`}
          >
            {item.label}
          </button>
        ))}
      </div>

      {/* Main Panel Content body */}
      <div className="flex-1 overflow-y-auto px-4 py-6 md:px-8 md:py-8 scroll scrollable-y">
        <div className="max-w-[560px] mx-auto flex flex-col gap-5 fade">
          
          {/* Cloud Sync panel */}
          {sub === 'sync' && (
            <div className="flex flex-col gap-4">
              <h3 className="text-xl font-extrabold text-[#EAF2F1]">Google Drive Sync</h3>
              <p className="text-sm text-[#84A09D] leading-relaxed">
                Connect your personal Google Drive to safely synchronize your private journal entries. All documents are stored under a secure sandboxed folder <strong>“Project Hail Mary”</strong>, keeping your privacy completely offline-first.
              </p>

              <div className="bg-[#0B1716] border border-[rgba(255,255,255,0.06)] rounded-xl p-4 flex items-center justify-between">
                <div>
                  <div className="text-[10px] font-black text-[#5E7977] uppercase tracking-wider">Connection Status</div>
                  <div className="flex items-center gap-1.5 mt-1">
                    <span className={`w-2.5 h-2.5 rounded-full ${
                      driveStatus === 'live' ? 'bg-[#2FD4C4]' : driveStatus === 'connecting' ? 'bg-[#F4B65C] animate-pulse' : 'bg-[#E26D7A]'
                    }`} />
                    <span className="font-extrabold text-xs text-[#EAF2F1] uppercase">
                      {driveStatus === 'live' ? 'Connected' : driveStatus === 'connecting' ? 'Connecting…' : 'Disconnected'}
                    </span>
                  </div>
                </div>

                {driveStatus === 'live' ? (
                  <button
                    onClick={disconnectDrive}
                    className="px-4 py-2 rounded-xl text-xs font-bold bg-[#E26D7A] text-[#1D0407] hover:opacity-90"
                  >
                    Disconnect
                  </button>
                ) : (
                  <button
                    onClick={connectDrive}
                    disabled={driveStatus === 'connecting'}
                    className="px-4 py-2 rounded-xl text-xs font-bold bg-[#2FD4C4] text-[#04201D] hover:opacity-90 disabled:opacity-50"
                  >
                    {driveStatus === 'connecting' ? 'Connecting…' : 'Authorize Google Drive'}
                  </button>
                )}
              </div>

              {driveError && (
                <div className="p-3 bg-[rgba(226,109,122,0.06)] border border-[#E26D7A] rounded-xl text-xs text-[#E26D7A] font-medium leading-relaxed">
                  {driveError}
                </div>
              )}
            </div>
          )}

          {/* Calendar & search panel */}
          {sub === 'calendar' && (
            <div className="flex flex-col gap-4">
              <h3 className="text-xl font-extrabold text-[#EAF2F1]">Search Entries</h3>
              
              <div className="relative">
                <input
                  type="text"
                  placeholder="Type words to search in journal…"
                  value={query}
                  onChange={(e) => handleSearch(e.target.value)}
                  className="w-full bg-[#0B1716] border border-[rgba(255,255,255,0.06)] rounded-xl p-3.5 pl-11 text-sm text-[#EAF2F1] outline-none focus:border-[#2FD4C4]"
                />
                <Search className="w-5 h-5 text-[#5E7977] absolute left-3.5 top-1/2 -translate-y-1/2" />
              </div>

              <div className="flex flex-col gap-2 mt-1">
                {searchResults.length === 0 && query.trim() !== '' && (
                  <div className="text-xs italic text-[#5E7977]">No entries matched your keyword search.</div>
                )}
                {searchResults.map((res) => (
                  <div
                    key={res.dk}
                    onClick={() => onJumpDate(+res.dk.slice(0, 4), +res.dk.slice(4, 6) - 1, +res.dk.slice(6, 8))}
                    className="bg-[#0B1716] border border-[rgba(255,255,255,0.06)] hover:border-[rgba(47,212,196,0.2)] rounded-xl p-3.5 cursor-pointer flex flex-col gap-1 transition"
                  >
                    <div className="text-xs font-bold text-[#2FD4C4]">{fmtMed(res.dk)}</div>
                    <p className="text-xs text-[#84A09D] line-clamp-2 leading-relaxed">
                      {res.text.replace(/<[^>]+>/g, '')}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Security & lock configuration */}
          {sub === 'security' && (
            <div className="flex flex-col gap-4">
              <h3 className="text-xl font-extrabold text-[#EAF2F1]">Lock & Privacy</h3>
              <p className="text-sm text-[#84A09D] leading-relaxed">
                Configure your passcode PIN and biometric Touch ID / Face ID access to protect your secret diary entries and goal tracking details on this device.
              </p>

              {/* Pin input */}
              <div className="flex flex-col gap-2">
                <label className="text-[10px] font-black text-[#5E7977] uppercase tracking-wider">Passcode PIN</label>
                <div className="flex gap-2">
                  <input
                    type="password"
                    maxLength={10}
                    value={pinInput}
                    onChange={(e) => setPinInput(e.target.value.replace(/\D/g, ''))}
                    className="bg-[#0B1716] border border-[rgba(255,255,255,0.06)] rounded-xl p-3 text-lg font-bold text-center text-[#EAF2F1] w-28 outline-none tracking-[4px]"
                  />
                  <button
                    onClick={handleUpdateSecurity}
                    className="px-4 py-3 rounded-xl font-bold bg-[#132726] border border-[rgba(47,212,196,0.16)] text-[#2FD4C4] text-xs"
                  >
                    Update Password
                  </button>
                </div>
              </div>

              {/* Biometrics Switch */}
              <div className="flex items-center justify-between border-t border-[rgba(255,255,255,0.06)] pt-4 mt-1.5">
                <div>
                  <div className="font-extrabold text-sm text-[#EAF2F1]">Biometric Unlock</div>
                  <div className="text-xs text-[#5E7977] mt-0.5">Use Touch ID / Face ID on supported devices</div>
                </div>
                <button
                  onClick={handleToggleBio}
                  className={`w-12 h-6.5 rounded-full p-1 transition-all ${
                    settings.bio ? 'bg-[#2FD4C4]' : 'bg-[#132726] border border-[rgba(255,255,255,0.06)]'
                  }`}
                >
                  <div className={`w-4.5 h-4.5 rounded-full bg-[#04201D] transition-transform ${
                    settings.bio ? 'translate-x-5.5' : 'translate-x-0 bg-[#5E7977]'
                  }`} />
                </button>
              </div>

              {/* Idle auto lock timer */}
              <div className="flex flex-col gap-2 border-t border-[rgba(255,255,255,0.06)] pt-4">
                <label className="text-[10px] font-black text-[#5E7977] uppercase tracking-wider">Idle Auto Lock Timer</label>
                <div className="grid grid-cols-4 gap-1.5 bg-[#0B1716] border border-[rgba(255,255,255,0.06)] rounded-xl p-1 text-center">
                  {[
                    { val: 0, label: 'Off' },
                    { val: 1, label: '1 min' },
                    { val: 5, label: '5 min' },
                    { val: 10, label: '10 min' }
                  ].map((x) => (
                    <button
                      key={x.val}
                      onClick={() => handleUpdateAutolock(x.val)}
                      className={`py-2 rounded-lg text-xs font-bold transition ${
                        settings.autolock === x.val
                          ? 'bg-[rgba(47,212,196,0.1)] text-[#2FD4C4]'
                          : 'text-[#84A09D]'
                      }`}
                    >
                      {x.label}
                    </button>
                  ))}
                </div>
              </div>

              {securityStatus && (
                <div className="text-xs font-bold text-[#2FD4C4]">{securityStatus}</div>
              )}
            </div>
          )}

          {/* Categories setup */}
          {sub === 'categories' && (
            <div className="flex flex-col gap-4">
              <h3 className="text-xl font-extrabold text-[#EAF2F1]">Custom Project Categories</h3>
              
              <div className="flex flex-col gap-2">
                {(settings.cats || []).map((cat) => (
                  <div key={cat} className="bg-[#0B1716] border border-[rgba(255,255,255,0.06)] rounded-xl p-3.5 flex items-center justify-between">
                    <span className="text-sm font-bold text-[#EAF2F1]">{cat}</span>
                    <button
                      onClick={() => handleDeleteCategory(cat)}
                      className="text-[#E26D7A] hover:opacity-80 transition p-1"
                    >
                      <Trash className="w-4 h-4" />
                    </button>
                  </div>
                ))}
              </div>

              <div className="flex gap-2">
                <input
                  type="text"
                  placeholder="New category name…"
                  value={newCat}
                  onChange={(e) => setNewCat(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleAddCategory()}
                  className="flex-1 bg-[#0B1716] border border-[rgba(255,255,255,0.06)] rounded-xl p-3 text-sm text-[#EAF2F1] outline-none"
                />
                <button
                  onClick={handleAddCategory}
                  className="px-4.5 rounded-xl font-bold bg-[#132726] border border-[rgba(47,212,196,0.16)] text-[#2FD4C4] text-sm"
                >
                  Add
                </button>
              </div>
            </div>
          )}

          {/* Import / Export backup panels */}
          {sub === 'import' && (
            <div className="flex flex-col gap-4">
              <h3 className="text-xl font-extrabold text-[#EAF2F1]">JSON Backups</h3>
              <p className="text-sm text-[#84A09D] leading-relaxed">
                Export a fully self-contained `.json` file backup of all your journal entries, projects trackers, manual counters, and custom preferences to keep your information safe forever. Restore your data anytime by uploading a previous JSON backup.
              </p>

              <div className="grid grid-cols-2 gap-3.5">
                <button
                  onClick={onExportJSON}
                  className="flex flex-col items-center justify-center gap-2 p-5 rounded-xl border border-[rgba(47,212,196,0.16)] bg-[#0B1716] hover:bg-[rgba(47,212,196,0.03)] text-center transition"
                >
                  <Download className="w-5 h-5 text-[#2FD4C4]" />
                  <span className="text-xs font-extrabold text-[#EAF2F1]">Export JSON Backup</span>
                </button>

                <button
                  onClick={handleImportFile}
                  className="flex flex-col items-center justify-center gap-2 p-5 rounded-xl border border-[rgba(47,212,196,0.16)] bg-[#0B1716] hover:bg-[rgba(47,212,196,0.03)] text-center transition"
                >
                  <Upload className="w-5 h-5 text-[#2FD4C4]" />
                  <span className="text-xs font-extrabold text-[#EAF2F1]">Restore JSON Backup</span>
                </button>
              </div>
            </div>
          )}

          {/* Database metrics panels */}
          {sub === 'info' && (
            <div className="flex flex-col gap-4">
              <h3 className="text-xl font-extrabold text-[#EAF2F1]">Database Diagnostics</h3>
              
              <div className="grid grid-cols-2 gap-3">
                <div className="bg-[#0B1716] border border-[rgba(255,255,255,0.06)] rounded-xl p-4 text-center">
                  <div className="text-2xl font-black text-[#2FD4C4]">{totalEntriesCount}</div>
                  <div className="text-[10px] font-black text-[#5E7977] uppercase tracking-wider mt-1">Journal Entries</div>
                </div>

                <div className="bg-[#0B1716] border border-[rgba(255,255,255,0.06)] rounded-xl p-4 text-center">
                  <div className="text-2xl font-black text-[#2FD4C4]">{activeProjectsCount}</div>
                  <div className="text-[10px] font-black text-[#5E7977] uppercase tracking-wider mt-1">Active Projects</div>
                </div>

                <div className="bg-[#0B1716] border border-[rgba(255,255,255,0.06)] rounded-xl p-4 text-center">
                  <div className="text-2xl font-black text-[#2FD4C4]">{completedProjectsCount}</div>
                  <div className="text-[10px] font-black text-[#5E7977] uppercase tracking-wider mt-1">Completed Projects</div>
                </div>

                <div className="bg-[#0B1716] border border-[rgba(255,255,255,0.06)] rounded-xl p-4 text-center">
                  <div className="text-2xl font-black text-[#2FD4C4]">{totalTracksCount}</div>
                  <div className="text-[10px] font-black text-[#5E7977] uppercase tracking-wider mt-1">Audio Tracks</div>
                </div>
              </div>

              <div className="bg-[#0B1716] border border-[rgba(255,255,255,0.06)] rounded-xl p-4 flex gap-3 items-start">
                <Info className="w-5 h-5 text-[#2FD4C4] shrink-0 mt-0.5" />
                <p className="text-xs text-[#84A09D] leading-relaxed">
                  Your files are stored safely in your browser's private local state using IndexedDB and LocalStorage, synchronized directly into Google Drive sandbox. Cleaving browser cache could delete offline files if not synced.
                </p>
              </div>
            </div>
          )}

        </div>
      </div>
    </div>
  );
}
