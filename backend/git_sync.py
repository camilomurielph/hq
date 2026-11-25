from __future__ import annotations

import os
import shutil
import subprocess
import threading
from pathlib import Path
from typing import Any, Optional
from urllib.parse import quote, urlparse, urlunparse

_git_lock = threading.Lock()


def _find_git_bin() -> Optional[str]:
    found = shutil.which("git")
    if found:
        return found
    for candidate in (
        r"C:\Program Files\Git\cmd\git.exe",
        r"C:\Program Files\Git\bin\git.exe",
        os.path.expandvars(r"%LOCALAPPDATA%\Programs\Git\cmd\git.exe"),
    ):
        if Path(candidate).exists():
            return candidate
    return None


def _build_auth_url(repo_url: str, token: str) -> str:
    if not token or not repo_url.startswith("http"):
        return repo_url
    parsed = urlparse(repo_url)
    netloc = f"x-access-token:{quote(token, safe='')}@{parsed.hostname}"
    if parsed.port:
        netloc += f":{parsed.port}"
    return urlunparse((parsed.scheme, netloc, parsed.path, parsed.params, parsed.query, parsed.fragment))


def _sanitize(text: str, token: str) -> str:
    if token:
        return text.replace(token, "***")
    return text


def _run_git(args: list[str], cwd: Path, token: str = "", timeout: int = 30) -> tuple[bool, str]:
    git_bin = _find_git_bin()
    if not git_bin:
        return False, "git no está instalado en el sistema"
    env = os.environ.copy()
    env["GIT_TERMINAL_PROMPT"] = "0"
    try:
        proc = subprocess.run(
            [git_bin, *args],
            cwd=str(cwd),
            capture_output=True,
            text=True,
            encoding="utf-8",
            errors="replace",
            timeout=timeout,
            env=env,
        )
        out = ((proc.stdout or "") + ("\n" + proc.stderr if proc.stderr else "")).strip()
        return proc.returncode == 0, _sanitize(out, token)
    except Exception as exc:
        return False, _sanitize(str(exc), token)


def ensure_vault_repo(vault_dir: Path, repo_url: str, token: str) -> dict[str, Any]:
    """Clones the vault repo if missing, or ensures git identity and remote are configured."""
    with _git_lock:
        if not vault_dir.exists() or not (vault_dir / ".git").exists():
            if not repo_url:
                return {"ok": False, "message": "VAULT_REPO_URL no configurado y no existe .git local."}
            vault_dir.parent.mkdir(parents=True, exist_ok=True)
            auth_url = _build_auth_url(repo_url, token)
            ok, out = _run_git(["clone", auth_url, str(vault_dir)], cwd=vault_dir.parent, token=token, timeout=90)
            if not ok:
                return {"ok": False, "message": f"Error clonando repositorio: {out}"}
        elif repo_url and token:
            auth_url = _build_auth_url(repo_url, token)
            _run_git(["remote", "set-url", "origin", auth_url], cwd=vault_dir, token=token)

        git_name = os.environ.get("GIT_USER_NAME", "Obsidian HQ")
        git_email = os.environ.get("GIT_USER_EMAIL", "hq@obsidian.local")
        _run_git(["config", "user.name", git_name], cwd=vault_dir, token=token)
        _run_git(["config", "user.email", git_email], cwd=vault_dir, token=token)
        return {"ok": True, "message": "Repositorio listo"}


def get_git_status(vault_dir: Path, token: str = "") -> dict[str, Any]:
    if not _find_git_bin():
        return {"is_git": False, "git_available": False, "branch": None, "dirty": False, "changes": 0, "last_commit": None}
    if not (vault_dir / ".git").exists():
        return {"is_git": False, "git_available": True, "branch": None, "dirty": False, "changes": 0, "last_commit": None}

    with _git_lock:
        _, branch = _run_git(["rev-parse", "--abbrev-ref", "HEAD"], cwd=vault_dir, token=token)
        _, status_out = _run_git(["status", "--porcelain"], cwd=vault_dir, token=token)
        changes = [line for line in status_out.splitlines() if line.strip()]
        _, last_commit = _run_git(
            ["log", "-1", "--pretty=format:%h · %s (%cr)"], cwd=vault_dir, token=token
        )
        return {
            "is_git": True,
            "branch": branch.strip() or "main",
            "dirty": len(changes) > 0,
            "changes": len(changes),
            "last_commit": last_commit.strip(),
        }


def sync_vault(
    vault_dir: Path,
    repo_url: str,
    token: str,
    commit_message: str = "HQ: sincronización automática",
    push: bool = True,
) -> dict[str, Any]:
    """Safely pulls remote changes (rebase + autostash), commits local edits, and pushes."""
    if not (vault_dir / ".git").exists():
        return {"ok": False, "message": "El directorio del vault no es un repositorio Git."}

    with _git_lock:
        if repo_url and token:
            auth_url = _build_auth_url(repo_url, token)
            _run_git(["remote", "set-url", "origin", auth_url], cwd=vault_dir, token=token)

        _, branch = _run_git(["rev-parse", "--abbrev-ref", "HEAD"], cwd=vault_dir, token=token)
        branch = branch.strip() or "main"

        # 1. Stage & commit local changes first if any, so nothing is lost
        _, status_out = _run_git(["status", "--porcelain"], cwd=vault_dir, token=token)
        committed = False
        if status_out.strip():
            _run_git(["add", "-A"], cwd=vault_dir, token=token)
            ok_c, out_c = _run_git(["commit", "-m", commit_message], cwd=vault_dir, token=token)
            committed = ok_c
            if not ok_c and "nothing to commit" not in out_c.lower():
                return {"ok": False, "message": f"Error en commit: {out_c}"}

        # 2. Pull with rebase & autostash
        ok_pull, out_pull = _run_git(
            ["pull", "--rebase", "--autostash", "origin", branch],
            cwd=vault_dir,
            token=token,
            timeout=60,
        )
        if not ok_pull:
            # Abort rebase if there's a conflict so the repo stays clean
            _run_git(["rebase", "--abort"], cwd=vault_dir, token=token)
            return {
                "ok": False,
                "message": f"Conflicto o error al hacer git pull: {out_pull}",
            }

        # 3. Push if requested and we committed or are ahead
        pushed = False
        if push:
            ok_push, out_push = _run_git(
                ["push", "origin", branch], cwd=vault_dir, token=token, timeout=60
            )
            if not ok_push:
                return {"ok": False, "message": f"Error al hacer git push: {out_push}"}
            pushed = True

        return {
            "ok": True,
            "branch": branch,
            "committed": committed,
            "pushed": pushed,
            "message": "Sincronizado correctamente con GitHub",
        }
