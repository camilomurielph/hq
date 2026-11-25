from __future__ import annotations

import hashlib
import hmac
import json
import os
import re
import secrets
import subprocess
import sys
import threading
from datetime import date, datetime, timedelta
from pathlib import Path
from typing import Any, Optional

import yaml
from fastapi import FastAPI, File, Form, HTTPException, Query, Request, Response, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, JSONResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel

from git_sync import ensure_vault_repo, get_git_status, sync_vault
from lecturas import (
    add_collection_item,
    batch_add_tomos,
    create_collection,
    get_collection_detail,
    list_collections,
    update_item_or_collection,
)
from task_lists import (
    _new_id,
    get_all_lists,
    parse_list_file,
    write_list_file,
)

BASE_DIR = Path(__file__).resolve().parent.parent


def _load_dotenv(env_path: Path) -> None:
    if not env_path.exists():
        return
    for line in env_path.read_text(encoding="utf-8").splitlines():
        s = line.strip()
        if not s or s.startswith("#") or "=" not in s:
            continue
        k, v = s.split("=", 1)
        k = k.strip()
        v = v.strip().strip('"').strip("'")
        if k and k not in os.environ:
            os.environ[k] = v


_load_dotenv(BASE_DIR / ".env")

VAULT_DIR = Path(os.environ.get("OBSIDIAN_VAULT_PATH", r"C:\Obsidian\myVault")).resolve()
VAULT_REPO_URL = os.environ.get("VAULT_REPO_URL", "").strip()
GITHUB_TOKEN = os.environ.get("GITHUB_TOKEN", "").strip()
AUTO_GIT_SYNC = os.environ.get("AUTO_GIT_SYNC", "true").lower() in {"1", "true", "yes"}
HQ_PASSWORD = os.environ.get("HQ_PASSWORD", "")
HQ_SECRET_KEY = os.environ.get("HQ_SECRET_KEY") or secrets.token_hex(32)
SESSION_COOKIE = "hq_session"

SCRIPTS_DIR = BASE_DIR / "scripts"
DATA_DIR = BASE_DIR / "data"
ACTIVITY_LOG = DATA_DIR / "activity.jsonl"
FRONTEND_DIST = BASE_DIR / "frontend" / "dist"
HQ_META_DIR = VAULT_DIR / ".hq"
COVERS_DIR = HQ_META_DIR / "covers"
AREAS_META_FILE = HQ_META_DIR / "areas.json"
TAREAS_DIR = VAULT_DIR / "Tareas"

DATA_DIR.mkdir(parents=True, exist_ok=True)
SCRIPTS_DIR.mkdir(parents=True, exist_ok=True)

IGNORED_DIRS = {".git", ".obsidian", ".trash", ".hq", "node_modules", "__pycache__"}


def load_areas_meta() -> dict[str, Any]:
    if not AREAS_META_FILE.exists():
        return {}
    try:
        return json.loads(AREAS_META_FILE.read_text(encoding="utf-8"))
    except Exception:
        return {}


def save_areas_meta(data: dict[str, Any]) -> None:
    HQ_META_DIR.mkdir(parents=True, exist_ok=True)
    AREAS_META_FILE.write_text(json.dumps(data, ensure_ascii=False, indent=2), encoding="utf-8")

WIKILINK_RE = re.compile(r"\[\[([^\]|#]+)(?:#[^\]|]+)?(?:\|([^\]]+))?\]\]")
TAG_RE = re.compile(r"(?<!\w)#([a-zA-ZÀ-ÿ0-9_-]+)")
TASK_RE = re.compile(r"^(\s*[-*]\s+)\[([ xX])\]\s+(.*)$")
HEADING_RE = re.compile(r"^#\s+(.+)$", re.MULTILINE)

