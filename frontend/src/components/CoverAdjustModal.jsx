import React, { useState } from 'react'
import { ImagePlus, RotateCcw, SlidersHorizontal, X } from 'lucide-react'
import { AreaArtwork } from './AreaArtwork'

export function CoverAdjustModal({
  areaName,
  initialCoverUrl = null,
  initialPosX = 50,
  initialPosY = 50,
  initialZoom = 100,
  imageStyle = 'forest',
  onClose,
  onSaved,
}) {
  const [coverUrl, setCoverUrl] = useState(initialCoverUrl)
  const [posX, setPosX] = useState(initialPosX)
  const [posY, setPosY] = useState(initialPosY)
  const [zoom, setZoom] = useState(initialZoom)
  const [uploading, setUploading] = useState(false)
  const [saving, setSaving] = useState(false)

  const handleFileChange = async (file) => {
    if (!file) return
    setUploading(true)
    try {
      const fd = new FormData()
      fd.append('cover', file)
      const res = await fetch(`/api/areas/${encodeURIComponent(areaName)}/cover`, {
        method: 'POST',
        body: fd,
      })
      if (res.ok) {
        const d = await res.json()
        setCoverUrl(d.cover_url)
        setPosX(50)
        setPosY(50)
        setZoom(100)
        onSaved?.()
      }
    } finally {
      setUploading(false)
    }
  }

  const handleSaveSettings = async () => {
    setSaving(true)
    try {
      const res = await fetch(`/api/areas/${encodeURIComponent(areaName)}/cover-settings`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          cover_pos_x: Number(posX),
          cover_pos_y: Number(posY),
          cover_zoom: Number(zoom),
        }),
      })
      if (res.ok) {
        await onSaved?.()
        onClose()
      }
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4 backdrop-blur-md">
      <div className="animate-modal-pop w-full max-w-2xl rounded-2xl border border-white/10 bg-[#0d1214]/95 p-6 shadow-2xl space-y-5">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-bold text-white flex items-center gap-2">
            <SlidersHorizontal className="h-4 w-4 text-[#f2b880]" />
            Portada de {areaName}
          </h2>
          <button
            onClick={onClose}
            className="rounded-xl p-1.5 text-zinc-400 hover:bg-white/10 hover:text-white cursor-pointer"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Live Preview */}
        <div className="relative h-44 w-full overflow-hidden rounded-3xl border border-white/15">
          <AreaArtwork
            style={imageStyle}
            coverUrl={coverUrl}
            posX={posX}
            posY={posY}
            zoom={zoom}
            className="h-full w-full"
          />
          <div className="absolute bottom-4 left-5">
            <div className="text-2xl font-extrabold text-white">{areaName}</div>
          </div>
        </div>

        {/* Upload Button */}
        <div className="flex flex-wrap items-center justify-between gap-3">
          <label className="inline-flex items-center gap-2 rounded-xl border border-white/15 bg-white/5 px-4 py-2 text-xs font-semibold text-white hover:bg-white/10 cursor-pointer">
            <ImagePlus className="h-4 w-4 text-[#f2b880]" />
            <span>{uploading ? 'Subiendo...' : 'Subir nueva imagen (.webp, .png, .jpg)'}</span>
            <input
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => handleFileChange(e.target.files?.[0])}
            />
          </label>

          <button
            type="button"
            onClick={() => {
              setPosX(50)
              setPosY(50)
              setZoom(100)
            }}
            className="inline-flex items-center gap-1.5 rounded-xl border border-white/10 px-3 py-2 text-xs text-zinc-300 hover:bg-white/5 cursor-pointer"
          >
            <RotateCcw className="h-3.5 w-3.5" />
            Restablecer
          </button>
        </div>

        {/* Sliders */}
        {coverUrl && (
          <div className="grid gap-4 rounded-2xl border border-white/[0.08] bg-white/[0.02] p-4 sm:grid-cols-3">
            <div>
              <div className="mb-1 flex justify-between text-xs">
                <span className="text-zinc-400">Zoom</span>
                <span className="font-semibold text-[#f2b880]">{zoom}%</span>
              </div>
              <input
                type="range"
                min="100"
                max="250"
                value={zoom}
                onChange={(e) => setZoom(Number(e.target.value))}
                className="w-full accent-[#f2b880] cursor-pointer"
              />
            </div>

            <div>
              <div className="mb-1 flex justify-between text-xs">
                <span className="text-zinc-400">Horizontal (X)</span>
                <span className="font-semibold text-[#f2b880]">{posX}%</span>
              </div>
              <input
                type="range"
                min="0"
                max="100"
                value={posX}
                onChange={(e) => setPosX(Number(e.target.value))}
                className="w-full accent-[#f2b880] cursor-pointer"
              />
            </div>

            <div>
              <div className="mb-1 flex justify-between text-xs">
                <span className="text-zinc-400">Vertical (Y)</span>
                <span className="font-semibold text-[#f2b880]">{posY}%</span>
              </div>
              <input
                type="range"
                min="0"
                max="100"
                value={posY}
                onChange={(e) => setPosY(Number(e.target.value))}
                className="w-full accent-[#f2b880] cursor-pointer"
              />
            </div>
          </div>
        )}

        <div className="flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl border border-white/10 px-4 py-2 text-xs text-zinc-300 hover:bg-white/5 cursor-pointer"
          >
            Cerrar
          </button>
          <button
            type="button"
            onClick={handleSaveSettings}
            disabled={saving}
            className="rounded-xl bg-[#f2b880] px-5 py-2 text-xs font-bold text-zinc-950 hover:bg-[#f5c496] disabled:opacity-50 cursor-pointer"
          >
            {saving ? 'Guardando...' : 'Guardar ajuste'}
          </button>
        </div>
      </div>
    </div>
  )
}
