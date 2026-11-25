import React, { useCallback, useEffect, useMemo, useState } from 'react'
import {
  Activity,
  ArrowLeft,
  ArrowRight,
  Bell,
  BookOpen,
  Calendar,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Circle,
  FilePlus2,
  FolderKanban,
  FolderTree,
  GitBranch,
  Home,
  ImagePlus,
  Keyboard,
  LayoutGrid,
  Layers,
  ListTodo,
  LogOut,
  Play,
  Plus,
  RefreshCw,
  Search,
  Sparkles,
  Table2,
  Terminal,
} from 'lucide-react'
import { AreaArtwork } from './components/AreaArtwork'
import { LecturasSection, SeriesSection } from './components/ContenidoView'
import { CoverAdjustModal } from './components/CoverAdjustModal'
import { FoldersView } from './components/FoldersView'
import { LoginScreen } from './components/LoginScreen'
import { MarkdownEditor } from './components/MarkdownEditor'
import { NoteModal } from './components/NoteModal'
import { SaludView } from './components/SaludView'
import { TasksBoard } from './components/TasksBoard'

function formatSpanishDate(d = new Date()) {
  const days = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado']
  const months = [
    'enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio',
    'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre',
  ]
  return `${days[d.getDay()]}, ${d.getDate()} de ${months[d.getMonth()]}`
}

function formatClock(d = new Date()) {
  return d.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })
}

