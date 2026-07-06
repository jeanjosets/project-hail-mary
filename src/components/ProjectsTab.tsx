import React, { useState } from 'react';
import { Plus, Flag, Calendar, Check, Trash, Eye, EyeOff, Paperclip, ChevronLeft } from 'lucide-react';
import { Project, Subtask, ProjectFile, ProjectUpdate } from '../types';
import { todayKey, fmtMed, daysBetween, clamp, k2i, i2k, uid } from '../utils';

interface ProjectsTabProps {
  projects: Record<string, Project>;
  categories: string[];
  onSaveProject: (p: Project) => Promise<void>;
  onDeleteProject: (id: string) => Promise<void>;
}

export default function ProjectsTab({
  projects,
  categories,
  onSaveProject,
  onDeleteProject
}: ProjectsTabProps) {
  const [seg, setSeg] = useState<'active' | 'done'>('active');
  const [formOpen, setFormOpen] = useState(false);
  const [detailProject, setDetailProject] = useState<Project | null>(null);

  // Form states for creating a new project
  const [newTitle, setNewTitle] = useState('');
  const [newCategory, setNewCategory] = useState(categories[0] || 'Learning');
  const [newStart, setNewStart] = useState(k2i(todayKey()));
  const [newTarget, setNewTarget] = useState('');
  const [newNote, setNewNote] = useState('');

  // Selected project details updates
  const [newUpdateText, setNewUpdateText] = useState('');
  const [newSubtaskText, setNewSubtaskText] = useState('');

  const tk = todayKey();

  const activeProjects = Object.values(projects)
    .filter((p) => !p.end)
    .sort((a, b) => b.start.localeCompare(a.start));

  const completedProjects = Object.values(projects)
    .filter((p) => !!p.end)
    .sort((a, b) => b.end!.localeCompare(a.end!));

  const listProjects = seg === 'active' ? activeProjects : completedProjects;

  const getOngoingDays = (p: Project) => {
    return Math.max(0, daysBetween(p.start, p.end || tk));
  };

  const getTimeProgress = (p: Project) => {
    if (!p.target) return null;
    const span = daysBetween(p.start, p.target);
    if (span <= 0) return null;
    const done = daysBetween(p.start, p.end || tk);
    return clamp(Math.round((done / span) * 100), 0, 100);
  };

  const handleCreateProject = async () => {
    if (!newTitle.trim()) return;
    const p: Project = {
      id: uid('p'),
      title: newTitle.trim(),
      category: newCategory,
      note: newNote.trim(),
      start: i2k(newStart) || todayKey(),
      target: i2k(newTarget) || null,
      end: null,
      progress: null,
      subtasks: [],
      updates: [],
      files: [],
      createdAt: Date.now()
    };
    await onSaveProject(p);
    setFormOpen(false);
    // Reset fields
    setNewTitle('');
    setNewCategory(categories[0] || 'Learning');
    setNewStart(k2i(todayKey()));
    setNewTarget('');
    setNewNote('');
    // Open detail of the newly created project
    setDetailProject(p);
  };

  const handleUpdateDetail = async (updated: Project) => {
    await onSaveProject(updated);
    setDetailProject({ ...updated });
  };

  const handleAddSubtask = async () => {
    if (!detailProject || !newSubtaskText.trim()) return;
    const sub: Subtask = {
      id: uid('s'),
      title: newSubtaskText.trim(),
      done: false,
      files: []
    };
    const updated = {
      ...detailProject,
      subtasks: [...(detailProject.subtasks || []), sub]
    };
    await handleUpdateDetail(updated);
    setNewSubtaskText('');
  };

  const handleToggleSubtask = async (subId: string) => {
    if (!detailProject) return;
    const subtasks = detailProject.subtasks.map((s) =>
      s.id === subId ? { ...s, done: !s.done } : s
    );
    const updated = { ...detailProject, subtasks };
    await handleUpdateDetail(updated);
  };

  const handleDeleteSubtask = async (subId: string) => {
    if (!detailProject) return;
    const subtasks = detailProject.subtasks.filter((s) => s.id !== subId);
    const updated = { ...detailProject, subtasks };
    await handleUpdateDetail(updated);
  };

  const handleAttachFileToSubtask = async (subId: string) => {
    if (!detailProject) return;
    const kindInput = prompt('Attach to step — type: photo, file, or graph:', 'file') || 'file';
    const kind = ['photo', 'file', 'graph'].includes(kindInput.toLowerCase())
      ? (kindInput.toLowerCase() as 'photo' | 'file' | 'graph')
      : 'file';
    const name = prompt('File name:');
    if (!name || !name.trim()) return;

    const fileItem = {
      id: uid('f'),
      name: name.trim(),
      kind
    };

    const subtasks = detailProject.subtasks.map((s) => {
      if (s.id === subId) {
        return {
          ...s,
          files: [...(s.files || []), fileItem]
        };
      }
      return s;
    });

    const updated = { ...detailProject, subtasks };
    await handleUpdateDetail(updated);
  };

  const handleDeleteFileFromSubtask = async (subId: string, fileId: string) => {
    if (!detailProject) return;
    const subtasks = detailProject.subtasks.map((s) => {
      if (s.id === subId) {
        return {
          ...s,
          files: s.files.filter((f) => f.id !== fileId)
        };
      }
      return s;
    });
    const updated = { ...detailProject, subtasks };
    await handleUpdateDetail(updated);
  };

  const handleAddFile = async (kind: 'photo' | 'file' | 'graph') => {
    if (!detailProject) return;
    const name = prompt(`Enter ${kind} name:`);
    if (!name || !name.trim()) return;

    const fileItem: ProjectFile = {
      id: uid('f'),
      name: name.trim(),
      kind
    };

    const updated = {
      ...detailProject,
      files: [...(detailProject.files || []), fileItem]
    };
    await handleUpdateDetail(updated);
  };

  const handleDeleteFile = async (fileId: string) => {
    if (!detailProject) return;
    const updated = {
      ...detailProject,
      files: detailProject.files.filter((f) => f.id !== fileId)
    };
    await handleUpdateDetail(updated);
  };

  const handleAddUpdate = async () => {
    if (!detailProject || !newUpdateText.trim()) return;
    const u: ProjectUpdate = {
      id: uid('u'),
      ts: Date.now(),
      text: newUpdateText.trim()
    };
    const updated = {
      ...detailProject,
      updates: [...(detailProject.updates || []), u]
    };
    await handleUpdateDetail(updated);
    setNewUpdateText('');
  };

  const handleCompleteProject = async () => {
    if (!detailProject) return;
    const updated = {
      ...detailProject,
      end: todayKey(),
      progress: detailProject.progress === null ? 100 : detailProject.progress
    };
    await handleUpdateDetail(updated);
    setDetailProject(null);
  };

  const handleReopenProject = async () => {
    if (!detailProject) return;
    const updated = {
      ...detailProject,
      end: null
    };
    await handleUpdateDetail(updated);
  };

  const handleDeleteProject = async () => {
    if (!detailProject) return;
    if (confirm('Are you absolutely sure you want to delete this project?')) {
      await onDeleteProject(detailProject.id);
      setDetailProject(null);
    }
  };

  return (
    <div className="flex-1 flex flex-col overflow-hidden relative">
      {/* Tab content area */}
      {!detailProject && (
        <div className="scroll flex-1 overflow-y-auto px-4 py-6 md:px-10 md:py-8 scrollable-y">
          <div className="max-w-[760px] mx-auto flex flex-col gap-4">
            <div className="flex items-center justify-between">
              <h2 className="text-2xl font-extrabold tracking-tight text-[#EAF2F1]">Projects</h2>
            </div>
            <p className="text-[#84A09D] text-sm leading-relaxed mb-1">
              Everything you’re working toward — with steps, progress updates, logs, files, and progress metrics.
            </p>

            <button
              onClick={() => setFormOpen(true)}
              className="w-full p-4 rounded-xl font-extrabold bg-linear-to-r from-[#2FD4C4] to-[#0E7E78] text-[#04201D] hover:opacity-95 transition-all flex items-center justify-center gap-2 mb-2 fade"
            >
              <Plus className="w-5 h-5" /> New project
            </button>

            {/* Segment selectors */}
            <div className="flex gap-1 bg-[#0B1716] border border-[rgba(255,255,255,0.06)] rounded-xl p-1 mb-2">
              <button
                onClick={() => setSeg('active')}
                className={`flex-1 py-2.5 rounded-lg text-sm font-bold transition ${
                  seg === 'active' ? 'bg-[rgba(47,212,196,0.1)] text-[#2FD4C4]' : 'text-[#84A09D]'
                }`}
              >
                Active
              </button>
              <button
                onClick={() => setSeg('done')}
                className={`flex-1 py-2.5 rounded-lg text-sm font-bold transition ${
                  seg === 'done' ? 'bg-[rgba(47,212,196,0.1)] text-[#2FD4C4]' : 'text-[#84A09D]'
                }`}
              >
                Completed
              </button>
            </div>

            {/* List projects */}
            {listProjects.length === 0 ? (
              <div className="text-sm leading-relaxed text-[#5E7977] bg-[#0B1716] border border-dashed border-[rgba(255,255,255,0.06)] rounded-xl p-6 text-center fade">
                {seg === 'active'
                  ? 'No active projects. Tap “New project” to begin one.'
                  : 'No completed projects yet. Finish an active one and it lands here.'}
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5 fade">
                {listProjects.map((p) => {
                  const tp = getTimeProgress(p);
                  const showManual = p.progress !== null && p.progress > 0;
                  const barPct = showManual ? p.progress! : (tp !== null ? tp : 0);
                  const barColor = showManual
                    ? 'bg-[#2FD4C4]'
                    : 'bg-[#E8893B]';

                  return (
                    <div
                      key={p.id}
                      onClick={() => setDetailProject(p)}
                      className="bg-[#0B1716] border border-[rgba(255,255,255,0.06)] hover:border-[rgba(47,212,196,0.25)] rounded-xl p-4 flex flex-col gap-3.5 cursor-pointer transition-all duration-150"
                    >
                      <div>
                        <h3 className="font-extrabold text-base text-[#EAF2F1]">{p.title}</h3>
                        <div className="flex items-center gap-2 flex-wrap mt-2">
                          {p.category && (
                            <span className="text-[11px] font-bold text-[#2BA8C4] border border-[rgba(43,168,196,0.3)] px-2 py-0.5 rounded-full">
                              {p.category}
                            </span>
                          )}
                          {seg === 'active' ? (
                            <span className="text-xs font-bold text-[#2FD4C4]">
                              Ongoing · {getOngoingDays(p).toLocaleString()} days
                            </span>
                          ) : (
                            <span className="text-xs font-bold text-[#2BA8C4]">
                              Completed · {getOngoingDays(p).toLocaleString()} days
                            </span>
                          )}
                          {p.subtasks && p.subtasks.length > 0 && (
                            <span className="text-[11px] text-[#84A09D]">
                              {p.subtasks.filter((s) => s.done).length}/{p.subtasks.length} steps
                            </span>
                          )}
                        </div>
                      </div>

                      {seg === 'active' && (showManual || tp !== null) && (
                        <div className="flex flex-col gap-1.5 mt-0.5">
                          <div className="h-2 w-full bg-[#132726] rounded-full overflow-hidden">
                            <div
                              className={`h-full ${barColor} rounded-full transition-all duration-300`}
                              style={{ width: `${barPct}%` }}
                            />
                          </div>
                          <div className="flex justify-between text-[11px] text-[#F4B65C] font-bold">
                            <span>{showManual ? `${p.progress}% manual` : (p.target ? `Target ${fmtMed(p.target)} · ${tp}%` : '')}</span>
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
      )}

      {/* Detail Project overlay */}
      {detailProject && (
        <div className="absolute inset-0 z-40 bg-[#07100F] flex flex-col fade overflow-hidden">
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-4 border-b border-[rgba(255,255,255,0.06)]">
            <button
              onClick={() => {
                setDetailProject(null);
                setNewUpdateText('');
                setNewSubtaskText('');
              }}
              className="p-2 text-[#84A09D] hover:bg-[rgba(255,255,255,0.03)] rounded-xl transition"
            >
              <ChevronLeft className="w-5 h-5" />
            </button>
            <div className="text-sm font-black text-[#EAF2F1]">
              {detailProject.end ? 'Completed Project' : 'Active Project'}
            </div>
            <div className="w-9" />
          </div>

          {/* Body */}
          <div className="flex-1 overflow-y-auto p-4 md:p-8 scroll scrollable-y">
            <div className="max-w-[660px] mx-auto flex flex-col gap-4">
              {/* Title */}
              <div className="flex flex-col gap-2">
                <label className="text-[10px] font-black text-[#5E7977] uppercase tracking-wider">Title</label>
                <input
                  type="text"
                  value={detailProject.title}
                  onChange={(e) => handleUpdateDetail({ ...detailProject, title: e.target.value })}
                  className="w-full bg-[#0B1716] border border-[rgba(255,255,255,0.06)] rounded-xl p-3.5 text-[#EAF2F1] font-bold outline-none focus:border-[#2FD4C4]"
                />
              </div>

              {/* Categories */}
              <div className="flex flex-col gap-2">
                <label className="text-[10px] font-black text-[#5E7977] uppercase tracking-wider">Category</label>
                <div className="flex flex-wrap gap-1.5">
                  {categories.map((cat) => (
                    <button
                      key={cat}
                      onClick={() => handleUpdateDetail({ ...detailProject, category: cat })}
                      className={`px-3.5 py-2 rounded-full text-xs font-bold transition border ${
                        detailProject.category === cat
                          ? 'bg-[rgba(47,212,196,0.08)] border-[#2FD4C4] text-[#2FD4C4]'
                          : 'bg-[#0B1716] border-[rgba(255,255,255,0.06)] text-[#84A09D]'
                      }`}
                    >
                      {cat}
                    </button>
                  ))}
                </div>
              </div>

              {/* Date Pickers */}
              <div className="grid grid-cols-2 gap-3">
                <div className="flex flex-col gap-2">
                  <label className="text-[10px] font-black text-[#5E7977] uppercase tracking-wider">Start Date</label>
                  <input
                    type="date"
                    value={k2i(detailProject.start)}
                    onChange={(e) =>
                      handleUpdateDetail({ ...detailProject, start: i2k(e.target.value) || todayKey() })
                    }
                    className="bg-[#0B1716] border border-[rgba(255,255,255,0.06)] rounded-xl p-3 text-[#EAF2F1] text-sm outline-none"
                  />
                </div>
                <div className="flex flex-col gap-2">
                  <label className="text-[10px] font-black text-[#5E7977] uppercase tracking-wider">Goal Date</label>
                  <input
                    type="date"
                    value={k2i(detailProject.target || '')}
                    onChange={(e) =>
                      handleUpdateDetail({ ...detailProject, target: i2k(e.target.value) || null })
                    }
                    className="bg-[#0B1716] border border-[rgba(255,255,255,0.06)] rounded-xl p-3 text-[#EAF2F1] text-sm outline-none"
                  />
                </div>
              </div>

              {/* End Date (if completed) */}
              {detailProject.end && (
                <div className="flex flex-col gap-2">
                  <label className="text-[10px] font-black text-[#5E7977] uppercase tracking-wider">End Date</label>
                  <input
                    type="date"
                    value={k2i(detailProject.end)}
                    onChange={(e) =>
                      handleUpdateDetail({ ...detailProject, end: i2k(e.target.value) || null })
                    }
                    className="bg-[#0B1716] border border-[rgba(255,255,255,0.06)] rounded-xl p-3 text-[#EAF2F1] text-sm outline-none"
                  />
                </div>
              )}

              {/* Statistics block */}
              <div className="bg-[#0B1716] border border-[rgba(255,255,255,0.06)] rounded-xl p-4 flex flex-col gap-2.5">
                <div className="flex justify-between text-xs">
                  <span className="text-[#84A09D]">Status</span>
                  <span className="font-extrabold text-[#EAF2F1]">
                    {detailProject.end ? 'Completed' : 'Active'}
                  </span>
                </div>
                <div className="flex justify-between text-xs border-t border-[rgba(255,255,255,0.06)] pt-2.5">
                  <span className="text-[#84A09D]">
                    {detailProject.end ? 'Took' : 'Elapsed'}
                  </span>
                  <span className="font-extrabold text-[#EAF2F1]">
                    {getOngoingDays(detailProject).toLocaleString()} days
                  </span>
                </div>
                {getTimeProgress(detailProject) !== null && (
                  <div className="flex justify-between text-xs border-t border-[rgba(255,255,255,0.06)] pt-2.5">
                    <span className="text-[#84A09D]">Time to Goal</span>
                    <span className="font-extrabold text-[#F4B65C]">
                      {getTimeProgress(detailProject)}%
                    </span>
                  </div>
                )}
              </div>

              {/* Manual Progress Slider */}
              <div className="flex flex-col gap-2 mt-1">
                <div className="flex justify-between items-center text-[10px] font-black text-[#5E7977] uppercase tracking-wider">
                  <span>Your manual progress</span>
                  <span className="text-sm font-bold text-[#2FD4C4]">
                    {detailProject.progress || 0}%
                  </span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="100"
                  value={detailProject.progress || 0}
                  onChange={(e) =>
                    handleUpdateDetail({ ...detailProject, progress: parseInt(e.target.value) })
                  }
                  className="w-full h-1 bg-[#132726] rounded-lg appearance-none cursor-pointer accent-[#2FD4C4]"
                />
              </div>

              {/* Checklist / Sub-projects Section */}
              <div className="flex flex-col gap-2.5 mt-2">
                <label className="text-[10px] font-black text-[#5E7977] uppercase tracking-wider">
                  Sub-projects / steps (holds its own files)
                </label>
                <div className="flex flex-col gap-2">
                  {(detailProject.subtasks || []).map((sub) => (
                    <div key={sub.id} className="flex flex-col bg-[#0B1716] border border-[rgba(255,255,255,0.06)] rounded-xl p-3 gap-2">
                      <div className="flex items-center gap-3">
                        <button
                          onClick={() => handleToggleSubtask(sub.id)}
                          className={`w-[22px] h-[22px] rounded-md border flex items-center justify-center transition-all ${
                            sub.done
                              ? 'bg-[#2FD4C4] border-[#2FD4C4] text-[#04201D]'
                              : 'border-[#0E7E78]'
                          }`}
                        >
                          {sub.done && <Check className="w-3.5 h-3.5 stroke-[4px]" />}
                        </button>
                        <span className={`flex-1 text-sm ${sub.done ? 'line-through text-[#5E7977]' : 'text-[#EAF2F1]'}`}>
                          {sub.title}
                        </span>
                        
                        <button
                          onClick={() => handleAttachFileToSubtask(sub.id)}
                          className="p-1.5 text-[#5E7977] hover:text-[#2FD4C4] transition"
                          title="Attach document/photo"
                        >
                          <Paperclip className="w-3.5 h-3.5" />
                        </button>

                        <button
                          onClick={() => handleDeleteSubtask(sub.id)}
                          className="p-1.5 text-[#5E7977] hover:text-[#E26D7A] transition"
                        >
                          <Trash className="w-3.5 h-3.5" />
                        </button>
                      </div>

                      {/* Render bound files inside subtask list */}
                      {sub.files && sub.files.length > 0 && (
                        <div className="flex flex-wrap gap-2 pl-8 pt-1">
                          {sub.files.map((file) => (
                            <div key={file.id} className="flex items-center gap-1.5 text-[11px] bg-[#132726] border border-[rgba(47,212,196,0.15)] px-2.5 py-1 rounded-lg">
                              <span className="text-[#2FD4C4] text-xs">📎</span>
                              <span className="text-[#84A09D] font-bold">{file.name}</span>
                              <button
                                onClick={() => handleDeleteFileFromSubtask(sub.id, file.id)}
                                className="text-[#E26D7A] ml-1 font-bold"
                              >
                                ×
                              </button>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  ))}
                </div>

                <div className="flex gap-2">
                  <input
                    type="text"
                    placeholder="Add a checklist / step…"
                    value={newSubtaskText}
                    onChange={(e) => setNewSubtaskText(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleAddSubtask()}
                    className="flex-1 bg-[#0B1716] border border-[rgba(255,255,255,0.06)] rounded-xl px-3.5 py-2.5 text-sm text-[#EAF2F1] outline-none"
                  />
                  <button
                    onClick={handleAddSubtask}
                    className="px-4 rounded-xl font-bold bg-[#132726] border border-[rgba(47,212,196,0.16)] text-[#2FD4C4] text-sm"
                  >
                    Add
                  </button>
                </div>
              </div>

              {/* Attachments Section */}
              <div className="flex flex-col gap-2 mt-2">
                <label className="text-[10px] font-black text-[#5E7977] uppercase tracking-wider">
                  Attachments (saved into Drive folder)
                </label>
                <div className="flex flex-wrap gap-2 bg-[#0B1716] border border-[rgba(255,255,255,0.06)] rounded-xl p-3">
                  {(!detailProject.files || detailProject.files.length === 0) ? (
                    <span className="text-xs italic text-[#5E7977]">No files attached yet.</span>
                  ) : (
                    detailProject.files.map((file) => (
                      <div key={file.id} className="flex items-center gap-1.5 text-xs bg-[#132726] border border-[rgba(47,212,196,0.15)] px-3 py-1.5 rounded-xl">
                        <span className="text-[#2FD4C4]">📎</span>
                        <span className="text-[#EAF2F1] font-bold">{file.name}</span>
                        <span className="text-[9px] text-[#2BA8C4] uppercase font-bold ml-1">({file.kind})</span>
                        <button
                          onClick={() => handleDeleteFile(file.id)}
                          className="text-[#E26D7A] ml-2 font-black text-sm"
                        >
                          ×
                        </button>
                      </div>
                    ))
                  )}
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => handleAddFile('photo')}
                    className="flex-1 p-2 bg-[#132726] border border-[rgba(47,212,196,0.1)] rounded-lg text-xs font-bold text-[#2FD4C4]"
                  >
                    + Photo
                  </button>
                  <button
                    onClick={() => handleAddFile('file')}
                    className="flex-1 p-2 bg-[#132726] border border-[rgba(47,212,196,0.1)] rounded-lg text-xs font-bold text-[#2FD4C4]"
                  >
                    + File/Data
                  </button>
                  <button
                    onClick={() => handleAddFile('graph')}
                    className="flex-1 p-2 bg-[#132726] border border-[rgba(47,212,196,0.1)] rounded-lg text-xs font-bold text-[#2FD4C4]"
                  >
                    + Graph
                  </button>
                </div>
              </div>

              {/* Progress Updates Section */}
              <div className="flex flex-col gap-2.5 mt-2 border-t border-[rgba(255,255,255,0.06)] pt-4">
                <label className="text-[10px] font-black text-[#5E7977] uppercase tracking-wider">
                  Progress Updates / Notes Log
                </label>
                
                <div className="flex flex-col gap-2">
                  {(detailProject.updates || []).slice().reverse().map((u) => (
                    <div key={u.id} className="border-l-2 border-l-[#2FD4C4] bg-[#0B1716] rounded-r-lg p-3">
                      <div className="text-[10px] text-[#2FD4C4] font-bold mb-1">
                        {new Date(u.ts).toLocaleString()}
                      </div>
                      <div className="text-sm text-[#cfe6e3] leading-relaxed break-words whitespace-pre-wrap">{u.text}</div>
                    </div>
                  ))}
                </div>

                <div className="flex flex-col gap-2">
                  <textarea
                    placeholder="Type a progress update or note…"
                    value={newUpdateText}
                    onChange={(e) => setNewUpdateText(e.target.value)}
                    rows={2}
                    className="w-full bg-[#0B1716] border border-[rgba(255,255,255,0.06)] rounded-xl p-3 text-sm text-[#EAF2F1] outline-none resize-none focus:border-[#2FD4C4]"
                  />
                  <button
                    onClick={handleAddUpdate}
                    className="w-full py-2.5 rounded-xl font-bold bg-[#132726] border border-[#0E7E78] text-[#2FD4C4] text-sm hover:opacity-95"
                  >
                    Add update
                  </button>
                </div>
              </div>

              {/* Mark Complete or Reopen */}
              <div className="mt-4 flex flex-col gap-3">
                {!detailProject.end ? (
                  <button
                    onClick={handleCompleteProject}
                    className="w-full py-3.5 rounded-xl font-extrabold bg-[#2FD4C4] text-[#04201D] flex items-center justify-center gap-2"
                  >
                    <Check className="w-5 h-5 stroke-[3px]" /> Mark complete → Completed
                  </button>
                ) : (
                  <button
                    onClick={handleReopenProject}
                    className="w-full py-3.5 rounded-xl font-extrabold bg-[#132726] text-[#2FD4C4] border border-[#0E7E78]"
                  >
                    Reopen project
                  </button>
                )}

                <button
                  onClick={handleDeleteProject}
                  className="w-full py-3 text-sm font-bold text-[#E26D7A] hover:bg-[rgba(226,109,122,0.05)] rounded-xl transition"
                >
                  Delete project
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* New Project Modal dialog overlay */}
      {formOpen && (
        <div className="absolute inset-0 z-40 bg-[rgba(2,8,8,0.7)] backdrop-blur-xs flex items-center justify-center p-4">
          <div
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-[500px] bg-[#0E1A1A] border border-[rgba(47,212,196,0.16)] rounded-2xl p-5 md:p-6 shadow-xl flex flex-col gap-4 rise"
          >
            <div className="flex justify-between items-center">
              <h2 className="text-xl font-extrabold text-[#EAF2F1]">New Project</h2>
              <button
                onClick={() => setFormOpen(false)}
                className="text-[#84A09D] hover:text-[#EAF2F1] text-lg font-black"
              >
                ×
              </button>
            </div>

            {/* Title field */}
            <div className="flex flex-col gap-1.5">
              <label className="text-[10px] font-black text-[#5E7977] uppercase tracking-wider">What are you pursuing?</label>
              <input
                type="text"
                placeholder="e.g. Learn Malayalam script"
                value={newTitle}
                onChange={(e) => setNewTitle(e.target.value)}
                className="bg-[#0B1716] border border-[rgba(255,255,255,0.06)] rounded-xl p-3 text-sm text-[#EAF2F1] outline-none"
              />
            </div>

            {/* Category selection */}
            <div className="flex flex-col gap-1.5">
              <label className="text-[10px] font-black text-[#5E7977] uppercase tracking-wider">Category</label>
              <div className="flex flex-wrap gap-1.5 max-h-[100px] overflow-y-auto scroll">
                {categories.map((c) => (
                  <button
                    key={c}
                    onClick={() => setNewCategory(c)}
                    className={`px-3 py-1.5 rounded-full text-xs font-bold transition border ${
                      newCategory === c
                        ? 'bg-[rgba(47,212,196,0.08)] border-[#2FD4C4] text-[#2FD4C4]'
                        : 'bg-[#0B1716] border-[rgba(255,255,255,0.06)] text-[#84A09D]'
                    }`}
                  >
                    {c}
                  </button>
                ))}
              </div>
            </div>

            {/* Dates row */}
            <div className="grid grid-cols-2 gap-3">
              <div className="flex flex-col gap-1.5">
                <label className="text-[10px] font-black text-[#5E7977] uppercase tracking-wider">Start Date</label>
                <input
                  type="date"
                  value={newStart}
                  onChange={(e) => setNewStart(e.target.value)}
                  className="bg-[#0B1716] border border-[rgba(255,255,255,0.06)] rounded-xl p-3 text-sm text-[#EAF2F1] outline-none"
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="text-[10px] font-black text-[#5E7977] uppercase tracking-wider">Goal Date</label>
                <input
                  type="date"
                  value={newTarget}
                  onChange={(e) => setNewTarget(e.target.value)}
                  className="bg-[#0B1716] border border-[rgba(255,255,255,0.06)] rounded-xl p-3 text-sm text-[#EAF2F1] outline-none"
                />
              </div>
            </div>

            {/* Notes */}
            <div className="flex flex-col gap-1.5">
              <label className="text-[10px] font-black text-[#5E7977] uppercase tracking-wider">Notes</label>
              <textarea
                placeholder="What does 'done' look like? Describe your target outcome…"
                rows={2}
                value={newNote}
                onChange={(e) => setNewNote(e.target.value)}
                className="bg-[#0B1716] border border-[rgba(255,255,255,0.06)] rounded-xl p-3 text-sm text-[#EAF2F1] outline-none resize-none"
              />
            </div>

            <button
              onClick={handleCreateProject}
              className="w-full mt-2 p-3.5 rounded-xl font-extrabold bg-[#2FD4C4] text-[#04201D]"
            >
              Create project
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
