import React, { useEffect, useState } from 'react'
import {
  Archive,
  Calendar,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  Circle,
  CornerDownRight,
  Eye,
  GripVertical,
  Plus,
  Trash2,
} from 'lucide-react'
import { AreaArtwork } from './AreaArtwork'

export function TasksBoard({ lists, onRefresh, onOpenNote }) {
  const [visibleLists, setVisibleLists] = useState(() => {
    try {
      const saved = localStorage.getItem('hq_visible_task_lists')
      return saved ? JSON.parse(saved) : null
    } catch {
      return null
    }
  })
  const [showSelector, setShowSelector] = useState(false)
  const [newListName, setNewListName] = useState('')
  const [creatingList, setCreatingList] = useState(false)

  // Per-list new task inputs: { [listName]: { text, due } }
  const [drafts, setDrafts] = useState({})
  // Subtask input: { parentId, listName, text }
  const [subtaskDraft, setSubtaskDraft] = useState(null)
  // Expanded archived sections: { [listName]: boolean }
  const [showArchived, setShowArchived] = useState({})
  // Dragging state
  const [dragInfo, setDragInfo] = useState(null)
  const [dragOverList, setDragOverList] = useState(null)

  useEffect(() => {
    if (lists.length > 0 && visibleLists === null) {
      setVisibleLists(lists.map((l) => l.name))
    }
  }, [lists, visibleLists])

  const toggleListVisible = (name) => {
    const current = visibleLists || lists.map((l) => l.name)
    const next = current.includes(name)
      ? current.filter((n) => n !== name)
      : [...current, name]
    setVisibleLists(next)
    localStorage.setItem('hq_visible_task_lists', JSON.stringify(next))
  }

  const handleCreateList = async (e) => {
    e.preventDefault()
    if (!newListName.trim()) return
    const res = await fetch('/api/task-lists', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: newListName.trim() }),
    })
    if (res.ok) {
      const created = await res.json()
      const next = [...(visibleLists || lists.map((l) => l.name)), created.list.name]
      setVisibleLists(next)
      localStorage.setItem('hq_visible_task_lists', JSON.stringify(next))
      setNewListName('')
      setCreatingList(false)
      onRefresh()
    }
  }

  const handleAddTask = async (e, listName) => {
    e.preventDefault()
    const d = drafts[listName] || { text: '', due: '' }
    if (!d.text.trim()) return
    const res = await fetch(`/api/task-lists/${encodeURIComponent(listName)}/tasks`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text: d.text.trim(), due: d.due || '' }),
    })
    if (res.ok) {
      setDrafts((prev) => ({ ...prev, [listName]: { text: '', due: '' } }))
      onRefresh()
    }
  }

  const handleAddSubtask = async (e) => {
    e.preventDefault()
    if (!subtaskDraft || !subtaskDraft.text.trim()) return
    const res = await fetch(`/api/task-lists/${encodeURIComponent(subtaskDraft.listName)}/tasks`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        text: subtaskDraft.text.trim(),
        parent_id: subtaskDraft.parentId,
      }),
    })
    if (res.ok) {
      setSubtaskDraft(null)
      onRefresh()
    }
  }

  const handleToggle = async (listName, taskId, currentDone) => {
    const res = await fetch(
      `/api/task-lists/${encodeURIComponent(listName)}/tasks/${encodeURIComponent(taskId)}`,
      {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ done: !currentDone }),
      }
    )
    if (res.ok) onRefresh()
  }

  const handleUpdateDue = async (listName, taskId, due) => {
    const res = await fetch(
      `/api/task-lists/${encodeURIComponent(listName)}/tasks/${encodeURIComponent(taskId)}`,
      {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ due }),
      }
    )
    if (res.ok) onRefresh()
  }

  const handleDelete = async (listName, taskId) => {
    const res = await fetch(
      `/api/task-lists/${encodeURIComponent(listName)}/tasks/${encodeURIComponent(taskId)}`,
      { method: 'DELETE' }
    )
    if (res.ok) onRefresh()
  }

  const handleArchive = async (listName) => {
    const res = await fetch(`/api/task-lists/${encodeURIComponent(listName)}/archive`, {
      method: 'POST',
    })
    if (res.ok) onRefresh()
  }

  const handleDropOnList = async (toList) => {
    setDragOverList(null)
    if (!dragInfo || dragInfo.fromList === toList) {
      setDragInfo(null)
      return
    }
    const res = await fetch('/api/task-lists/move', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        from_list: dragInfo.fromList,
        to_list: toList,
        task_id: dragInfo.taskId,
      }),
    })
    setDragInfo(null)
    if (res.ok) onRefresh()
  }

  const todayIso = new Date().toISOString().slice(0, 10)
  const displayedLists = lists.filter(
    (l) => !visibleLists || visibleLists.includes(l.name)
  )

  return (
    <div className="space-y-6">
      {/* Banner */}
      <div className="relative z-20 min-h-[128px] sm:h-32 rounded-3xl border border-white/10">
        <div className="absolute inset-0 overflow-hidden rounded-3xl">
          <AreaArtwork style="studio" className="h-full w-full" />
        </div>
        <div className="relative z-10 flex h-full flex-wrap items-end justify-between gap-3 p-4 sm:p-6">
          <div>
            <span className="text-xs text-zinc-300">myVault / Tareas (estilo Google Tasks)</span>
            <h1 className="text-3xl font-extrabold text-white">Listas de Tareas</h1>
          </div>

          <div className="flex items-center gap-2">
            {/* List visibility dropdown */}
            <div className="relative">
              <button
                onClick={() => setShowSelector((v) => !v)}
                className="flex items-center gap-1.5 rounded-xl border border-white/15 bg-black/50 px-3.5 py-2 text-xs font-medium text-white backdrop-blur-md hover:bg-black/75 cursor-pointer"
              >
                <Eye className="h-3.5 w-3.5 text-[#f2b880]" />
                <span>Listas ({displayedLists.length}/{lists.length})</span>
                <ChevronDown className="h-3.5 w-3.5 opacity-70" />
              </button>
              {showSelector && (
                <div className="absolute right-0 mt-2 w-56 rounded-2xl border border-white/15 bg-[#0e1416] p-2 shadow-2xl z-30">
                  <div className="px-2 py-1 text-[11px] font-semibold text-zinc-400">
                    Mostrar listas
                  </div>
                  {lists.map((l) => {
                    const checked = !visibleLists || visibleLists.includes(l.name)
                    return (
                      <label
                        key={l.name}
                        className="flex items-center justify-between rounded-xl px-2.5 py-1.5 text-xs text-zinc-200 hover:bg-white/5 cursor-pointer"
                      >
                        <span className="flex items-center gap-2">
                          <input
                            type="checkbox"
                            checked={checked}
                            onChange={() => toggleListVisible(l.name)}
                            className="accent-[#f2b880]"
                          />
                          {l.title}
                        </span>
                        <span className="text-[10px] text-zinc-500">{l.pending.length}</span>
                      </label>
                    )
                  })}
                </div>
              )}
            </div>

            <button
              onClick={() => setCreatingList((v) => !v)}
              className="flex items-center gap-1.5 rounded-xl bg-[#f2b880] px-3.5 py-2 text-xs font-bold text-zinc-950 hover:bg-[#f5c496] cursor-pointer"
            >
              <Plus className="h-3.5 w-3.5" />
              Nueva lista
            </button>
          </div>
        </div>
      </div>

      {/* Create New List inline form */}
      {creatingList && (
        <form
          onSubmit={handleCreateList}
          className="animate-modal-pop flex items-center gap-2 rounded-2xl border border-[#f2b880]/30 bg-white/[0.04] p-3"
        >
          <input
            type="text"
            value={newListName}
            onChange={(e) => setNewListName(e.target.value)}
            placeholder="Nombre de la nueva lista (ej. Trabajo, Compras, Dumashe)..."
            autoFocus
            className="flex-1 bg-transparent px-2 text-sm text-white placeholder:text-zinc-500 focus:outline-none"
          />
          <button
            type="button"
            onClick={() => setCreatingList(false)}
            className="rounded-xl px-3 py-1.5 text-xs text-zinc-400 hover:bg-white/5 cursor-pointer"
          >
            Cancelar
          </button>
          <button
            type="submit"
            className="rounded-xl bg-[#f2b880] px-4 py-1.5 text-xs font-bold text-zinc-950 hover:bg-[#f5c496] cursor-pointer"
          >
            Crear lista
          </button>
        </form>
      )}

      {/* Multi-list Google Tasks Columns */}
      <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3 items-start">
        {displayedLists.map((lst) => {
          const draft = drafts[lst.name] || { text: '', due: '' }
          const completedInPending = lst.pending.filter((t) => t.done).length
          const archivedOpen = Boolean(showArchived[lst.name])
          const isDropTarget = dragOverList === lst.name

          return (
            <div
              key={lst.name}
              onDragOver={(e) => {
                e.preventDefault()
                setDragOverList(lst.name)
              }}
              onDragLeave={() => setDragOverList(null)}
              onDrop={() => handleDropOnList(lst.name)}
              className={`flex flex-col rounded-3xl border p-5 backdrop-blur-xl transition-all ${
                isDropTarget
                  ? 'border-[#f2b880] bg-[#f2b880]/[0.06] scale-[1.01]'
                  : 'border-white/[0.08] bg-white/[0.03]'
              }`}
            >
              {/* List Header */}
              <div className="mb-4 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <h2 className="text-lg font-bold text-white">{lst.title}</h2>
                  <span className="rounded-full bg-white/10 px-2 py-0.5 text-[11px] font-semibold text-zinc-300">
                    {lst.pending.filter((t) => !t.done).length}
                  </span>
                </div>
                <div className="flex items-center gap-1.5">
                  {completedInPending > 0 && (
                    <button
                      onClick={() => handleArchive(lst.name)}
                      title="Archivar tareas marcadas"
                      className="flex items-center gap-1 rounded-xl border border-[#f2b880]/30 bg-[#f2b880]/15 px-2.5 py-1 text-[11px] font-semibold text-[#f2b880] hover:bg-[#f2b880]/25 cursor-pointer"
                    >
                      <Archive className="h-3 w-3" />
                      Archivar ({completedInPending})
                    </button>
                  )}
                  <button
                    onClick={() => onOpenNote(lst.file_path)}
                    title="Ver nota Markdown"
                    className="rounded-lg border border-white/10 px-2 py-1 text-[10px] text-zinc-400 hover:text-white cursor-pointer"
                  >
                    .md
                  </button>
                </div>
              </div>

              {/* Add task form */}
              <form onSubmit={(e) => handleAddTask(e, lst.name)} className="mb-4 space-y-2">
                <div className="flex items-center gap-2 rounded-xl border border-white/10 bg-black/30 px-3 py-2">
                  <Plus className="h-4 w-4 text-[#f2b880] shrink-0" />
                  <input
                    type="text"
                    value={draft.text}
                    onChange={(e) =>
                      setDrafts((prev) => ({
                        ...prev,
                        [lst.name]: { ...draft, text: e.target.value },
                      }))
                    }
                    placeholder="Añadir una tarea..."
                    className="flex-1 bg-transparent text-xs text-white placeholder:text-zinc-500 focus:outline-none"
                  />
                  <input
                    type="date"
                    value={draft.due}
                    onChange={(e) =>
                      setDrafts((prev) => ({
                        ...prev,
                        [lst.name]: { ...draft, due: e.target.value },
                      }))
                    }
                    title="Fecha límite"
                    className="w-28 bg-transparent text-[11px] text-zinc-400 focus:outline-none"
                  />
                </div>
              </form>

              {/* Pending Tasks */}
              <div className="space-y-2">
                {lst.pending.length === 0 ? (
                  <div className="rounded-2xl border border-dashed border-white/10 py-6 text-center text-xs text-zinc-500">
                    Sin tareas aquí. Arrastra una o crea una arriba.
                  </div>
                ) : (
                  lst.pending.map((task) => {
                    const isOverdue = task.due && task.due < todayIso && !task.done
                    const isToday = task.due && task.due === todayIso && !task.done
                    return (
                      <div
                        key={task.id}
                        data-nav-item
                        tabIndex={0}
                        draggable
                        onDragStart={() =>
                          setDragInfo({ fromList: lst.name, taskId: task.id })
                        }
                        className="group rounded-2xl border border-white/[0.06] bg-white/[0.02] p-3 hover:border-white/15 hover:bg-white/[0.04] transition-all"
                      >
                        <div className="flex items-start gap-2">
                          <GripVertical className="mt-0.5 h-4 w-4 shrink-0 text-zinc-600 opacity-0 group-hover:opacity-100 cursor-grab" />
                          <button
                            onClick={() => handleToggle(lst.name, task.id, task.done)}
                            className="mt-0.5 shrink-0 cursor-pointer"
                          >
                            {task.done ? (
                              <CheckCircle2 className="h-4 w-4 text-[#f2b880]" />
                            ) : (
                              <Circle className="h-4 w-4 text-zinc-500 hover:text-[#f2b880]" />
                            )}
                          </button>

                          <div className="min-w-0 flex-1">
                            <div
                              className={`text-sm leading-snug ${
                                task.done ? 'line-through text-zinc-500' : 'text-zinc-100'
                              }`}
                            >
                              {task.text}
                            </div>

                            {/* Due date & quick actions */}
                            <div className="mt-1.5 flex flex-wrap items-center gap-2">
                              {task.due && (
                                <span
                                  className={`inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[10px] font-medium ${
                                    isOverdue
                                      ? 'bg-rose-500/20 text-rose-300'
                                      : isToday
                                      ? 'bg-[#f2b880]/20 text-[#f2b880]'
                                      : 'bg-white/10 text-zinc-400'
                                  }`}
                                >
                                  <Calendar className="h-2.5 w-2.5" />
                                  {task.due}
                                </span>
                              )}

                              <div className="flex items-center gap-1 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity">
                                <input
                                  type="date"
                                  value={task.due || ''}
                                  onChange={(e) =>
                                    handleUpdateDue(lst.name, task.id, e.target.value)
                                  }
                                  title="Cambiar fecha límite"
                                  className="w-5 cursor-pointer bg-transparent text-[10px] text-zinc-400"
                                />
                                <button
                                  onClick={() =>
                                    setSubtaskDraft({
                                      listName: lst.name,
                                      parentId: task.id,
                                      text: '',
                                    })
                                  }
                                  title="Añadir subtarea"
                                  className="rounded px-1.5 py-0.5 text-[10px] text-zinc-400 hover:bg-white/10 hover:text-white cursor-pointer"
                                >
                                  + Subtarea
                                </button>
                                <button
                                  onClick={() => handleDelete(lst.name, task.id)}
                                  title="Eliminar tarea"
                                  className="rounded p-1 text-zinc-500 hover:text-rose-400 cursor-pointer"
                                >
                                  <Trash2 className="h-3 w-3" />
                                </button>
                              </div>
                            </div>

                            {/* Subtasks */}
                            {task.subtasks?.length > 0 && (
                              <div className="mt-2 space-y-1 border-l border-white/10 pl-3">
                                {task.subtasks.map((st) => (
                                  <div
                                    key={st.id}
                                    className="flex items-center justify-between gap-2 text-xs"
                                  >
                                    <button
                                      onClick={() => handleToggle(lst.name, st.id, st.done)}
                                      className="flex items-center gap-2 text-left cursor-pointer"
                                    >
                                      {st.done ? (
                                        <CheckCircle2 className="h-3.5 w-3.5 text-[#f2b880]" />
                                      ) : (
                                        <Circle className="h-3.5 w-3.5 text-zinc-500" />
                                      )}
                                      <span
                                        className={
                                          st.done ? 'line-through text-zinc-500' : 'text-zinc-300'
                                        }
                                      >
                                        {st.text}
                                      </span>
                                    </button>
                                    <button
                                      onClick={() => handleDelete(lst.name, st.id)}
                                      className="text-zinc-600 hover:text-rose-400 cursor-pointer"
                                    >
                                      <Trash2 className="h-3 w-3" />
                                    </button>
                                  </div>
                                ))}
                              </div>
                            )}

                            {/* Inline subtask input */}
                            {subtaskDraft?.parentId === task.id && (
                              <form onSubmit={handleAddSubtask} className="mt-2 flex items-center gap-1.5">
                                <CornerDownRight className="h-3.5 w-3.5 text-zinc-500 shrink-0" />
                                <input
                                  type="text"
                                  value={subtaskDraft.text}
                                  onChange={(e) =>
                                    setSubtaskDraft({ ...subtaskDraft, text: e.target.value })
                                  }
                                  placeholder="Subtarea..."
                                  autoFocus
                                  className="flex-1 rounded-lg border border-white/10 bg-black/40 px-2 py-1 text-xs text-white focus:outline-none"
                                />
                                <button
                                  type="submit"
                                  className="rounded-lg bg-[#f2b880] px-2 py-1 text-[10px] font-bold text-zinc-950 cursor-pointer"
                                >
                                  OK
                                </button>
                              </form>
                            )}
                          </div>
                        </div>
                      </div>
                    )
                  })
                )}
              </div>

              {/* Archived Tasks Collapsible */}
              {lst.archived.length > 0 && (
                <div className="mt-4 border-t border-white/[0.08] pt-3">
                  <button
                    onClick={() =>
                      setShowArchived((prev) => ({ ...prev, [lst.name]: !archivedOpen }))
                    }
                    className="flex w-full items-center justify-between text-xs font-medium text-zinc-400 hover:text-zinc-200 cursor-pointer"
                  >
                    <span className="flex items-center gap-1.5">
                      {archivedOpen ? (
                        <ChevronDown className="h-3.5 w-3.5" />
                      ) : (
                        <ChevronRight className="h-3.5 w-3.5" />
                      )}
                      Archivadas ({lst.archived.length})
                    </span>
                  </button>

                  {archivedOpen && (
                    <div className="mt-2 space-y-1.5">
                      {lst.archived.map((at) => (
                        <div
                          key={at.id}
                          className="flex items-center justify-between gap-2 rounded-xl bg-black/20 px-3 py-2 text-xs text-zinc-500"
                        >
                          <button
                            onClick={() => handleToggle(lst.name, at.id, at.done)}
                            className="flex items-center gap-2 text-left cursor-pointer"
                          >
                            <CheckCircle2 className="h-3.5 w-3.5 text-[#f2b880]/60 shrink-0" />
                            <span className="line-through">{at.text}</span>
                          </button>
                          <button
                            onClick={() => handleDelete(lst.name, at.id)}
                            className="text-zinc-600 hover:text-rose-400 cursor-pointer"
                          >
                            <Trash2 className="h-3 w-3" />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
