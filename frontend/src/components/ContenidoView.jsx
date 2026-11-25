import React, { useCallback, useEffect, useState } from 'react'
import { ArrowLeft, BookOpen, Check, Film, ImagePlus, Layers, MessageSquare, Plus, Star, User } from 'lucide-react'
import { AreaArtwork } from './AreaArtwork'

const STAR_SCORES = [0, 0.5, 1, 1.5, 2, 2.5, 3, 3.5, 4, 4.5, 5]

export function LecturasSection({ onBack, onOpenNote, onRefreshVault }) {
  const [collections, setCollections] = useState([])
  const [selectedCol, setSelectedCol] = useState(null)
  const [showAddCol, setShowAddCol] = useState(false)

  // New collection form
  const [title, setTitle] = useState('')
  const [tipo, setTipo] = useState('Libro')
  const [autor, setAutor] = useState('')
  const [puntuacion, setPuntuacion] = useState(0)
  const [comentario, setComentario] = useState('')

  // Detail sub-forms
  const [showAddItem, setShowAddItem] = useState(false)
  const [itemTitle, setItemTitle] = useState('')
  const [itemProg, setItemProg] = useState(0)

  const [showBatch, setShowBatch] = useState(false)
  const [batchTotal, setBatchTotal] = useState(10)
  const [batchDone, setBatchDone] = useState(0)
  const [batchPrefix, setBatchPrefix] = useState('Tomo')

  const [colCommentDraft, setColCommentDraft] = useState('')

  const loadCollections = useCallback(async () => {
    const res = await fetch('/api/content/lecturas')
    if (res.ok) {
      const d = await res.json()
      setCollections(d.items || [])
    }
  }, [])

  const loadDetail = useCallback(async (name) => {
    const res = await fetch(`/api/content/lecturas/${encodeURIComponent(name)}`)
    if (res.ok) {
      const d = await res.json()
      setSelectedCol(d)
      setColCommentDraft(d.comentario || '')
    }
  }, [])

  useEffect(() => {
    loadCollections()
  }, [loadCollections])

  const handleCreateCollection = async (e) => {
    e.preventDefault()
    if (!title.trim()) return
    const res = await fetch('/api/content/lecturas', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        title: title.trim(),
        tipo,
        autor: autor.trim(),
        puntuacion: Number(puntuacion),
        comentario: comentario.trim(),
      }),
    })
    if (res.ok) {
      setTitle('')
      setAutor('')
      setPuntuacion(0)
      setComentario('')
      setShowAddCol(false)
      await loadCollections()
      onRefreshVault?.()
    }
  }

  const handleUploadCover = async (colName, file, itemFile = null) => {
    if (!file) return
    const fd = new FormData()
    fd.append('cover', file)
    if (itemFile) fd.append('item_file', itemFile)
    const res = await fetch(`/api/content/lecturas/${encodeURIComponent(colName)}/cover`, {
      method: 'POST',
      body: fd,
    })
    if (res.ok) {
      await loadCollections()
      if (selectedCol) await loadDetail(colName)
    }
  }

  const handleUpdateCollection = async (colName, patch) => {
    const res = await fetch(`/api/content/lecturas/${encodeURIComponent(colName)}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(patch),
    })
    if (res.ok) {
      const d = await res.json()
      setSelectedCol(d.collection)
      await loadCollections()
    }
  }

  const handleAddItem = async (e) => {
    e.preventDefault()
    if (!selectedCol || !itemTitle.trim()) return
    const res = await fetch(`/api/content/lecturas/${encodeURIComponent(selectedCol.name)}/items`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title: itemTitle.trim(), progreso: Number(itemProg) }),
    })
    if (res.ok) {
      const d = await res.json()
      setSelectedCol(d.collection)
      setItemTitle('')
      setItemProg(0)
      setShowAddItem(false)
      await loadCollections()
      onRefreshVault?.()
    }
  }

  const handleBatchAdd = async (e) => {
    e.preventDefault()
    if (!selectedCol) return
    const res = await fetch(`/api/content/lecturas/${encodeURIComponent(selectedCol.name)}/batch`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        total_count: Number(batchTotal),
        completed_count: Number(batchDone),
        prefix: batchPrefix.trim() || 'Tomo',
      }),
    })
    if (res.ok) {
      const d = await res.json()
      setSelectedCol(d.collection)
      setShowBatch(false)
      await loadCollections()
      onRefreshVault?.()
    }
  }

  const handleUpdateItem = async (itemFile, patch) => {
    if (!selectedCol) return
    const res = await fetch(
      `/api/content/lecturas/${encodeURIComponent(selectedCol.name)}/items/${encodeURIComponent(itemFile)}`,
      {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(patch),
      }
    )
    if (res.ok) {
      const d = await res.json()
      setSelectedCol(d.collection)
      await loadCollections()
    }
  }

  // ==================== COLLECTION DETAIL VIEW ====================
  if (selectedCol) {
    return (
      <div className="animate-view-in space-y-6">
        <div className="relative h-48 overflow-hidden rounded-3xl border border-white/10">
          <AreaArtwork style="library" coverUrl={selectedCol.cover_url} className="h-full w-full" />
          <div className="absolute inset-0 flex flex-col justify-between p-6">
            <div className="flex items-center justify-between">
              <button
                onClick={() => setSelectedCol(null)}
                className="inline-flex items-center gap-1.5 rounded-xl bg-black/50 px-3 py-1.5 text-xs text-zinc-200 backdrop-blur-md hover:text-white cursor-pointer"
              >
                <ArrowLeft className="h-3.5 w-3.5" />
                Volver a Lecturas
              </button>
              <div className="flex items-center gap-2">
                <label className="flex items-center gap-1.5 rounded-xl border border-white/15 bg-black/50 px-3 py-1.5 text-xs font-medium text-white backdrop-blur-md hover:bg-black/75 cursor-pointer">
                  <ImagePlus className="h-3.5 w-3.5 text-[#f2b880]" />
                  <span>Portada</span>
                  <input
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={(e) => handleUploadCover(selectedCol.name, e.target.files?.[0])}
                  />
                </label>
                <button
                  onClick={() => onOpenNote(selectedCol.path)}
                  className="rounded-xl border border-white/15 bg-black/50 px-3 py-1.5 text-xs font-medium text-white backdrop-blur-md hover:bg-black/75 cursor-pointer"
                >
                  Nota .md
                </button>
              </div>
            </div>

            <div className="flex flex-wrap items-end justify-between gap-4">
              <div>
                <span className="rounded-full bg-[#f2b880]/20 px-2.5 py-0.5 text-[10px] font-bold text-[#f2b880]">
                  {selectedCol.tipo} · {selectedCol.items_count} {selectedCol.tipo === 'Manga' ? 'tomos' : 'libros'}
                </span>
                <h1 className="mt-1 text-3xl font-extrabold text-white">{selectedCol.name}</h1>
                {selectedCol.autor && <p className="text-xs text-zinc-300">{selectedCol.autor}</p>}
              </div>

              <div className="flex items-center gap-4 rounded-2xl border border-white/10 bg-black/55 px-4 py-2.5 backdrop-blur-md">
                <div>
                  <div className="text-[10px] text-zinc-400">Progreso total</div>
                  <div className="text-2xl font-extrabold text-[#f2b880]">{selectedCol.progreso}%</div>
                </div>
                <div className="h-8 w-px bg-white/15" />
                <div className="flex items-center gap-1.5">
                  <Star className="h-4 w-4 text-[#f2b880] fill-[#f2b880]" />
                  <select
                    value={selectedCol.puntuacion}
                    onChange={(e) => handleUpdateCollection(selectedCol.name, { puntuacion: Number(e.target.value) })}
                    className="rounded-lg border border-white/10 bg-zinc-900 px-2 py-1 text-xs font-bold text-[#f2b880] cursor-pointer"
                  >
                    {STAR_SCORES.map((s) => (
                      <option key={s} value={s}>{s === 0 ? 'Sin ★' : `${s} ★`}</option>
                    ))}
                  </select>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Collection Comment + Actions */}
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-white/[0.08] bg-white/[0.03] p-4">
          <div className="flex flex-1 items-center gap-2 min-w-[240px]">
            <MessageSquare className="h-4 w-4 text-zinc-400 shrink-0" />
            <input
              type="text"
              value={colCommentDraft}
              onChange={(e) => setColCommentDraft(e.target.value)}
              onBlur={() => {
                if (colCommentDraft !== (selectedCol.comentario || '')) {
                  handleUpdateCollection(selectedCol.name, { comentario: colCommentDraft })
                }
              }}
              placeholder="Añadir comentario sobre esta colección..."
              className="flex-1 bg-transparent text-xs text-zinc-200 placeholder:text-zinc-500 focus:outline-none"
            />
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => {
                setShowBatch((v) => !v)
                setShowAddItem(false)
              }}
              className="flex items-center gap-1.5 rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-xs font-medium text-zinc-200 hover:bg-white/10 cursor-pointer"
            >
              <Layers className="h-3.5 w-3.5 text-[#f2b880]" />
              Generar en lote
            </button>
            <button
              onClick={() => {
                setShowAddItem((v) => !v)
                setShowBatch(false)
              }}
              className="flex items-center gap-1.5 rounded-xl bg-[#f2b880] px-3.5 py-2 text-xs font-bold text-zinc-950 hover:bg-[#f5c496] cursor-pointer"
            >
              <Plus className="h-3.5 w-3.5" />
              Agregar {selectedCol.tipo === 'Manga' ? 'tomo' : 'libro'}
            </button>
          </div>
        </div>

        {showAddItem && (
          <form onSubmit={handleAddItem} className="animate-modal-pop flex flex-wrap items-center gap-3 rounded-2xl border border-[#f2b880]/30 bg-white/[0.04] p-4">
            <input
              type="text"
              value={itemTitle}
              onChange={(e) => setItemTitle(e.target.value)}
              placeholder={selectedCol.tipo === 'Manga' ? 'Ej. Tomo 01' : 'Ej. El pozo de la ascensión'}
              required
              autoFocus
              className="flex-1 min-w-[200px] rounded-xl border border-white/10 bg-black/40 px-3 py-2 text-sm text-white focus:outline-none"
            />
            <div className="flex items-center gap-2">
              <span className="text-xs text-zinc-400">Avance:</span>
              <input
                type="number"
                min="0"
                max="100"
                value={itemProg}
                onChange={(e) => setItemProg(e.target.value)}
                className="w-16 rounded-xl border border-white/10 bg-black/40 px-2 py-2 text-xs text-white text-center"
              />
              <span className="text-xs text-zinc-400">%</span>
            </div>
            <button type="submit" className="rounded-xl bg-[#f2b880] px-4 py-2 text-xs font-bold text-zinc-950 cursor-pointer">
              Añadir
            </button>
          </form>
        )}

        {showBatch && (
          <form onSubmit={handleBatchAdd} className="animate-modal-pop grid gap-3 rounded-2xl border border-[#f2b880]/30 bg-white/[0.04] p-4 sm:grid-cols-4">
            <div>
              <label className="block text-[10px] text-zinc-400 mb-1">Prefijo</label>
              <input
                type="text"
                value={batchPrefix}
                onChange={(e) => setBatchPrefix(e.target.value)}
                className="w-full rounded-xl border border-white/10 bg-black/40 px-3 py-2 text-xs text-white"
              />
            </div>
            <div>
              <label className="block text-[10px] text-zinc-400 mb-1">Cantidad total</label>
              <input
                type="number"
                min="1"
                max="100"
                value={batchTotal}
                onChange={(e) => setBatchTotal(e.target.value)}
                className="w-full rounded-xl border border-white/10 bg-black/40 px-3 py-2 text-xs text-white"
              />
            </div>
            <div>
              <label className="block text-[10px] text-zinc-400 mb-1">Primeros N al 100%</label>
              <input
                type="number"
                min="0"
                max="100"
                value={batchDone}
                onChange={(e) => setBatchDone(e.target.value)}
                className="w-full rounded-xl border border-white/10 bg-black/40 px-3 py-2 text-xs text-white"
              />
            </div>
            <div className="flex items-end">
              <button type="submit" className="w-full rounded-xl bg-[#f2b880] py-2 text-xs font-bold text-zinc-950 cursor-pointer">
                Generar
              </button>
            </div>
          </form>
        )}

        {/* Items Grid */}
        {selectedCol.items.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-white/10 p-8 text-center text-xs text-zinc-400">
            Esta colección aún no tiene {selectedCol.tipo === 'Manga' ? 'tomos' : 'libros'} individuales. Agrega uno o genera un lote arriba, o ajusta el progreso general:
            <div className="mt-4 mx-auto max-w-xs flex items-center gap-3">
              <input
                type="range"
                min="0"
                max="100"
                value={selectedCol.progreso}
                onChange={(e) => handleUpdateCollection(selectedCol.name, { progreso: Number(e.target.value) })}
                className="flex-1 accent-[#f2b880]"
              />
              <span className="text-sm font-bold text-[#f2b880]">{selectedCol.progreso}%</span>
            </div>
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {selectedCol.items.map((it) => (
              <div
                key={it.file_name}
                className="overflow-hidden rounded-2xl border border-white/[0.08] bg-white/[0.03] flex flex-col justify-between"
              >
                <div className="relative h-28">
                  <AreaArtwork style="library" coverUrl={it.cover_url} className="h-full w-full" />
                  <label className="absolute right-2 top-2 flex items-center gap-1 rounded-lg bg-black/60 px-2 py-1 text-[10px] text-white backdrop-blur-md hover:bg-black/80 cursor-pointer">
                    <ImagePlus className="h-3 w-3 text-[#f2b880]" />
                    <input
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={(e) => handleUploadCover(selectedCol.name, e.target.files?.[0], it.file_name)}
                    />
                  </label>
                  <div className="absolute bottom-2 left-3 right-3 flex items-center justify-between">
                    <span className="font-bold text-sm text-white truncate">{it.title}</span>
                    <span className="rounded-md bg-black/70 px-2 py-0.5 text-xs font-bold text-[#f2b880]">
                      {it.progreso}%
                    </span>
                  </div>
                </div>

                <div className="p-4 space-y-3">
                  <div className="flex items-center gap-2">
                    <input
                      type="range"
                      min="0"
                      max="100"
                      value={it.progreso}
                      onChange={(e) => handleUpdateItem(it.file_name, { progreso: Number(e.target.value) })}
                      className="flex-1 accent-[#f2b880] cursor-pointer"
                    />
                    <button
                      onClick={() => handleUpdateItem(it.file_name, { progreso: it.progreso === 100 ? 0 : 100 })}
                      title="Marcar 100%"
                      className={`rounded-lg p-1.5 cursor-pointer ${
                        it.progreso === 100 ? 'bg-[#f2b880] text-zinc-950' : 'bg-white/10 text-zinc-300 hover:bg-white/20'
                      }`}
                    >
                      <Check className="h-3.5 w-3.5" />
                    </button>
                  </div>

                  <div className="flex items-center justify-between gap-2">
                    <input
                      type="text"
                      defaultValue={it.comentario}
                      onBlur={(e) => {
                        if (e.target.value !== it.comentario) {
                          handleUpdateItem(it.file_name, { comentario: e.target.value })
                        }
                      }}
                      placeholder="Comentario..."
                      className="flex-1 rounded-lg border border-white/10 bg-black/30 px-2.5 py-1 text-xs text-zinc-200 placeholder:text-zinc-500 focus:outline-none"
                    />
                    <select
                      value={it.puntuacion}
                      onChange={(e) => handleUpdateItem(it.file_name, { puntuacion: Number(e.target.value) })}
                      className="rounded-lg border border-white/10 bg-zinc-900 px-1.5 py-1 text-xs text-[#f2b880] cursor-pointer"
                    >
                      {STAR_SCORES.map((s) => (
                        <option key={s} value={s}>{s === 0 ? '★' : `${s} ★`}</option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    )
  }

  // ==================== COLLECTIONS GRID VIEW ====================
  return (
    <div className="space-y-6">
      <div className="relative h-40 overflow-hidden rounded-3xl border border-white/10">
        <AreaArtwork style="library" className="h-full w-full" />
        <div className="absolute inset-0 flex items-end justify-between p-6">
          <div>
            <button
              onClick={onBack}
              className="mb-2 inline-flex items-center gap-1.5 text-xs text-zinc-300 hover:text-white cursor-pointer"
            >
              <ArrowLeft className="h-3.5 w-3.5" />
              Volver a Áreas
            </button>
            <h1 className="text-3xl font-extrabold text-white">Contenido / Lecturas</h1>
          </div>
          <button
            onClick={() => setShowAddCol((v) => !v)}
            className="flex items-center gap-1.5 rounded-xl bg-[#f2b880] px-4 py-2 text-xs font-bold text-zinc-950 hover:bg-[#f5c496] cursor-pointer"
          >
            <Plus className="h-4 w-4" />
            Nueva colección
          </button>
        </div>
      </div>

      {showAddCol && (
        <form
          onSubmit={handleCreateCollection}
          className="animate-modal-pop grid gap-3 rounded-2xl border border-[#f2b880]/30 bg-white/[0.04] p-4 sm:grid-cols-5"
        >
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Título del libro, saga o manga..."
            required
            autoFocus
            className="sm:col-span-2 rounded-xl border border-white/10 bg-black/40 px-3 py-2 text-sm text-white focus:outline-none"
          />
          <select
            value={tipo}
            onChange={(e) => setTipo(e.target.value)}
            className="rounded-xl border border-white/10 bg-zinc-900 px-3 py-2 text-xs text-white"
          >
            <option value="Libro">Libro / Saga</option>
            <option value="Manga">Manga</option>
          </select>
          <input
            type="text"
            value={autor}
            onChange={(e) => setAutor(e.target.value)}
            placeholder="Autor (opcional)"
            className="rounded-xl border border-white/10 bg-black/40 px-3 py-2 text-xs text-white focus:outline-none"
          />
          <button
            type="submit"
            className="rounded-xl bg-[#f2b880] py-2 text-xs font-bold text-zinc-950 hover:bg-[#f5c496] cursor-pointer"
          >
            Crear carpeta
          </button>
        </form>
      )}

      <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {collections.map((col) => (
          <div
            key={col.name}
            data-nav-item
            tabIndex={0}
            onClick={() => loadDetail(col.name)}
            className="group overflow-hidden rounded-3xl border border-white/10 bg-white/[0.03] hover:border-[#f2b880]/45 transition-all cursor-pointer flex flex-col justify-between"
          >
            <div className="relative h-36">
              <AreaArtwork style="library" coverUrl={col.cover_url} className="h-full w-full" />
              <div className="absolute top-3 right-3 rounded-full bg-black/65 px-2.5 py-0.5 text-[10px] font-semibold text-zinc-200 backdrop-blur-md">
                {col.tipo}
              </div>
              <div className="absolute bottom-3 left-4 right-4">
                <h3 className="text-lg font-bold text-white group-hover:text-[#f2b880] transition-colors truncate">
                  {col.name}
                </h3>
                {col.autor && <p className="text-xs text-zinc-300 truncate">{col.autor}</p>}
              </div>
            </div>

            <div className="p-5 space-y-3">
              <div className="space-y-1.5">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-zinc-400 flex items-center gap-1">
                    <BookOpen className="h-3.5 w-3.5 text-[#f2b880]" />
                    {col.items_count > 0
                      ? `${col.items_count} ${col.tipo === 'Manga' ? 'tomos' : 'libros'}`
                      : 'Sin volúmenes'}
                  </span>
                  <span className="font-bold text-[#f2b880]">{col.progreso}%</span>
                </div>
                <div className="h-2 w-full overflow-hidden rounded-full bg-white/10">
                  <div
                    className="h-full rounded-full bg-[#f2b880] transition-all duration-500"
                    style={{ width: `${col.progreso}%` }}
                  />
                </div>
              </div>

              <div className="flex items-center justify-between text-xs text-zinc-400">
                <span className="flex items-center gap-1">
                  <Star className="h-3.5 w-3.5 text-[#f2b880] fill-[#f2b880]" />
                  {col.puntuacion > 0 ? `${col.puntuacion} ★` : 'Sin puntuar'}
                </span>
                <span className="font-semibold text-[#f2b880]">Abrir colección →</span>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

export function SeriesSection({ onBack, onOpenNote, onRefreshVault }) {
  const [items, setItems] = useState([])
  const [personas, setPersonas] = useState([])
  const [filterEstado, setFilterEstado] = useState('Todos')
  const [showAdd, setShowAdd] = useState(false)

  const [title, setTitle] = useState('')
  const [tipo, setTipo] = useState('Serie')
  const [estado, setEstado] = useState('por ver')
  const [recomendadoPor, setRecomendadoPor] = useState('')
  const [puntuacion, setPuntuacion] = useState(0)

  const load = useCallback(async () => {
    const res = await fetch('/api/content/series')
    if (res.ok) {
      const d = await res.json()
      setItems(d.items || [])
      setPersonas(d.personas || [])
    }
  }, [])

  useEffect(() => {
    load()
  }, [load])

  const handleCreate = async (e) => {
    e.preventDefault()
    if (!title.trim()) return
    const res = await fetch('/api/content/series', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        title: title.trim(),
        tipo,
        estado,
        recomendado_por: recomendadoPor.trim(),
        puntuacion: Number(puntuacion),
      }),
    })
    if (res.ok) {
      setTitle('')
      setRecomendadoPor('')
      setPuntuacion(0)
      setShowAdd(false)
      await load()
      onRefreshVault?.()
    }
  }

  const handleUpdate = async (path, patch) => {
    await fetch('/api/content/series', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ path, ...patch }),
    })
    await load()
    onRefreshVault?.()
  }

  const filtered = items.filter(
    (it) => filterEstado === 'Todos' || it.estado === filterEstado
  )

  const ESTADOS = ['por ver', 'vista', 'pausada', 'dropeada']
  const SCORES = [0, 0.5, 1, 1.5, 2, 2.5, 3, 3.5, 4, 4.5, 5]

  return (
    <div className="space-y-6">
      <div className="relative h-40 overflow-hidden rounded-3xl border border-white/10">
        <AreaArtwork style="cinema" className="h-full w-full" />
        <div className="absolute inset-0 flex items-end justify-between p-6">
          <div>
            <button
              onClick={onBack}
              className="mb-2 inline-flex items-center gap-1.5 text-xs text-zinc-300 hover:text-white cursor-pointer"
            >
              <ArrowLeft className="h-3.5 w-3.5" />
              Volver a Áreas
            </button>
            <h1 className="text-3xl font-extrabold text-white">Contenido / Series y Películas</h1>
          </div>
          <button
            onClick={() => setShowAdd((v) => !v)}
            className="flex items-center gap-1.5 rounded-xl bg-[#f2b880] px-4 py-2 text-xs font-bold text-zinc-950 hover:bg-[#f5c496] cursor-pointer"
          >
            <Plus className="h-4 w-4" />
            Agregar serie / película
          </button>
        </div>
      </div>

      {/* Filter pills */}
      <div className="flex flex-wrap gap-2">
        {['Todos', ...ESTADOS].map((st) => (
          <button
            key={st}
            onClick={() => setFilterEstado(st)}
            className={`rounded-xl px-3.5 py-1.5 text-xs font-semibold capitalize transition-all cursor-pointer ${
              filterEstado === st
                ? 'bg-[#f2b880] text-zinc-950'
                : 'border border-white/10 bg-white/5 text-zinc-300 hover:bg-white/10'
            }`}
          >
            {st}
          </button>
        ))}
      </div>

      {showAdd && (
        <form
          onSubmit={handleCreate}
          className="animate-modal-pop grid gap-3 rounded-2xl border border-[#f2b880]/30 bg-white/[0.04] p-4 sm:grid-cols-6"
        >
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Nombre de la serie o película..."
            required
            autoFocus
            className="sm:col-span-2 rounded-xl border border-white/10 bg-black/40 px-3 py-2 text-sm text-white focus:outline-none"
          />
          <select
            value={tipo}
            onChange={(e) => setTipo(e.target.value)}
            className="rounded-xl border border-white/10 bg-zinc-900 px-3 py-2 text-xs text-white"
          >
            <option value="Serie">Serie</option>
            <option value="Película">Película</option>
            <option value="Anime">Anime</option>
          </select>
          <select
            value={estado}
            onChange={(e) => setEstado(e.target.value)}
            className="rounded-xl border border-white/10 bg-zinc-900 px-3 py-2 text-xs text-white"
          >
            {ESTADOS.map((e) => (
              <option key={e} value={e}>{e}</option>
            ))}
          </select>
          <div>
            <input
              type="text"
              list="personas-list"
              value={recomendadoPor}
              onChange={(e) => setRecomendadoPor(e.target.value)}
              placeholder="Recomendado por..."
              className="w-full rounded-xl border border-white/10 bg-black/40 px-3 py-2 text-xs text-white focus:outline-none"
            />
            <datalist id="personas-list">
              {personas.map((p) => (
                <option key={p} value={p} />
              ))}
            </datalist>
          </div>
          <div className="flex items-center gap-2">
            <select
              value={puntuacion}
              onChange={(e) => setPuntuacion(Number(e.target.value))}
              className="rounded-xl border border-white/10 bg-zinc-900 px-2 py-2 text-xs text-white"
            >
              {SCORES.map((s) => (
                <option key={s} value={s}>{s === 0 ? 'Sin nota' : `${s} ★`}</option>
              ))}
            </select>
            <button
              type="submit"
              className="flex-1 rounded-xl bg-[#f2b880] py-2 text-xs font-bold text-zinc-950 hover:bg-[#f5c496] cursor-pointer"
            >
              Añadir
            </button>
          </div>
        </form>
      )}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {filtered.map((item) => (
          <div
            key={item.path}
            className="flex flex-col justify-between rounded-2xl border border-white/[0.08] bg-white/[0.03] p-5 hover:border-[#f2b880]/40 transition-all"
          >
            <div>
              <div className="flex items-start justify-between gap-2">
                <button
                  onClick={() => onOpenNote(item.path)}
                  className="text-left text-base font-bold text-white hover:text-[#f2b880] cursor-pointer flex items-center gap-1.5"
                >
                  <Film className="h-4 w-4 text-[#f2b880] shrink-0" />
                  <span>{item.title}</span>
                </button>
                <span className="shrink-0 rounded-full bg-white/10 px-2 py-0.5 text-[10px] text-zinc-300">
                  {item.tipo}
                </span>
              </div>

              {item.recomendado_por && (
                <div className="mt-2 inline-flex items-center gap-1 rounded-lg bg-white/5 px-2 py-1 text-xs text-zinc-300">
                  <User className="h-3 w-3 text-[#f2b880]" />
                  <span>Recomendado por: <strong>{item.recomendado_por}</strong></span>
                </div>
              )}
            </div>

            <div className="mt-4 flex items-center justify-between gap-2 border-t border-white/[0.06] pt-3">
              <select
                value={item.estado}
                onChange={(e) => handleUpdate(item.path, { estado: e.target.value })}
                className="rounded-lg border border-white/10 bg-zinc-900 px-2 py-1 text-xs capitalize text-zinc-200 cursor-pointer"
              >
                {ESTADOS.map((e) => (
                  <option key={e} value={e}>{e}</option>
                ))}
              </select>

              <div className="flex items-center gap-1">
                <Star className="h-3.5 w-3.5 text-[#f2b880] fill-[#f2b880]" />
                <select
                  value={item.puntuacion}
                  onChange={(e) => handleUpdate(item.path, { puntuacion: Number(e.target.value) })}
                  className="rounded-lg border border-white/10 bg-zinc-900 px-2 py-1 text-xs text-[#f2b880] font-semibold cursor-pointer"
                >
                  {SCORES.map((s) => (
                    <option key={s} value={s}>{s === 0 ? 'Sin ★' : `${s} ★`}</option>
                  ))}
                </select>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
