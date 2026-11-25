import React, { useEffect, useMemo, useRef, useState } from 'react'
import { CheckSquare, Code2, Heading2, Link2, Minus, Table2 } from 'lucide-react'

const SLASH_COMMANDS = [
  {
    id: 'tabla',
    cmd: '/tabla',
    label: 'Tabla',
    desc: 'Insertar tabla Markdown',
    icon: Table2,
    snippet: '| Columna 1 | Columna 2 | Columna 3 |\n| --- | --- | --- |\n| Dato 1 | Dato 2 | Dato 3 |\n',
  },
  {
    id: 'codigo',
    cmd: '/codigo',
    label: 'Bloque de código',
    desc: 'Insertar bloque ```',
    icon: Code2,
    snippet: '```\n\n```\n',
    cursorOffset: 4,
  },
  {
    id: 'check',
    cmd: '/check',
    label: 'Lista de tareas',
    desc: 'Insertar checkbox - [ ]',
    icon: CheckSquare,
    snippet: '- [ ] ',
  },
  {
    id: 'enlace',
    cmd: '/enlace',
    label: 'Enlace interno [[...]]',
    desc: 'Enlazar otra nota del vault',
    icon: Link2,
    snippet: '[[',
    triggersWiki: true,
  },
  {
    id: 'titulo',
    cmd: '/titulo',
    label: 'Subtítulo',
    desc: 'Insertar encabezado ##',
    icon: Heading2,
    snippet: '## ',
  },
  {
    id: 'divisor',
    cmd: '/divisor',
    label: 'Separador',
    desc: 'Insertar línea ---',
    icon: Minus,
    snippet: '\n---\n',
  },
]

