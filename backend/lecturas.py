from __future__ import annotations

import re
import secrets
import shutil
from pathlib import Path
from typing import Any, Optional

import yaml


def _split_fm(text: str) -> tuple[dict[str, Any], str]:
    if text.startswith("---\n") or text.startswith("---\r\n"):
        lines = text.splitlines(keepends=True)
        for idx in range(1, len(lines)):
            if lines[idx].strip() == "---":
                raw_yaml = "".join(lines[1:idx])
                body = "".join(lines[idx + 1 :])
                try:
                    data = yaml.safe_load(raw_yaml) or {}
                    if not isinstance(data, dict):
                        data = {}
                except Exception:
                    data = {}
                return data, body
    return {}, text


def _write_fm(path: Path, fm: dict[str, Any], body: str) -> None:
    yaml_str = yaml.safe_dump(fm, allow_unicode=True, sort_keys=False).strip()
    content = f"---\n{yaml_str}\n---\n{body.lstrip()}"
    path.write_text(content, encoding="utf-8")


def _safe_name(name: str) -> str:
    return re.sub(r'[\\/:*?"<>|]', "", name).strip()


def migrate_flat_lecturas(lecturas_dir: Path) -> None:
    """Moves legacy flat Contenido/Lecturas/<Name>.md into Contenido/Lecturas/<Name>/<Name>.md."""
    lecturas_dir.mkdir(parents=True, exist_ok=True)
    for p in list(lecturas_dir.glob("*.md")):
        col_dir = lecturas_dir / p.stem
        col_dir.mkdir(parents=True, exist_ok=True)
        dest = col_dir / p.name
        if not dest.exists():
            shutil.move(str(p), str(dest))


def _parse_item_file(p: Path) -> dict[str, Any]:
    raw = p.read_text(encoding="utf-8", errors="replace")
    fm, body = _split_fm(raw)
    try:
        orden = int(fm.get("orden", 999))
    except Exception:
        orden = 999
    try:
        prog = max(0, min(100, int(fm.get("progreso", 0))))
    except Exception:
        prog = 0
    try:
        score = float(fm.get("puntuacion", 0) or 0)
    except Exception:
        score = 0.0

    return {
        "file_name": p.name,
        "title": fm.get("titulo") or p.stem,
        "orden": orden,
        "progreso": prog,
        "puntuacion": score,
        "cover_url": fm.get("cover_url") or None,
        "comentario": fm.get("comentario") or "",
    }


def get_collection_detail(lecturas_dir: Path, vault_dir: Path, col_name: str) -> Optional[dict[str, Any]]:
    col_dir = lecturas_dir / col_name
    if not col_dir.exists() or not col_dir.is_dir():
        return None

    main_file = col_dir / f"{col_name}.md"
    if not main_file.exists():
        _write_fm(
            main_file,
            {"tipo": "Libro", "autor": "", "progreso": 0, "puntuacion": 0.0, "comentario": ""},
            f"\n# {col_name}\n\n",
        )

    raw = main_file.read_text(encoding="utf-8", errors="replace")
    fm, _ = _split_fm(raw)

    items = []
    for p in col_dir.glob("*.md"):
        if p.name == main_file.name:
            continue
        items.append(_parse_item_file(p))
    items.sort(key=lambda x: (x["orden"], x["file_name"].lower()))

    if items:
        calc_progress = round(sum(it["progreso"] for it in items) / len(items))
    else:
        try:
            calc_progress = max(0, min(100, int(fm.get("progreso", 0))))
        except Exception:
            calc_progress = 0

    try:
        score = float(fm.get("puntuacion", 0) or 0)
    except Exception:
        score = 0.0

    return {
        "name": col_name,
        "path": main_file.relative_to(vault_dir).as_posix(),
        "tipo": fm.get("tipo", "Libro"),
        "autor": fm.get("autor", ""),
        "cover_url": fm.get("cover_url") or None,
        "puntuacion": score,
        "comentario": fm.get("comentario") or "",
        "progreso": calc_progress,
        "items_count": len(items),
        "items": items,
    }


def list_collections(lecturas_dir: Path, vault_dir: Path) -> list[dict[str, Any]]:
    migrate_flat_lecturas(lecturas_dir)
    cols = []
    for d in sorted(lecturas_dir.iterdir(), key=lambda x: x.name.lower()):
        if not d.is_dir():
            continue
        detail = get_collection_detail(lecturas_dir, vault_dir, d.name)
        if detail:
            cols.append(detail)
    return cols


def create_collection(
    lecturas_dir: Path,
    title: str,
    tipo: str = "Libro",
    autor: str = "",
    puntuacion: float = 0.0,
    comentario: str = "",
) -> Path:
    clean = _safe_name(title)
    col_dir = lecturas_dir / clean
    col_dir.mkdir(parents=True, exist_ok=True)
    main_file = col_dir / f"{clean}.md"
    fm = {
        "tipo": tipo,
        "autor": autor.strip(),
        "progreso": 0,
        "puntuacion": max(0.0, min(5.0, round(puntuacion * 2) / 2)),
        "comentario": comentario.strip(),
    }
    _write_fm(main_file, fm, f"\n# {clean}\n\n")
    return main_file


def add_collection_item(
    lecturas_dir: Path,
    col_name: str,
    title: str,
    progreso: int = 0,
    puntuacion: float = 0.0,
    comentario: str = "",
    orden: Optional[int] = None,
) -> Path:
    col_dir = lecturas_dir / col_name
    existing = [p for p in col_dir.glob("*.md") if p.name != f"{col_name}.md"]
    next_order = orden if orden is not None else len(existing) + 1
    clean_title = _safe_name(title)
    fname = f"{next_order:02d} - {clean_title}.md"
    target = col_dir / fname
    fm = {
        "orden": next_order,
        "titulo": clean_title,
        "progreso": max(0, min(100, progreso)),
        "puntuacion": max(0.0, min(5.0, round(puntuacion * 2) / 2)),
        "comentario": comentario.strip(),
    }
    _write_fm(target, fm, f"\n# {clean_title}\n\n")
    return target


def batch_add_tomos(
    lecturas_dir: Path,
    col_name: str,
    total_count: int,
    completed_count: int = 0,
    prefix: str = "Tomo",
) -> int:
    col_dir = lecturas_dir / col_name
    existing = [p for p in col_dir.glob("*.md") if p.name != f"{col_name}.md"]
    start_idx = len(existing) + 1
    created = 0
    for i in range(total_count):
        num = start_idx + i
        prog = 100 if (i + 1) <= completed_count else 0
        title = f"{prefix} {num:02d}"
        add_collection_item(lecturas_dir, col_name, title=title, progreso=prog, orden=num)
        created += 1
    return created


def update_item_or_collection(
    md_path: Path,
    progreso: Optional[int] = None,
    puntuacion: Optional[float] = None,
    comentario: Optional[str] = None,
    cover_url: Optional[str] = None,
) -> None:
    raw = md_path.read_text(encoding="utf-8", errors="replace")
    fm, body = _split_fm(raw)
    if progreso is not None:
        fm["progreso"] = max(0, min(100, progreso))
    if puntuacion is not None:
        fm["puntuacion"] = max(0.0, min(5.0, round(puntuacion * 2) / 2))
    if comentario is not None:
        fm["comentario"] = comentario.strip()
    if cover_url is not None:
        fm["cover_url"] = cover_url
    _write_fm(md_path, fm, body)
