"""Reorganiza myVault en la estructura de carpetas aprobada por el usuario."""

import os
import re
import shutil
from pathlib import Path

VAULT = Path(os.environ.get("OBSIDIAN_VAULT_PATH", r"C:\Obsidian\myVault"))
LINK_RE = re.compile(r"\[\[([^\]|#]+)(?:#[^\]|]+)?(?:\|[^\]]+)?\]\]")


def get_links(md_path: Path) -> list[str]:
    if not md_path.exists():
        return []
    txt = md_path.read_text(encoding="utf-8", errors="ignore")
    return [Path(m.group(1).strip()).name for m in LINK_RE.finditer(txt)]


def move_note(src: Path, dest_dir: Path) -> bool:
    if not src.exists() or not src.is_file():
        return False
    dest_dir.mkdir(parents=True, exist_ok=True)
    dest = dest_dir / src.name
    if dest.exists():
        return False
    shutil.move(str(src), str(dest))
    return True


def main():
    notas_dir = VAULT / "Notas"
    moc_dir = VAULT / "MOC"
    moved = 0

    # Ensure all top-level directories exist
    top_dirs = [
        VAULT / "Proyectos",
        VAULT / "Finanzas",
        VAULT / "Personas",
        VAULT / "Trabajo",
        VAULT / "Reflexiones",
        VAULT / "Contenido" / "Lecturas",
        VAULT / "Contenido" / "Series y Películas",
        VAULT / "Salud",
        VAULT / "Hobbies e intereses",
        VAULT / "Conocimiento",
    ]
    for d in top_dirs:
        d.mkdir(parents=True, exist_ok=True)

    # Index notes currently in Notas/
    def find_in_notas(stem: str) -> Path | None:
        cand = notas_dir / f"{stem}.md"
        if cand.exists():
            return cand
        for p in notas_dir.glob("*.md"):
            if p.stem.lower() == stem.lower():
                return p
        return None

    # 1. Proyectos/ -> cada proyecto en su propia subcarpeta
    for proj_stem in get_links(moc_dir / "Proyectos.md"):
        proj_dir = VAULT / "Proyectos" / proj_stem
        proj_dir.mkdir(parents=True, exist_ok=True)
        src = find_in_notas(proj_stem)
        if src:
            child_links = get_links(src)
            if move_note(src, proj_dir):
                moved += 1
            for cl in child_links:
                csrc = find_in_notas(cl)
                if csrc and move_note(csrc, proj_dir):
                    moved += 1

    # Extra children for specific projects (e.g. Tipo * -> Dex Completa, Cuervo - * -> Cuervo)
    for p in list(notas_dir.glob("*.md")):
        low = p.stem.lower()
        if low.startswith("tipo "):
            if move_note(p, VAULT / "Proyectos" / "Dex Completa"):
                moved += 1
        elif low.startswith("cuervo"):
            if move_note(p, VAULT / "Proyectos" / "Cuervo"):
                moved += 1
        elif low.startswith("cap ") or low.startswith("capítulo "):
            if move_note(p, VAULT / "Proyectos" / "Escrituras sobre Kath - Historia juntos"):
                moved += 1

    # 2. Personas/ -> cada persona en su propia subcarpeta
    for person_stem in get_links(moc_dir / "Personas.md"):
        if person_stem.lower().startswith("nota "):
            continue
        p_dir = VAULT / "Personas" / person_stem
        p_dir.mkdir(parents=True, exist_ok=True)
        src = find_in_notas(person_stem)
        if src and move_note(src, p_dir):
            moved += 1

    # 3. Contenido/Lecturas y Contenido/Series y Películas
    for stem in get_links(moc_dir / "Lecturas.md"):
        src = find_in_notas(stem)
        if src and move_note(src, VAULT / "Contenido" / "Lecturas"):
            moved += 1

    for stem in get_links(moc_dir / "Series y Películas.md"):
        src = find_in_notas(stem)
        if src and move_note(src, VAULT / "Contenido" / "Series y Películas"):
            moved += 1

    # 4. Simple area folders
    area_map = {
        "Finanzas": VAULT / "Finanzas",
        "Trabajo": VAULT / "Trabajo",
        "Reflexiones": VAULT / "Reflexiones",
        "Salud": VAULT / "Salud",
        "Hobbies e intereses": VAULT / "Hobbies e intereses",
        "Conocimiento": VAULT / "Conocimiento",
    }
    for moc_name, dest in area_map.items():
        for stem in get_links(moc_dir / f"{moc_name}.md"):
            src = find_in_notas(stem)
            if src:
                children = get_links(src)
                if move_note(src, dest):
                    moved += 1
                for cl in children:
                    csrc = find_in_notas(cl)
                    if csrc and move_note(csrc, dest):
                        moved += 1

    # Extra keyword grouping for remaining Notas/
    for p in list(notas_dir.glob("*.md")):
        low = p.stem.lower()
        if low.startswith("deuda"):
            if move_note(p, VAULT / "Finanzas"):
                moved += 1
        elif "dumashe" in low:
            if move_note(p, VAULT / "Trabajo"):
                moved += 1

    print(f"Reorganización completada: {moved} notas movidas a la nueva estructura.")


if __name__ == "__main__":
    main()