export default function App() {
  const [tab, setTab] = useState('inicio')
  const [selectedArea, setSelectedArea] = useState(null)
  const [areaDetail, setAreaDetail] = useState(null)

  const [overview, setOverview] = useState(null)
  const [tasksData, setTasksData] = useState(null)
  const [taskLists, setTaskLists] = useState([])
  const [projectsData, setProjectsData] = useState(null)
  const [notesData, setNotesData] = useState([])
  const [scripts, setScripts] = useState([])
  const [activity, setActivity] = useState([])
  const [gitStatus, setGitStatus] = useState(null)
  const [syncingGit, setSyncingGit] = useState(false)

  // Auth state
  const [authChecked, setAuthChecked] = useState(false)
  const [authRequired, setAuthRequired] = useState(false)
  const [authenticated, setAuthenticated] = useState(false)

  const [carouselIdx, setCarouselIdx] = useState(0)
  const [carouselDir, setCarouselDir] = useState('next')
  const [clock, setClock] = useState(() => formatClock())
  const [todayLabel, setTodayLabel] = useState(() => formatSpanishDate())
  const [refreshing, setRefreshing] = useState(false)

  // Modal state
  const [openNotePath, setOpenNotePath] = useState(null)
  const [newNoteModal, setNewNoteModal] = useState(false)
  const [newNoteFolder, setNewNoteFolder] = useState('Notas')
  const [newNoteMocArea, setNewNoteMocArea] = useState('')
  const [newNoteName, setNewNoteName] = useState('')
  const [newNoteContent, setNewNoteContent] = useState('')

  // Inline create Persona / Proyecto
  const [addingEntity, setAddingEntity] = useState(null) // 'persona' | 'proyecto' | null
  const [newEntityName, setNewEntityName] = useState('')

  // New Area modal state
  const [newAreaModal, setNewAreaModal] = useState(false)
  const [newAreaName, setNewAreaName] = useState('')
  const [newAreaSubtitle, setNewAreaSubtitle] = useState('')
  const [newAreaStyle, setNewAreaStyle] = useState('forest')
  const [newAreaCover, setNewAreaCover] = useState(null)
  const [coverModalArea, setCoverModalArea] = useState(null)
  const [showShortcuts, setShowShortcuts] = useState(false)

  // Tasks form state
  const [newTaskText, setNewTaskText] = useState('')
  const [newTaskTarget, setNewTaskTarget] = useState('hoy')
  const [newTaskArea, setNewTaskArea] = useState('Sin área')
  const [newTaskPrio, setNewTaskPrio] = useState('Normal')

  // Projects view state
  const [projectFilter, setProjectFilter] = useState('En marcha')
  const [projectView, setProjectView] = useState('Tabla')
  const [projectSearch, setProjectSearch] = useState('')

  // Notes explorer state
  const [notesFolder, setNotesFolder] = useState('Todas')
  const [notesSearch, setNotesSearch] = useState('')

  // Scripts output state
  const [runningScript, setRunningScript] = useState(null)
  const [scriptOutput, setScriptOutput] = useState(null)

  useEffect(() => {
    const timer = setInterval(() => {
      const now = new Date()
      setClock(formatClock(now))
      setTodayLabel(formatSpanishDate(now))
    }, 15000)
    return () => clearInterval(timer)
  }, [])

  const fetchAll = useCallback(async () => {
    setRefreshing(true)
    try {
      const [ovRes, tkRes, tlRes, prRes, ntRes, scRes, acRes, gitRes] = await Promise.all([
        fetch('/api/overview'),
        fetch('/api/tasks'),
        fetch('/api/task-lists'),
        fetch('/api/projects'),
        fetch('/api/notes'),
        fetch('/api/scripts'),
        fetch('/api/activity'),
        fetch('/api/git/status'),
      ])
      if (ovRes.status === 401) {
        setAuthenticated(false)
        setAuthRequired(true)
        return
      }
      if (ovRes.ok) {
        const ovData = await ovRes.json()
        setOverview(ovData)
        // Preload all Area cover images so carousel & cards render instantaneously
        ;(ovData.areas || []).forEach((a) => {
          if (a.cover_url) {
            const img = new Image()
            img.src = a.cover_url
          }
        })
      }
      if (tkRes.ok) setTasksData(await tkRes.json())
      if (tlRes.ok) {
        const tld = await tlRes.json()
        setTaskLists(tld.lists || [])
      }
      if (prRes.ok) setProjectsData(await prRes.json())
      if (ntRes.ok) {
        const nd = await ntRes.json()
        setNotesData(nd.notes || [])
      }
      if (scRes.ok) {
        const sd = await scRes.json()
        setScripts(sd.scripts || [])
      }
      if (acRes.ok) {
        const ad = await acRes.json()
        setActivity(ad.items || [])
      }
      if (gitRes.ok) setGitStatus(await gitRes.json())
    } catch (e) {
      console.error('Error cargando datos del vault:', e)
    } finally {
      setRefreshing(false)
    }
  }, [])

  const checkAuth = useCallback(async () => {
    try {
      const res = await fetch('/api/auth/check')
      if (res.ok) {
        const data = await res.json()
        setAuthRequired(Boolean(data.auth_required))
        setAuthenticated(Boolean(data.authenticated))
      }
    } catch (e) {
      console.error(e)
    } finally {
      setAuthChecked(true)
    }
  }, [])

  useEffect(() => {
    checkAuth()
  }, [checkAuth])

  useEffect(() => {
    if (authChecked && (!authRequired || authenticated)) {
      fetchAll()
    }
  }, [authChecked, authRequired, authenticated, fetchAll])

  const handleGitSync = async () => {
    setSyncingGit(true)
    try {
      const res = await fetch('/api/git/sync', { method: 'POST' })
      if (res.ok) {
        await fetchAll()
      }
    } catch (e) {
      console.error(e)
    } finally {
      setSyncingGit(false)
    }
  }

  const handleLogout = async () => {
    await fetch('/api/auth/logout', { method: 'POST' })
    setAuthenticated(false)
  }

  const openArea = async (areaName) => {
    setSelectedArea(areaName)
    setTab('area_detail')
    try {
      const res = await fetch(`/api/areas/${encodeURIComponent(areaName)}`)
      if (res.ok) {
        setAreaDetail(await res.json())
      }
    } catch (e) {
      console.error(e)
    }
  }

  const handleOpenWikiLink = async (targetName) => {
    const clean = targetName.trim().toLowerCase()
    const found = notesData.find(
      (n) =>
        n.name.toLowerCase() === clean ||
        n.path.toLowerCase() === `${clean}.md` ||
        n.path.toLowerCase() === clean
    )
    if (found) {
      setOpenNotePath(found.path)
    } else {
      // Offer to open/create in Notas/
      const targetPath = `Notas/${targetName.trim()}.md`
      await fetch('/api/notes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ path: targetPath, content: `# ${targetName.trim()}\n\n` }),
      })
      await fetchAll()
      setOpenNotePath(targetPath)
    }
  }

  const handleOpenTodayJournal = async () => {
    if (!overview) return
    const dailyPath = overview.today_daily_path
    const exists = notesData.some((n) => n.path === dailyPath)
    if (!exists) {
      await fetch('/api/notes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          path: dailyPath,
          content: `#diario\n\n---\n## ⚡ Tareas\n\n- [ ] \n\n---\n## 🔧 Acciones secundarias\n\n---\n## 🧠 Notas\n`,
        }),
      })
      await fetchAll()
    }
    setOpenNotePath(dailyPath)
  }

  const handleAddTask = async (e) => {
    e.preventDefault()
    if (!newTaskText.trim()) return
    const target_file =
      newTaskTarget === 'hoy' ? overview?.today_daily_path : 'Temporal/Tareas hoy.md'
    const res = await fetch('/api/tasks', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        text: newTaskText,
        target_file,
        area: newTaskArea,
        priority: newTaskPrio,
      }),
    })
    if (res.ok) {
      setNewTaskText('')
      await fetchAll()
    }
  }

  const handleToggleTask = async (task) => {
    const res = await fetch('/api/tasks/toggle', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ file_path: task.file_path, line: task.line }),
    })
    if (res.ok) {
      await fetchAll()
    }
  }

  const handleRunScript = async (scriptName) => {
    setRunningScript(scriptName)
    setScriptOutput(null)
    try {
      const res = await fetch('/api/scripts/run', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ script_name: scriptName, args: [] }),
      })
      const data = await res.json()
      setScriptOutput({ name: scriptName, ...data })
      await fetchAll()
    } catch (err) {
      setScriptOutput({ name: scriptName, status: 'error', output: err.message })
    } finally {
      setRunningScript(null)
    }
  }

  const openNewNoteIn = (folder, mocArea = '') => {
    setNewNoteFolder(folder)
    setNewNoteMocArea(mocArea)
    setNewNoteName('')
    setNewNoteContent('')
    setNewNoteModal(true)
  }

  const handleCreateNote = async (e) => {
    e.preventDefault()
    if (!newNoteName.trim()) return
    const cleanName = newNoteName.trim().replace(/\.md$/i, '')
    const fullPath = newNoteFolder === 'Raíz' ? `${cleanName}.md` : `${newNoteFolder}/${cleanName}.md`
    const res = await fetch('/api/notes', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        path: fullPath,
        content: newNoteContent,
        moc_area: newNoteMocArea || null,
      }),
    })
    if (res.ok) {
      const data = await res.json()
      setNewNoteModal(false)
      setNewNoteName('')
      setNewNoteContent('')
      setNewNoteMocArea('')
      await fetchAll()
      if (tab === 'area_detail' && selectedArea) {
        await openArea(selectedArea)
      }
      setOpenNotePath(data.path)
    }
  }

  const handleCreateEntity = async (e) => {
    e.preventDefault()
    if (!newEntityName.trim()) return
    const endpoint = addingEntity === 'persona' ? '/api/personas' : '/api/proyectos'
    const res = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: newEntityName.trim() }),
    })
    if (res.ok) {
      setAddingEntity(null)
      setNewEntityName('')
      await fetchAll()
      if (selectedArea) await openArea(selectedArea)
    }
  }

  const handleCreateArea = async (e) => {
    e.preventDefault()
    if (!newAreaName.trim()) return
    const fd = new FormData()
    fd.append('name', newAreaName.trim())
    fd.append('subtitle', newAreaSubtitle.trim() || 'Área de conocimiento en tu segundo cerebro.')
    fd.append('image_style', newAreaStyle)
    if (newAreaCover) {
      fd.append('cover', newAreaCover)
    }
    const res = await fetch('/api/areas', { method: 'POST', body: fd })
    if (res.ok) {
      setNewAreaModal(false)
      setNewAreaName('')
      setNewAreaSubtitle('')
      setNewAreaCover(null)
      await fetchAll()
    }
  }

  const handleUploadAreaCover = async (areaName, file) => {
    if (!file) return
    const fd = new FormData()
    fd.append('cover', file)
    const res = await fetch(`/api/areas/${encodeURIComponent(areaName)}/cover`, {
      method: 'POST',
      body: fd,
    })
    if (res.ok) {
      await fetchAll()
      await openArea(areaName)
    }
  }

  const areas = overview?.areas || []
  const activeArea = areas[carouselIdx] || null
  const prevArea = areas.length > 1 ? areas[(carouselIdx - 1 + areas.length) % areas.length] : null
  const nextArea = areas.length > 1 ? areas[(carouselIdx + 1) % areas.length] : null

  const filteredNotes = useMemo(() => {
    return notesData.filter((n) => {
      if (notesFolder !== 'Todas' && n.folder !== notesFolder) return false
      if (notesSearch.trim()) {
        const q = notesSearch.toLowerCase()
        return (
          n.name.toLowerCase().includes(q) ||
          n.title.toLowerCase().includes(q) ||
          n.excerpt.toLowerCase().includes(q) ||
          n.tags.some((t) => t.toLowerCase().includes(q))
        )
      }
      return true
    })
  }, [notesData, notesFolder, notesSearch])

  const filteredProjects = useMemo(() => {
    const list = projectsData?.projects || []
    return list.filter((p) => {
      if (projectFilter !== 'Todos' && p.status !== projectFilter) return false
      if (projectSearch.trim()) {
        return p.name.toLowerCase().includes(projectSearch.toLowerCase())
      }
      return true
    })
  }, [projectsData, projectFilter, projectSearch])

  const ambientBg = useMemo(() => {
    if (tab === 'tareas') {
      return 'bg-[radial-gradient(ellipse_at_top,rgba(154,52,18,0.32),transparent_60%),radial-gradient(ellipse_at_bottom_right,rgba(120,53,15,0.25),transparent_55%)]'
    }
    if (tab === 'proyectos') {
      return 'bg-[radial-gradient(ellipse_at_top,rgba(180,83,9,0.26),transparent_60%),radial-gradient(ellipse_at_bottom_left,rgba(16,185,129,0.12),transparent_55%)]'
    }
    if (tab === 'ia') {
      return 'bg-[radial-gradient(ellipse_at_top,rgba(14,116,144,0.30),transparent_60%),radial-gradient(ellipse_at_bottom,rgba(6,78,59,0.22),transparent_55%)]'
    }
    return 'bg-[radial-gradient(ellipse_at_top,rgba(6,95,70,0.34),transparent_60%),radial-gradient(ellipse_at_bottom_right,rgba(15,118,110,0.20),transparent_55%)]'
  }, [tab])

  const breadcrumbLabel = useMemo(() => {
    if (tab === 'inicio') return 'Inicio'
    if (tab === 'tareas') return 'Tareas diarias'
    if (tab === 'proyectos') return 'Proyectos'
    if (tab === 'areas') return 'Áreas'
    if (tab === 'area_detail') return `Áreas / ${selectedArea || ''}`
    if (tab === 'notas') return 'Explorador de Notas'
    if (tab === 'ia') return 'Qué ha hecho la IA'
    if (tab === 'decidir') return 'Te toca decidir'
    if (tab === 'carpetas') return 'Carpetas'
    return 'Inicio'
  }, [tab, selectedArea])

  const pendingTasksCount = taskLists.reduce(
    (acc, lst) => acc + (lst.pending?.filter((t) => !t.done).length || 0),
    0
  )
  const decideCount = overview?.stats?.temporal_count ?? 0

  // Global keyboard shortcuts
  useEffect(() => {
    const DOCK_ORDER = ['inicio', 'tareas', 'proyectos', 'areas', 'notas', 'ia', 'decidir', 'carpetas']

    const onKeyDown = (e) => {
      const tag = (e.target?.tagName || '').toLowerCase()
      const isTyping = tag === 'input' || tag === 'textarea' || tag === 'select' || e.target?.isContentEditable
      const hasModal = Boolean(openNotePath || newNoteModal || newAreaModal || showShortcuts)

      // Ctrl + S -> Sync Git
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') {
        e.preventDefault()
        handleGitSync()
        return
      }

      // Ctrl + K -> Explorador de Notas
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault()
        setTab('notas')
        return
      }

      // Alt + N -> Nueva nota
      if (e.altKey && e.key.toLowerCase() === 'n') {
        e.preventDefault()
        setNewNoteModal(true)
        return
      }

      // Alt + J -> Diario de hoy
      if (e.altKey && e.key.toLowerCase() === 'j') {
        e.preventDefault()
        handleOpenTodayJournal()
        return
      }

      // Escape -> Cerrar modales
      if (e.key === 'Escape') {
        if (showShortcuts) setShowShortcuts(false)
        else if (newNoteModal) setNewNoteModal(false)
        else if (newAreaModal) setNewAreaModal(false)
        else if (openNotePath) setOpenNotePath(null)
        return
      }

      if (isTyping || hasModal) return

      // Shift + ArrowLeft / ArrowRight -> Navegar entre menús del dock
      if (e.shiftKey && (e.key === 'ArrowRight' || e.key === 'ArrowLeft')) {
        e.preventDefault()
        const curTab = tab === 'area_detail' ? 'areas' : tab
        const idx = DOCK_ORDER.indexOf(curTab)
        if (idx !== -1) {
          const nextIdx =
            e.key === 'ArrowRight'
              ? (idx + 1) % DOCK_ORDER.length
              : (idx - 1 + DOCK_ORDER.length) % DOCK_ORDER.length
          setTab(DOCK_ORDER[nextIdx])
        }
        return
      }

      // Inicio carousel navigation with ArrowLeft / ArrowRight / Enter
      if (tab === 'inicio' && areas.length > 0) {
        if (e.key === 'ArrowRight') {
          e.preventDefault()
          setCarouselDir('next')
          setCarouselIdx((prev) => (prev + 1) % areas.length)
          return
        }
        if (e.key === 'ArrowLeft') {
          e.preventDefault()
          setCarouselDir('prev')
          setCarouselIdx((prev) => (prev - 1 + areas.length) % areas.length)
          return
        }
        if (e.key === 'Enter' && activeArea) {
          e.preventDefault()
          openArea(activeArea.name)
          return
        }
      }

      // 2D spatial arrow-key navigation across cards/items in all other menus
      if (
        tab !== 'inicio' &&
        ['ArrowRight', 'ArrowLeft', 'ArrowDown', 'ArrowUp'].includes(e.key)
      ) {
        const items = Array.from(document.querySelectorAll('main [data-nav-item]'))
        if (items.length === 0) return
        e.preventDefault()

        const current = document.activeElement
        const curIdx = items.indexOf(current)
        if (curIdx === -1) {
          items[0].focus()
          items[0].scrollIntoView({ block: 'nearest', behavior: 'smooth' })
          return
        }

        const curRect = current.getBoundingClientRect()
        const curX = curRect.left + curRect.width / 2
        const curY = curRect.top + curRect.height / 2

        let best = null
        let bestScore = Infinity

        for (const el of items) {
          if (el === current) continue
          const r = el.getBoundingClientRect()
          const cx = r.left + r.width / 2
          const cy = r.top + r.height / 2
          const dx = cx - curX
          const dy = cy - curY

          const isMatch =
            (e.key === 'ArrowRight' && dx > 12) ||
            (e.key === 'ArrowLeft' && dx < -12) ||
            (e.key === 'ArrowDown' && dy > 12) ||
            (e.key === 'ArrowUp' && dy < -12)

          if (!isMatch) continue

          // Penalize off-axis distance so row/column navigation feels natural
          const primary =
            e.key === 'ArrowRight' || e.key === 'ArrowLeft' ? Math.abs(dx) : Math.abs(dy)
          const secondary =
            e.key === 'ArrowRight' || e.key === 'ArrowLeft' ? Math.abs(dy) : Math.abs(dx)
          const score = primary + secondary * 2.5
          if (score < bestScore) {
            bestScore = score
            best = el
          }
        }

        // Fallback to linear next/prev if at edge of row
        if (!best) {
          if (e.key === 'ArrowRight' || e.key === 'ArrowDown') {
            best = items[(curIdx + 1) % items.length]
          } else {
            best = items[(curIdx - 1 + items.length) % items.length]
          }
        }

        if (best) {
          best.focus()
          best.scrollIntoView({ block: 'nearest', behavior: 'smooth' })
        }
        return
      }

      if (e.key === 'Enter' && tab !== 'inicio') {
        const current = document.activeElement
        if (current && current.hasAttribute('data-nav-item')) {
          e.preventDefault()
          current.click()
          return
        }
      }

      // Number keys 1-7 -> Jump to dock tab
      const num = Number(e.key)
      if (num >= 1 && num <= DOCK_ORDER.length && !e.ctrlKey && !e.metaKey && !e.altKey) {
        e.preventDefault()
        setTab(DOCK_ORDER[num - 1])
        return
      }

      // ? -> Show shortcuts legend
      if (e.key === '?') {
        e.preventDefault()
        setShowShortcuts(true)
      }
    }

    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [tab, areas, activeArea, openNotePath, newNoteModal, newAreaModal, showShortcuts])

  if (!authChecked) {
    return <div className="min-h-screen bg-[#070b0c]" />
  }

  if (authRequired && !authenticated) {
    return (
      <LoginScreen
        onSuccess={() => {
          setAuthenticated(true)
          fetchAll()
        }}
      />
    )
  }

  return (
    <div className={`relative min-h-screen bg-[#070b0c] text-zinc-100 transition-colors duration-700 ${ambientBg}`}>
      {/* Top Header */}
      <header className="mx-auto flex max-w-7xl items-center justify-between gap-2 px-4 sm:px-6 pt-5 pb-3">
        <div className="flex items-center gap-2 text-sm">
          <button
            onClick={() => setTab('inicio')}
            className="font-bold tracking-wide text-white hover:text-[#f2b880] transition-colors cursor-pointer"
          >
            HQ
          </button>
          <span className="text-zinc-500">/</span>
          <span className="text-zinc-300 font-medium truncate max-w-[140px] sm:max-w-none">{breadcrumbLabel}</span>
        </div>

        <div className="flex items-center gap-2 sm:gap-3">
          <div className="hidden md:flex items-baseline gap-2.5 mr-1">
            <span className="text-2xl font-extrabold tracking-tight text-white">{clock}</span>
            <span className="text-xs text-zinc-400">{todayLabel}</span>
          </div>

          {gitStatus?.is_git && (
            <button
              onClick={handleGitSync}
              disabled={syncingGit}
              title={gitStatus.last_commit || 'Sincronizar con GitHub'}
              className="relative flex items-center gap-1.5 rounded-xl border border-white/10 bg-white/[0.05] px-3 py-1.5 text-xs font-medium text-zinc-200 hover:border-[#f2b880]/40 hover:bg-white/[0.09] transition-all cursor-pointer disabled:opacity-50"
            >
              <GitBranch className={`h-3.5 w-3.5 ${syncingGit ? 'animate-pulse text-[#f2b880]' : 'text-emerald-400'}`} />
              <span className="hidden sm:inline">{syncingGit ? 'Sync...' : 'Sync Git'}</span>
              {gitStatus.dirty && (
                <span className="h-1.5 w-1.5 rounded-full bg-[#f2b880]" />
              )}
            </button>
          )}

          <button
            onClick={handleOpenTodayJournal}
            className="rounded-xl border border-white/10 bg-white/[0.05] px-3 py-1.5 text-xs font-medium text-zinc-200 hover:border-[#f2b880]/40 hover:bg-white/[0.09] transition-all cursor-pointer"
          >
            Diario de hoy
          </button>

          <button
            onClick={() => setNewNoteModal(true)}
            title="Crear nueva nota"
            className="flex h-8 w-8 items-center justify-center rounded-xl border border-white/10 bg-white/[0.05] text-zinc-200 hover:border-[#f2b880]/40 hover:text-[#f2b880] transition-all cursor-pointer"
          >
            <FilePlus2 className="h-4 w-4" />
          </button>

          <button
            onClick={fetchAll}
            title="Refrescar vault"
            className="flex h-8 w-8 items-center justify-center rounded-xl border border-white/10 bg-white/[0.05] text-zinc-300 hover:bg-white/[0.1] transition-all cursor-pointer"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${refreshing ? 'animate-spin text-[#f2b880]' : ''}`} />
          </button>

          <button
            onClick={() => setShowShortcuts(true)}
            title="Atajos de teclado (?)"
            className="hidden sm:flex h-8 w-8 items-center justify-center rounded-xl border border-white/10 bg-white/[0.05] text-zinc-400 hover:text-[#f2b880] transition-all cursor-pointer"
          >
            <Keyboard className="h-3.5 w-3.5" />
          </button>

          {authRequired && (
            <button
              onClick={handleLogout}
              title="Cerrar sesión"
              className="flex h-8 w-8 items-center justify-center rounded-xl border border-white/10 bg-white/[0.05] text-zinc-400 hover:text-rose-300 transition-all cursor-pointer"
            >
              <LogOut className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
      </header>

      {/* Main Content */}
      <main key={tab} className="animate-view-in mx-auto max-w-7xl px-4 sm:px-6 pb-32 pt-2">
        {/* ================= INICIO ================= */}
        {tab === 'inicio' && overview && (
          <div className="space-y-6">
            {/* Weekly Calendar Strip */}
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-white/[0.08] bg-white/[0.03] px-3 sm:px-4 py-3 backdrop-blur-xl">
              <div className="no-scrollbar flex flex-1 items-center justify-between gap-1.5 sm:gap-2 overflow-x-auto">
                {overview.week_days.map((day) => (
                  <button
                    key={day.date}
                    onClick={() => {
                      if (day.has_note) {
                        setOpenNotePath(day.daily_path)
                      } else if (day.is_today) {
                        handleOpenTodayJournal()
                      }
                    }}
                    className={`group relative flex shrink-0 flex-col items-center rounded-xl px-2.5 sm:px-4 py-2 text-xs font-semibold transition-all cursor-pointer ${
                      day.is_today
                        ? 'bg-[#f2b880] text-zinc-950 shadow-lg shadow-[#f2b880]/20'
                        : 'text-zinc-300 hover:bg-white/[0.06]'
                    }`}
                  >
                    <span>{day.label}</span>
                    {day.has_note && (
                      <span
                        className={`mt-1 h-1 w-1 rounded-full ${
                          day.is_today ? 'bg-zinc-950' : 'bg-[#f2b880]'
                        }`}
                      />
                    )}
                  </button>
                ))}
              </div>

              <div className="flex w-full sm:w-auto items-center justify-around sm:justify-start gap-5 border-t sm:border-t-0 sm:border-l border-white/10 pt-2.5 sm:pt-0 sm:pl-5">
                <button
                  onClick={() => setTab('decidir')}
                  className="flex items-center gap-2 text-left hover:opacity-80 transition-opacity cursor-pointer"
                >
                  <Bell className="h-4 w-4 text-zinc-400" />
                  <div>
                    <div className="flex items-center gap-1.5 text-xs font-semibold text-white">
                      Te toca decidir
                      {decideCount > 0 && <span className="h-1.5 w-1.5 rounded-full bg-[#f2b880]" />}
                    </div>
                    <div className="text-[11px] text-zinc-400">{decideCount} en temporal</div>
                  </div>
                </button>

                <button
                  onClick={() => setTab('tareas')}
                  className="flex items-center gap-2 text-left hover:opacity-80 transition-opacity cursor-pointer"
                >
                  <ListTodo className="h-4 w-4 text-zinc-400" />
                  <div>
                    <div className="text-xs font-semibold text-white">Hoy</div>
                    <div className="text-[11px] text-zinc-400">
                      {overview.stats.today_pending} por hacer
                    </div>
                  </div>
                </button>
              </div>
            </div>

            {/* Hero Carousel */}
            {activeArea && (
              <div className="relative flex items-center justify-center py-2">
                {/* Left peek card */}
                {prevArea && (
                  <div
                    onClick={() => {
                      setCarouselDir('prev')
                      setCarouselIdx((carouselIdx - 1 + areas.length) % areas.length)
                    }}
                    className="hidden lg:block absolute left-0 h-[370px] w-[200px] overflow-hidden rounded-3xl border border-white/10 opacity-40 hover:opacity-65 transition-all duration-300 cursor-pointer"
                  >
                    <AreaArtwork
                      style={prevArea.image_style}
                      coverUrl={prevArea.cover_url}
                      posX={prevArea.cover_pos_x}
                      posY={prevArea.cover_pos_y}
                      zoom={prevArea.cover_zoom}
                      className="h-full w-full"
                    />
                    <div className="absolute bottom-6 left-5 right-4">
                      <div className="text-lg font-bold text-white truncate">{prevArea.name}</div>
                    </div>
                  </div>
                )}

                {/* Main Center Card */}
                <div
                  key={`${carouselIdx}-${carouselDir}`}
                  className={`relative z-10 h-[340px] sm:h-[430px] w-full max-w-4xl overflow-hidden rounded-3xl border border-white/15 shadow-2xl ${
                    carouselDir === 'next' ? 'animate-carousel-next' : 'animate-carousel-prev'
                  }`}
                >
                  <AreaArtwork
                    style={activeArea.image_style}
                    coverUrl={activeArea.cover_url}
                    posX={activeArea.cover_pos_x}
                    posY={activeArea.cover_pos_y}
                    zoom={activeArea.cover_zoom}
                    className="h-full w-full"
                  />

                  {/* Left Arrow */}
                  <button
                    onClick={() => {
                      setCarouselDir('prev')
                      setCarouselIdx((carouselIdx - 1 + areas.length) % areas.length)
                    }}
                    className="absolute left-3 top-4 sm:left-4 sm:top-1/2 sm:-translate-y-1/2 flex h-9 w-9 sm:h-10 sm:w-10 items-center justify-center rounded-full border border-white/15 bg-black/50 text-white backdrop-blur-md hover:bg-black/75 hover:scale-105 transition-all cursor-pointer"
                  >
                    <ChevronLeft className="h-5 w-5" />
                  </button>

                  {/* Right Arrow */}
                  <button
                    onClick={() => {
                      setCarouselDir('next')
                      setCarouselIdx((carouselIdx + 1) % areas.length)
                    }}
                    className="absolute right-3 top-4 sm:right-4 sm:top-1/2 sm:-translate-y-1/2 flex h-9 w-9 sm:h-10 sm:w-10 items-center justify-center rounded-full border border-white/15 bg-black/50 text-white backdrop-blur-md hover:bg-black/75 hover:scale-105 transition-all cursor-pointer"
                  >
                    <ChevronRight className="h-5 w-5" />
                  </button>

                  {/* Bottom overlay info */}
                  <div className="absolute inset-x-0 bottom-0 flex flex-col sm:flex-row sm:items-end justify-between gap-4 p-8">
                    <div>
                      <div className="mb-2 inline-flex items-center gap-2 rounded-full border border-white/15 bg-black/40 px-3 py-1 text-xs text-zinc-300 backdrop-blur-md">
                        <span>{activeArea.existing_count} notas conectadas</span>
                        {activeArea.pending_tasks > 0 && (
                          <>
                            <span>·</span>
                            <span className="text-[#f2b880]">{activeArea.pending_tasks} tareas</span>
                          </>
                        )}
                      </div>
                      <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-white">
                        {activeArea.name}
                      </h1>
                      <p className="mt-1 text-sm text-zinc-300 max-w-xl">{activeArea.subtitle}</p>
                    </div>

                    <button
                      onClick={() => openArea(activeArea.name)}
                      className="inline-flex shrink-0 items-center gap-2 rounded-xl bg-[#f2b880] px-5 py-2.5 text-sm font-semibold text-zinc-950 shadow-lg hover:bg-[#f5c496] transition-all cursor-pointer"
                    >
                      Entrar
                      <ArrowRight className="h-4 w-4" />
                    </button>
                  </div>
                </div>

                {/* Right peek card */}
                {nextArea && (
                  <div
                    onClick={() => {
                      setCarouselDir('next')
                      setCarouselIdx((carouselIdx + 1) % areas.length)
                    }}
                    className="hidden lg:block absolute right-0 h-[370px] w-[200px] overflow-hidden rounded-3xl border border-white/10 opacity-40 hover:opacity-65 transition-all duration-300 cursor-pointer"
                  >
                    <AreaArtwork
                      style={nextArea.image_style}
                      coverUrl={nextArea.cover_url}
                      posX={nextArea.cover_pos_x}
                      posY={nextArea.cover_pos_y}
                      zoom={nextArea.cover_zoom}
                      className="h-full w-full"
                    />
                    <div className="absolute bottom-6 left-5 right-4">
                      <div className="text-lg font-bold text-white truncate">{nextArea.name}</div>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Carousel Pagination Dots */}
            <div className="flex items-center justify-center gap-2">
              {areas.map((a, idx) => (
                <button
                  key={a.name}
                  onClick={() => setCarouselIdx(idx)}
                  className={`h-1.5 rounded-full transition-all cursor-pointer ${
                    idx === carouselIdx ? 'w-6 bg-[#f2b880]' : 'w-1.5 bg-white/25 hover:bg-white/45'
                  }`}
                  title={a.name}
                />
              ))}
            </div>

            {/* Quick Vault Summary Strip */}
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 pt-2">
              <div
                onClick={() => setTab('notas')}
                className="rounded-2xl border border-white/[0.08] bg-white/[0.03] p-4 hover:border-white/20 transition-all cursor-pointer"
              >
                <div className="text-xs text-zinc-400">Notas en myVault</div>
                <div className="mt-1 text-2xl font-bold text-white">{overview.stats.total_notes}</div>
              </div>
              <div
                onClick={() => setTab('tareas')}
                className="rounded-2xl border border-white/[0.08] bg-white/[0.03] p-4 hover:border-white/20 transition-all cursor-pointer"
              >
                <div className="text-xs text-zinc-400">Tareas pendientes</div>
                <div className="mt-1 text-2xl font-bold text-[#f2b880]">{pendingTasksCount}</div>
              </div>
              <div
                onClick={() => setTab('proyectos')}
                className="rounded-2xl border border-white/[0.08] bg-white/[0.03] p-4 hover:border-white/20 transition-all cursor-pointer"
              >
                <div className="text-xs text-zinc-400">Ideas guardadas</div>
                <div className="mt-1 text-2xl font-bold text-white">{overview.stats.ideas_count}</div>
              </div>
              <div
                onClick={() => setTab('ia')}
                className="rounded-2xl border border-white/[0.08] bg-white/[0.03] p-4 hover:border-white/20 transition-all cursor-pointer"
              >
                <div className="text-xs text-zinc-400">Scripts Python (.py)</div>
                <div className="mt-1 text-2xl font-bold text-cyan-300">{scripts.length}</div>
              </div>
            </div>
          </div>
        )}

        {/* ================= AREA DETAIL ================= */}
        {tab === 'area_detail' && selectedArea === 'Lecturas' && (
          <LecturasSection
            areaTheme={areaDetail?.theme}
            onEditCover={() => setCoverModalArea({ name: 'Lecturas', ...areaDetail?.theme })}
            onBack={() => setTab('areas')}
            onOpenNote={(p) => setOpenNotePath(p)}
            onRefreshVault={fetchAll}
          />
        )}
        {tab === 'area_detail' && selectedArea === 'Series y Películas' && (
          <SeriesSection
            areaTheme={areaDetail?.theme}
            onEditCover={() => setCoverModalArea({ name: 'Series y Películas', ...areaDetail?.theme })}
            onBack={() => setTab('areas')}
            onOpenNote={(p) => setOpenNotePath(p)}
            onRefreshVault={fetchAll}
          />
        )}
        {tab === 'area_detail' && selectedArea === 'Salud' && (
          <SaludView
            areaTheme={areaDetail?.theme}
            onEditCover={() => setCoverModalArea({ name: 'Salud', ...areaDetail?.theme })}
            onBack={() => setTab('areas')}
            onOpenNote={(p) => setOpenNotePath(p)}
            onNewNoteInFolder={(folder) => openNewNoteIn(folder)}
          />
        )}
        {tab === 'area_detail' &&
          selectedArea !== 'Lecturas' &&
          selectedArea !== 'Series y Películas' &&
          selectedArea !== 'Salud' &&
          areaDetail && (
          <div className="space-y-6">
            <div className="relative min-h-[168px] sm:h-44 overflow-hidden rounded-3xl border border-white/10">
              <AreaArtwork
                style={areaDetail.theme?.image_style || 'forest'}
                coverUrl={areaDetail.theme?.cover_url}
                posX={areaDetail.theme?.cover_pos_x}
                posY={areaDetail.theme?.cover_pos_y}
                zoom={areaDetail.theme?.cover_zoom}
                className="h-full w-full"
              />
              <div className="absolute inset-0 flex items-end justify-between p-6">
                <div>
                  <button
                    onClick={() => setTab('areas')}
                    className="mb-2 inline-flex items-center gap-1.5 text-xs text-zinc-300 hover:text-white cursor-pointer"
                  >
                    <ArrowLeft className="h-3.5 w-3.5" />
                    Volver a Áreas
                  </button>
                  <h1 className="text-3xl font-extrabold text-white">{areaDetail.name}</h1>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  {areaDetail.name === 'Personas' && (
                    <button
                      onClick={() => {
                        setAddingEntity(addingEntity === 'persona' ? null : 'persona')
                        setNewEntityName('')
                      }}
                      className="flex items-center gap-1.5 rounded-xl bg-[#f2b880] px-3.5 py-2 text-xs font-bold text-zinc-950 hover:bg-[#f5c496] cursor-pointer"
                    >
                      <Plus className="h-3.5 w-3.5" />
                      Nueva persona
                    </button>
                  )}
                  {areaDetail.name === 'Proyectos' && (
                    <button
                      onClick={() => {
                        setAddingEntity(addingEntity === 'proyecto' ? null : 'proyecto')
                        setNewEntityName('')
                      }}
                      className="flex items-center gap-1.5 rounded-xl bg-[#f2b880] px-3.5 py-2 text-xs font-bold text-zinc-950 hover:bg-[#f5c496] cursor-pointer"
                    >
                      <Plus className="h-3.5 w-3.5" />
                      Nuevo proyecto
                    </button>
                  )}
                  {['Proyectos', 'Trabajo', 'Conocimiento', 'Reflexiones', 'Finanzas', 'Hobbies e intereses'].includes(areaDetail.name) && (
                    <button
                      onClick={() => openNewNoteIn(areaDetail.name, areaDetail.name)}
                      className="flex items-center gap-1.5 rounded-xl border border-[#f2b880]/40 bg-[#f2b880]/15 px-3.5 py-2 text-xs font-bold text-[#f2b880] hover:bg-[#f2b880]/25 cursor-pointer"
                    >
                      <FilePlus2 className="h-3.5 w-3.5" />
                      Nueva nota
                    </button>
                  )}
                  <button
                    onClick={() => setCoverModalArea({ name: areaDetail.name, ...areaDetail.theme })}
                    className="flex items-center gap-1.5 rounded-xl border border-white/15 bg-black/50 px-3.5 py-2 text-xs font-medium text-white backdrop-blur-md hover:bg-black/75 cursor-pointer"
                  >
                    <ImagePlus className="h-3.5 w-3.5 text-[#f2b880]" />
                    <span>{areaDetail.theme?.cover_url ? 'Portada / Ajustar' : 'Portada'}</span>
                  </button>
                  <button
                    onClick={() => setOpenNotePath(areaDetail.moc_path)}
                    className="rounded-xl border border-white/15 bg-black/50 px-4 py-2 text-xs font-medium text-white backdrop-blur-md hover:bg-black/75 cursor-pointer"
                  >
                    Editar MOC
                  </button>
                </div>
              </div>
            </div>

            {addingEntity && (
              <form
                onSubmit={handleCreateEntity}
                className="animate-modal-pop flex items-center gap-2 rounded-2xl border border-[#f2b880]/30 bg-white/[0.04] p-3"
              >
                <input
                  type="text"
                  value={newEntityName}
                  onChange={(e) => setNewEntityName(e.target.value)}
                  placeholder={
                    addingEntity === 'persona'
                      ? 'Nombre de la nueva persona...'
                      : 'Nombre del nuevo proyecto...'
                  }
                  autoFocus
                  required
                  className="flex-1 bg-transparent px-2 text-sm text-white placeholder:text-zinc-500 focus:outline-none"
                />
                <button
                  type="button"
                  onClick={() => setAddingEntity(null)}
                  className="rounded-xl px-3 py-1.5 text-xs text-zinc-400 hover:bg-white/5 cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="rounded-xl bg-[#f2b880] px-4 py-1.5 text-xs font-bold text-zinc-950 hover:bg-[#f5c496] cursor-pointer"
                >
                  Crear
                </button>
              </form>
            )}

            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {areaDetail.items.map((item) => (
                <div
                  key={item.path + item.name}
                  data-nav-item
                  tabIndex={0}
                  onClick={() => (item.exists ? setOpenNotePath(item.path) : handleOpenWikiLink(item.name))}
                  className="group flex flex-col justify-between rounded-2xl border border-white/[0.08] bg-white/[0.03] p-5 hover:border-[#f2b880]/40 hover:bg-white/[0.05] transition-all cursor-pointer"
                >
                  <div>
                    <div className="flex items-start justify-between gap-2">
                      <h3 className="text-base font-bold text-white group-hover:text-[#f2b880] transition-colors">
                        {item.title}
                      </h3>
                      <span
                        className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-medium ${
                          item.exists
                            ? 'bg-emerald-500/15 text-emerald-300'
                            : 'bg-zinc-700/40 text-zinc-400'
                        }`}
                      >
                        {item.exists ? item.folder : 'Sin crear'}
                      </span>
                    </div>
                    <p className="mt-2 line-clamp-2 text-xs text-zinc-400">{item.excerpt}</p>
                  </div>

                  <div className="mt-4 flex items-center justify-between border-t border-white/[0.06] pt-3 text-xs text-zinc-400">
                    <span>
                      {item.task_stats?.pending || 0} pendientes · {item.links?.length || 0} enlaces
                    </span>
                    <span className="font-semibold text-[#f2b880]">Entrar →</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ================= TAREAS (GOOGLE TASKS) ================= */}
        {tab === 'tareas' && (
          <TasksBoard
            lists={taskLists}
            onRefresh={fetchAll}
            onOpenNote={(p) => setOpenNotePath(p)}
          />
        )}

        {/* ================= PROYECTOS ================= */}
        {tab === 'proyectos' && projectsData && (
          <div className="space-y-6">
            <div className="relative h-36 overflow-hidden rounded-3xl border border-white/10">
              <AreaArtwork style="koi" className="h-full w-full" />
              <div className="absolute inset-0 flex flex-col justify-end p-6">
                <span className="text-xs text-zinc-300">MOC / Proyectos</span>
                <h1 className="text-3xl font-extrabold text-white">Proyectos & Ideas</h1>
              </div>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                {['En marcha', 'Archivados', 'Todos'].map((status) => (
                  <button
                    key={status}
                    onClick={() => setProjectFilter(status)}
                    className={`rounded-xl px-3.5 py-1.5 text-xs font-semibold transition-all cursor-pointer ${
                      projectFilter === status
                        ? 'bg-[#f2b880] text-zinc-950'
                        : 'border border-white/10 bg-white/5 text-zinc-300 hover:bg-white/10'
                    }`}
                  >
                    {status}
                  </button>
                ))}
              </div>

              <div className="flex items-center gap-2">
                <div className="flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-3 py-1.5">
                  <Search className="h-3.5 w-3.5 text-zinc-400" />
                  <input
                    type="text"
                    value={projectSearch}
                    onChange={(e) => setProjectSearch(e.target.value)}
                    placeholder="Buscar..."
                    className="w-36 bg-transparent text-xs text-white placeholder:text-zinc-500 focus:outline-none"
                  />
                </div>
                <div className="flex rounded-xl border border-white/10 bg-white/5 p-0.5">
                  <button
                    onClick={() => setProjectView('Tabla')}
                    className={`flex items-center gap-1 rounded-lg px-2.5 py-1 text-xs cursor-pointer ${
                      projectView === 'Tabla' ? 'bg-white/15 text-white' : 'text-zinc-400'
                    }`}
                  >
                    <Table2 className="h-3.5 w-3.5" />
                    Tabla
                  </button>
                  <button
                    onClick={() => setProjectView('Tablero')}
                    className={`flex items-center gap-1 rounded-lg px-2.5 py-1 text-xs cursor-pointer ${
                      projectView === 'Tablero' ? 'bg-white/15 text-white' : 'text-zinc-400'
                    }`}
                  >
                    <FolderKanban className="h-3.5 w-3.5" />
                    Tablero
                  </button>
                </div>
              </div>
            </div>

            {projectView === 'Tabla' ? (
              <div className="overflow-hidden rounded-2xl border border-white/[0.08] bg-white/[0.03] backdrop-blur-xl">
                <table className="w-full text-left text-sm">
                  <thead className="border-b border-white/10 text-xs text-zinc-400">
                    <tr>
                      <th className="px-5 py-3 font-medium">Nombre</th>
                      <th className="px-5 py-3 font-medium">Estado</th>
                      <th className="px-5 py-3 font-medium">Progreso</th>
                      <th className="px-5 py-3 font-medium text-right">Acción</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/[0.06]">
                    {filteredProjects.map((p) => (
                      <tr
                        key={p.name}
                        data-nav-item
                        tabIndex={0}
                        onClick={() => (p.path ? setOpenNotePath(p.path) : handleOpenWikiLink(p.name))}
                        className="hover:bg-white/[0.04] cursor-pointer transition-colors"
                      >
                        <td className="px-5 py-3.5 font-medium text-white">{p.name}</td>
                        <td className="px-5 py-3.5">
                          <span className="rounded-lg border border-white/10 bg-white/5 px-2.5 py-1 text-xs text-zinc-300">
                            {p.step}
                          </span>
                        </td>
                        <td className="px-5 py-3.5">
                          <div className="flex items-center gap-2">
                            <div className="h-2 w-28 overflow-hidden rounded-full bg-white/10">
                              <div
                                className="h-full rounded-full bg-[#f2b880]"
                                style={{ width: `${p.progress}%` }}
                              />
                            </div>
                            <span className="text-xs text-zinc-400">{p.progress}%</span>
                          </div>
                        </td>
                        <td className="px-5 py-3.5 text-right">
                          <span className="text-xs font-semibold text-[#f2b880]">Abrir →</span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="grid gap-4 md:grid-cols-2">
                {['En marcha', 'Archivados'].map((col) => (
                  <div
                    key={col}
                    className="rounded-2xl border border-white/[0.08] bg-white/[0.03] p-4"
                  >
                    <h3 className="mb-3 text-sm font-bold text-white">{col}</h3>
                    <div className="space-y-2.5">
                      {(projectsData.projects || [])
                        .filter((p) => p.status === col)
                        .map((p) => (
                          <div
                            key={p.name}
                            data-nav-item
                            tabIndex={0}
                            onClick={() =>
                              p.path ? setOpenNotePath(p.path) : handleOpenWikiLink(p.name)
                            }
                            className="rounded-xl border border-white/[0.08] bg-black/30 p-3.5 hover:border-[#f2b880]/40 cursor-pointer"
                          >
                            <div className="font-semibold text-white text-sm">{p.name}</div>
                            <div className="mt-2 flex items-center justify-between text-xs text-zinc-400">
                              <span>{p.word_count} palabras</span>
                              <span>{p.links_count} enlaces</span>
                            </div>
                          </div>
                        ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ================= ÁREAS (MOCs) ================= */}
        {tab === 'areas' && (
          <div className="space-y-6">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div>
                <h1 className="text-2xl font-extrabold text-white">Áreas principales (MOCs)</h1>
                <p className="text-xs text-zinc-400">
                  Basado en tu nota 📌 000 - Dashboard.md y la carpeta MOC/
                </p>
              </div>
              <button
                onClick={() => setNewAreaModal(true)}
                className="flex items-center gap-1.5 rounded-xl bg-[#f2b880] px-4 py-2 text-xs font-bold text-zinc-950 hover:bg-[#f5c496] cursor-pointer"
              >
                <Plus className="h-4 w-4" />
                Nueva Área
              </button>
            </div>
            <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
              {areas.map((a) => (
                <div
                  key={a.name}
                  data-nav-item
                  tabIndex={0}
                  onClick={() => openArea(a.name)}
                  className="group overflow-hidden rounded-3xl border border-white/10 bg-white/[0.03] hover:border-[#f2b880]/45 transition-all cursor-pointer"
                >
                  <div className="relative h-36">
                    <AreaArtwork
                      style={a.image_style}
                      coverUrl={a.cover_url}
                      posX={a.cover_pos_x}
                      posY={a.cover_pos_y}
                      zoom={a.cover_zoom}
                      className="h-full w-full"
                    />
                    <div className="absolute bottom-3 left-4 rounded-xl bg-black/60 px-3 py-1 backdrop-blur-md">
                      <span className="text-sm font-bold text-white">{a.name}</span>
                    </div>
                  </div>
                  <div className="p-5">
                    <p className="text-xs text-zinc-400 line-clamp-2">{a.subtitle}</p>
                    <div className="mt-4 flex items-center justify-between">
                      <div className="flex gap-4 text-xs">
                        <div>
                          <div className="text-lg font-bold text-white">{a.existing_count}</div>
                          <div className="text-[11px] text-zinc-500">Notas</div>
                        </div>
                        <div>
                          <div className="text-lg font-bold text-white">{a.pending_tasks}</div>
                          <div className="text-[11px] text-zinc-500">Tareas</div>
                        </div>
                      </div>
                      <span className="text-xs font-semibold text-[#f2b880] group-hover:translate-x-0.5 transition-transform">
                        Entrar →
                      </span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ================= EXPLORADOR DE NOTAS ================= */}
        {tab === 'notas' && (
          <div className="space-y-5">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex flex-wrap items-center gap-2">
                {['Todas', 'Proyectos', 'Personas', 'Finanzas', 'Trabajo', 'Reflexiones', 'Contenido', 'Salud', 'Hobbies e intereses', 'Tareas', 'Diario', 'MOC', 'Ideas', 'Inventarios', 'Temporal', 'Notas'].map(
                  (folder) => (
                    <button
                      key={folder}
                      onClick={() => setNotesFolder(folder)}
                      className={`rounded-xl px-3.5 py-1.5 text-xs font-semibold transition-all cursor-pointer ${
                        notesFolder === folder
                          ? 'bg-[#f2b880] text-zinc-950'
                          : 'border border-white/10 bg-white/5 text-zinc-300 hover:bg-white/10'
                      }`}
                    >
                      {folder}
                    </button>
                  )
                )}
              </div>

              <div className="flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-3 py-2">
                <Search className="h-4 w-4 text-zinc-400" />
                <input
                  type="text"
                  value={notesSearch}
                  onChange={(e) => setNotesSearch(e.target.value)}
                  placeholder="Buscar nota o #tag..."
                  className="w-56 bg-transparent text-xs text-white placeholder:text-zinc-500 focus:outline-none"
                />
              </div>
            </div>

            <div className="text-xs text-zinc-400">
              Mostrando {filteredNotes.length} notas
            </div>

            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {filteredNotes.slice(0, 60).map((n) => (
                <div
                  key={n.path}
                  data-nav-item
                  tabIndex={0}
                  onClick={() => setOpenNotePath(n.path)}
                  className="flex flex-col justify-between rounded-2xl border border-white/[0.08] bg-white/[0.03] p-4 hover:border-[#f2b880]/40 hover:bg-white/[0.05] transition-all cursor-pointer"
                >
                  <div>
                    <div className="flex items-start justify-between gap-2">
                      <h3 className="text-sm font-bold text-white line-clamp-1">{n.title}</h3>
                      <span className="shrink-0 rounded-md bg-white/10 px-2 py-0.5 text-[10px] text-zinc-300">
                        {n.folder}
                      </span>
                    </div>
                    <p className="mt-1.5 line-clamp-2 text-xs text-zinc-400">
                      {n.excerpt || 'Nota vacía'}
                    </p>
                  </div>
                  <div className="mt-3 flex items-center justify-between text-[11px] text-zinc-500">
                    <span>{n.word_count} palabras</span>
                    <span>{n.links.length} enlaces · {n.backlinks.length} backlinks</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ================= LA IA & SCRIPTS PYTHON ================= */}
        {tab === 'ia' && (
          <div className="space-y-6">
            <div className="relative h-36 overflow-hidden rounded-3xl border border-white/10">
              <AreaArtwork style="forest" className="h-full w-full" />
              <div className="absolute inset-0 flex flex-col justify-end p-6">
                <h1 className="text-3xl font-extrabold text-white">Qué ha hecho la IA & Scripts</h1>
                <p className="text-xs text-zinc-300">
                  Ejecuta tus scripts .py sobre myVault y revisa el historial de acciones.
                </p>
              </div>
            </div>

            {/* Python Scripts Runner */}
            <div className="rounded-3xl border border-white/[0.08] bg-white/[0.03] p-5 backdrop-blur-xl">
              <div className="mb-4 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Terminal className="h-4 w-4 text-[#f2b880]" />
                  <h2 className="text-base font-bold text-white">Automatizaciones Python (.py)</h2>
                </div>
                <span className="text-xs text-zinc-400">Carpeta: hq-dashboard/scripts/</span>
              </div>

              <div className="grid gap-3 sm:grid-cols-3">
                {scripts.map((sc) => (
                  <div
                    key={sc.name}
                    className="flex flex-col justify-between rounded-2xl border border-white/10 bg-black/30 p-4"
                  >
                    <div>
                      <div className="font-mono text-sm font-semibold text-white">{sc.name}</div>
                      <p className="mt-1 text-xs text-zinc-400">{sc.description}</p>
                    </div>
                    <button
                      onClick={() => handleRunScript(sc.name)}
                      disabled={runningScript === sc.name}
                      className="mt-4 inline-flex items-center justify-center gap-1.5 rounded-xl bg-[#f2b880] px-3 py-2 text-xs font-bold text-zinc-950 hover:bg-[#f5c496] disabled:opacity-50 cursor-pointer"
                    >
                      <Play className="h-3.5 w-3.5" />
                      {runningScript === sc.name ? 'Ejecutando...' : 'Ejecutar'}
                    </button>
                  </div>
                ))}
              </div>

              {scriptOutput && (
                <div className="mt-4 rounded-2xl border border-white/10 bg-black/60 p-4">
                  <div className="mb-2 flex items-center justify-between text-xs">
                    <span className="font-mono font-semibold text-[#f2b880]">
                      Salida: {scriptOutput.name}
                    </span>
                    <span
                      className={
                        scriptOutput.status === 'ok' ? 'text-emerald-400' : 'text-rose-400'
                      }
                    >
                      {scriptOutput.status === 'ok' ? 'Completado' : 'Error'}
                    </span>
                  </div>
                  <pre className="max-h-64 overflow-auto whitespace-pre-wrap font-mono text-xs text-zinc-200">
                    {scriptOutput.output || '(Sin salida)'}
                  </pre>
                </div>
              )}
            </div>

            {/* Activity Log */}
            <div className="space-y-2.5">
              <h2 className="text-sm font-bold text-zinc-300">Historial de actividad reciente</h2>
              {activity.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-white/10 p-6 text-center text-xs text-zinc-500">
                  Aún no hay actividad registrada. Edita una nota, marca una tarea o ejecuta un script .py.
                </div>
              ) : (
                activity.map((item) => (
                  <div
                    key={item.id}
                    className="flex items-start gap-4 rounded-2xl border border-white/[0.08] bg-white/[0.03] px-4 py-3"
                  >
                    <span className="font-mono text-xs text-zinc-500 pt-0.5">
                      {item.timestamp?.slice(11, 16) || '--:--'}
                    </span>
                    <div className="flex-1">
                      <div className="flex items-center gap-2 text-xs">
                        <span
                          className={`rounded-md px-2 py-0.5 font-semibold ${
                            item.status === 'Error'
                              ? 'bg-rose-500/20 text-rose-300'
                              : 'bg-emerald-500/20 text-emerald-300'
                          }`}
                        >
                          {item.status}
                        </span>
                        <span className="text-zinc-400">
                          {item.section} · {item.actor}
                        </span>
                      </div>
                      <p className="mt-1 text-sm text-zinc-200">{item.message}</p>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        )}

        {/* ================= DECIDIR (TEMPORAL & IDEAS) ================= */}
        {tab === 'decidir' && (
          <div className="space-y-6">
            <div>
              <h1 className="text-2xl font-extrabold text-white">Te toca decidir</h1>
              <p className="text-xs text-zinc-400">
                Notas en Temporal/ e Ideas/ listas para revisar, procesar o convertir en proyectos.
              </p>
            </div>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {notesData
                .filter((n) => n.folder === 'Temporal' || n.folder === 'Ideas')
                .map((n) => (
                  <div
                    key={n.path}
                    data-nav-item
                    tabIndex={0}
                    onClick={() => setOpenNotePath(n.path)}
                    className="rounded-2xl border border-white/[0.08] bg-white/[0.03] p-4 hover:border-[#f2b880]/40 cursor-pointer"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <h3 className="text-sm font-bold text-white truncate">{n.title}</h3>
                      <span className="rounded-md bg-[#f2b880]/15 px-2 py-0.5 text-[10px] font-semibold text-[#f2b880]">
                        {n.folder}
                      </span>
                    </div>
                    <p className="mt-2 line-clamp-2 text-xs text-zinc-400">{n.excerpt}</p>
                  </div>
                ))}
            </div>
          </div>
        )}
        {/* ================= CARPETAS ================= */}
        {tab === 'carpetas' && (
          <FoldersView
            onOpenNote={(p) => setOpenNotePath(p)}
            onNewNoteInFolder={(folder) => openNewNoteIn(folder)}
            onRefreshVault={fetchAll}
          />
        )}
      </main>

      {/* Bottom Floating Dock */}
      <nav className="fixed bottom-[max(0.75rem,env(safe-area-inset-bottom))] left-1/2 z-40 max-w-[95vw] -translate-x-1/2">
        <div className="no-scrollbar flex items-center gap-1 overflow-x-auto rounded-2xl border border-white/15 bg-[#0c1113]/90 p-1.5 shadow-2xl backdrop-blur-2xl">
          {[
            { id: 'inicio', label: 'Inicio', icon: Home },
            { id: 'tareas', label: 'Tareas', icon: ListTodo, badge: pendingTasksCount },
            { id: 'proyectos', label: 'Proyectos', icon: Layers },
            { id: 'areas', label: 'Áreas', icon: LayoutGrid },
            { id: 'notas', label: 'Notas', icon: BookOpen },
            { id: 'ia', label: 'La IA', icon: Activity },
            { id: 'decidir', label: 'Decidir', icon: Bell, badge: decideCount },
            { id: 'carpetas', label: 'Carpetas', icon: FolderTree },
          ].map((item) => {
            const Icon = item.icon
            const active =
              tab === item.id || (tab === 'area_detail' && item.id === 'areas')
            return (
              <button
                key={item.id}
                onClick={() => setTab(item.id)}
                className={`relative flex shrink-0 flex-col items-center justify-center rounded-xl px-3 sm:px-3.5 py-2 text-[11px] font-medium transition-all cursor-pointer ${
                  active
                    ? 'bg-white/[0.12] text-white shadow-inner border border-white/10'
                    : 'text-zinc-400 hover:bg-white/[0.06] hover:text-zinc-200'
                }`}
              >
                <Icon className={`h-4 w-4 mb-1 ${active ? 'text-[#f2b880]' : ''}`} />
                <span>{item.label}</span>
                {active && (
                  <span className="absolute bottom-0.5 h-0.5 w-6 rounded-full bg-[#f2b880]" />
                )}
                {item.badge > 0 && (
                  <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-[#f2b880] px-1 text-[10px] font-bold text-zinc-950">
                    {item.badge > 99 ? '99+' : item.badge}
                  </span>
                )}
              </button>
            )
          })}
        </div>
      </nav>

      {/* Note Viewer/Editor Modal */}
      {openNotePath && (
        <NoteModal
          notePath={openNotePath}
          allNotes={notesData}
          onClose={() => setOpenNotePath(null)}
          onOpenNote={(p) => setOpenNotePath(p)}
          onOpenWikiLink={handleOpenWikiLink}
          onSaved={fetchAll}
        />
      )}

      {/* New Note Modal (Wide & Comfortable) */}
      {newNoteModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4 backdrop-blur-md">
          <form
            onSubmit={handleCreateNote}
            className="animate-modal-pop flex max-h-[90vh] w-full max-w-4xl flex-col rounded-2xl border border-white/10 bg-[#0d1214]/95 p-6 shadow-2xl space-y-4"
          >
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-bold text-white flex items-center gap-2">
                <Sparkles className="h-4 w-4 text-[#f2b880]" />
                Nueva nota en myVault
              </h2>
            </div>
            <div className="grid gap-3 sm:grid-cols-3">
              <div>
                <label className="block text-xs text-zinc-400 mb-1">Carpeta</label>
                <input
                  type="text"
                  list="note-folders-list"
                  value={newNoteFolder}
                  onChange={(e) => setNewNoteFolder(e.target.value)}
                  className="w-full rounded-xl border border-white/10 bg-zinc-900 px-3 py-2 text-sm text-white focus:border-[#f2b880]/50 focus:outline-none"
                />
                <datalist id="note-folders-list">
                  {[
                    'Proyectos',
                    'Trabajo',
                    'Conocimiento',
                    'Reflexiones',
                    'Finanzas',
                    'Hobbies e intereses',
                    'Salud/Entrenamiento',
                    'Salud/Salud y estado',
                    'Salud/Artículos y estudios',
                    'Ideas',
                    'Temporal',
                    'Notas',
                    'Raíz',
                  ].map((f) => (
                    <option key={f} value={f} />
                  ))}
                </datalist>
              </div>
              <div className="sm:col-span-2">
                <label className="block text-xs text-zinc-400 mb-1">Nombre de la nota</label>
                <input
                  type="text"
                  value={newNoteName}
                  onChange={(e) => setNewNoteName(e.target.value)}
                  placeholder="Mi nueva idea"
                  autoFocus
                  className="w-full rounded-xl border border-white/10 bg-black/40 px-3 py-2 text-sm text-white focus:border-[#f2b880]/50 focus:outline-none"
                  required
                />
              </div>
            </div>
            <div className="flex-1">
              <label className="block text-xs text-zinc-400 mb-1">Contenido (Markdown)</label>
              <MarkdownEditor
                value={newNoteContent}
                onChange={setNewNoteContent}
                allNotes={notesData}
                heightClass="h-[52vh]"
              />
            </div>
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setNewNoteModal(false)}
                className="rounded-xl border border-white/10 px-4 py-2 text-xs text-zinc-300 hover:bg-white/5 cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="submit"
                className="rounded-xl bg-[#f2b880] px-5 py-2 text-xs font-bold text-zinc-950 hover:bg-[#f5c496] cursor-pointer"
              >
                Crear nota
              </button>
            </div>
          </form>
        </div>
      )}

      {/* New Area Modal */}
      {newAreaModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4 backdrop-blur-md">
          <form
            onSubmit={handleCreateArea}
            className="animate-modal-pop w-full max-w-lg rounded-2xl border border-white/10 bg-[#0d1214]/95 p-6 shadow-2xl space-y-4"
          >
            <h2 className="text-lg font-bold text-white flex items-center gap-2">
              <LayoutGrid className="h-4 w-4 text-[#f2b880]" />
              Crear nueva Área (MOC)
            </h2>
            <div>
              <label className="block text-xs text-zinc-400 mb-1">Nombre del Área</label>
              <input
                type="text"
                value={newAreaName}
                onChange={(e) => setNewAreaName(e.target.value)}
                placeholder="Ej. Negocios, Viajes, Idiomas..."
                autoFocus
                required
                className="w-full rounded-xl border border-white/10 bg-black/40 px-3 py-2 text-sm text-white focus:border-[#f2b880]/50 focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-xs text-zinc-400 mb-1">Descripción corta</label>
              <input
                type="text"
                value={newAreaSubtitle}
                onChange={(e) => setNewAreaSubtitle(e.target.value)}
                placeholder="¿Qué engloba esta área?"
                className="w-full rounded-xl border border-white/10 bg-black/40 px-3 py-2 text-sm text-white focus:border-[#f2b880]/50 focus:outline-none"
              />
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <label className="block text-xs text-zinc-400 mb-1">Estilo visual base</label>
                <select
                  value={newAreaStyle}
                  onChange={(e) => setNewAreaStyle(e.target.value)}
                  className="w-full rounded-xl border border-white/10 bg-zinc-900 px-3 py-2 text-xs text-white"
                >
                  <option value="forest">Bosque Místico</option>
                  <option value="koi">Estanque Koi</option>
                  <option value="studio">Estudio Cálido</option>
                  <option value="night">Noche</option>
                  <option value="meadow">Pradera</option>
                </select>
              </div>
              <div>
                <label className="block text-xs text-zinc-400 mb-1">Imagen de portada (opcional)</label>
                <input
                  type="file"
                  accept="image/*"
                  onChange={(e) => setNewAreaCover(e.target.files?.[0] || null)}
                  className="w-full text-xs text-zinc-300 file:mr-2 file:rounded-lg file:border-0 file:bg-white/10 file:px-2.5 file:py-1.5 file:text-xs file:text-white"
                />
              </div>
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setNewAreaModal(false)}
                className="rounded-xl border border-white/10 px-4 py-2 text-xs text-zinc-300 hover:bg-white/5 cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="submit"
                className="rounded-xl bg-[#f2b880] px-5 py-2 text-xs font-bold text-zinc-950 hover:bg-[#f5c496] cursor-pointer"
              >
                Crear Área
              </button>
            </div>
          </form>
        </div>
      )}
      {/* Cover Adjust Modal */}
      {coverModalArea && (
        <CoverAdjustModal
          areaName={coverModalArea.name}
          initialCoverUrl={coverModalArea.cover_url}
          initialPosX={coverModalArea.cover_pos_x ?? 50}
          initialPosY={coverModalArea.cover_pos_y ?? 50}
          initialZoom={coverModalArea.cover_zoom ?? 100}
          imageStyle={coverModalArea.image_style || 'forest'}
          onClose={() => setCoverModalArea(null)}
          onSaved={async () => {
            await fetchAll()
            if (selectedArea) await openArea(selectedArea)
          }}
        />
      )}

      {/* Shortcuts Help Modal */}
      {showShortcuts && (
        <div
          onClick={() => setShowShortcuts(false)}
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4 backdrop-blur-md"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="animate-modal-pop w-full max-w-md rounded-2xl border border-white/10 bg-[#0d1214]/95 p-6 shadow-2xl space-y-4"
          >
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-bold text-white flex items-center gap-2">
                <Keyboard className="h-4 w-4 text-[#f2b880]" />
                Atajos de teclado
              </h2>
              <button
                onClick={() => setShowShortcuts(false)}
                className="text-xs text-zinc-400 hover:text-white cursor-pointer"
              >
                Esc
              </button>
            </div>
            <div className="space-y-2 text-xs">
              {[
                ['← / → / ↑ / ↓', 'Moverse entre tarjetas y elementos en cualquier menú'],
                ['Enter', 'Abrir el elemento o Área seleccionada'],
                ['Shift + ← / →', 'Cambiar entre menús del dock'],
                ['1 – 7', 'Ir directo a Inicio, Tareas, Proyectos, Áreas, Notas, La IA o Decidir'],
                ['Ctrl + S', 'Sincronizar con GitHub (Sync Git)'],
                ['Ctrl + K', 'Ir al buscador de Notas'],
                ['Alt + N', 'Crear nueva nota'],
                ['Alt + J', 'Abrir Diario de hoy'],
                ['Esc', 'Cerrar ventana o modal actual'],
              ].map(([keys, desc]) => (
                <div key={keys} className="flex items-center justify-between gap-3 rounded-xl border border-white/[0.06] bg-white/[0.02] px-3 py-2">
                  <span className="text-zinc-300">{desc}</span>
                  <kbd className="shrink-0 rounded-lg border border-white/15 bg-black/50 px-2 py-0.5 font-mono text-[11px] font-semibold text-[#f2b880]">
                    {keys}
                  </kbd>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
