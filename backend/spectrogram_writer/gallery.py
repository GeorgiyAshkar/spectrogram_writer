from __future__ import annotations

import json
import os
import sqlite3
import uuid
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

ROOT_DIR = Path(__file__).resolve().parents[2]
DEFAULT_DB = ROOT_DIR / "data" / "music_gallery.sqlite3"
MAX_PROJECT_BYTES = 2_000_000


class GalleryError(ValueError):
    pass


def _db_path() -> Path:
    configured = os.getenv("MUSIC_GALLERY_DB")
    return Path(configured).expanduser().resolve() if configured else DEFAULT_DB


def _connect() -> sqlite3.Connection:
    path = _db_path()
    path.parent.mkdir(parents=True, exist_ok=True)
    connection = sqlite3.connect(path, timeout=10)
    connection.row_factory = sqlite3.Row
    connection.execute("PRAGMA journal_mode=WAL")
    connection.execute(
        """
        CREATE TABLE IF NOT EXISTS music_gallery (
            id TEXT PRIMARY KEY,
            title TEXT NOT NULL,
            author TEXT NOT NULL,
            created_at TEXT NOT NULL,
            project_json TEXT NOT NULL
        )
        """
    )
    return connection


def create_piece(title: str, author: str, project: dict[str, Any]) -> dict[str, Any]:
    clean_title = title.strip()
    clean_author = author.strip()
    if not clean_title:
        raise GalleryError("Title is required.")
    if not clean_author:
        raise GalleryError("Author is required.")

    project_json = json.dumps(project, ensure_ascii=False, separators=(",", ":"))
    if len(project_json.encode("utf-8")) > MAX_PROJECT_BYTES:
        raise GalleryError("Project is too large to publish.")

    piece_id = uuid.uuid4().hex
    created_at = datetime.now(timezone.utc).isoformat()

    with _connect() as connection:
        connection.execute(
            "INSERT INTO music_gallery (id, title, author, created_at, project_json) VALUES (?, ?, ?, ?, ?)",
            (piece_id, clean_title, clean_author, created_at, project_json),
        )
        connection.commit()

    return {
        "id": piece_id,
        "title": clean_title,
        "author": clean_author,
        "created_at": created_at,
    }


def list_pieces(limit: int = 30, offset: int = 0) -> list[dict[str, Any]]:
    safe_limit = max(1, min(100, int(limit)))
    safe_offset = max(0, int(offset))
    with _connect() as connection:
        rows = connection.execute(
            """
            SELECT id, title, author, created_at
            FROM music_gallery
            ORDER BY created_at DESC
            LIMIT ? OFFSET ?
            """,
            (safe_limit, safe_offset),
        ).fetchall()

    return [dict(row) for row in rows]


def get_piece(piece_id: str) -> dict[str, Any] | None:
    with _connect() as connection:
        row = connection.execute(
            """
            SELECT id, title, author, created_at, project_json
            FROM music_gallery
            WHERE id = ?
            """,
            (piece_id,),
        ).fetchone()

    if row is None:
        return None

    return {
        "id": row["id"],
        "title": row["title"],
        "author": row["author"],
        "created_at": row["created_at"],
        "project": json.loads(row["project_json"]),
    }
