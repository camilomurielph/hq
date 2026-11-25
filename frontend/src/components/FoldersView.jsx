import React, { useCallback, useEffect, useState } from 'react'
import { FilePlus2, FileText, Folder, FolderOpen, GripVertical, Search } from 'lucide-react'

export function FoldersView({ onOpenNote, onNewNoteInFolder, onRefreshVault }) {
  const [folders, setFolders] = useState([])
  const [selectedPath, setSelectedPath] = useState('Temporal')
  const [folderFilter, setFolderFilter] = useState('')
  const [dragNote, setDragNote] = useState(null)
  const [dropTarget, setDropTarget] = useState(null)

  const load = useCallback(async () => {
    const res = await fetch('/api/folders')
    if (res.ok) {
      const data = await res.json()
      const list = data.folders || []
      setFolders(list)
      if (list.length > 0 && !list.some((f) => f.path === selectedPath)) {
        setSelectedPath(list[0].path)
      }
    }
  }, [selectedPath])

  useEffect(() => {
    load()
  }, [load])

  const handleMoveNote = async (note, targetFolder) => {
    if (!note || !targetFolder) return
    const fileName = note.path.split('/').pop()
    const newPath = targetFolder === 'Raíz' ? fileName : `${targetFolder}/${fileName}`
    if (newPath === note.path) return

    const res = await fetch('/api/notes/move', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ old_path: note.path, new_path: newPath }),
    })
    if (res.ok) {
      await load()
      onRefreshVault?.()
    }
  }

  const visibleFolders = folders.filter((f) =>
    !folderFilter.trim()
      ? true
      : f.path.toLowerCase().includes(folderFilter.toLowerCase())
  )

  const activeFolder = folders.find((f) => f.path === selectedPath) || folders[0] || null

  return (
    <div className="space-y-4 sm:space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl sm:text-2xl font-extrabold text-white">Carpetas</h1>
          <p className="text-xs sm:text-sm text-zinc-400">
            Navega por tus carpetas y mueve notas fácilmente.
          </p>
        </div>
        {activeFolder && (
          <button
            onClick={() => onNewNoteInFolder(activeFolder.path)}
            className="flex items-center gap-1.5 rounded-xl bg-[#f2b880] px-4 py-2.5 sm:py-2 text-xs sm:text-sm font-bold text-zinc-950 hover:bg-[#f5c496] cursor-pointer"
          >
            <FilePlus2 className="h-4 w-4" />
            Nueva en {activeFolder.path.split('/').pop()}
          </button>
        )}
      </div>

      {/* Mobile Folder Selector (replaces giant stacked tree on small screens) */}
      <div className="lg:hidden rounded-2xl border border-white/10 bg-white/[0.04] p-3">
        <label className="block text-[11px] font-medium text-zinc-400 mb-1.5">
          Carpeta seleccionada
        </label>
        <select
          value={activeFolder?.path || ''}
          onChange={(e) => setSelectedPath(e.target.value)}
          className="w-full rounded-xl border border-white/15 bg-zinc-900 px-3 py-2.5 text-sm font-medium text-white focus:border-[#f2b880]/50 focus:outline-none"
        >
          {folders.map((f) => (
            <option key={f.path} value={f.path}>
              {f.path} ({f.count})
            </option>
          ))}
        </select>
      </div>

      <div className="grid gap-5 lg:grid-cols-12 items-start">
        {/* Desktop Left Pane: Folder Tree */}
        <div className="hidden lg:block lg:col-span-4 rounded-3xl border border-white/[0.08] bg-white/[0.03] p-4 backdrop-blur-xl space-y-3">
          <div className="flex items-center gap-2 rounded-xl border border-white/10 bg-black/30 px-3 py-2">
            <Search className="h-3.5 w-3.5 text-zinc-400" />
            <input
              type="text"
              value={folderFilter}
              onChange={(e) => setFolderFilter(e.target.value)}
              placeholder="Filtrar carpetas..."
              className="w-full bg-transparent text-xs text-white placeholder:text-zinc-500 focus:outline-none"
            />
          </div>

          <div className="max-h-[60vh] space-y-1 overflow-y-auto pr-1">
            {visibleFolders.map((f) => {
              const depth = f.path === 'Raíz' ? 0 : f.path.split('/').length - 1
              const label = f.path.split('/').pop()
              const active = activeFolder?.path === f.path
              const isDrop = dropTarget === f.path

              return (
                <button
                  key={f.path}
                  data-nav-item
                  tabIndex={0}
                  onClick={() => setSelectedPath(f.path)}
                  onDragOver={(e) => {
                    e.preventDefault()
                    setDropTarget(f.path)
                  }}
                  onDragLeave={() => setDropTarget(null)}
                  onDrop={() => {
                    setDropTarget(null)
                    if (dragNote) {
                      handleMoveNote(dragNote, f.path)
                      setDragNote(null)
                    }
                  }}
                  style={{ paddingLeft: `${12 + depth * 14}px` }}
                  className={`flex w-full items-center justify-between rounded-xl pr-3 py-2 text-left text-xs transition-all cursor-pointer ${
                    isDrop
                      ? 'border border-[#f2b880] bg-[#f2b880]/20 text-white'
                      : active
                      ? 'bg-[#f2b880]/15 text-[#f2b880] font-semibold border border-[#f2b880]/30'
                      : 'text-zinc-300 hover:bg-white/[0.06] border border-transparent'
                  }`}
                >
                  <span className="flex items-center gap-2 min-w-0">
                    {active ? (
                      <FolderOpen className="h-3.5 w-3.5 shrink-0 text-[#f2b880]" />
                    ) : (
                      <Folder className="h-3.5 w-3.5 shrink-0 text-zinc-400" />
                    )}
                    <span className="truncate">{label}</span>
                  </span>
                  <span className="ml-2 shrink-0 rounded-full bg-white/10 px-2 py-0.5 text-[10px] text-zinc-400">
                    {f.count}
                  </span>
                </button>
              )
            })}
          </div>
        </div>

        {/* Right Pane: Notes in selected folder */}
        <div className="lg:col-span-8 rounded-3xl border border-white/[0.08] bg-white/[0.03] p-4 sm:p-5 backdrop-blur-xl space-y-4">
          <div className="flex items-center justify-between border-b border-white/[0.06] pb-3">
            <div className="min-w-0">
              <div className="text-[11px] text-zinc-400">Carpeta actual</div>
              <h2 className="text-base sm:text-lg font-bold text-white font-mono truncate">
                {activeFolder?.path || 'Raíz'}
              </h2>
            </div>
            <span className="shrink-0 text-xs sm:text-sm text-zinc-400">
              {activeFolder?.notes?.length || 0} notas
            </span>
          </div>

          {!activeFolder || activeFolder.notes.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-white/10 p-8 text-center text-sm text-zinc-500">
              Esta carpeta está vacía.
            </div>
          ) : (
            <div className="space-y-3 lg:max-h-[60vh] lg:overflow-y-auto lg:pr-1">
              {activeFolder.notes.map((n) => (
                <div
                  key={n.path}
                  data-nav-item
                  tabIndex={0}
                  draggable
                  onDragStart={() => setDragNote(n)}
                  onClick={() => onOpenNote(n.path)}
                  className="group flex flex-col sm:flex-row sm:items-center justify-between gap-3 rounded-2xl border border-white/[0.06] bg-white/[0.02] p-4 hover:border-[#f2b880]/40 hover:bg-white/[0.05] transition-all cursor-pointer"
                >
                  <div className="flex items-start gap-2.5 min-w-0 flex-1">
                    <GripVertical className="hidden sm:block mt-0.5 h-4 w-4 shrink-0 text-zinc-600 opacity-0 group-hover:opacity-100 cursor-grab" />
                    <FileText className="mt-0.5 h-4 w-4 shrink-0 text-[#f2b880]" />
                    <div className="min-w-0">
                      <div className="text-base sm:text-sm font-semibold text-white group-hover:text-[#f2b880] leading-snug">
                        {n.title}
                      </div>
                      <div className="mt-0.5 text-xs sm:text-xs text-zinc-400 line-clamp-2">
                        {n.excerpt || `${n.word_count} palabras`}
                      </div>
                    </div>
                  </div>

                  <div
                    onClick={(e) => e.stopPropagation()}
                    className="flex items-center justify-end"
                  >
                    <select
                      value={activeFolder.path}
                      onChange={(e) => handleMoveNote(n, e.target.value)}
                      title="Mover nota a otra carpeta"
                      className="w-full sm:w-auto sm:max-w-[190px] rounded-xl border border-white/15 bg-zinc-900 px-3 py-2 sm:py-1.5 text-xs text-zinc-200 focus:outline-none cursor-pointer"
                    >
                      {folders.map((dest) => (
                        <option key={dest.path} value={dest.path}>
                          Mover → {dest.path}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
