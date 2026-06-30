import { User } from '../types';
import { collection, getDocs, doc, setDoc, deleteDoc } from 'firebase/firestore';
import { db, getLocalCache, setLocalCache, handleFirestoreError, OperationType, ensureAuthenticated } from './firestoreService';
import { mockUsers } from './mockData';

const CACHE_KEY = 'sentinel_users_cache';

function sanitizeUser(user: User): any {
    const allowedKeys = [
        'id', 'fullName', 'role', 'department', 'enrolledDate', 
        'hasEmbedding', 'lastActive', 'avatarUrl'
    ];
    const sanitized: any = {};
    for (const key of allowedKeys) {
        const val = (user as any)[key];
        if (val !== undefined && val !== null) {
            sanitized[key] = val;
        }
    }
    return sanitized;
}

export const userService = {
    getAllUsers: async (): Promise<User[]> => {
        try {
            await ensureAuthenticated();
            const querySnapshot = await getDocs(collection(db, 'users'));
            const users = querySnapshot.docs.map(doc => doc.data() as User);
            if (users.length > 0) {
                setLocalCache(CACHE_KEY, users);
            }
            return users.length > 0 ? users : getLocalCache(CACHE_KEY, mockUsers);
        } catch (e) {
            console.warn('Firestore getAllUsers failed, falling back to local cache:', e);
            try {
                handleFirestoreError(e, OperationType.GET, 'users');
            } catch (err) {
                // Logged successfully to console by handleFirestoreError, ignore for runtime fallback
            }
            return getLocalCache(CACHE_KEY, mockUsers);
        }
    },

    saveUser: async (user: User): Promise<void> => {
        // Save to local cache first
        const current = getLocalCache<User>(CACHE_KEY, mockUsers);
        const exists = current.findIndex(u => u.id === user.id);
        if (exists >= 0) {
            current[exists] = user;
        } else {
            current.push(user);
        }
        setLocalCache(CACHE_KEY, current);

        // Try syncing with Firestore
        try {
            await ensureAuthenticated();
            const sanitized = sanitizeUser(user);
            await setDoc(doc(db, 'users', user.id), sanitized);
        } catch (e) {
            console.warn(`Firestore saveUser for ${user.id} failed, saved locally:`, e);
            try {
                handleFirestoreError(e, OperationType.WRITE, `users/${user.id}`);
            } catch (err) {
                // Logged successfully
            }
        }
    },

    deleteUser: async (userId: string): Promise<void> => {
        // Delete from local cache first
        const current = getLocalCache<User>(CACHE_KEY, mockUsers);
        const updated = current.filter(u => u.id !== userId);
        setLocalCache(CACHE_KEY, updated);

        // Try syncing with Firestore
        try {
            await ensureAuthenticated();
            await deleteDoc(doc(db, 'users', userId));
        } catch (e) {
            console.warn(`Firestore deleteUser for ${userId} failed, deleted locally:`, e);
            try {
                handleFirestoreError(e, OperationType.DELETE, `users/${userId}`);
            } catch (err) {
                // Logged successfully
            }
        }
    }
};

