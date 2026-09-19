import os
import tempfile
import unittest
from pathlib import Path

from backend.spectrogram_writer import gallery


class MusicGalleryTests(unittest.TestCase):
    def setUp(self) -> None:
        self._tmp = tempfile.TemporaryDirectory()
        self._old_db = os.environ.get("MUSIC_GALLERY_DB")
        os.environ["MUSIC_GALLERY_DB"] = str(Path(self._tmp.name) / "gallery.sqlite3")

    def tearDown(self) -> None:
        if self._old_db is None:
            os.environ.pop("MUSIC_GALLERY_DB", None)
        else:
            os.environ["MUSIC_GALLERY_DB"] = self._old_db
        self._tmp.cleanup()

    def test_create_list_and_get_piece(self) -> None:
        thumbnail = "data:image/jpeg;base64,AA=="
        created = gallery.create_piece(
            title="  Test piece  ",
            author="  Tester  ",
            project={"schemaVersion": 1, "strokes": []},
            thumbnail=thumbnail,
        )

        self.assertEqual(created["title"], "Test piece")
        self.assertEqual(created["author"], "Tester")
        self.assertEqual(created["thumbnail"], thumbnail)
        self.assertTrue(created["id"])

        items = gallery.list_pieces()
        self.assertEqual(len(items), 1)
        self.assertEqual(items[0]["id"], created["id"])
        self.assertEqual(items[0]["thumbnail"], thumbnail)

        detail = gallery.get_piece(created["id"])
        self.assertIsNotNone(detail)
        assert detail is not None
        self.assertEqual(detail["project"]["schemaVersion"], 1)
        self.assertEqual(detail["project"]["strokes"], [])
        self.assertEqual(detail["thumbnail"], thumbnail)

    def test_latest_piece_is_first(self) -> None:
        first = gallery.create_piece("First", "A", {"schemaVersion": 1})
        second = gallery.create_piece("Second", "B", {"schemaVersion": 1})

        items = gallery.list_pieces()
        self.assertEqual([items[0]["id"], items[1]["id"]], [second["id"], first["id"]])

    def test_missing_piece_returns_none(self) -> None:
        self.assertIsNone(gallery.get_piece("does-not-exist"))

    def test_title_and_author_are_required(self) -> None:
        with self.assertRaises(gallery.GalleryError):
            gallery.create_piece("", "Author", {"schemaVersion": 1})

        with self.assertRaises(gallery.GalleryError):
            gallery.create_piece("Title", "  ", {"schemaVersion": 1})

    def test_invalid_thumbnail_is_rejected(self) -> None:
        with self.assertRaises(gallery.GalleryError):
            gallery.create_piece(
                "Bad thumb",
                "Tester",
                {"schemaVersion": 2},
                thumbnail="https://example.com/not-data-url.jpg",
            )

    def test_large_project_is_rejected(self) -> None:
        oversized = {"schemaVersion": 1, "payload": "x" * (gallery.MAX_PROJECT_BYTES + 100)}

        with self.assertRaises(gallery.GalleryError):
            gallery.create_piece("Large", "Tester", oversized)

    def test_limit_is_clamped(self) -> None:
        for index in range(3):
            gallery.create_piece(
                title=f"Piece {index}",
                author="Tester",
                project={"schemaVersion": 1, "index": index},
            )

        self.assertEqual(len(gallery.list_pieces(limit=0)), 1)
        self.assertEqual(len(gallery.list_pieces(limit=999)), 3)


if __name__ == "__main__":
    unittest.main()
