"""Detecta notas huérfanas (sin backlinks) y enlaces [[wikilinks]] sin archivo."""

import os
import re
from pathlib import Path

VAULT = Path(os.environ.get("OBSIDIAN_VAULT_PATH", r"C:\Obsidian\myVault"))
IGNORED = {".git", ".obsidian", ".trash"}
LINK_RE = re.compile(r"\[\[([^\]|#]+)(?:#[^\]|]+)?(?:\|[^\]]+)?\]\]")


def main():
    all_stems = set()
    notes = {}

    for root, dirs, files in os.walk(VAULT):
        dirs[:] = [d for d in dirs if d not in IGNORED]
        for f in files:
            if f.endswith(".md"):
                p = Path(root) / f
                rel = p.relative_to(VAULT).as_posix()
                all_stems.add(p.stem.lower())
                notes[rel] = p.read_text(encoding="utf-8", errors="ignore")

    referenced = set()
    missing = set()

    for rel, text in notes.items():
        for m in LINK_RE.finditer(text):
            target = Path(m.group(1).strip()).name.lower()
            referenced.add(target)
            if target not in all_stems:
                missing.add(m.group(1).strip())

    orphans = [
        rel for rel in sorted(notes)
        if Path(rel).stem.lower() not in referenced and not rel.startswith("Diario/")
    ]

    print(f"🔗 Enlaces [[...]] sin nota creada ({len(missing)}):")
    for item in sorted(missing)[:25]:
        print(f"  - [[{item}]]")

    print(f"\n🏝️ Notas sin enlaces entrantes ({len(orphans)}):")
    for item in orphans[:25]:
        print(f"  - {item}")


if __name__ == "__main__":
    main()
