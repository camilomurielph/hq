"""Genera un resumen diario de tareas pendientes y últimas notas modificadas."""

import os
import re
from datetime import datetime
from pathlib import Path

VAULT = Path(os.environ.get("OBSIDIAN_VAULT_PATH", r"C:\Obsidian\myVault"))
IGNORED = {".git", ".obsidian", ".trash"}
TASK_RE = re.compile(r"^\s*[-*]\s+\[ \]\s+(.*)$", re.MULTILINE)


def main():
    pending = []
    recent = []

    for root, dirs, files in os.walk(VAULT):
        dirs[:] = [d for d in dirs if d not in IGNORED]
        for f in files:
            if not f.endswith(".md"):
                continue
            p = Path(root) / f
            rel = p.relative_to(VAULT).as_posix()
            mtime = p.stat().st_mtime
            recent.append((mtime, rel))
            text = p.read_text(encoding="utf-8", errors="ignore")
            for m in TASK_RE.finditer(text):
                pending.append((rel, m.group(1).strip()))

    recent.sort(reverse=True)
    print(f"⚡ Tareas pendientes encontradas ({len(pending)}):")
    for rel, task in pending[:15]:
        print(f"  - [ ] {task}  ({rel})")

    print("\n🕒 Últimas 10 notas modificadas:")
    for mtime, rel in recent[:10]:
        dt = datetime.fromtimestamp(mtime).strftime("%Y-%m-%d %H:%M")
        print(f"  - {dt} | {rel}")


if __name__ == "__main__":
    main()
