
import numpy as np
from sklearn.preprocessing import normalize
from .insightface_manager import manager

class FaceEmbedder:
    def __init__(self):
        self.rec_model = manager.get_rec_model()

    def get_embedding(self, aligned_face: np.ndarray) -> np.ndarray:
        """
        Forward pass through ArcFace (ResNet100).
        Returns a 512-d L2-normalized numpy array.
        """
        # get_feat does the forward pass
        # Input: (112, 112, 3)
        embedding = self.rec_model.get_feat(aligned_face)
        
        # Ensure flattened
        embedding = embedding.flatten().reshape(1, -1)
        
        # MANDATORY: L2 Normalization
        # Critical for Cosine Similarity to work as Dot Product
        norm_embedding = normalize(embedding, norm='l2', axis=1).flatten()
        
        return norm_embedding