export function MarkdownEditor({
  value,
  onChange,
  allNotes = [],
  placeholder = 'Escribe en Markdown... (usa / para comandos o [[ para enlazar notas)',
  heightClass = 'h-[52vh]',
}) {
  const textareaRef = useRef(null)
  const [menuMode, setMenuMode] = useState(null) // null | 'slash' | 'wiki'
  const [query, setQuery] = useState('')
  const [triggerStart, setTriggerStart] = useState(0)
  const [activeIdx, setActiveIdx] = useState(0)

  const filteredItems = useMemo(() => {
    const q = query.toLowerCase()
    if (menuMode === 'slash') {
      return SLASH_COMMANDS.filter(
        (c) => c.cmd.includes('/' + q) || c.label.toLowerCase().includes(q)
      )
    }
    if (menuMode === 'wiki') {
      return allNotes
        .filter((n) => !q || n.name.toLowerCase().includes(q) || n.title.toLowerCase().includes(q))
        .slice(0, 12)
    }
    return []
  }, [menuMode, query, allNotes])

  useEffect(() => {
    setActiveIdx(0)
  }, [menuMode, query])

  const detectTrigger = (text, cursorPos) => {
    const before = text.slice(0, cursorPos)

    // Check for [[wikilink autocomplete first
    const lastWiki = before.lastIndexOf('[[')
    if (lastWiki !== -1) {
      const between = before.slice(lastWiki + 2)
      if (!between.includes(']]') && !between.includes('\n')) {
        setMenuMode('wiki')
        setTriggerStart(lastWiki)
        setQuery(between)
        return
      }
    }

    // Check for /slash command at start of line or after whitespace
    const slashMatch = before.match(/(?:^|\s)(\/[a-zA-Z0-9_-]*)$/)
    if (slashMatch) {
      const token = slashMatch[1]
      setMenuMode('slash')
      setTriggerStart(cursorPos - token.length)
      setQuery(token.slice(1))
      return
    }

    setMenuMode(null)
  }

  const handleChange = (e) => {
    const nextVal = e.target.value
    const cursorPos = e.target.selectionStart
    onChange(nextVal)
    detectTrigger(nextVal, cursorPos)
  }

  const applySelection = (item) => {
    const el = textareaRef.current
    if (!el) return
    const cursorPos = el.selectionStart
    const before = value.slice(0, triggerStart)
    const after = value.slice(cursorPos)

    if (menuMode === 'slash') {
      const inserted = item.snippet
      const nextText = before + inserted + after
      onChange(nextText)
      const nextCursor =
        item.cursorOffset !== undefined
          ? before.length + item.cursorOffset
          : before.length + inserted.length

      requestAnimationFrame(() => {
        el.focus()
        el.setSelectionRange(nextCursor, nextCursor)
        if (item.triggersWiki) {
          setMenuMode('wiki')
          setTriggerStart(before.length)
          setQuery('')
        } else {
          setMenuMode(null)
        }
      })
      return
    }

    if (menuMode === 'wiki') {
      const inserted = `[[${item.name}]]`
      const nextText = before + inserted + after
      onChange(nextText)
      const nextCursor = before.length + inserted.length
      setMenuMode(null)
      requestAnimationFrame(() => {
        el.focus()
        el.setSelectionRange(nextCursor, nextCursor)
      })
    }
  }

  const handleKeyDown = (e) => {
    if (!menuMode || filteredItems.length === 0) return

    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setActiveIdx((i) => (i + 1) % filteredItems.length)
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setActiveIdx((i) => (i - 1 + filteredItems.length) % filteredItems.length)
    } else if (e.key === 'Enter' || e.key === 'Tab') {
      e.preventDefault()
      applySelection(filteredItems[activeIdx])
    } else if (e.key === 'Escape') {
      e.preventDefault()
      setMenuMode(null)
    }
  }

  return (
    <div className="relative">
      <textarea
        ref={textareaRef}
        value={value}
        onChange={handleChange}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        className={`mono ${heightClass} w-full resize-none rounded-xl border border-white/10 bg-black/40 p-4 text-sm leading-relaxed text-zinc-100 focus:border-[#f2b880]/50 focus:outline-none`}
      />

      {/* Predictive Popup */}
      {menuMode && filteredItems.length > 0 && (
        <div className="absolute bottom-3 left-3 z-30 w-80 max-w-[90%] overflow-hidden rounded-2xl border border-white/15 bg-[#0e1417]/95 shadow-2xl backdrop-blur-xl">
          <div className="border-b border-white/10 px-3 py-1.5 text-[10px] font-semibold uppercase tracking-wider text-zinc-400">
            {menuMode === 'slash' ? 'Comandos (/)' : 'Enlazar nota ([[...]])'}
          </div>
          <div className="max-h-56 overflow-y-auto p-1.5 space-y-0.5">
            {menuMode === 'slash'
              ? filteredItems.map((cmd, idx) => {
                  const Icon = cmd.icon
                  return (
                    <button
                      key={cmd.id}
                      type="button"
                      onMouseDown={(e) => {
                        e.preventDefault()
                        applySelection(cmd)
                      }}
                      className={`flex w-full items-center gap-2.5 rounded-xl px-2.5 py-2 text-left text-xs transition-colors cursor-pointer ${
                        idx === activeIdx
                          ? 'bg-[#f2b880]/20 text-white'
                          : 'text-zinc-300 hover:bg-white/5'
                      }`}
                    >
                      <Icon className="h-4 w-4 shrink-0 text-[#f2b880]" />
                      <div className="min-w-0 flex-1">
                        <div className="font-semibold flex items-center gap-2">
                          <span>{cmd.label}</span>
                          <span className="font-mono text-[10px] text-[#f2b880]">{cmd.cmd}</span>
                        </div>
                        <div className="text-[10px] text-zinc-400 truncate">{cmd.desc}</div>
                      </div>
                    </button>
                  )
                })
              : filteredItems.map((note, idx) => (
                  <button
                    key={note.path}
                    type="button"
                    onMouseDown={(e) => {
                      e.preventDefault()
                      applySelection(note)
                    }}
                    className={`flex w-full items-center justify-between gap-2 rounded-xl px-2.5 py-2 text-left text-xs transition-colors cursor-pointer ${
                      idx === activeIdx
                        ? 'bg-[#f2b880]/20 text-white'
                        : 'text-zinc-300 hover:bg-white/5'
                    }`}
                  >
                    <span className="truncate font-medium">{note.name}</span>
                    <span className="shrink-0 rounded bg-white/10 px-1.5 py-0.5 text-[10px] text-zinc-400">
                      {note.folder}
                    </span>
                  </button>
                ))}
          </div>
        </div>
      )}
    </div>
  )
}
