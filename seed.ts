import { initializeApp } from 'firebase/app';
import { getFirestore, doc, setDoc } from 'firebase/firestore';
import { getAuth, signInAnonymously } from 'firebase/auth';
import firebaseConfig from './firebase-applet-config.json' assert { type: "json" };

const app = initializeApp(firebaseConfig);
const db = getFirestore(app, firebaseConfig.firestoreDatabaseId);
const auth = getAuth(app);

async function seed() {
    await signInAnonymously(auth);
    const userId = "U-" + Math.floor(100000 + Math.random() * 900000);
    await setDoc(doc(db, 'users', userId), {
        id: userId,
        fullName: "Alisher Navoiy",
        role: "EMPLOYEE",
        department: "IT Department",
        enrolledDate: new Date().toISOString().split('T')[0],
        hasEmbedding: false,
        lastActive: "Hozirgina",
        avatarUrl: "https://ui-avatars.com/api/?name=Alisher+Navoiy"
    });
    console.log("Profile created:", userId);
    process.exit(0);
}
seed().catch(console.error);
