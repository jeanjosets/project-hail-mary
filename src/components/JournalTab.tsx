import React, { useState, useEffect, useRef } from 'react';
import { RefreshCw, ArrowLeft, Download, Check } from 'lucide-react';
import { JournalEntry } from '../types';
import {
  todayKey,
  keyOf,
  fmtMed,
  dayNumber,
  fmtLong,
  MONTHS,
  buildModel,
  predict,
  tidy
} from '../utils';
import { downloadDocx } from '../drive';

interface JournalTabProps {
  entries: Record<string, JournalEntry>;
  entryIndex: Record<string, string>;
  onRefresh: () => void;
  onSaveEntry: (dk: string, text: string) => Promise<void>;
  onLoadEntryFromDrive: (dk: string) => Promise<string | null>;
  selDate: { y: number; m: number; d: number };
  setSelDate: React.Dispatch<React.SetStateAction<{ y: number; m: number; d: number }>>;
}

export default function JournalTab({
  entries,
  entryIndex,
  onRefresh,
  onSaveEntry,
  onLoadEntryFromDrive,
  selDate,
  setSelDate
}: JournalTabProps) {
  const [editorOpen, setEditorOpen] = useState(false);
  const [editorText, setEditorText] = useState('');
  const [editorDateKey, setEditorDateKey] = useState('');
  const [saveStatus, setSaveStatus] = useState<'saved' | 'saving'>('saved');
  const [loading, setLoading] = useState(false);
  const [predictions, setPredictions] = useState<string[]>([]);
  const [wordModel, setWordModel] = useState<any>(null);

  const yearColRef = useRef<HTMLDivElement>(null);
  const monColRef = useRef<HTMLDivElement>(null);
  const dayColRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const saveTimerRef = useRef<any>(null);

  // Constants
  const startYear = 1998;
  const currentYear = new Date().getFullYear();
  const endYear = currentYear + 1;
  const years = Array.from({ length: endYear - startYear + 1 }, (_, i) => startYear + i);

  const daysInMonth = new Date(selDate.y, selDate.m + 1, 0).getDate();
  const days = Array.from({ length: daysInMonth }, (_, i) => i + 1);

  // Re-clamp day if it exceeds current days in selected month
  useEffect(() => {
    if (selDate.d > daysInMonth) {
      setSelDate((prev) => ({ ...prev, d: daysInMonth }));
    }
  }, [selDate.y, selDate.m, daysInMonth]);

  // Center wheels scrolling on mount or when selections change
  const centerSelected = (colRef: React.RefObject<HTMLDivElement | null>, selectedIndex: number) => {
    setTimeout(() => {
      if (colRef.current) {
        const parent = colRef.current;
        const items = parent.querySelectorAll('.wheel-item');
        const selected = items[selectedIndex] as HTMLButtonElement;
        if (selected) {
          parent.scrollTop = selected.offsetTop - parent.clientHeight / 2 + selected.offsetHeight / 2;
        }
      }
    }, 50);
  };

  useEffect(() => {
    centerSelected(yearColRef, selDate.y - startYear);
  }, [selDate.y]);

  useEffect(() => {
    centerSelected(monColRef, selDate.m);
  }, [selDate.m]);

  useEffect(() => {
    centerSelected(dayColRef, selDate.d - 1);
  }, [selDate.d]);

  const selKey = keyOf(selDate.y, selDate.m, selDate.d);
  const currentEntry = entries[selKey];

  // Load language model for prediction on editor open
  useEffect(() => {
    if (editorOpen) {
      const texts = Object.values(entries).map((e) => e.text);
      setWordModel(buildModel(texts));
    }
  }, [editorOpen, entries]);

  const handleOpenEditor = async (dk: string) => {
    setEditorDateKey(dk);
    setLoading(true);
    setEditorOpen(true);

    try {
      // Fetch latest from Google Drive if online
      const driveText = await onLoadEntryFromDrive(dk);
      if (driveText !== null) {
        setEditorText(driveText);
      } else {
        setEditorText(entries[dk]?.text || '');
      }
    } catch (e) {
      setEditorText(entries[dk]?.text || '');
    } finally {
      setLoading(false);
      setTimeout(() => textareaRef.current?.focus(), 80);
    }
  };

  // Safe auto-save scheduler
  const triggerAutoSave = (newText: string) => {
    setSaveStatus('saving');
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(async () => {
      await onSaveEntry(editorDateKey, newText);
      setSaveStatus('saved');
    }, 650);
  };

  const handleTextChange = (val: string) => {
    setEditorText(val);
    triggerAutoSave(val);

    // Run prediction
    if (wordModel) {
      const p = predict(wordModel, val);
      setPredictions(p.words);
    }
  };

  const handlePredictionClick = (word: string) => {
    if (!wordModel) return;
    const val = editorText;
    const p = predict(wordModel, val);
    let updated = '';

    if (p.mode === 'complete') {
      updated = val.replace(/[a-z']+$/i, word) + ' ';
    } else {
      updated = val + (/(\s|^)$/.test(val) ? '' : ' ') + word + ' ';
    }

    setEditorText(updated);
    triggerAutoSave(updated);
    textareaRef.current?.focus();

    // Re-run prediction
    const nextP = predict(wordModel, updated);
    setPredictions(nextP.words);
  };

  const handleTidy = () => {
    const tidied = tidy(editorText);
    setEditorText(tidied);
    triggerAutoSave(tidied);
  };

  const handleCloseEditor = async () => {
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    // Final explicit save
    await onSaveEntry(editorDateKey, editorText);
    setSaveStatus('saved');
    setEditorOpen(false);
  };

  const getWordCount = () => {
    return (editorText.trim().match(/\S+/g) || []).length;
  };

  return (
    <div className="flex-1 flex flex-col overflow-hidden relative">
      {/* Date wheels and preview tab */}
      {!editorOpen && (
        <div className="scroll flex-1 overflow-y-auto px-4 py-6 md:px-10 md:py-8 scrollable-y">
          <div className="max-w-[760px] mx-auto flex flex-col gap-5">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-2xl font-extrabold tracking-tight text-[#EAF2F1]">Journal</h2>
              </div>
              <button
                onClick={onRefresh}
                className="px-3.5 py-1.5 rounded-lg text-xs font-bold border border-[rgba(47,212,196,0.16)] text-[#2FD4C4] hover:bg-[rgba(47,212,196,0.08)] flex items-center gap-1.5 transition"
              >
                <RefreshCw className="w-3.5 h-3.5" /> Refresh
              </button>
            </div>
            <p className="text-[#84A09D] text-sm leading-relaxed">
              Scroll the year, month, and day to move through time — the entry preview updates instantly.
            </p>

            {/* Date Picker Wheels */}
            <div className="flex gap-2 bg-[#0B1716] border border-[rgba(47,212,196,0.06)] rounded-2xl p-1.5 relative overflow-hidden h-[180px] md:h-[220px]">
              {/* Overlay lines for current selection row */}
              <div className="absolute left-2 right-2 top-1/2 -translate-y-1/2 h-11 rounded-xl bg-[rgba(47,212,196,0.06)] border border-[rgba(47,212,196,0.15)] pointer-events-none" />

              {/* Year column */}
              <div
                ref={yearColRef}
                className="flex-1 overflow-y-auto text-center scroll-smooth scrollbar-none scrollable-y"
              >
                <div className="h-[68px] md:h-[88px]" />
                {years.map((y) => (
                  <button
                    key={y}
                    className={`wheel-item block w-full py-2.5 text-sm md:text-base font-bold transition duration-150 ${
                      y === selDate.y ? 'text-[#2FD4C4] font-black' : 'text-[#5E7977]'
                    }`}
                    onClick={() => setSelDate((prev) => ({ ...prev, y }))}
                  >
                    {y}
                  </button>
                ))}
                <div className="h-[68px] md:h-[88px]" />
              </div>

              {/* Month column */}
              <div
                ref={monColRef}
                className="flex-[1.5] overflow-y-auto text-center scroll-smooth scrollbar-none scrollable-y"
              >
                <div className="h-[68px] md:h-[88px]" />
                {MONTHS.map((m, idx) => (
                  <button
                    key={m}
                    className={`wheel-item block w-full py-2.5 text-sm md:text-base font-bold transition duration-150 ${
                      idx === selDate.m ? 'text-[#2FD4C4] font-black' : 'text-[#5E7977]'
                    }`}
                    onClick={() => setSelDate((prev) => ({ ...prev, m: idx }))}
                  >
                    {m}
                  </button>
                ))}
                <div className="h-[68px] md:h-[88px]" />
              </div>

              {/* Day column */}
              <div
                ref={dayColRef}
                className="flex-1 overflow-y-auto text-center scroll-smooth scrollbar-none scrollable-y"
              >
                <div className="h-[68px] md:h-[88px]" />
                {days.map((d) => {
                  const dayKeyVal = keyOf(selDate.y, selDate.m, d);
                  const hasEntry = !!entryIndex[dayKeyVal] || !!entries[dayKeyVal];
                  return (
                    <button
                      key={d}
                      className={`wheel-item block w-full py-2.5 text-sm md:text-base font-bold transition duration-150 ${
                        d === selDate.d
                          ? 'text-[#2FD4C4] font-black'
                          : hasEntry
                          ? 'text-[#EAF2F1] font-semibold border-l-2 border-l-[#2FD4C4]'
                          : 'text-[#5E7977]'
                      }`}
                      onClick={() => setSelDate((prev) => ({ ...prev, d }))}
                    >
                      {d}
                    </button>
                  );
                })}
                <div className="h-[68px] md:h-[88px]" />
              </div>
            </div>

            {/* Date entry preview block */}
            <div
              onClick={() => handleOpenEditor(selKey)}
              className="bg-[#0B1716] border border-[rgba(255,255,255,0.06)] hover:border-[rgba(47,212,196,0.25)] rounded-xl p-4 cursor-pointer transition-all duration-150 fade"
            >
              <div className="flex items-center justify-between text-xs font-bold text-[#2FD4C4] mb-3">
                <span>{fmtMed(selKey)} · Day {dayNumber(selKey).toLocaleString()}</span>
                <span>{currentEntry ? 'Edit ✎' : 'Write ✎'}</span>
              </div>
              {currentEntry ? (
                <p className="text-sm text-[#cfe6e3] leading-relaxed break-words whitespace-pre-wrap">
                  {currentEntry.text.length > 300
                    ? currentEntry.text.slice(0, 300).trim() + '…'
                    : currentEntry.text}
                </p>
              ) : (
                <p className="text-sm italic text-[#5E7977]">
                  No journal entry written for this day yet — tap to open the typewriter editor.
                </p>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Modern Typewriter editor overlay */}
      {editorOpen && (
        <div className="absolute inset-0 z-40 bg-[#07100F] flex flex-col fade overflow-hidden">
          {/* Editor Header */}
          <div className="flex items-center justify-between px-4 py-4 border-b border-[rgba(255,255,255,0.06)]">
            <button
              onClick={handleCloseEditor}
              className="p-2 text-[#84A09D] hover:bg-[rgba(255,255,255,0.03)] rounded-xl transition"
              title="Save and back"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
            <div className="text-center">
              <div className="text-sm font-black text-[#EAF2F1]">{fmtMed(editorDateKey)}</div>
              <div className="text-[11px] text-[#5E7977]">Day {dayNumber(editorDateKey).toLocaleString()}</div>
            </div>
            {/* Save Status indicator */}
            <div className={`flex items-center gap-1.5 text-xs font-extrabold ${saveStatus === 'saved' ? 'text-[#2FD4C4]' : 'text-[#F4B65C]'}`}>
              <span className={`w-2 h-2 rounded-full ${saveStatus === 'saved' ? 'bg-[#2FD4C4]' : 'bg-[#F4B65C] animate-pulse'}`} />
              {saveStatus === 'saved' ? 'Synced' : 'Saving…'}
            </div>
          </div>

          {/* Text Area typing canvas */}
          {loading ? (
            <div className="flex-1 flex flex-col items-center justify-center text-[#84A09D] text-sm">
              <RefreshCw className="w-6 h-6 animate-spin mb-2 text-[#2FD4C4]" />
              Loading your entry…
            </div>
          ) : (
            <textarea
              ref={textareaRef}
              value={editorText}
              onChange={(e) => handleTextChange(e.target.value)}
              placeholder="Start typing your heart out today…"
              className="flex-1 w-full max-w-[760px] mx-auto bg-transparent border-none outline-none resize-none text-[#EAF2F1] text-base md:text-lg leading-relaxed p-6 placeholder-[#3f5957] overflow-y-auto scroll"
              style={{ caretColor: '#2FD4C4' }}
              autoCapitalize="sentences"
              autoCorrect="off"
              spellCheck="false"
            />
          )}

          {/* Predictions bar */}
          {editorText.length > 0 && predictions.length > 0 && (
            <div className="px-4 py-2 border-t border-[rgba(255,255,255,0.06)] bg-[#0B1716] flex gap-2 overflow-x-auto select-none scrollable-x">
              {predictions.map((word) => (
                <button
                  key={word}
                  onClick={() => handlePredictionClick(word)}
                  className="flex-none px-4 py-2 rounded-full bg-[#132726] border border-[#0E7E78] text-[#2FD4C4] font-bold text-xs"
                >
                  {word}
                </button>
              ))}
            </div>
          )}

          {/* Editor Footer Actions bar */}
          <div className="px-4 py-3 border-t border-[rgba(255,255,255,0.06)] flex items-center justify-between">
            <span className="text-xs text-[#5E7977] font-semibold">{getWordCount()} words</span>
            <div className="flex gap-2">
              <button
                onClick={handleTidy}
                className="px-3.5 py-2 rounded-xl text-xs font-bold border border-[rgba(47,212,196,0.16)] text-[#2FD4C4]"
              >
                Tidy punctuation
              </button>
              <button
                onClick={() => downloadDocx(`${editorDateKey}.docx`, fmtLong(editorDateKey), editorText)}
                className="px-3 py-2 rounded-xl text-xs font-bold bg-[#132726] text-[#2FD4C4] border border-[rgba(47,212,196,0.16)] flex items-center gap-1"
                title="Export Word document"
              >
                <Download className="w-3.5 h-3.5" /> Export .docx
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
