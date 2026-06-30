
import numpy as np
from typing import Tuple, Dict
from .config import settings

class FaceMatcher:
    """
    Stateless matcher using linear algebra.
    """

    @staticmethod
    def match_one_to_many(target_emb: np.ndarray, database: Dict[str, np.ndarray]) -> Tuple[str, float]:
        """
        Compares target embedding against a dictionary of {person_id: embedding}.
        Returns (best_person_id, best_score).
        """
        if not database:
            return None, 0.0

        # Prepare matrices
        ids = list(database.keys())
        
        # Stack embeddings into Matrix M (N, 512)
        # Assuming embeddings in DB are already L2 normalized
        db_matrix = np.stack(list(database.values()))
        
        # Target vector T (512,)
        # Cosine Similarity = (A . B) / (||A||*||B||)
        # Since vectors are already L2 normalized, it simplifies to Dot Product.
        scores = np.dot(db_matrix, target_emb)
        
        # Find max
        best_idx = np.argmax(scores)
        best_score = scores[best_idx]
        
        if best_score >= settings.REC_THRESHOLD:
            return ids[best_idx], float(best_score)
        
        return "Unknown", float(best_score)
