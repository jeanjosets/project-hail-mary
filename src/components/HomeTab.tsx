import React from 'react';
import { RefreshCw, Plus, Calendar, Flag } from 'lucide-react';
import { JournalEntry, Project } from '../types';
import { verseOfDay, dayNumber, todayKey, fmtMed, daysBetween, clamp } from '../utils';

interface HomeTabProps {
  entries: Record<string, JournalEntry>;
  projects: Record<string, Project>;
  onRefresh: () => void;
  onOpenEditor: (dk: string) => void;
  onOpenProjectForm: () => void;
  onOpenProjectDetail: (id: string) => void;
}

export default function HomeTab({
  entries,
  projects,
  onRefresh,
  onOpenEditor,
  onOpenProjectForm,
  onOpenProjectDetail
}: HomeTabProps) {
  const verse = verseOfDay();
  const tk = todayKey();
  const todayEntry = entries[tk];

  // Filter active projects
  const activeProjects = Object.values(projects)
    .filter((p) => !p.end)
    .sort((a, b) => b.start.localeCompare(a.start));

  const getOngoingDays = (p: Project) => {
    return Math.max(0, daysBetween(p.start, tk));
  };

  const getTimeProgress = (p: Project) => {
    if (!p.target) return null;
    const span = daysBetween(p.start, p.target);
    if (span <= 0) return null;
    const done = daysBetween(p.start, tk);
    return clamp(Math.round((done / span) * 100), 0, 100);
  };

  return (
    <div className="scroll flex-1 overflow-y-auto px-4 py-6 md:px-10 md:py-8 scrollable-y">
      <div className="max-w-[760px] mx-auto flex flex-col gap-5">
        {/* Header bar */}
        <div className="flex items-center justify-between">
          <h2 className="text-2xl font-extrabold tracking-tight text-[#EAF2F1]">Home</h2>
          <button
            onClick={onRefresh}
            className="px-3.5 py-1.5 rounded-lg text-xs font-bold border border-[rgba(47,212,196,0.16)] text-[#2FD4C4] hover:bg-[rgba(47,212,196,0.08)] flex items-center gap-1.5 transition"
          >
            <RefreshCw className="w-3.5 h-3.5" /> Refresh
          </button>
        </div>

        {/* Verse Card */}
        <div className="bg-linear-to-br from-[#132726] to-[#0B1716] border border-[rgba(47,212,196,0.16)] border-l-4 border-l-[#2FD4C4] rounded-xl p-4 shadow-sm fade">
          <p className="italic text-base text-[#d7ece9] leading-relaxed">“{verse[1]}”</p>
          <span className="block not-italic font-bold text-xs text-[#2FD4C4] mt-2 tracking-wide uppercase">
            {verse[0]} · KJV
          </span>
        </div>

        {/* Day Counter */}
        <div className="flex items-center justify-between bg-linear-to-br from-[#132726] to-[#0B1716] border border-[rgba(47,212,196,0.16)] rounded-xl p-4 fade">
          <div>
            <div className="text-[#84A09D] text-xs font-black tracking-widest uppercase">Day Counter</div>
            <div className="text-[#5E7977] text-xs mt-0.5">Since 19 Jan 1998</div>
          </div>
          <div className="text-xl font-black text-[#2FD4C4]">
            {dayNumber(tk).toLocaleString()}
          </div>
        </div>

        {/* Today Preview Card */}
        <div
          onClick={() => onOpenEditor(tk)}
          className="bg-[#0B1716] border border-[rgba(255,255,255,0.06)] hover:border-[rgba(47,212,196,0.2)] rounded-xl p-4 flex flex-col gap-2 cursor-pointer transition duration-200 fade"
        >
          <div className="flex items-center justify-between text-xs font-bold text-[#2FD4C4]">
            <span>Today · {fmtMed(tk)}</span>
            <span className="text-[11px]">Write ✎</span>
          </div>
          {todayEntry ? (
            <p className="text-sm text-[#cfe6e3] leading-relaxed">
              {todayEntry.text.length > 250
                ? todayEntry.text.slice(0, 250).trim() + '…'
                : todayEntry.text}
            </p>
          ) : (
            <p className="text-sm italic text-[#5E7977]">
              Nothing written today. Tap to start writing your journal entry.
            </p>
          )}
        </div>

        {/* Active Projects Header */}
        <div className="flex items-center justify-between mt-3 mb-1">
          <span className="text-xs font-black tracking-widest text-[#5E7977] uppercase">Pursuing Now</span>
          <button
            onClick={onOpenProjectForm}
            className="text-[#2FD4C4] font-bold text-xs flex items-center gap-1 hover:bg-[rgba(47,212,196,0.05)] px-2.5 py-1.5 rounded-lg transition"
          >
            <Plus className="w-4 h-4" /> New project
          </button>
        </div>

        {/* Project cards listing */}
        {activeProjects.length === 0 ? (
          <div className="text-sm leading-relaxed text-[#5E7977] bg-[#0B1716] border border-dashed border-[rgba(255,255,255,0.06)] rounded-xl p-5 fade">
            Nothing in progress right now. Add a project — like “Gym goal” — set a goal date, and an orange progress bar will track how close you are as the days pass.
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5 fade">
            {activeProjects.map((p) => {
              const tp = getTimeProgress(p);
              const hasSubtasks = p.subtasks && p.subtasks.length > 0;
              const subDone = hasSubtasks ? p.subtasks.filter((s) => s.done).length : 0;
              
              const showManual = p.progress !== null && p.progress > 0;
              const barPct = showManual ? p.progress! : (tp !== null ? tp : 0);
              const barColor = showManual
                ? 'bg-gradient-to-r from-[#2FD4C4] to-[#0E7E78]'
                : 'bg-gradient-to-r from-[#E8893B] to-[#F4B65C]';
              const barLabel = showManual
                ? `${p.progress}% complete`
                : (p.target ? `Target ${fmtMed(p.target)} · ${tp}%` : null);

              return (
                <div
                  key={p.id}
                  onClick={() => onOpenProjectDetail(p.id)}
                  className="bg-[#0B1716] border border-[rgba(255,255,255,0.06)] hover:border-[rgba(47,212,196,0.25)] rounded-xl p-4 flex flex-col gap-3.5 cursor-pointer transition duration-150"
                >
                  <div>
                    <h3 className="font-extrabold text-base text-[#EAF2F1]">{p.title}</h3>
                    <div className="flex items-center gap-2 flex-wrap mt-2">
                      {p.category && (
                        <span className="text-[11px] font-bold text-[#2BA8C4] border border-[rgba(43,168,196,0.3)] px-2 py-0.5 rounded-full">
                          {p.category}
                        </span>
                      )}
                      <span className="text-xs font-bold text-[#2FD4C4]">
                        Ongoing · {getOngoingDays(p).toLocaleString()} days
                      </span>
                      {hasSubtasks && (
                        <span className="text-[11px] text-[#84A09D]">
                          {subDone}/{p.subtasks.length} steps
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Progress bar container */}
                  {(showManual || tp !== null) && (
                    <div className="flex flex-col gap-1.5 mt-1">
                      <div className="h-2 w-full bg-[#132726] rounded-full overflow-hidden">
                        <div
                          className={`h-full ${barColor} rounded-full transition-all duration-500`}
                          style={{ width: `${barPct}%` }}
                        />
                      </div>
                      <div className="flex justify-between text-[11px] text-[#F4B65C] font-bold">
                        <span>{barLabel}</span>
                        <span>{barPct}%</span>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