app = FastAPI(title="Obsidian HQ Backend", version="1.1.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


def _sign_token(payload: str) -> str:
    sig = hmac.new(HQ_SECRET_KEY.encode("utf-8"), payload.encode("utf-8"), hashlib.sha256).hexdigest()
    return f"{payload}.{sig}"


def _verify_token(token: Optional[str]) -> bool:
    if not HQ_PASSWORD:
        return True
    if not token or "." not in token:
        return False
    payload, sig = token.rsplit(".", 1)
    expected = hmac.new(HQ_SECRET_KEY.encode("utf-8"), payload.encode("utf-8"), hashlib.sha256).hexdigest()
    return hmac.compare_digest(sig, expected) and payload == "hq-authenticated"


@app.middleware("http")
async def auth_middleware(request: Request, call_next):
    path = request.url.path
    if HQ_PASSWORD and path.startswith("/api/") and not path.startswith("/api/auth/") and path != "/api/health":
        token = request.cookies.get(SESSION_COOKIE)
        if not _verify_token(token):
            return JSONResponse(status_code=401, content={"detail": "No autorizado"})
    return await call_next(request)


@app.on_event("startup")
def on_startup() -> None:
    if VAULT_REPO_URL or (VAULT_DIR / ".git").exists():
        res = ensure_vault_repo(VAULT_DIR, VAULT_REPO_URL, GITHUB_TOKEN)
        if not res.get("ok"):
            print(f"[HQ Git] {res.get('message')}")


def trigger_auto_sync(reason: str) -> None:
    if not AUTO_GIT_SYNC or not (VAULT_DIR / ".git").exists():
        return

    def _job():
        res = sync_vault(VAULT_DIR, VAULT_REPO_URL, GITHUB_TOKEN, commit_message=f"HQ: {reason}", push=bool(GITHUB_TOKEN or VAULT_REPO_URL))
        if not res.get("ok"):
            log_activity(
                actor="Git Sync",
                action_type="Error",
                section="General",
                message=res.get("message", "Error sincronizando con GitHub"),
                status="Error",
            )

    threading.Thread(target=_job, daemon=True).start()


def log_activity(
    actor: str,
    action_type: str,
    section: str,
    message: str,
    status: str = "Hecho",
    details: Optional[dict[str, Any]] = None,
) -> dict[str, Any]:
    entry = {
        "id": f"{datetime.now().timestamp():.6f}",
        "timestamp": datetime.now().isoformat(timespec="seconds"),
        "actor": actor,
        "type": action_type,
        "section": section,
        "message": message,
        "status": status,
        "details": details or {},
    }
    with ACTIVITY_LOG.open("a", encoding="utf-8") as f:
        f.write(json.dumps(entry, ensure_ascii=False) + "\n")
    return entry


def read_activity(limit: int = 100) -> list[dict[str, Any]]:
    if not ACTIVITY_LOG.exists():
        return []
    lines = ACTIVITY_LOG.read_text(encoding="utf-8").splitlines()
    items = []
    for line in reversed(lines[-limit:]):
        line = line.strip()
        if not line:
            continue
        try:
            items.append(json.loads(line))
        except json.JSONDecodeError:
            continue
    return items


def safe_vault_path(rel_path: str) -> Path:
    clean = rel_path.replace("\\", "/").lstrip("/")
    target = (VAULT_DIR / clean).resolve()
    if not str(target).startswith(str(VAULT_DIR)):
        raise HTTPException(status_code=400, detail="Ruta fuera del vault")
    return target


def split_frontmatter(text: str) -> tuple[dict[str, Any], str]:
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


def extract_excerpt(body: str, max_len: int = 160) -> str:
    lines = []
    for line in body.splitlines():
        s = line.strip()
        if not s or s == "---":
            continue
        s = re.sub(r"^#+\s*", "", s)
        s = re.sub(r"\[\[([^\]|]+)(?:\|([^\]]+))?\]\]", lambda m: m.group(2) or m.group(1), s)
        lines.append(s)
        if sum(len(x) for x in lines) >= max_len:
            break
    joined = " ".join(lines)
    return (joined[: max_len - 1] + "…") if len(joined) > max_len else joined


def scan_vault() -> dict[str, Any]:
    notes: dict[str, dict[str, Any]] = {}
    name_to_paths: dict[str, list[str]] = {}

    if not VAULT_DIR.exists():
        return {"notes": notes, "name_to_paths": name_to_paths}

    for root, dirs, files in os.walk(VAULT_DIR):
        dirs[:] = [d for d in dirs if d not in IGNORED_DIRS]
        for fname in files:
            if not fname.lower().endswith(".md"):
                continue
            full_path = Path(root) / fname
            rel_path = full_path.relative_to(VAULT_DIR).as_posix()
            parts = rel_path.split("/")
            folder = parts[0] if len(parts) > 1 else "Raíz"
            stem = full_path.stem

            try:
                raw_text = full_path.read_text(encoding="utf-8")
            except UnicodeDecodeError:
                raw_text = full_path.read_text(encoding="latin-1", errors="replace")

            frontmatter, body = split_frontmatter(raw_text)
            stat = full_path.stat()

            title_match = HEADING_RE.search(body)
            title = title_match.group(1).strip() if title_match else (stem or "Sin título")

            links = []
            for m in WIKILINK_RE.finditer(raw_text):
                target = m.group(1).strip()
                alias = m.group(2).strip() if m.group(2) else None
                links.append({"target": target, "alias": alias})

            tags = set()
            fm_tags = frontmatter.get("tags")
            if isinstance(fm_tags, list):
                tags.update(str(t).lstrip("#") for t in fm_tags)
            elif isinstance(fm_tags, str):
                tags.update(t.strip().lstrip("#") for t in fm_tags.split(",") if t.strip())
            for m in TAG_RE.finditer(body):
                tags.add(m.group(1))

            tasks = []
            for line_idx, line in enumerate(raw_text.splitlines(), start=1):
                tm = TASK_RE.match(line)
                if tm:
                    done = tm.group(2).lower() == "x"
                    task_text = tm.group(3).strip()
                    tasks.append(
                        {
                            "id": f"{rel_path}:{line_idx}",
                            "file_path": rel_path,
                            "file_name": stem,
                            "folder": folder,
                            "line": line_idx,
                            "done": done,
                            "text": task_text,
                        }
                    )

            note_obj = {
                "path": rel_path,
                "name": stem,
                "title": title,
                "folder": folder,
                "frontmatter": frontmatter,
                "tags": sorted(tags),
                "links": links,
                "backlinks": [],
                "tasks": tasks,
                "task_stats": {
                    "total": len(tasks),
                    "done": sum(1 for t in tasks if t["done"]),
                    "pending": sum(1 for t in tasks if not t["done"]),
                },
                "word_count": len(body.split()),
                "modified_at": datetime.fromtimestamp(stat.st_mtime).isoformat(timespec="seconds"),
                "excerpt": extract_excerpt(body),
            }
            notes[rel_path] = note_obj
            name_to_paths.setdefault(stem.lower(), []).append(rel_path)

    # Resolve backlinks
    for src_path, note in notes.items():
        for link in note["links"]:
            target = link["target"]
            resolved = resolve_link_path(target, notes, name_to_paths)
            link["resolved_path"] = resolved
            if resolved and resolved in notes and resolved != src_path:
                if src_path not in notes[resolved]["backlinks"]:
                    notes[resolved]["backlinks"].append(src_path)

    return {"notes": notes, "name_to_paths": name_to_paths}


def resolve_link_path(
    target: str, notes: dict[str, dict[str, Any]], name_to_paths: dict[str, list[str]]
) -> Optional[str]:
    clean = target.replace("\\", "/").strip()
    if not clean:
        return None
    if clean in notes:
        return clean
    if f"{clean}.md" in notes:
        return f"{clean}.md"
    base_name = Path(clean).name.lower()
    matches = name_to_paths.get(base_name, [])
    if len(matches) == 1:
        return matches[0]
    for m in matches:
        if m.lower().endswith(f"{clean.lower()}.md") or m.lower() == clean.lower():
            return m
    return matches[0] if matches else None


AREA_THEMES = {
    "Proyectos": {
        "subtitle": "Proyectos activos, lanzamientos y desarrollo de software.",
        "accent": "emerald",
        "gradient": "from-emerald-950/90 via-teal-900/60 to-slate-950/95",
        "image_style": "koi",
    },
    "Trabajo": {
        "subtitle": "Operaciones, clientes, inventarios y flujo laboral.",
        "accent": "amber",
        "gradient": "from-amber-950/85 via-stone-900/70 to-neutral-950/95",
        "image_style": "studio",
    },
    "Conocimiento": {
        "subtitle": "Sistemas, IA, herramientas, recetas y aprendizaje técnico.",
        "accent": "cyan",
        "gradient": "from-cyan-950/85 via-slate-900/70 to-neutral-950/95",
        "image_style": "forest",
    },
    "Finanzas": {
        "subtitle": "Ingresos, gastos fijos, deudas y estrategia financiera.",
        "accent": "lime",
        "gradient": "from-emerald-950/80 via-neutral-900/75 to-stone-950/95",
        "image_style": "meadow",
    },
    "Lecturas": {
        "subtitle": "Libros, resúmenes, citas y notas de lectura.",
        "accent": "orange",
        "gradient": "from-orange-950/80 via-stone-900/75 to-neutral-950/95",
        "image_style": "library",
    },
    "Salud": {
        "subtitle": "Rutinas físicas, ejercicio, alimentación y bienestar.",
        "accent": "teal",
        "gradient": "from-teal-950/85 via-emerald-950/70 to-neutral-950/95",
        "image_style": "zen",
    },
    "Personas": {
        "subtitle": "Vínculos, relaciones, regalos y notas personales.",
        "accent": "rose",
        "gradient": "from-rose-950/80 via-stone-900/75 to-neutral-950/95",
        "image_style": "warm",
    },
    "Reflexiones": {
        "subtitle": "Pensamientos, filosofía personal y diarios de introspección.",
        "accent": "indigo",
        "gradient": "from-indigo-950/80 via-slate-900/75 to-neutral-950/95",
        "image_style": "night",
    },
    "Series y Películas": {
        "subtitle": "Lista de seguimiento, reseñas y recomendaciones.",
        "accent": "purple",
        "gradient": "from-purple-950/80 via-slate-900/75 to-neutral-950/95",
        "image_style": "cinema",
    },
    "Hobbies e intereses": {
        "subtitle": "Música, creatividad, videojuegos y pasatiempos.",
        "accent": "yellow",
        "gradient": "from-yellow-950/75 via-stone-900/75 to-neutral-950/95",
        "image_style": "craft",
    },
}


class NoteUpdatePayload(BaseModel):
    content: str


class NoteCreatePayload(BaseModel):
    path: str
    content: str = ""
    moc_area: Optional[str] = None


class TaskCreatePayload(BaseModel):
    text: str
    target_file: Optional[str] = None
    area: Optional[str] = None
    priority: str = "Normal"


class TaskTogglePayload(BaseModel):
    file_path: str
    line: int
    text: Optional[str] = None


class ScriptRunPayload(BaseModel):
    script_name: str
    args: list[str] = []


@app.get("/api/health")
def health() -> dict[str, Any]:
    index = scan_vault()
    return {
        "status": "ok",
        "vault_path": str(VAULT_DIR),
        "note_count": len(index["notes"]),
    }


@app.get("/api/overview")
def get_overview() -> dict[str, Any]:
    index = scan_vault()
    notes = index["notes"]

    folder_counts: dict[str, int] = {}
    all_tasks: list[dict[str, Any]] = []
    for note in notes.values():
        folder_counts[note["folder"]] = folder_counts.get(note["folder"], 0) + 1
        all_tasks.extend(note["tasks"])

    today_str = date.today().isoformat()
    today_daily_path = f"Diario/{today_str}.md"
    today_tasks = [t for t in all_tasks if t["file_path"] == today_daily_path]
    pending_tasks = [t for t in all_tasks if not t["done"]]

    # Build 7-day calendar strip (Sunday -> Saturday of current week)
    today = date.today()
    # In Python weekday(): Mon=0..Sun=6. Shift so Sunday is start of week.
    days_since_sunday = (today.weekday() + 1) % 7
    week_start = today - timedelta(days=days_since_sunday)
    day_names_es = ["lun", "mar", "mié", "jue", "vie", "sáb", "dom"]
    week_days = []
    for i in range(7):
        d = week_start + timedelta(days=i)
        d_str = d.isoformat()
        daily_path = f"Diario/{d_str}.md"
        daily_note = notes.get(daily_path)
        week_days.append(
            {
                "date": d_str,
                "label": f"{day_names_es[d.weekday()]} {d.day}",
                "is_today": d == today,
                "has_note": daily_note is not None,
                "pending_tasks": daily_note["task_stats"]["pending"] if daily_note else 0,
                "total_tasks": daily_note["task_stats"]["total"] if daily_note else 0,
                "daily_path": daily_path,
            }
        )

    # Parse Areas from MOC folder & 📌 000 - Dashboard.md
    areas_meta = load_areas_meta()
    areas = []
    dashboard_note = notes.get("📌 000 - Dashboard.md")
    area_order = (
        [lnk["target"] for lnk in dashboard_note["links"]]
        if dashboard_note
        else list(AREA_THEMES.keys())
    )
    seen_areas = set()
    for area_name in area_order:
        if area_name in seen_areas:
            continue
        seen_areas.add(area_name)
        moc_path = f"MOC/{area_name}.md"
        moc_note = notes.get(moc_path)
        linked_notes = []
        if moc_note:
            for lnk in moc_note["links"]:
                rp = lnk.get("resolved_path")
                if rp and rp in notes:
                    linked_notes.append(notes[rp])
                else:
                    linked_notes.append(
                        {
                            "path": None,
                            "name": lnk["target"],
                            "title": lnk.get("alias") or lnk["target"],
                            "folder": "Sin crear",
                            "exists": False,
                        }
                    )
        theme = AREA_THEMES.get(
            area_name,
            {
                "subtitle": "Área de conocimiento en tu segundo cerebro.",
                "accent": "amber",
                "gradient": "from-stone-900/90 via-neutral-900/80 to-neutral-950/95",
                "image_style": "studio",
            },
        )
        custom = areas_meta.get(area_name, {})
        areas.append(
            {
                "name": area_name,
                "moc_path": moc_path if moc_note else None,
                "subtitle": custom.get("subtitle") or theme["subtitle"],
                "accent": theme["accent"],
                "gradient": theme["gradient"],
                "image_style": custom.get("image_style") or theme["image_style"],
                "cover_url": custom.get("cover_url"),
                "cover_pos_x": custom.get("cover_pos_x", 50),
                "cover_pos_y": custom.get("cover_pos_y", 50),
                "cover_zoom": custom.get("cover_zoom", 100),
                "linked_count": len(moc_note["links"]) if moc_note else 0,
                "existing_count": sum(1 for n in linked_notes if n.get("path")),
                "pending_tasks": sum(
                    n.get("task_stats", {}).get("pending", 0)
                    for n in linked_notes
                    if n.get("path")
                ),
            }
        )

    task_lists_pending = sum(
        len([t for t in lst["pending"] if not t["done"]])
        for lst in get_all_lists(TAREAS_DIR)
    )

    recent_notes = sorted(
        notes.values(), key=lambda n: n["modified_at"], reverse=True
    )[:12]

    temporal_count = folder_counts.get("Temporal", 0)
    ideas_count = folder_counts.get("Ideas", 0)

    return {
        "vault_name": VAULT_DIR.name,
        "today": today_str,
        "today_daily_path": today_daily_path,
        "stats": {
            "total_notes": len(notes),
            "total_tasks": len(all_tasks),
            "pending_tasks": task_lists_pending,
            "today_pending": sum(1 for t in today_tasks if not t["done"]),
            "today_total": len(today_tasks),
            "temporal_count": temporal_count,
            "ideas_count": ideas_count,
            "folder_counts": folder_counts,
        },
        "week_days": week_days,
        "areas": areas,
        "recent_notes": recent_notes,
    }


@app.get("/api/areas/{area_name}")
def get_area_detail(area_name: str) -> dict[str, Any]:
    index = scan_vault()
    notes = index["notes"]
    moc_path = f"MOC/{area_name}.md"
    moc_note = notes.get(moc_path)
    if not moc_note:
        raise HTTPException(status_code=404, detail=f"Área '{area_name}' no encontrada")

    raw_text = (VAULT_DIR / moc_path).read_text(encoding="utf-8")
    items = []
    seen = set()
    for lnk in moc_note["links"]:
        rp = lnk.get("resolved_path")
        key = rp or lnk["target"]
        if key in seen:
            continue
        seen.add(key)
        if rp and rp in notes:
            n = notes[rp]
            items.append({**n, "exists": True})
        else:
            items.append(
                {
                    "path": f"Notas/{lnk['target']}.md",
                    "name": lnk["target"],
                    "title": lnk.get("alias") or lnk["target"],
                    "folder": "Sin crear",
                    "exists": False,
                    "excerpt": "Nota referenciada en el MOC pero aún sin archivo.",
                    "task_stats": {"total": 0, "done": 0, "pending": 0},
                    "links": [],
                    "backlinks": [moc_path],
                    "tags": [],
                }
            )

    areas_meta = load_areas_meta()
    theme = {**AREA_THEMES.get(area_name, {}), **areas_meta.get(area_name, {})}
    return {
        "name": area_name,
        "moc_path": moc_path,
        "content": raw_text,
        "theme": theme,
        "items": items,
    }


@app.get("/api/notes")
def list_notes(
    folder: Optional[str] = None,
    tag: Optional[str] = None,
    q: Optional[str] = None,
) -> dict[str, Any]:
    index = scan_vault()
    results = list(index["notes"].values())
    if folder and folder != "Todas":
        results = [n for n in results if n["folder"] == folder]
    if tag:
        results = [n for n in results if tag in n["tags"]]
    if q:
        ql = q.lower()
        filtered = []
        for n in results:
            if ql in n["name"].lower() or ql in n["title"].lower() or ql in n["excerpt"].lower():
                filtered.append(n)
            else:
                try:
                    txt = (VAULT_DIR / n["path"]).read_text(encoding="utf-8", errors="ignore")
                    if ql in txt.lower():
                        filtered.append(n)
                except Exception:
                    pass
        results = filtered

    results.sort(key=lambda n: n["modified_at"], reverse=True)
    return {"count": len(results), "notes": results}


@app.get("/api/notes/{note_path:path}")
def get_note(note_path: str) -> dict[str, Any]:
    target = safe_vault_path(note_path)
    if not target.exists() or not target.is_file():
        raise HTTPException(status_code=404, detail="Nota no encontrada")

    index = scan_vault()
    rel = target.relative_to(VAULT_DIR).as_posix()
    meta = index["notes"].get(rel)
    content = target.read_text(encoding="utf-8", errors="replace")

    backlink_notes = []
    if meta:
        for bp in meta["backlinks"]:
            if bp in index["notes"]:
                backlink_notes.append(
                    {
                        "path": bp,
                        "title": index["notes"][bp]["title"],
                        "folder": index["notes"][bp]["folder"],
                    }
                )

    return {
        "path": rel,
        "content": content,
        "meta": meta,
        "backlink_notes": backlink_notes,
    }


@app.put("/api/notes/{note_path:path}")
def update_note(note_path: str, payload: NoteUpdatePayload) -> dict[str, Any]:
    target = safe_vault_path(note_path)
    target.parent.mkdir(parents=True, exist_ok=True)
    existed = target.exists()
    target.write_text(payload.content, encoding="utf-8")
    rel = target.relative_to(VAULT_DIR).as_posix()
    log_activity(
        actor="Usuario",
        action_type="Hecho",
        section="Notas",
        message=f"{'Actualizada' if existed else 'Creada'} la nota {rel}",
        details={"path": rel},
    )
    trigger_auto_sync(f"actualiza {rel}")
    return {"status": "ok", "path": rel}


@app.post("/api/notes")
def create_note(payload: NoteCreatePayload) -> dict[str, Any]:
    rel = payload.path.replace("\\", "/").lstrip("/")
    if not rel.endswith(".md"):
        rel += ".md"
    target = safe_vault_path(rel)
    if target.exists():
        raise HTTPException(status_code=409, detail="Ya existe una nota con esa ruta")
    target.parent.mkdir(parents=True, exist_ok=True)
    content = payload.content or f"# {target.stem}\n\n"
    target.write_text(content, encoding="utf-8")
    rel_final = target.relative_to(VAULT_DIR).as_posix()
    if payload.moc_area:
        moc_file = VAULT_DIR / "MOC" / f"{payload.moc_area}.md"
        if moc_file.exists():
            mtxt = moc_file.read_text(encoding="utf-8")
            if f"[[{target.stem}]]" not in mtxt:
                if not mtxt.endswith("\n"):
                    mtxt += "\n"
                mtxt += f"- [[{target.stem}]]\n"
                moc_file.write_text(mtxt, encoding="utf-8")
    log_activity(
        actor="Usuario",
        action_type="Hecho",
        section="Notas",
        message=f"Nueva nota creada: {rel_final}",
        details={"path": rel_final},
    )
    trigger_auto_sync(f"crea {rel_final}")
    return {"status": "ok", "path": rel_final}


@app.delete("/api/notes/{note_path:path}")
def delete_note(note_path: str) -> dict[str, Any]:
    target = safe_vault_path(note_path)
    if not target.exists() or not target.is_file():
        raise HTTPException(status_code=404, detail="Nota no encontrada")
    rel = target.relative_to(VAULT_DIR).as_posix()
    target.unlink()
    log_activity(
        actor="Usuario",
        action_type="Hecho",
        section="Notas",
        message=f"Nota eliminada: {rel}",
        details={"path": rel},
    )
    trigger_auto_sync(f"elimina {rel}")
    return {"status": "ok", "path": rel}


class NoteMovePayload(BaseModel):
    old_path: str
    new_path: str


@app.post("/api/notes/move")
def move_note(payload: NoteMovePayload) -> dict[str, Any]:
    src = safe_vault_path(payload.old_path)
    if not src.exists() or not src.is_file():
        raise HTTPException(status_code=404, detail="Nota origen no encontrada")

    new_rel = payload.new_path.replace("\\", "/").lstrip("/")
    if not new_rel.endswith(".md"):
        new_rel += ".md"
    dst = safe_vault_path(new_rel)
    if src == dst:
        return {"status": "ok", "path": src.relative_to(VAULT_DIR).as_posix()}
    if dst.exists():
        raise HTTPException(status_code=409, detail="Ya existe una nota en la ruta destino")

    dst.parent.mkdir(parents=True, exist_ok=True)
    src.rename(dst)
    old_rel = src.relative_to(VAULT_DIR).as_posix()
    final_rel = dst.relative_to(VAULT_DIR).as_posix()
    log_activity(
        actor="Usuario",
        action_type="Hecho",
        section="Carpetas",
        message=f"Nota movida: {old_rel} → {final_rel}",
    )
    trigger_auto_sync(f"mueve {old_rel} a {final_rel}")
    return {"status": "ok", "old_path": old_rel, "path": final_rel}


@app.get("/api/folders")
def get_folders() -> dict[str, Any]:
    index = scan_vault()
    notes_by_folder: dict[str, list[dict[str, Any]]] = {}
    all_folders: set[str] = {"Raíz"}

    for root, dirs, _ in os.walk(VAULT_DIR):
        dirs[:] = [d for d in dirs if d not in IGNORED_DIRS]
        rel_dir = Path(root).relative_to(VAULT_DIR).as_posix()
        if rel_dir != ".":
            all_folders.add(rel_dir)

    for n in index["notes"].values():
        parent = Path(n["path"]).parent.as_posix()
        folder_key = "Raíz" if parent == "." else parent
        all_folders.add(folder_key)
        notes_by_folder.setdefault(folder_key, []).append(n)

    for k in notes_by_folder:
        notes_by_folder[k].sort(key=lambda x: x["name"].lower())

    sorted_folders = sorted(all_folders, key=lambda f: ("" if f == "Raíz" else f.lower()))
    return {
        "folders": [
            {
                "path": f,
                "count": len(notes_by_folder.get(f, [])),
                "notes": notes_by_folder.get(f, []),
            }
            for f in sorted_folders
        ]
    }


@app.get("/api/tasks")
def get_tasks() -> dict[str, Any]:
    index = scan_vault()
    all_tasks = []
    for note in index["notes"].values():
        all_tasks.extend(note["tasks"])

    today_str = date.today().isoformat()
    today_path = f"Diario/{today_str}.md"

    today_tasks = [t for t in all_tasks if t["file_path"] == today_path]
    overdue_daily = [
        t
        for t in all_tasks
        if t["folder"] == "Diario" and t["file_path"] != today_path and not t["done"]
    ]
    other_pending = [
        t
        for t in all_tasks
        if t["folder"] != "Diario" and not t["done"]
    ]
    completed = [t for t in all_tasks if t["done"]]

    return {
        "today": today_str,
        "today_daily_path": today_path,
        "today_tasks": today_tasks,
        "overdue_daily": overdue_daily,
        "other_pending": other_pending,
        "completed": completed[:60],
        "counts": {
            "today_pending": sum(1 for t in today_tasks if not t["done"]),
            "today_done": sum(1 for t in today_tasks if t["done"]),
            "overdue_daily": len(overdue_daily),
            "other_pending": len(other_pending),
            "total_pending": len(overdue_daily)
            + len(other_pending)
            + sum(1 for t in today_tasks if not t["done"]),
        },
    }


@app.post("/api/tasks")
def create_task(payload: TaskCreatePayload) -> dict[str, Any]:
    text = payload.text.strip()
    if not text:
        raise HTTPException(status_code=400, detail="El texto de la tarea no puede estar vacío")

    today_str = date.today().isoformat()
    target_rel = payload.target_file or f"Diario/{today_str}.md"
    target = safe_vault_path(target_rel)
    target.parent.mkdir(parents=True, exist_ok=True)

    area_suffix = f" #{payload.area.lower().replace(' ', '-')}" if payload.area and payload.area != "Sin área" else ""
    prio_prefix = "🔺 " if payload.priority == "Alta" else ""
    task_line = f"- [ ] {prio_prefix}{text}{area_suffix}"

    if not target.exists():
        initial = (
            "#diario\n\n---\n## ⚡ Tareas\n\n"
            f"{task_line}\n\n"
            "---\n## 🔧 Acciones secundarias\n\n---\n## 🧠 Notas\n"
        )
        target.write_text(initial, encoding="utf-8")
    else:
        existing = target.read_text(encoding="utf-8")
        lines = existing.splitlines()
        inserted = False
        for i, line in enumerate(lines):
            if "## ⚡ Tareas" in line or "## Tareas" in line:
                insert_at = i + 1
                while insert_at < len(lines) and lines[insert_at].strip() == "":
                    insert_at += 1
                lines.insert(insert_at, task_line)
                inserted = True
                break
        if not inserted:
            lines.append(task_line)
        target.write_text("\n".join(lines) + "\n", encoding="utf-8")

    rel = target.relative_to(VAULT_DIR).as_posix()
    log_activity(
        actor="Usuario",
        action_type="Hecho",
        section="Tareas",
        message=f"Tarea añadida en {rel}: {text}",
    )
    trigger_auto_sync(f"tarea en {rel}")
    return {"status": "ok", "file_path": rel, "task_line": task_line}


@app.post("/api/tasks/toggle")
def toggle_task(payload: TaskTogglePayload) -> dict[str, Any]:
    target = safe_vault_path(payload.file_path)
    if not target.exists():
        raise HTTPException(status_code=404, detail="Archivo no encontrado")

    lines = target.read_text(encoding="utf-8").splitlines()
    idx = payload.line - 1
    if idx < 0 or idx >= len(lines):
        raise HTTPException(status_code=400, detail="Línea fuera de rango")

    m = TASK_RE.match(lines[idx])
    if not m:
        raise HTTPException(status_code=400, detail="La línea indicada no es una tarea válida")

    current_done = m.group(2).lower() == "x"
    new_mark = " " if current_done else "x"
    lines[idx] = f"{m.group(1)}[{new_mark}] {m.group(3)}"
    target.write_text("\n".join(lines) + "\n", encoding="utf-8")

    log_activity(
        actor="Usuario",
        action_type="Hecho",
        section="Tareas",
        message=f"Tarea {'desmarcada' if current_done else 'completada'}: {m.group(3).strip()}",
    )
    trigger_auto_sync(f"toggle tarea en {payload.file_path}")
    return {"status": "ok", "done": not current_done}


@app.get("/api/projects")
def get_projects() -> dict[str, Any]:
    index = scan_vault()
    notes = index["notes"]
    projects_moc = VAULT_DIR / "MOC" / "Proyectos.md"

    items = []
    if projects_moc.exists():
        raw = projects_moc.read_text(encoding="utf-8")
        current_section = "En marcha"
        for line in raw.splitlines():
            s = line.strip()
            if s.startswith("##"):
                if "anterior" in s.lower() or "archiv" in s.lower():
                    current_section = "Archivados"
                else:
                    current_section = "En marcha"
            for m in WIKILINK_RE.finditer(s):
                name = m.group(1).strip()
                rp = resolve_link_path(name, notes, index["name_to_paths"])
                note_data = notes.get(rp) if rp else None
                tasks_total = note_data["task_stats"]["total"] if note_data else 0
                tasks_done = note_data["task_stats"]["done"] if note_data else 0
                progress = (
                    round((tasks_done / tasks_total) * 100)
                    if tasks_total > 0
                    else (100 if current_section == "Archivados" else 25)
                )
                items.append(
                    {
                        "name": name,
                        "path": rp,
                        "status": current_section,
                        "step": "Activo" if current_section == "En marcha" else "Archivado",
                        "progress": progress,
                        "tasks_total": tasks_total,
                        "tasks_done": tasks_done,
                        "word_count": note_data["word_count"] if note_data else 0,
                        "links_count": len(note_data["links"]) if note_data else 0,
                        "modified_at": note_data["modified_at"] if note_data else None,
                    }
                )

    ideas = [n for n in notes.values() if n["folder"] == "Ideas"]
    return {
        "projects": items,
        "ideas": ideas,
    }


@app.get("/api/scripts")
def list_scripts() -> dict[str, Any]:
    scripts = []
    for p in sorted(SCRIPTS_DIR.glob("*.py")):
        first_doc = ""
        try:
            text = p.read_text(encoding="utf-8")
            doc_m = re.search(r'"""(.*?)"""', text, re.DOTALL)
            if doc_m:
                first_doc = doc_m.group(1).strip().splitlines()[0]
        except Exception:
            pass
        scripts.append(
            {
                "name": p.name,
                "path": str(p),
                "description": first_doc or "Script de automatización Python sobre myVault",
            }
        )
    return {"scripts": scripts, "scripts_dir": str(SCRIPTS_DIR)}


@app.post("/api/scripts/run")
def run_script(payload: ScriptRunPayload) -> dict[str, Any]:
    script_path = (SCRIPTS_DIR / payload.script_name).resolve()
    if not str(script_path).startswith(str(SCRIPTS_DIR.resolve())) or not script_path.exists():
        raise HTTPException(status_code=404, detail="Script no encontrado")

    env = os.environ.copy()
    env["OBSIDIAN_VAULT_PATH"] = str(VAULT_DIR)
    env["PYTHONIOENCODING"] = "utf-8"

    try:
        proc = subprocess.run(
            [sys.executable, str(script_path), *payload.args],
            capture_output=True,
            text=True,
            encoding="utf-8",
            errors="replace",
            timeout=30,
            env=env,
        )
        ok = proc.returncode == 0
        output = (proc.stdout or "") + ("\n" + proc.stderr if proc.stderr else "")
        log_activity(
            actor="Script Python",
            action_type="Hecho" if ok else "Error",
            section="La IA",
            message=f"Ejecución de {payload.script_name}: {'completada' if ok else 'con error'}",
            status="Hecho" if ok else "Error",
            details={"output": output[:2000], "returncode": proc.returncode},
        )
        return {
            "status": "ok" if ok else "error",
            "returncode": proc.returncode,
            "output": output,
        }
    except subprocess.TimeoutExpired:
        log_activity(
            actor="Script Python",
            action_type="Error",
            section="La IA",
            message=f"Timeout ejecutando {payload.script_name}",
            status="Error",
        )
        raise HTTPException(status_code=504, detail="El script tardó más de 30 segundos")


class LoginPayload(BaseModel):
    password: str


@app.get("/api/auth/check")
def auth_check(request: Request) -> dict[str, Any]:
    if not HQ_PASSWORD:
        return {"auth_required": False, "authenticated": True}
    token = request.cookies.get(SESSION_COOKIE)
    return {"auth_required": True, "authenticated": _verify_token(token)}


@app.post("/api/auth/login")
def auth_login(payload: LoginPayload, response: Response) -> dict[str, Any]:
    if not HQ_PASSWORD:
        return {"ok": True, "authenticated": True}
    if not secrets.compare_digest(payload.password, HQ_PASSWORD):
        raise HTTPException(status_code=401, detail="Contraseña incorrecta")
    token = _sign_token("hq-authenticated")
    response.set_cookie(
        key=SESSION_COOKIE,
        value=token,
        httponly=True,
        samesite="lax",
        max_age=60 * 60 * 24 * 30,
    )
    return {"ok": True, "authenticated": True}


@app.post("/api/auth/logout")
def auth_logout(response: Response) -> dict[str, Any]:
    response.delete_cookie(SESSION_COOKIE)
    return {"ok": True}


@app.get("/api/git/status")
def git_status_endpoint() -> dict[str, Any]:
    return get_git_status(VAULT_DIR, GITHUB_TOKEN)


@app.post("/api/git/sync")
def git_sync_endpoint() -> dict[str, Any]:
    res = sync_vault(
        VAULT_DIR,
        VAULT_REPO_URL,
        GITHUB_TOKEN,
        commit_message="HQ: sincronización manual",
        push=True,
    )
    log_activity(
        actor="Git Sync",
        action_type="Hecho" if res.get("ok") else "Error",
        section="General",
        message=res.get("message", "Sincronización"),
        status="Hecho" if res.get("ok") else "Error",
    )
    if not res.get("ok"):
        raise HTTPException(status_code=500, detail=res.get("message"))
    return res


@app.get("/api/covers/{filename}")
def get_cover_image(filename: str):
    safe_name = Path(filename).name
    target = (COVERS_DIR / safe_name).resolve()
    if not target.exists() or not target.is_file():
        raise HTTPException(status_code=404, detail="Imagen no encontrada")
    return FileResponse(
        str(target),
        headers={"Cache-Control": "public, max-age=31536000, immutable"},
    )


@app.post("/api/areas")
async def create_area(
    name: str = Form(...),
    subtitle: str = Form("Área de conocimiento en tu segundo cerebro."),
    image_style: str = Form("forest"),
    cover: Optional[UploadFile] = File(None),
) -> dict[str, Any]:
    clean_name = re.sub(r'[\\/:*?"<>|]', "", name).strip()
    if not clean_name:
        raise HTTPException(status_code=400, detail="Nombre de área inválido")

    moc_path = VAULT_DIR / "MOC" / f"{clean_name}.md"
    moc_path.parent.mkdir(parents=True, exist_ok=True)
    if not moc_path.exists():
        moc_path.write_text(f"# {clean_name}\n\n", encoding="utf-8")

    dash_path = VAULT_DIR / "📌 000 - Dashboard.md"
    if dash_path.exists():
        dash_text = dash_path.read_text(encoding="utf-8")
        if f"[[{clean_name}]]" not in dash_text:
            if not dash_text.endswith("\n"):
                dash_text += "\n"
            dash_text += f"- [[{clean_name}]]\n"
            dash_path.write_text(dash_text, encoding="utf-8")

    meta = load_areas_meta()
    entry = meta.get(clean_name, {})
    entry["subtitle"] = subtitle.strip() or "Área de conocimiento en tu segundo cerebro."
    entry["image_style"] = image_style

    if cover and cover.filename:
        COVERS_DIR.mkdir(parents=True, exist_ok=True)
        ext = Path(cover.filename).suffix.lower() or ".jpg"
        slug = re.sub(r"[^a-zA-Z0-9_-]", "_", clean_name.lower())
        fname = f"{slug}_{secrets.token_hex(4)}{ext}"
        (COVERS_DIR / fname).write_bytes(await cover.read())
        entry["cover_url"] = f"/api/covers/{fname}"

    meta[clean_name] = entry
    save_areas_meta(meta)
    log_activity("Usuario", "Hecho", "Áreas", f"Área creada: {clean_name}")
    trigger_auto_sync(f"nueva área {clean_name}")
    return {"status": "ok", "name": clean_name, "meta": entry}


@app.post("/api/areas/{area_name}/cover")
async def upload_area_cover(area_name: str, cover: UploadFile = File(...)) -> dict[str, Any]:
    COVERS_DIR.mkdir(parents=True, exist_ok=True)
    ext = Path(cover.filename or "cover.jpg").suffix.lower() or ".jpg"
    slug = re.sub(r"[^a-zA-Z0-9_-]", "_", area_name.lower())
    fname = f"{slug}_{secrets.token_hex(4)}{ext}"
    (COVERS_DIR / fname).write_bytes(await cover.read())

    meta = load_areas_meta()
    entry = meta.get(area_name, {})
    entry["cover_url"] = f"/api/covers/{fname}"
    entry.setdefault("cover_pos_x", 50)
    entry.setdefault("cover_pos_y", 50)
    entry.setdefault("cover_zoom", 100)
    meta[area_name] = entry
    save_areas_meta(meta)
    log_activity("Usuario", "Hecho", "Áreas", f"Portada actualizada en {area_name}")
    trigger_auto_sync(f"portada de {area_name}")
    return {"status": "ok", "cover_url": entry["cover_url"]}


class CoverSettingsPayload(BaseModel):
    cover_pos_x: int = 50
    cover_pos_y: int = 50
    cover_zoom: int = 100


@app.patch("/api/areas/{area_name}/cover-settings")
def update_area_cover_settings(area_name: str, payload: CoverSettingsPayload) -> dict[str, Any]:
    meta = load_areas_meta()
    entry = meta.get(area_name, {})
    entry["cover_pos_x"] = max(0, min(100, payload.cover_pos_x))
    entry["cover_pos_y"] = max(0, min(100, payload.cover_pos_y))
    entry["cover_zoom"] = max(100, min(250, payload.cover_zoom))
    meta[area_name] = entry
    save_areas_meta(meta)
    log_activity("Usuario", "Hecho", "Áreas", f"Ajuste de portada en {area_name}")
    trigger_auto_sync(f"ajuste portada de {area_name}")
    return {"status": "ok", "meta": entry}


# ================= GOOGLE-TASKS STYLE LISTS =================


class TaskListCreatePayload(BaseModel):
    name: str


class ListTaskCreatePayload(BaseModel):
    text: str
    due: str = ""
    parent_id: Optional[str] = None


class ListTaskUpdatePayload(BaseModel):
    text: Optional[str] = None
    done: Optional[bool] = None
    due: Optional[str] = None


class ListTaskMovePayload(BaseModel):
    from_list: str
    to_list: str
    task_id: str


def _safe_list_path(list_name: str) -> Path:
    clean = re.sub(r'[\\/:*?"<>|]', "", list_name).strip()
    if not clean:
        raise HTTPException(status_code=400, detail="Nombre de lista inválido")
    TAREAS_DIR.mkdir(parents=True, exist_ok=True)
    return TAREAS_DIR / f"{clean}.md"


@app.get("/api/task-lists")
def api_get_task_lists() -> dict[str, Any]:
    lists = get_all_lists(TAREAS_DIR)
    total_pending = sum(
        len([t for t in lst["pending"] if not t["done"]])
        for lst in lists
    )
    return {"lists": lists, "total_pending": total_pending}


@app.post("/api/task-lists")
def api_create_task_list(payload: TaskListCreatePayload) -> dict[str, Any]:
    p = _safe_list_path(payload.name)
    if p.exists():
        raise HTTPException(status_code=409, detail="Ya existe una lista con ese nombre")
    data = {"title": p.stem, "pending": [], "archived": []}
    write_list_file(p, data)
    log_activity("Usuario", "Hecho", "Tareas", f"Lista creada: {p.stem}")
    trigger_auto_sync(f"nueva lista {p.stem}")
    return {"status": "ok", "list": parse_list_file(p)}


@app.post("/api/task-lists/{list_name}/tasks")
def api_add_list_task(list_name: str, payload: ListTaskCreatePayload) -> dict[str, Any]:
    p = _safe_list_path(list_name)
    if not p.exists():
        raise HTTPException(status_code=404, detail="Lista no encontrada")
    text = payload.text.strip()
    if not text:
        raise HTTPException(status_code=400, detail="El texto no puede estar vacío")

    data = parse_list_file(p)
    now_iso = datetime.now().isoformat(timespec="seconds")

    if payload.parent_id:
        added = False
        for t in data["pending"]:
            if t["id"] == payload.parent_id:
                t["subtasks"].append(
                    {"id": _new_id("st"), "text": text, "done": False, "created": now_iso}
                )
                added = True
                break
        if not added:
            raise HTTPException(status_code=404, detail="Tarea padre no encontrada")
    else:
        data["pending"].insert(
            0,
            {
                "id": _new_id("t"),
                "text": text,
                "done": False,
                "created": now_iso,
                "due": payload.due.strip(),
                "subtasks": [],
            },
        )

    write_list_file(p, data)
    log_activity("Usuario", "Hecho", "Tareas", f"Tarea añadida en {list_name}: {text}")
    trigger_auto_sync(f"tarea en {list_name}")
    return {"status": "ok", "list": parse_list_file(p)}


@app.patch("/api/task-lists/{list_name}/tasks/{task_id}")
def api_update_list_task(
    list_name: str, task_id: str, payload: ListTaskUpdatePayload
) -> dict[str, Any]:
    p = _safe_list_path(list_name)
    if not p.exists():
        raise HTTPException(status_code=404, detail="Lista no encontrada")
    data = parse_list_file(p)

    found = False
    for group in (data["pending"], data["archived"]):
        for t in group:
            if t["id"] == task_id:
                if payload.text is not None:
                    t["text"] = payload.text.strip()
                if payload.done is not None:
                    t["done"] = payload.done
                if payload.due is not None:
                    t["due"] = payload.due.strip()
                found = True
                break
            for st in t.get("subtasks", []):
                if st["id"] == task_id:
                    if payload.text is not None:
                        st["text"] = payload.text.strip()
                    if payload.done is not None:
                        st["done"] = payload.done
                    found = True
                    break
            if found:
                break
        if found:
            break

    if not found:
        raise HTTPException(status_code=404, detail="Tarea no encontrada")

    write_list_file(p, data)
    trigger_auto_sync(f"actualiza tarea en {list_name}")
    return {"status": "ok", "list": parse_list_file(p)}


@app.delete("/api/task-lists/{list_name}/tasks/{task_id}")
def api_delete_list_task(list_name: str, task_id: str) -> dict[str, Any]:
    p = _safe_list_path(list_name)
    if not p.exists():
        raise HTTPException(status_code=404, detail="Lista no encontrada")
    data = parse_list_file(p)

    for group_key in ("pending", "archived"):
        new_group = []
        for t in data[group_key]:
            if t["id"] == task_id:
                continue
            t["subtasks"] = [st for st in t.get("subtasks", []) if st["id"] != task_id]
            new_group.append(t)
        data[group_key] = new_group

    write_list_file(p, data)
    log_activity("Usuario", "Hecho", "Tareas", f"Tarea eliminada de {list_name}")
    trigger_auto_sync(f"elimina tarea en {list_name}")
    return {"status": "ok", "list": parse_list_file(p)}


@app.post("/api/task-lists/{list_name}/archive")
def api_archive_completed(list_name: str) -> dict[str, Any]:
    p = _safe_list_path(list_name)
    if not p.exists():
        raise HTTPException(status_code=404, detail="Lista no encontrada")
    data = parse_list_file(p)
    still_pending = []
    newly_archived = []
    for t in data["pending"]:
        if t.get("done"):
            newly_archived.append(t)
        else:
            still_pending.append(t)
    data["pending"] = still_pending
    data["archived"] = newly_archived + data["archived"]
    write_list_file(p, data)
    if newly_archived:
        log_activity("Usuario", "Hecho", "Tareas", f"Archivadas {len(newly_archived)} tareas en {list_name}")
        trigger_auto_sync(f"archiva tareas en {list_name}")
    return {"status": "ok", "archived_count": len(newly_archived), "list": parse_list_file(p)}


@app.post("/api/task-lists/move")
def api_move_list_task(payload: ListTaskMovePayload) -> dict[str, Any]:
    if payload.from_list == payload.to_list:
        return {"status": "ok"}
    src_p = _safe_list_path(payload.from_list)
    dst_p = _safe_list_path(payload.to_list)
    if not src_p.exists() or not dst_p.exists():
        raise HTTPException(status_code=404, detail="Lista origen o destino no encontrada")

    src_data = parse_list_file(src_p)
    dst_data = parse_list_file(dst_p)

    moved_task = None
    new_pending = []
    for t in src_data["pending"]:
        if t["id"] == payload.task_id:
            moved_task = t
        else:
            new_pending.append(t)

    if not moved_task:
        raise HTTPException(status_code=404, detail="Tarea no encontrada en la lista origen")

    src_data["pending"] = new_pending
    dst_data["pending"].insert(0, moved_task)

    write_list_file(src_p, src_data)
    write_list_file(dst_p, dst_data)
    log_activity("Usuario", "Hecho", "Tareas", f"Tarea movida de {payload.from_list} a {payload.to_list}")
    trigger_auto_sync(f"mueve tarea a {payload.to_list}")
    return {"status": "ok"}


# ================= CONTENIDO: LECTURAS & SERIES/PELÍCULAS =================

LECTURAS_DIR = VAULT_DIR / "Contenido" / "Lecturas"
SERIES_DIR = VAULT_DIR / "Contenido" / "Series y Películas"
PERSONAS_DIR = VAULT_DIR / "Personas"


def _write_with_frontmatter(path: Path, fm: dict[str, Any], body: str) -> None:
    yaml_str = yaml.safe_dump(fm, allow_unicode=True, sort_keys=False).strip()
    content = f"---\n{yaml_str}\n---\n{body.lstrip()}"
    path.write_text(content, encoding="utf-8")


def _ensure_persona(raw_name: str) -> str:
    clean = re.sub(r"[\[\]]", "", raw_name).strip()
    clean = re.sub(r'[\\/:*?"<>|]', "", clean).strip()
    if not clean:
        return ""

    # Check if already exists in Personas/<Name>/ or Personas/<Name>.md
    if PERSONAS_DIR.exists():
        for d in PERSONAS_DIR.iterdir():
            if d.is_dir() and d.name.lower() == clean.lower():
                note = d / f"{d.name}.md"
                if not note.exists():
                    note.write_text(f"# {d.name}\n\n", encoding="utf-8")
                return d.name
            if d.is_file() and d.stem.lower() == clean.lower():
                return d.stem

    # Create new person folder & note + link in MOC/Personas.md
    p_dir = PERSONAS_DIR / clean
    p_dir.mkdir(parents=True, exist_ok=True)
    p_note = p_dir / f"{clean}.md"
    if not p_note.exists():
        p_note.write_text(f"# {clean}\n\n", encoding="utf-8")

    moc_personas = VAULT_DIR / "MOC" / "Personas.md"
    if moc_personas.exists():
        txt = moc_personas.read_text(encoding="utf-8")
        if f"[[{clean}]]" not in txt:
            if not txt.endswith("\n"):
                txt += "\n"
            txt += f"- [[{clean}]]\n"
            moc_personas.write_text(txt, encoding="utf-8")

    log_activity("Usuario", "Hecho", "Personas", f"Persona creada automáticamente: {clean}")
    return clean


def _list_personas() -> list[str]:
    if not PERSONAS_DIR.exists():
        return []
    names = []
    for item in sorted(PERSONAS_DIR.iterdir(), key=lambda p: p.name.lower()):
        if item.is_dir():
            names.append(item.name)
        elif item.is_file() and item.suffix.lower() == ".md":
            names.append(item.stem)
    return names


class LecturaCreatePayload(BaseModel):
    title: str
    tipo: str = "Libro"
    autor: str = ""
    puntuacion: float = 0.0
    comentario: str = ""


class LecturaItemCreatePayload(BaseModel):
    title: str
    progreso: int = 0
    puntuacion: float = 0.0
    comentario: str = ""


class LecturaBatchTomosPayload(BaseModel):
    total_count: int
    completed_count: int = 0
    prefix: str = "Tomo"


class LecturaUpdatePayload(BaseModel):
    progreso: Optional[int] = None
    puntuacion: Optional[float] = None
    comentario: Optional[str] = None


class SeriesCreatePayload(BaseModel):
    title: str
    tipo: str = "Serie"
    estado: str = "por ver"
    recomendado_por: str = ""
    puntuacion: float = 0.0


class SeriesUpdatePayload(BaseModel):
    path: str
    estado: Optional[str] = None
    puntuacion: Optional[float] = None
    recomendado_por: Optional[str] = None


@app.get("/api/content/lecturas")
def api_get_lecturas() -> dict[str, Any]:
    return {"items": list_collections(LECTURAS_DIR, VAULT_DIR)}


@app.get("/api/content/lecturas/{col_name}")
def api_get_lectura_detail(col_name: str) -> dict[str, Any]:
    detail = get_collection_detail(LECTURAS_DIR, VAULT_DIR, col_name)
    if not detail:
        raise HTTPException(status_code=404, detail="Colección no encontrada")
    return detail


@app.post("/api/content/lecturas")
def api_create_lectura(payload: LecturaCreatePayload) -> dict[str, Any]:
    if not payload.title.strip():
        raise HTTPException(status_code=400, detail="Título inválido")
    main_file = create_collection(
        LECTURAS_DIR,
        title=payload.title,
        tipo=payload.tipo,
        autor=payload.autor,
        puntuacion=payload.puntuacion,
        comentario=payload.comentario,
    )
    log_activity("Usuario", "Hecho", "Lecturas", f"Colección creada: {payload.title.strip()}")
    trigger_auto_sync(f"nueva lectura {payload.title.strip()}")
    return {"status": "ok", "name": main_file.parent.name}


@app.patch("/api/content/lecturas/{col_name}")
def api_update_lectura_collection(col_name: str, payload: LecturaUpdatePayload) -> dict[str, Any]:
    main_file = LECTURAS_DIR / col_name / f"{col_name}.md"
    if not main_file.exists():
        raise HTTPException(status_code=404, detail="Colección no encontrada")
    update_item_or_collection(
        main_file,
        progreso=payload.progreso,
        puntuacion=payload.puntuacion,
        comentario=payload.comentario,
    )
    trigger_auto_sync(f"actualiza lectura {col_name}")
    return {"status": "ok", "collection": get_collection_detail(LECTURAS_DIR, VAULT_DIR, col_name)}


@app.post("/api/content/lecturas/{col_name}/cover")
async def api_upload_lectura_cover(
    col_name: str,
    cover: UploadFile = File(...),
    item_file: Optional[str] = Form(None),
) -> dict[str, Any]:
    col_dir = LECTURAS_DIR / col_name
    if not col_dir.exists():
        raise HTTPException(status_code=404, detail="Colección no encontrada")
    COVERS_DIR.mkdir(parents=True, exist_ok=True)
    ext = Path(cover.filename or "cover.jpg").suffix.lower() or ".jpg"
    slug = re.sub(r"[^a-zA-Z0-9_-]", "_", col_name.lower())
    fname = f"lec_{slug}_{secrets.token_hex(4)}{ext}"
    (COVERS_DIR / fname).write_bytes(await cover.read())
    cover_url = f"/api/covers/{fname}"

    target_md = (col_dir / item_file) if item_file else (col_dir / f"{col_name}.md")
    if not target_md.exists():
        raise HTTPException(status_code=404, detail="Archivo no encontrado")
    update_item_or_collection(target_md, cover_url=cover_url)
    trigger_auto_sync(f"portada lectura {col_name}")
    return {"status": "ok", "cover_url": cover_url}


@app.post("/api/content/lecturas/{col_name}/items")
def api_add_lectura_item(col_name: str, payload: LecturaItemCreatePayload) -> dict[str, Any]:
    col_dir = LECTURAS_DIR / col_name
    if not col_dir.exists():
        raise HTTPException(status_code=404, detail="Colección no encontrada")
    add_collection_item(
        LECTURAS_DIR,
        col_name=col_name,
        title=payload.title,
        progreso=payload.progreso,
        puntuacion=payload.puntuacion,
        comentario=payload.comentario,
    )
    log_activity("Usuario", "Hecho", "Lecturas", f"Añadido '{payload.title}' en {col_name}")
    trigger_auto_sync(f"nuevo tomo/libro en {col_name}")
    return {"status": "ok", "collection": get_collection_detail(LECTURAS_DIR, VAULT_DIR, col_name)}


@app.post("/api/content/lecturas/{col_name}/batch")
def api_batch_tomos(col_name: str, payload: LecturaBatchTomosPayload) -> dict[str, Any]:
    col_dir = LECTURAS_DIR / col_name
    if not col_dir.exists():
        raise HTTPException(status_code=404, detail="Colección no encontrada")
    count = max(1, min(100, payload.total_count))
    done_cnt = max(0, min(count, payload.completed_count))
    batch_add_tomos(
        LECTURAS_DIR,
        col_name=col_name,
        total_count=count,
        completed_count=done_cnt,
        prefix=payload.prefix or "Tomo",
    )
    log_activity("Usuario", "Hecho", "Lecturas", f"Generados {count} tomos en {col_name}")
    trigger_auto_sync(f"lote de tomos en {col_name}")
    return {"status": "ok", "collection": get_collection_detail(LECTURAS_DIR, VAULT_DIR, col_name)}


@app.patch("/api/content/lecturas/{col_name}/items/{item_file}")
def api_update_lectura_item(
    col_name: str, item_file: str, payload: LecturaUpdatePayload
) -> dict[str, Any]:
    target = (LECTURAS_DIR / col_name / item_file).resolve()
    if not str(target).startswith(str((LECTURAS_DIR / col_name).resolve())) or not target.exists():
        raise HTTPException(status_code=404, detail="Elemento no encontrado")
    update_item_or_collection(
        target,
        progreso=payload.progreso,
        puntuacion=payload.puntuacion,
        comentario=payload.comentario,
    )
    trigger_auto_sync(f"actualiza {item_file} en {col_name}")
    return {"status": "ok", "collection": get_collection_detail(LECTURAS_DIR, VAULT_DIR, col_name)}


@app.get("/api/content/series")
def api_get_series() -> dict[str, Any]:
    SERIES_DIR.mkdir(parents=True, exist_ok=True)
    items = []
    for p in sorted(SERIES_DIR.glob("*.md"), key=lambda x: x.stat().st_mtime, reverse=True):
        if p.stem.lower().startswith("cómo califico"):
            continue
        raw = p.read_text(encoding="utf-8", errors="replace")
        fm, _ = split_frontmatter(raw)
        rec_raw = str(fm.get("recomendado_por", "") or "")
        rec_clean = re.sub(r"[\[\]]", "", rec_raw).strip()
        try:
            score = float(fm.get("puntuacion", 0) or 0)
        except Exception:
            score = 0.0
        items.append(
            {
                "title": p.stem,
                "path": p.relative_to(VAULT_DIR).as_posix(),
                "tipo": fm.get("tipo", "Serie"),
                "estado": fm.get("estado", "por ver"),
                "recomendado_por": rec_clean,
                "puntuacion": score,
            }
        )
    return {"items": items, "personas": _list_personas()}


@app.post("/api/content/series")
def api_create_series(payload: SeriesCreatePayload) -> dict[str, Any]:
    clean = re.sub(r'[\\/:*?"<>|]', "", payload.title).strip()
    if not clean:
        raise HTTPException(status_code=400, detail="Título inválido")
    SERIES_DIR.mkdir(parents=True, exist_ok=True)
    target = SERIES_DIR / f"{clean}.md"
    if target.exists():
        raise HTTPException(status_code=409, detail="Ya existe ese título")

    estado = payload.estado if payload.estado in {"por ver", "vista", "pausada", "dropeada"} else "por ver"
    score = max(0.0, min(5.0, round(payload.puntuacion * 2) / 2))
    persona = _ensure_persona(payload.recomendado_por) if payload.recomendado_por.strip() else ""

    fm = {
        "tipo": payload.tipo,
        "estado": estado,
        "recomendado_por": f"[[{persona}]]" if persona else "",
        "puntuacion": score,
    }
    _write_with_frontmatter(target, fm, f"\n# {clean}\n\n## Reseña / Notas\n")
    rel = target.relative_to(VAULT_DIR).as_posix()
    log_activity("Usuario", "Hecho", "Series y Películas", f"Añadido: {clean} ({estado})")
    trigger_auto_sync(f"nueva serie/película {clean}")
    return {"status": "ok", "path": rel, "persona_creada": persona}


@app.patch("/api/content/series")
def api_update_series(payload: SeriesUpdatePayload) -> dict[str, Any]:
    target = safe_vault_path(payload.path)
    if not target.exists():
        raise HTTPException(status_code=404, detail="Título no encontrado")
    raw = target.read_text(encoding="utf-8", errors="replace")
    fm, body = split_frontmatter(raw)
    if payload.estado is not None and payload.estado in {"por ver", "vista", "pausada", "dropeada"}:
        fm["estado"] = payload.estado
    if payload.puntuacion is not None:
        fm["puntuacion"] = max(0.0, min(5.0, round(payload.puntuacion * 2) / 2))
    if payload.recomendado_por is not None:
        persona = _ensure_persona(payload.recomendado_por) if payload.recomendado_por.strip() else ""
        fm["recomendado_por"] = f"[[{persona}]]" if persona else ""
    _write_with_frontmatter(target, fm, body)
    trigger_auto_sync(f"actualiza serie/película {target.stem}")
    return {"status": "ok"}


# ================= PERSONAS, PROYECTOS & SALUD =================

WORKOUTS_FILE = HQ_META_DIR / "workouts.json"
SALUD_SUBFOLDERS = ["Entrenamiento", "Salud y estado", "Artículos y estudios"]


def _load_workouts() -> set[str]:
    if not WORKOUTS_FILE.exists():
        return set()
    try:
        data = json.loads(WORKOUTS_FILE.read_text(encoding="utf-8"))
        return set(data.get("dates", []))
    except Exception:
        return set()


def _save_workouts(dates: set[str]) -> None:
    HQ_META_DIR.mkdir(parents=True, exist_ok=True)
    WORKOUTS_FILE.write_text(
        json.dumps({"dates": sorted(dates)}, ensure_ascii=False, indent=2),
        encoding="utf-8",
    )


class NameCreatePayload(BaseModel):
    name: str


class WorkoutTogglePayload(BaseModel):
    date: str


@app.post("/api/personas")
def api_create_persona(payload: NameCreatePayload) -> dict[str, Any]:
    name = _ensure_persona(payload.name)
    if not name:
        raise HTTPException(status_code=400, detail="Nombre inválido")
    trigger_auto_sync(f"nueva persona {name}")
    return {"status": "ok", "name": name, "path": f"Personas/{name}/{name}.md"}


@app.post("/api/proyectos")
def api_create_proyecto(payload: NameCreatePayload) -> dict[str, Any]:
    clean = re.sub(r'[\\/:*?"<>|]', "", payload.name).strip()
    if not clean:
        raise HTTPException(status_code=400, detail="Nombre de proyecto inválido")
    proj_dir = VAULT_DIR / "Proyectos" / clean
    proj_dir.mkdir(parents=True, exist_ok=True)
    proj_note = proj_dir / f"{clean}.md"
    if not proj_note.exists():
        proj_note.write_text(f"# {clean}\n\n## Objetivo\n\n## Notas\n", encoding="utf-8")

    moc_proj = VAULT_DIR / "MOC" / "Proyectos.md"
    if moc_proj.exists():
        txt = moc_proj.read_text(encoding="utf-8")
        if f"[[{clean}]]" not in txt:
            lines = txt.splitlines()
            inserted = False
            for i, line in enumerate(lines):
                if "## Proyectos actuales" in line:
                    lines.insert(i + 1, f"- [[{clean}]]")
                    inserted = True
                    break
            if not inserted:
                lines.append(f"- [[{clean}]]")
            moc_proj.write_text("\n".join(lines) + "\n", encoding="utf-8")

    log_activity("Usuario", "Hecho", "Proyectos", f"Proyecto creado: {clean}")
    trigger_auto_sync(f"nuevo proyecto {clean}")
    return {"status": "ok", "name": clean, "path": f"Proyectos/{clean}/{clean}.md"}


@app.get("/api/salud")
def api_get_salud() -> dict[str, Any]:
    salud_dir = VAULT_DIR / "Salud"
    folders_data = {}
    for sub in SALUD_SUBFOLDERS:
        sub_dir = salud_dir / sub
        sub_dir.mkdir(parents=True, exist_ok=True)
        notes = []
        for p in sorted(sub_dir.glob("*.md"), key=lambda x: x.stat().st_mtime, reverse=True):
            raw = p.read_text(encoding="utf-8", errors="replace")
            _, body = split_frontmatter(raw)
            notes.append(
                {
                    "title": p.stem,
                    "path": p.relative_to(VAULT_DIR).as_posix(),
                    "excerpt": extract_excerpt(body),
                    "word_count": len(body.split()),
                }
            )
        folders_data[sub] = notes

    workout_dates = _load_workouts()
    today = date.today()
    # Current week: Monday to Sunday (or Sunday to Saturday — let's use Monday..Sunday for workouts!)
    monday = today - timedelta(days=today.weekday())
    day_names = ["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"]
    current_week = []
    done_this_week = 0
    for i in range(7):
        d = monday + timedelta(days=i)
        d_str = d.isoformat()
        trained = d_str in workout_dates
        if trained:
            done_this_week += 1
        current_week.append(
            {
                "date": d_str,
                "label": day_names[i],
                "day_num": d.day,
                "is_today": d == today,
                "trained": trained,
            }
        )

    week_pct = min(100, round((done_this_week / 4) * 100))

    return {
        "folders": folders_data,
        "workout": {
            "current_week": current_week,
            "done_this_week": done_this_week,
            "goal_days": 4,
            "percentage": week_pct,
            "all_dates": sorted(workout_dates),
        },
    }


@app.post("/api/salud/workout/toggle")
def api_toggle_workout(payload: WorkoutTogglePayload) -> dict[str, Any]:
    dates = _load_workouts()
    if payload.date in dates:
        dates.remove(payload.date)
        trained = False
    else:
        dates.add(payload.date)
        trained = True
    _save_workouts(dates)
    log_activity(
        "Usuario",
        "Hecho",
        "Salud",
        f"Entrenamiento {'marcado' if trained else 'desmarcado'} para {payload.date}",
    )
    trigger_auto_sync(f"entreno {payload.date}")
    return {"status": "ok", "trained": trained}


@app.get("/api/activity")
def get_activity(limit: int = Query(default=60, le=200)) -> dict[str, Any]:
    items = read_activity(limit=limit)
    return {"items": items}


# Serve built frontend if available
if FRONTEND_DIST.exists():
    assets_dir = FRONTEND_DIST / "assets"
    if assets_dir.exists():
        app.mount("/assets", StaticFiles(directory=str(assets_dir)), name="assets")

    @app.get("/{full_path:path}")
    def serve_spa(full_path: str):
        candidate = FRONTEND_DIST / full_path
        if full_path and candidate.exists() and candidate.is_file():
            return FileResponse(str(candidate))
        return FileResponse(str(FRONTEND_DIST / "index.html"))
