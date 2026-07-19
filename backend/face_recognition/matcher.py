
import numpy as np
from typing import Tuple, Dict, List, Optional
from .config import settings


class FaceMatcher:
    """
    Stateless embedding matcher. Uses the EmbeddingStore's built-in FAISS search
    when available; falls back to numpy linear scan for small datasets.
    """

    @staticmethod
    def match_one_to_many(
        target_emb: np.ndarray,
        database: Dict[str, np.ndarray],
    ) -> Tuple[Optional[str], float]:
        """
        Compare target embedding against a {person_id: embedding} dictionary.
        Returns (best_person_id, best_score). Returns ("Unknown", score) when below threshold.
        """
        if not database:
            return None, 0.0

        # L2-normalize the query vector
        q = target_emb.astype(np.float32)
        norm = np.linalg.norm(q)
        if norm > 0:
            q = q / norm

        ids = list(database.keys())
        db_matrix = np.stack(list(database.values())).astype(np.float32)

        # L2-normalize DB rows too (defensive; InsightFace should already normalize)
        row_norms = np.linalg.norm(db_matrix, axis=1, keepdims=True)
        row_norms = np.where(row_norms == 0, 1.0, row_norms)
        db_matrix = db_matrix / row_norms

        scores = db_matrix @ q  # Cosine similarity
        best_idx = int(np.argmax(scores))
        best_score = float(scores[best_idx])

        if best_score >= settings.REC_THRESHOLD:
            return ids[best_idx], best_score
        return "Unknown", best_score

    @staticmethod
    def match_with_store(
        target_emb: np.ndarray,
        store,  # EmbeddingStore instance
        top_k: int = 1,
    ) -> List[Tuple[Optional[str], float]]:
        """
        Use EmbeddingStore.search() which internally picks FAISS or numpy based on
        dataset size. Returns list of (person_id, score) sorted by descending score.
        """
        if store is None or len(store) == 0:
            return [("Unknown", 0.0)]

        results = store.search(target_emb, top_k=top_k)
        if not results:
            return [("Unknown", 0.0)]
        return results

    @staticmethod
    def match_top_k(
        target_emb: np.ndarray,
        database: Dict[str, np.ndarray],
        top_k: int = 5,
        threshold: float = None,
    ) -> List[Tuple[str, float]]:
        """
        Return the top-k matches above threshold from a dict, using numpy.
        Useful for small in-memory galleries.
        """
        threshold = threshold if threshold is not None else settings.REC_THRESHOLD
        if not database:
            return []

        q = target_emb.astype(np.float32)
        norm = np.linalg.norm(q)
        if norm > 0:
            q = q / norm

        ids = list(database.keys())
        db_matrix = np.stack(list(database.values())).astype(np.float32)
        row_norms = np.linalg.norm(db_matrix, axis=1, keepdims=True)
        row_norms = np.where(row_norms == 0, 1.0, row_norms)
        db_matrix = db_matrix / row_norms

        scores = db_matrix @ q
        order = np.argsort(-scores)
        results = []
        for idx in order[:top_k]:
            sim = float(scores[idx])
            if sim >= threshold:
                results.append((ids[idx], sim))
        return results
