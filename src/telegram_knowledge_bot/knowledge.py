from __future__ import annotations

import hashlib
import logging
from dataclasses import dataclass
from pathlib import Path
from typing import Iterable

import numpy as np
from pypdf import PdfReader
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.metrics.pairwise import cosine_similarity

log = logging.getLogger(__name__)
SUPPORTED_EXTS = {".txt", ".md", ".pdf"}


@dataclass(frozen=True)
class Chunk:
    id: str
    source: str
    index: int
    text: str


class KnowledgeBase:
    def __init__(self, root: str, chunk_chars: int = 1800, overlap: int = 250) -> None:
        self.root = Path(root)
        self.chunk_chars = chunk_chars
        self.overlap = overlap
        self.chunks: list[Chunk] = []
        self.vectorizer: TfidfVectorizer | None = None
        self.matrix = None

    def load(self) -> None:
        self.root.mkdir(parents=True, exist_ok=True)
        docs = list(self._iter_documents())
        self.chunks = []
        for source, text in docs:
            self.chunks.extend(self._chunk(source, text))

        if not self.chunks:
            log.warning("No knowledge docs found in %s", self.root)
            self.vectorizer = None
            self.matrix = None
            return

        self.vectorizer = TfidfVectorizer(stop_words=None, ngram_range=(1, 2), max_features=50000)
        self.matrix = self.vectorizer.fit_transform([c.text for c in self.chunks])
        log.info("Loaded %s chunks from %s documents", len(self.chunks), len(docs))

    def search(self, query: str, limit: int = 6, min_score: float = 0.03) -> list[tuple[Chunk, float]]:
        if not self.chunks or self.vectorizer is None or self.matrix is None:
            return []
        q = self.vectorizer.transform([query])
        scores = cosine_similarity(q, self.matrix).ravel()
        if scores.size == 0:
            return []
        top_idx = np.argsort(scores)[::-1][:limit]
        return [(self.chunks[i], float(scores[i])) for i in top_idx if scores[i] >= min_score]

    def build_context(self, query: str, max_chars: int) -> tuple[str, list[str]]:
        hits = self.search(query)
        parts: list[str] = []
        sources: list[str] = []
        used = 0
        for chunk, score in hits:
            block = f"[Source: {chunk.source} | chunk {chunk.index} | score {score:.3f}]\n{chunk.text.strip()}\n"
            if used + len(block) > max_chars:
                break
            parts.append(block)
            sources.append(f"{chunk.source}#chunk-{chunk.index}")
            used += len(block)
        return "\n---\n".join(parts), sources

    def _iter_documents(self) -> Iterable[tuple[str, str]]:
        for path in sorted(self.root.rglob("*")):
            if not path.is_file() or path.suffix.lower() not in SUPPORTED_EXTS:
                continue
            try:
                yield str(path.relative_to(self.root)), self._read_file(path)
            except Exception:
                log.exception("Failed reading %s", path)

    def _read_file(self, path: Path) -> str:
        if path.suffix.lower() == ".pdf":
            reader = PdfReader(str(path))
            return "\n".join(page.extract_text() or "" for page in reader.pages)
        return path.read_text(encoding="utf-8", errors="ignore")

    def _chunk(self, source: str, text: str) -> list[Chunk]:
        text = "\n".join(line.rstrip() for line in text.splitlines()).strip()
        if not text:
            return []
        chunks: list[Chunk] = []
        start = 0
        idx = 1
        while start < len(text):
            end = min(start + self.chunk_chars, len(text))
            piece = text[start:end].strip()
            if piece:
                digest = hashlib.sha1(f"{source}:{idx}:{piece[:80]}".encode()).hexdigest()[:12]
                chunks.append(Chunk(id=digest, source=source, index=idx, text=piece))
                idx += 1
            if end >= len(text):
                break
            start = max(0, end - self.overlap)
        return chunks
