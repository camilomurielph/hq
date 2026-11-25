import React, { useEffect, useState } from 'react'
import { X, Edit3, Eye, Save, ArrowUpRight, CheckSquare, Square, Link2, FileText, Trash2, ExternalLink, Copy, Check } from 'lucide-react'
import { MarkdownEditor } from './MarkdownEditor'

function CodeBlock({ lang, code }) {
  const [copied, setCopied] = useState(false)

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(code)
      setCopied(true)
      setTimeout(() => setCopied(false), 1800)
    } catch (e) {
      console.error(e)
    }
  }

  return (
    <div className="my-3 overflow-hidden rounded-xl border border-white/10 bg-black/55">
      <div className="flex items-center justify-between border-b border-white/[0.06] bg-white/[0.03] px-3.5 py-1.5">
        <span className="font-mono text-[11px] text-zinc-400">{lang || 'código'}</span>
        <button
          onClick={handleCopy}
          className="flex items-center gap-1 rounded-lg px-2 py-1 text-[11px] font-medium text-zinc-300 hover:bg-white/10 hover:text-white transition-colors cursor-pointer"
        >
          {copied ? (
            <>
              <Check className="h-3.5 w-3.5 text-emerald-400" />
              <span className="text-emerald-400">Copiado</span>
            </>
          ) : (
            <>
              <Copy className="h-3.5 w-3.5" />
              <span>Copiar</span>
            </>
          )}
        </button>
      </div>
      <pre className="overflow-x-auto p-3.5 font-mono text-xs leading-relaxed text-zinc-100">
        <code>{code}</code>
      </pre>
    </div>
  )
}

