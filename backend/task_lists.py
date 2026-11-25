from __future__ import annotations

import json
import re
import uuid
from datetime import datetime
from pathlib import Path
from typing import Any, Optional

META_RE = re.compile(r"\s*<!--\s*hq:(\{.*?\})\s*-->\s*$")
TASK_LINE_RE = re.compile(r"^(\s*)[-*]\s+\[([ xX])\]\s+(.*)$")


def _new_id(prefix: str = "t") -> str:
    return f"{prefix}_{uuid.uuid4().hex[:8]}"


def ensure_default_lists(tareas_dir: Path) -> None:
    tareas_dir.mkdir(parents=True, exist_ok=True)
    if any(tareas_dir.glob("*.md")):
        return
    (tareas_dir / "General.md").write_text(
        "# General\n\n## Pendientes\n\n## Archivadas\n",
        encoding="utf-8",
    )
    (tareas_dir / "Urgentes.md").write_text(
        "# Urgentes\n\n## Pendientes\n\n## Archivadas\n",
        encoding="utf-8",
    )


def _parse_task_line(raw_line: str) -> Optional[dict[str, Any]]:
    m = TASK_LINE_RE.match(raw_line)
    if not m:
        return None
    indent = len(m.group(1))
    done = m.group(2).lower() == "x"
    rest = m.group(3)
    meta: dict[str, Any] = {}
    mm = META_RE.search(rest)
    if mm:
        try:
            meta = json.loads(mm.group(1))
        except json.JSONDecodeError:
            meta = {}
        rest = rest[: mm.start()].strip()
    else:
        rest = rest.strip()

    return {
        "indent": indent,
        "id": meta.get("id") or _new_id("t" if indent == 0 else "st"),
        "text": rest,
        "done": done,
        "created": meta.get("created") or datetime.now().isoformat(timespec="seconds"),
        "due": meta.get("due") or "",
        "subtasks": [],
    }


def _format_task_line(task: dict[str, Any], indent_str: str = "") -> str:
    mark = "x" if task.get("done") else " "
    meta = {
        "id": task["id"],
        "created": task.get("created") or datetime.now().isoformat(timespec="seconds"),
    }
    if task.get("due"):
        meta["due"] = task["due"]
    meta_json = json.dumps(meta, ensure_ascii=False, separators=(",", ":"))
    return f"{indent_str}- [{mark}] {task['text']} <!-- hq:{meta_json} -->"


def parse_list_file(path: Path) -> dict[str, Any]:
    raw = path.read_text(encoding="utf-8", errors="replace")
    title = path.stem
    pending: list[dict[str, Any]] = []
    archived: list[dict[str, Any]] = []
    section = "pending"
    current_parent: Optional[dict[str, Any]] = None

    for line in raw.splitlines():
        s = line.strip()
        if s.startswith("# "):
            title = s[2:].strip() or path.stem
            continue
        if s.lower().startswith("## "):
            hdr = s[3:].strip().lower()
            section = "archived" if "archiv" in hdr else "pending"
            current_parent = None
            continue

        parsed = _parse_task_line(line)
        if not parsed:
            continue

        target_list = archived if section == "archived" else pending
        if parsed["indent"] >= 2 and current_parent is not None:
            current_parent["subtasks"].append(
                {
                    "id": parsed["id"],
                    "text": parsed["text"],
                    "done": parsed["done"],
                    "created": parsed["created"],
                }
            )
        else:
            parsed.pop("indent", None)
            target_list.append(parsed)
            current_parent = parsed

    return {
        "name": path.stem,
        "title": title,
        "file_path": f"Tareas/{path.name}",
        "pending": pending,
        "archived": archived,
    }


def write_list_file(path: Path, data: dict[str, Any]) -> None:
    lines = [f"# {data.get('title') or path.stem}", "", "## Pendientes"]
    for t in data.get("pending", []):
        lines.append(_format_task_line(t, ""))
        for st in t.get("subtasks", []):
            lines.append(_format_task_line(st, "  "))
    lines.extend(["", "## Archivadas"])
    for t in data.get("archived", []):
        lines.append(_format_task_line(t, ""))
        for st in t.get("subtasks", []):
            lines.append(_format_task_line(st, "  "))
    lines.append("")
    path.write_text("\n".join(lines), encoding="utf-8")


def get_all_lists(tareas_dir: Path) -> list[dict[str, Any]]:
    ensure_default_lists(tareas_dir)
    lists = []
    for p in sorted(tareas_dir.glob("*.md"), key=lambda x: x.stem.lower()):
        lists.append(parse_list_file(p))
    return lists
