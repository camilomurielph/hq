import React, { useCallback, useEffect, useMemo, useState } from 'react'
import {
  Activity,
  ArrowLeft,
  BookOpen,
  Calendar,
  Check,
  ChevronLeft,
  ChevronRight,
  Dumbbell,
  FilePlus2,
  HeartPulse,
} from 'lucide-react'
import { AreaArtwork } from './AreaArtwork'

function CircularProgress({ percentage, size = 112, stroke = 9 }) {
  const radius = (size - stroke) / 2
  const circumference = 2 * Math.PI * radius
  const offset = circumference - (percentage / 100) * circumference

  return (
    <div className="relative inline-flex items-center justify-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="transparent"
          stroke="rgba(255,255,255,0.1)"
          strokeWidth={stroke}
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="transparent"
          stroke="#f2b880"
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          className="transition-all duration-700 ease-out"
        />
      </svg>
      <div className="absolute flex flex-col items-center justify-center text-center">
        <span className="text-xl font-extrabold text-white">{percentage}%</span>
      </div>
    </div>
  )
}

const MONTH_NAMES = [
  'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre',
]

export function SaludView({ onBack, onOpenNote, onNewNoteInFolder }) {
  const [data, setData] = useState(null)
  const [subView, setSubView] = useState(null) // null | 'Entrenamiento' | 'Salud y estado' | 'Artículos y estudios'
  const [calMode, setCalMode] = useState('semanal') // 'semanal' | 'mensual'
  const [monthCursor, setMonthCursor] = useState(() => {
    const now = new Date()
    return { year: now.getFullYear(), month: now.getMonth() }
  })

  const load = useCallback(async () => {
    const res = await fetch('/api/salud')
    if (res.ok) {
      setData(await res.json())
    }
  }, [])

  useEffect(() => {
    load()
  }, [load])

  const handleToggleWorkout = async (dateStr) => {
    const res = await fetch('/api/salud/workout/toggle', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ date: dateStr }),
    })
    if (res.ok) {
      await load()
    }
  }

  const trainedSet = useMemo(
    () => new Set(data?.workout?.all_dates || []),
    [data]
  )

  const monthCells = useMemo(() => {
    const { year, month } = monthCursor
    const firstDay = new Date(year, month, 1)
    const daysInMonth = new Date(year, month + 1, 0).getDate()
    // Monday = 0 .. Sunday = 6
    const offset = (firstDay.getDay() + 6) % 7
    const cells = []
    for (let i = 0; i < offset; i++) cells.push(null)
    for (let d = 1; d <= daysInMonth; d++) {
      const mm = String(month + 1).padStart(2, '0')
      const dd = String(d).padStart(2, '0')
      const iso = `${year}-${mm}-${dd}`
      cells.push({ day: d, iso, trained: trainedSet.has(iso) })
    }
    return cells
  }, [monthCursor, trainedSet])

  if (!data) {
    return <div className="py-16 text-center text-sm text-zinc-400">Cargando Salud...</div>
  }

  // ==================== SUBFOLDER VIEW ====================
  if (subView) {
    const notes = data.folders[subView] || []
    const folderRel = `Salud/${subView}`

    return (
      <div className="animate-view-in space-y-6">
        <div className="relative h-36 overflow-hidden rounded-3xl border border-white/10">
          <AreaArtwork style="zen" className="h-full w-full" />
          <div className="absolute inset-0 flex items-end justify-between p-6">
            <div>
              <button
                onClick={() => setSubView(null)}
                className="mb-2 inline-flex items-center gap-1.5 text-xs text-zinc-300 hover:text-white cursor-pointer"
              >
                <ArrowLeft className="h-3.5 w-3.5" />
                Volver a Salud
              </button>
              <h1 className="text-3xl font-extrabold text-white">{subView}</h1>
            </div>
            <button
              onClick={() => onNewNoteInFolder(folderRel)}
              className="flex items-center gap-1.5 rounded-xl bg-[#f2b880] px-4 py-2 text-xs font-bold text-zinc-950 hover:bg-[#f5c496] cursor-pointer"
            >
              <FilePlus2 className="h-4 w-4" />
              Nueva nota
            </button>
          </div>
        </div>

        {/* Entrenamiento: Weekly & Monthly Workout Tracker */}
        {subView === 'Entrenamiento' && (
          <div className="rounded-3xl border border-white/[0.08] bg-white/[0.03] p-6 backdrop-blur-xl space-y-5">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div className="flex items-center gap-4">
                <CircularProgress percentage={data.workout.percentage} size={84} stroke={8} />
                <div>
                  <h2 className="text-lg font-bold text-white">Meta semanal de entrenamiento</h2>
                  <p className="text-xs text-zinc-400">
                    {data.workout.done_this_week} de {data.workout.goal_days} días completados esta semana (4 días = 100%)
                  </p>
                </div>
              </div>

              <div className="flex rounded-xl border border-white/10 bg-black/30 p-1">
                <button
                  onClick={() => setCalMode('semanal')}
                  className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors cursor-pointer ${
                    calMode === 'semanal' ? 'bg-[#f2b880] text-zinc-950' : 'text-zinc-400 hover:text-white'
                  }`}
                >
                  Semana actual
                </button>
                <button
                  onClick={() => setCalMode('mensual')}
                  className={`flex items-center gap-1 rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors cursor-pointer ${
                    calMode === 'mensual' ? 'bg-[#f2b880] text-zinc-950' : 'text-zinc-400 hover:text-white'
                  }`}
                >
                  <Calendar className="h-3.5 w-3.5" />
                  Vista mensual
                </button>
              </div>
            </div>

            {calMode === 'semanal' ? (
              <div className="grid grid-cols-7 gap-2.5">
                {data.workout.current_week.map((day) => (
                  <button
                    key={day.date}
                    data-nav-item
                    tabIndex={0}
                    onClick={() => handleToggleWorkout(day.date)}
                    className={`flex flex-col items-center justify-center rounded-2xl border py-4 transition-all cursor-pointer ${
                      day.trained
                        ? 'border-[#f2b880] bg-[#f2b880]/20 text-white shadow-lg shadow-[#f2b880]/10'
                        : day.is_today
                        ? 'border-white/25 bg-white/[0.06] text-zinc-200'
                        : 'border-white/[0.08] bg-black/25 text-zinc-400 hover:border-white/20'
                    }`}
                  >
                    <span className="text-[11px] font-medium uppercase">{day.label}</span>
                    <span className="mt-1 text-lg font-extrabold">{day.day_num}</span>
                    <div
                      className={`mt-2 flex h-6 w-6 items-center justify-center rounded-full ${
                        day.trained ? 'bg-[#f2b880] text-zinc-950' : 'bg-white/10 text-transparent'
                      }`}
                    >
                      <Check className="h-3.5 w-3.5" />
                    </div>
                  </button>
                ))}
              </div>
            ) : (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <button
                    onClick={() =>
                      setMonthCursor((prev) =>
                        prev.month === 0
                          ? { year: prev.year - 1, month: 11 }
                          : { year: prev.year, month: prev.month - 1 }
                      )
                    }
                    className="rounded-xl border border-white/10 bg-white/5 p-2 text-zinc-300 hover:bg-white/10 cursor-pointer"
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </button>
                  <span className="text-sm font-bold text-white">
                    {MONTH_NAMES[monthCursor.month]} {monthCursor.year}
                  </span>
                  <button
                    onClick={() =>
                      setMonthCursor((prev) =>
                        prev.month === 11
                          ? { year: prev.year + 1, month: 0 }
                          : { year: prev.year, month: prev.month + 1 }
                      )
                    }
                    className="rounded-xl border border-white/10 bg-white/5 p-2 text-zinc-300 hover:bg-white/10 cursor-pointer"
                  >
                    <ChevronRight className="h-4 w-4" />
                  </button>
                </div>

                <div className="grid grid-cols-7 gap-1.5 text-center text-[11px] text-zinc-500">
                  {['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'].map((d) => (
                    <div key={d} className="py-1 font-semibold">{d}</div>
                  ))}
                  {monthCells.map((cell, i) =>
                    cell ? (
                      <button
                        key={cell.iso}
                        onClick={() => handleToggleWorkout(cell.iso)}
                        className={`rounded-xl border py-2 text-xs font-semibold transition-all cursor-pointer ${
                          cell.trained
                            ? 'border-[#f2b880] bg-[#f2b880]/25 text-[#f2b880]'
                            : 'border-white/[0.06] bg-black/25 text-zinc-300 hover:border-white/20'
                        }`}
                      >
                        {cell.day}
                      </button>
                    ) : (
                      <div key={`empty-${i}`} />
                    )
                  )}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Notes inside subfolder */}
        <div className="space-y-3">
          <h2 className="text-sm font-bold text-zinc-300">Notas en {subView} ({notes.length})</h2>
          {notes.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-white/10 p-8 text-center text-xs text-zinc-500">
              Aún no hay notas en esta carpeta. Pulsa <strong>Nueva nota</strong> arriba para crear una.
            </div>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {notes.map((n) => (
                <div
                  key={n.path}
                  data-nav-item
                  tabIndex={0}
                  onClick={() => onOpenNote(n.path)}
                  className="group flex flex-col justify-between rounded-2xl border border-white/[0.08] bg-white/[0.03] p-5 hover:border-[#f2b880]/40 hover:bg-white/[0.05] transition-all cursor-pointer"
                >
                  <div>
                    <h3 className="text-base font-bold text-white group-hover:text-[#f2b880] transition-colors">
                      {n.title}
                    </h3>
                    <p className="mt-2 line-clamp-2 text-xs text-zinc-400">
                      {n.excerpt || 'Nota vacía'}
                    </p>
                  </div>
                  <div className="mt-4 flex items-center justify-between border-t border-white/[0.06] pt-3 text-xs text-zinc-500">
                    <span>{n.word_count} palabras</span>
                    <span className="font-semibold text-[#f2b880]">Abrir →</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    )
  }

  // ==================== MAIN SALUD VIEW (3 SQUARE CARDS) ====================
  const cards = [
    {
      id: 'Entrenamiento',
      title: 'Entrenamiento',
      desc: `${data.workout.done_this_week}/4 días esta semana`,
      icon: Dumbbell,
      hasRing: true,
      count: (data.folders['Entrenamiento'] || []).length,
    },
    {
      id: 'Salud y estado',
      title: 'Salud y estado',
      desc: 'Chequeos, síntomas, hábitos y bienestar',
      icon: HeartPulse,
      hasRing: false,
      count: (data.folders['Salud y estado'] || []).length,
    },
    {
      id: 'Artículos y estudios',
      title: 'Artículos y estudios',
      desc: 'Papers, lecturas médicas y apuntes',
      icon: BookOpen,
      hasRing: false,
      count: (data.folders['Artículos y estudios'] || []).length,
    },
  ]

  return (
    <div className="space-y-6">
      <div className="relative h-36 overflow-hidden rounded-3xl border border-white/10">
        <AreaArtwork style="zen" className="h-full w-full" />
        <div className="absolute inset-0 flex items-end justify-between p-6">
          <div>
            <button
              onClick={onBack}
              className="mb-2 inline-flex items-center gap-1.5 text-xs text-zinc-300 hover:text-white cursor-pointer"
            >
              <ArrowLeft className="h-3.5 w-3.5" />
              Volver a Áreas
            </button>
            <h1 className="text-3xl font-extrabold text-white">Salud</h1>
          </div>
        </div>
      </div>

      {/* 3 Square Cards */}
      <div className="grid grid-cols-1 gap-5 sm:grid-cols-3">
        {cards.map((c) => {
          const Icon = c.icon
          return (
            <div
              key={c.id}
              data-nav-item
              tabIndex={0}
              onClick={() => setSubView(c.id)}
              className="group relative flex aspect-square flex-col items-center justify-between overflow-hidden rounded-3xl border border-white/10 bg-white/[0.03] p-6 text-center hover:border-[#f2b880]/50 hover:bg-white/[0.05] transition-all cursor-pointer"
            >
              <div className="flex w-full items-center justify-between text-xs text-zinc-400">
                <span className="rounded-full bg-white/10 px-2.5 py-0.5 text-[10px] font-semibold text-zinc-300">
                  {c.count} notas
                </span>
                <Icon className="h-4 w-4 text-[#f2b880]" />
              </div>

              <div className="my-auto flex flex-col items-center justify-center gap-3">
                {c.hasRing ? (
                  <CircularProgress percentage={data.workout.percentage} size={116} stroke={10} />
                ) : (
                  <div className="flex h-24 w-24 items-center justify-center rounded-3xl border border-white/10 bg-[#f2b880]/10 text-[#f2b880] group-hover:scale-105 transition-transform">
                    <Icon className="h-10 w-10" />
                  </div>
                )}
                <div>
                  <h2 className="text-xl font-extrabold text-white group-hover:text-[#f2b880] transition-colors">
                    {c.title}
                  </h2>
                  <p className="mt-1 text-xs text-zinc-400">{c.desc}</p>
                </div>
              </div>

              <div className="text-xs font-semibold text-[#f2b880]">Entrar →</div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