function renderInlineMarkdown(text, onOpenWikiLink) {
  // Match: <img ...>, ![alt](url), [label](url), [[wikilink]], **bold**, `code`, bare https://... URLs, and #tag
  const tokenRegex = /(<img\s+[^>]*>|!\[[^\]]*\]\(https?:\/\/[^)\s]+\)|\[[^\]]+\]\(https?:\/\/[^)\s]+\)|\[\[[^\]]+\]\]|\*\*[^*]+\*\*|`[^`]+`|https?:\/\/[^\s<>()]+|#[a-zA-ZÀ-ÿ0-9_-]+)/g
  const parts = text.split(tokenRegex)

  return parts.map((part, idx) => {
    if (!part) return null

    // HTML <img ...> tag
    if (part.toLowerCase().startsWith('<img')) {
      const srcMatch = part.match(/src=["']([^"']+)["']/i)
      const widthMatch = part.match(/width=["']?(\d+)["']?/i)
      let src = srcMatch ? srcMatch[1] : ''
      const mdInside = src.match(/^\[([^\]]+)\]\((https?:\/\/[^)]+)\)$/)
      if (mdInside) src = mdInside[2]
      if (!src) return null
      const maxW = widthMatch ? `${Math.min(320, Number(widthMatch[1]))}px` : '200px'
      return (
        <img
          key={idx}
          src={src}
          alt=""
          loading="lazy"
          style={{ maxWidth: maxW }}
          className="my-1 rounded-xl border border-white/10 object-cover"
        />
      )
    }

    // Markdown image ![alt](url)
    const mdImgMatch = part.match(/^!\[([^\]]*)\]\((https?:\/\/[^)\s]+)\)$/)
    if (mdImgMatch) {
      return (
        <img
          key={idx}
          src={mdImgMatch[2]}
          alt={mdImgMatch[1]}
          loading="lazy"
          className="my-1 max-w-[220px] rounded-xl border border-white/10 object-cover"
        />
      )
    }

    // Markdown external link: [label](url)
    const mdLinkMatch = part.match(/^\[([^\]]+)\]\((https?:\/\/[^)\s]+)\)$/)
    if (mdLinkMatch) {
      return (
        <a
          key={idx}
          href={mdLinkMatch[2]}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1 text-sky-400 hover:text-sky-300 hover:underline font-medium"
        >
          <span>{mdLinkMatch[1]}</span>
          <ExternalLink className="h-3 w-3 opacity-70" />
        </a>
      )
    }

    // Bare URL
    if (/^https?:\/\/[^\s<>()]+$/.test(part)) {
      return (
        <a
          key={idx}
          href={part}
          target="_blank"
          rel="noopener noreferrer"
          className="text-sky-400 hover:text-sky-300 hover:underline break-all"
        >
          {part}
        </a>
      )
    }

    // Obsidian [[wikilink]]
    if (part.startsWith('[[') && part.endsWith(']]')) {
      const inner = part.slice(2, -2)
      const [target, alias] = inner.split('|')
      const label = (alias || target).trim()
      return (
        <button
          key={idx}
          onClick={() => onOpenWikiLink(target.trim())}
          className="inline-flex items-center gap-0.5 rounded bg-[#f2b880]/15 px-1.5 py-0.5 text-[#f2b880] hover:bg-[#f2b880]/25 transition-colors cursor-pointer font-medium"
        >
          <span>{label}</span>
          <ArrowUpRight className="h-3 w-3 opacity-75" />
        </button>
      )
    }

    if (part.startsWith('**') && part.endsWith('**')) {
      return <strong key={idx} className="font-semibold text-white">{part.slice(2, -2)}</strong>
    }
    if (part.startsWith('`') && part.endsWith('`')) {
      return (
        <code key={idx} className="rounded bg-white/10 px-1.5 py-0.5 text-xs text-emerald-300 font-mono">
          {part.slice(1, -1)}
        </code>
      )
    }
    if (part.startsWith('#') && part.length > 1) {
      return (
        <span key={idx} className="inline-block rounded-full bg-white/10 px-2 py-0.5 text-xs text-cyan-300">
          {part}
        </span>
      )
    }
    return <React.Fragment key={idx}>{part}</React.Fragment>
  })
}

export function NoteModal({
  notePath,
  allNotes = [],
  onClose,
  onOpenNote,
  onOpenWikiLink,
  onSaved,
}) {
  const [note, setNote] = useState(null)
  const [content, setContent] = useState('')
  const [editPath, setEditPath] = useState('')
  const [editing, setEditing] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [error, setError] = useState(null)

  const loadNote = async (path) => {
    setLoading(true)
    setError(null)
    setConfirmDelete(false)
    try {
      const encoded = path.split('/').map(encodeURIComponent).join('/')
      const res = await fetch(`/api/notes/${encoded}`)
      if (!res.ok) throw new Error('No se pudo cargar la nota')
      const data = await res.json()
      setNote(data)
      setContent(data.content)
      setEditPath(data.path)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (notePath) {
      setEditing(false)
      loadNote(notePath)
    }
  }, [notePath])

  const handleSave = async () => {
    setSaving(true)
    setError(null)
    try {
      let activePath = notePath
      const cleanEditPath = editPath.trim().replace(/\\/g, '/').replace(/^\/+/, '')
      if (cleanEditPath && cleanEditPath !== notePath) {
        const moveRes = await fetch('/api/notes/move', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ old_path: notePath, new_path: cleanEditPath }),
        })
        if (!moveRes.ok) {
          const md = await moveRes.json().catch(() => ({}))
          throw new Error(md.detail || 'No se pudo mover la nota')
        }
        const moveData = await moveRes.json()
        activePath = moveData.path
      }

      const encoded = activePath.split('/').map(encodeURIComponent).join('/')
      const res = await fetch(`/api/notes/${encoded}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content }),
      })
      if (!res.ok) throw new Error('Error al guardar')
      if (activePath !== notePath) {
        onOpenNote(activePath)
      } else {
        await loadNote(activePath)
      }
      setEditing(false)
      onSaved?.()
    } catch (err) {
      setError(err.message)
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async () => {
    setDeleting(true)
    try {
      const encoded = notePath.split('/').map(encodeURIComponent).join('/')
      const res = await fetch(`/api/notes/${encoded}`, { method: 'DELETE' })
      if (!res.ok) throw new Error('No se pudo eliminar la nota')
      onSaved?.()
      onClose()
    } catch (err) {
      setError(err.message)
      setDeleting(false)
    }
  }

  const handleToggleCheckbox = async (lineNumber) => {
    try {
      const res = await fetch('/api/tasks/toggle', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ file_path: notePath, line: lineNumber }),
      })
      if (res.ok) {
        await loadNote(notePath)
        onSaved?.()
      }
    } catch (e) {
      console.error(e)
    }
  }

  if (!notePath) return null

  const parseTableRow = (rowLine) => {
    const trimmed = rowLine.trim().replace(/^\|/, '').replace(/\|$/, '')
    return trimmed.split('|').map((c) => c.trim())
  }
  const isTableSep = (rowLine) => {
    const t = rowLine.trim()
    return t.startsWith('|') && /^\|[\s:-]+(\|[\s:-]+)*\|?$/.test(t)
  }

  const lines = content.split('\n')
  const blocks = []
  let inCode = false
  let codeLang = ''
  let codeLines = []

  for (let idx = 0; idx < lines.length; idx++) {
    const line = lines[idx]
    const trimmed = line.trim()
    if (trimmed.startsWith('```')) {
      if (!inCode) {
        inCode = true
        codeLang = trimmed.slice(3).trim()
        codeLines = []
      } else {
        blocks.push({ type: 'code', lang: codeLang, code: codeLines.join('\n'), key: `code-${idx}` })
        inCode = false
        codeLang = ''
        codeLines = []
      }
      continue
    }
    if (inCode) {
      codeLines.push(line)
      continue
    }
    // Check Markdown table: current line starts with | and next line is separator | --- |
    if (trimmed.startsWith('|') && idx + 1 < lines.length && isTableSep(lines[idx + 1])) {
      const headers = parseTableRow(line)
      const rows = []
      let j = idx + 2
      while (j < lines.length && lines[j].trim().startsWith('|')) {
        rows.push(parseTableRow(lines[j]))
        j++
      }
      blocks.push({ type: 'table', headers, rows, key: `table-${idx}` })
      idx = j - 1
      continue
    }
    blocks.push({ type: 'line', line, lineNum: idx + 1, key: `line-${idx}` })
  }
  if (inCode) {
    blocks.push({ type: 'code', lang: codeLang, code: codeLines.join('\n'), key: 'code-unclosed' })
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4 backdrop-blur-md">
      <div className="animate-modal-pop relative flex max-h-[88vh] w-full max-w-4xl flex-col overflow-hidden rounded-2xl border border-white/10 bg-[#0d1214]/95 shadow-2xl">
        {/* Header */}
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-white/10 px-6 py-4">
          <div className="flex items-center gap-3 min-w-0">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[#f2b880]/15 text-[#f2b880]">
              <FileText className="h-4 w-4" />
            </div>
            <div className="min-w-0">
              <h2 className="truncate text-lg font-semibold text-white">
                {note?.meta?.title || notePath.split('/').pop()?.replace('.md', '')}
              </h2>
              <p className="truncate text-xs text-zinc-400">{notePath}</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {confirmDelete ? (
              <div className="flex items-center gap-1.5 rounded-xl border border-rose-500/30 bg-rose-500/10 px-2.5 py-1">
                <span className="text-xs text-rose-200">¿Eliminar?</span>
                <button
                  onClick={() => setConfirmDelete(false)}
                  className="rounded-lg px-2 py-0.5 text-xs text-zinc-300 hover:bg-white/10 cursor-pointer"
                >
                  No
                </button>
                <button
                  onClick={handleDelete}
                  disabled={deleting}
                  className="rounded-lg bg-rose-500 px-2.5 py-0.5 text-xs font-semibold text-white hover:bg-rose-400 disabled:opacity-50 cursor-pointer"
                >
                  {deleting ? '...' : 'Sí, borrar'}
                </button>
              </div>
            ) : (
              <button
                onClick={() => setConfirmDelete(true)}
                title="Eliminar nota"
                className="flex items-center gap-1 rounded-xl border border-white/10 bg-white/5 px-2.5 py-1.5 text-xs text-zinc-400 hover:border-rose-500/40 hover:text-rose-300 cursor-pointer"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            )}

            {editing ? (
              <>
                <button
                  onClick={() => setEditing(false)}
                  className="flex items-center gap-1.5 rounded-xl border border-white/10 bg-white/5 px-3 py-1.5 text-xs font-medium text-zinc-300 hover:bg-white/10 cursor-pointer"
                >
                  <Eye className="h-3.5 w-3.5" />
                  Vista previa
                </button>
                <button
                  onClick={handleSave}
                  disabled={saving}
                  className="flex items-center gap-1.5 rounded-xl bg-[#f2b880] px-3.5 py-1.5 text-xs font-semibold text-zinc-950 hover:bg-[#f5c496] disabled:opacity-50 cursor-pointer"
                >
                  <Save className="h-3.5 w-3.5" />
                  {saving ? 'Guardando...' : 'Guardar'}
                </button>
              </>
            ) : (
              <button
                onClick={() => setEditing(true)}
                className="flex items-center gap-1.5 rounded-xl border border-white/10 bg-white/5 px-3.5 py-1.5 text-xs font-medium text-zinc-200 hover:bg-white/10 cursor-pointer"
              >
                <Edit3 className="h-3.5 w-3.5" />
                Editar
              </button>
            )}
            <button
              onClick={onClose}
              className="rounded-xl p-2 text-zinc-400 hover:bg-white/10 hover:text-white cursor-pointer"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-6 py-5">
          {loading ? (
            <div className="py-12 text-center text-sm text-zinc-400">Cargando nota...</div>
          ) : error ? (
            <div className="rounded-xl border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-300">
              {error}
            </div>
          ) : editing ? (
            <div className="space-y-3">
              <div>
                <label className="block text-[11px] font-medium text-zinc-400 mb-1">
                  Carpeta / Ruta en myVault (edita para mover o renombrar)
                </label>
                <input
                  type="text"
                  value={editPath}
                  onChange={(e) => setEditPath(e.target.value)}
                  className="mono w-full rounded-xl border border-white/10 bg-black/40 px-3 py-2 text-xs text-[#f2b880] focus:border-[#f2b880]/50 focus:outline-none"
                />
              </div>
              <MarkdownEditor
                value={content}
                onChange={setContent}
                allNotes={allNotes}
                heightClass="h-[52vh]"
              />
            </div>
          ) : (
            <div className="space-y-2 text-sm leading-relaxed text-zinc-300">
              {blocks.map((block) => {
                if (block.type === 'code') {
                  return <CodeBlock key={block.key} lang={block.lang} code={block.code} />
                }
                if (block.type === 'table') {
                  return (
                    <div key={block.key} className="my-4 overflow-x-auto rounded-2xl border border-white/10 bg-black/30">
                      <table className="w-full text-left text-xs">
                        <thead className="border-b border-white/10 bg-white/[0.04] text-zinc-200">
                          <tr>
                            {block.headers.map((h, hi) => (
                              <th key={hi} className="px-4 py-3 font-semibold whitespace-nowrap">
                                {renderInlineMarkdown(h, onOpenWikiLink)}
                              </th>
                            ))}
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-white/[0.06]">
                          {block.rows.map((row, ri) => (
                            <tr key={ri} className="hover:bg-white/[0.03] transition-colors">
                              {block.headers.map((_, ci) => (
                                <td key={ci} className="px-4 py-3 align-middle text-zinc-300">
                                  {renderInlineMarkdown(row[ci] || '', onOpenWikiLink)}
                                </td>
                              ))}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )
                }
                const { line, lineNum, key: idx } = block
                const trimmed = line.trim()

                if (trimmed === '---') {
                  return <hr key={idx} className="my-4 border-white/10" />
                }
                if (trimmed.startsWith('### ')) {
                  return (
                    <h3 key={idx} className="pt-3 text-base font-semibold text-zinc-100">
                      {renderInlineMarkdown(trimmed.slice(4), onOpenWikiLink)}
                    </h3>
                  )
                }
                if (trimmed.startsWith('## ')) {
                  return (
                    <h2 key={idx} className="pt-4 text-lg font-bold text-white">
                      {renderInlineMarkdown(trimmed.slice(3), onOpenWikiLink)}
                    </h2>
                  )
                }
                if (trimmed.startsWith('# ')) {
                  return (
                    <h1 key={idx} className="pt-2 text-2xl font-bold text-white">
                      {renderInlineMarkdown(trimmed.slice(2), onOpenWikiLink)}
                    </h1>
                  )
                }
                const taskMatch = line.match(/^\s*[-*]\s+\[([ xX])\]\s+(.*)$/)
                if (taskMatch) {
                  const done = taskMatch[1].toLowerCase() === 'x'
                  return (
                    <div
                      key={idx}
                      onClick={() => handleToggleCheckbox(lineNum)}
                      className="flex items-start gap-2.5 rounded-lg px-2 py-1 hover:bg-white/5 cursor-pointer"
                    >
                      {done ? (
                        <CheckSquare className="mt-0.5 h-4 w-4 shrink-0 text-[#f2b880]" />
                      ) : (
                        <Square className="mt-0.5 h-4 w-4 shrink-0 text-zinc-500" />
                      )}
                      <span className={done ? 'line-through text-zinc-500' : 'text-zinc-200'}>
                        {renderInlineMarkdown(taskMatch[2], onOpenWikiLink)}
                      </span>
                    </div>
                  )
                }
                if (trimmed.startsWith('- ') || trimmed.startsWith('* ')) {
                  return (
                    <div key={idx} className="flex items-start gap-2 pl-2">
                      <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-[#f2b880]/70" />
                      <div>{renderInlineMarkdown(trimmed.slice(2), onOpenWikiLink)}</div>
                    </div>
                  )
                }
                if (!trimmed) {
                  return <div key={idx} className="h-2" />
                }
                return <p key={idx}>{renderInlineMarkdown(line, onOpenWikiLink)}</p>
              })}
            </div>
          )}
        </div>

        {/* Backlinks Footer */}
        {note?.backlink_notes?.length > 0 && (
          <div className="border-t border-white/10 bg-white/[0.02] px-6 py-3">
            <div className="flex flex-wrap items-center gap-2 text-xs">
              <span className="flex items-center gap-1 text-zinc-400">
                <Link2 className="h-3.5 w-3.5" />
                Backlinks ({note.backlink_notes.length}):
              </span>
              {note.backlink_notes.map((bl) => (
                <button
                  key={bl.path}
                  onClick={() => onOpenNote(bl.path)}
                  className="rounded-lg border border-white/10 bg-white/5 px-2.5 py-1 text-zinc-200 hover:border-[#f2b880]/40 hover:text-[#f2b880] cursor-pointer"
                >
                  {bl.title}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
