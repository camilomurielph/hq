"""Analiza estadísticas generales del vault de Obsidian (notas, palabras y tareas)."""

import os
import re
from collections import Counter
from pathlib import Path

VAULT = Path(os.environ.get("OBSIDIAN_VAULT_PATH", r"C:\Obsidian\myVault"))
IGNORED = {".git", ".obsidian", ".trash"}
TASK_RE = re.compile(r"^\s*[-*]\s+\[([ xX])\]\s+", re.MULTILINE)


def main():
    folders = Counter()
    total_words = 0
    pending = 0
    done = 0

    for root, dirs, files in os.walk(VAULT):
        dirs[:] = [d for d in dirs if d not in IGNORED]
        for f in files:
            if not f.endswith(".md"):
                continue
            p = Path(root) / f
            rel = p.relative_to(VAULT)
            folder = rel.parts[0] if len(rel.parts) > 1 else "Raíz"
            folders[folder] += 1
            text = p.read_text(encoding="utf-8", errors="ignore")
            total_words += len(text.split())
            for m in TASK_RE.finditer(text):
                if m.group(1).lower() == "x":
                    done += 1
                else:
                    pending += 1

    print(f"📊 Resumen de {VAULT.name}")
    print(f"Total de notas: {sum(folders.values())}")
    print(f"Total de palabras: {total_words:,}")
    print(f"Tareas: {pending} pendientes / {done} completadas\n")
    print("Notas por carpeta:")
    for folder, count in folders.most_common():
        print(f"  - {folder}: {count}")


if __name__ == "__main__":
    main()
