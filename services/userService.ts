import { User } from '../types';
import { collection, getDocs, doc, setDoc, deleteDoc } from 'firebase/firestore';
import { db, getLocalCache, setLocalCache, handleFirestoreError, OperationType } from './firestoreService';

const CACHE_KEY = 'sentinel_users_cache';

function sanitizeUser(user: User): any {
    const allowedKeys = [
        'id', 'fullName', 'role', 'department', 'enrolledDate', 
        'hasEmbedding', 'lastActive', 'avatarUrl', 'faceDescriptor'
    ];
    const sanitized: any = {};
    for (const key of allowedKeys) {
        const val = (user as any)[key];
        if (val !== undefined && val !== null) {
            sanitized[key] = val;
        }
    }
    if (sanitized.faceDescriptor && sanitized.faceDescriptor.length !== undefined) {
        sanitized.faceDescriptor = Array.from(sanitized.faceDescriptor);
    }
    return sanitized;
}

export const userService = {
    getAllUsers: async (): Promise<User[]> => {
        try {
            const querySnapshot = await getDocs(collection(db, 'users'));
            const users = querySnapshot.docs.map(doc => doc.data() as User);
            if (users.length > 0) {
                setLocalCache(CACHE_KEY, users);
            }
            return users;
        } catch (e) {
            console.error('Firestore getAllUsers failed:', e);
            try {
                handleFirestoreError(e, OperationType.GET, 'users');
            } catch (err) {
                // Logged
            }
            return getLocalCache(CACHE_KEY, []);
        }
    },

    saveUser: async (user: User): Promise<void> => {
        // Update local cache
        const current = getLocalCache<User>(CACHE_KEY, []);
        const exists = current.findIndex(u => u.id === user.id);
        if (exists >= 0) {
            current[exists] = user;
        } else {
            current.push(user);
        }
        setLocalCache(CACHE_KEY, current);

        // Sync with Firestore
        try {
            const sanitized = sanitizeUser(user);
            await setDoc(doc(db, 'users', user.id), sanitized);
        } catch (e) {
            console.error(`Firestore saveUser for ${user.id} failed:`, e);
            handleFirestoreError(e, OperationType.WRITE, `users/${user.id}`);
            throw e; // Propagate error in production
        }
    },

    deleteUser: async (userId: string): Promise<void> => {
        // Update local cache
        const current = getLocalCache<User>(CACHE_KEY, []);
        const updated = current.filter(u => u.id !== userId);
        setLocalCache(CACHE_KEY, updated);

        // Sync with Firestore
        try {
            await deleteDoc(doc(db, 'users', userId));
        } catch (e) {
            console.error(`Firestore deleteUser for ${userId} failed:`, e);
            handleFirestoreError(e, OperationType.DELETE, `users/${userId}`);
            throw e;
        }
    }
};

