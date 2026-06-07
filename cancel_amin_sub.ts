import * as dotenv from 'dotenv';
import admin from 'firebase-admin';
import { getFirestore } from 'firebase-admin/firestore';
import fs from 'fs';
import path from 'path';

dotenv.config();

let firebaseConfig: any = {};
try {
  const configPath = path.join(process.cwd(), 'firebase-applet-config.json');
  if (fs.existsSync(configPath)) {
    firebaseConfig = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
  }
} catch (e) {
  console.log('Could not load firebase-applet-config.json:', e);
}

if (!admin.apps.length && firebaseConfig.projectId) {
  admin.initializeApp({
    projectId: firebaseConfig.projectId
  });
}

async function run() {
  try {
    const db = getFirestore(admin.app(), firebaseConfig.firestoreDatabaseId);
    // Find user by email (actually, we don't have email in auth if we can't search, but we might have it in the user doc `email` or `contactEmail`)
    // Actually we can list users from auth, or query firestore 'users' collection
    console.log("Searching for aminhatar01@gmail.com in Firestore 'users'...");
    
    // Auth
    let userRecord;
    try {
        userRecord = await admin.auth().getUserByEmail("aminhatar01@gmail.com");
    } catch(e) {
        console.log("Not found in Auth via email, trying contactEmail in DB.");
    }

    let uid = userRecord?.uid;

    if (!uid) {
        const q = db.collection('users').where('email', '==', 'aminhatar01@gmail.com');
        const snap = await q.get();
        if (!snap.empty) {
            uid = snap.docs[0].id;
        } else {
            const q2 = db.collection('users').where('contactEmail', '==', 'aminhatar01@gmail.com');
            const snap2 = await q2.get();
            if (!snap2.empty) {
                uid = snap2.docs[0].id;
            }
        }
    }

    if (uid) {
        console.log(`Found user: ${uid}. Updating subscription to canceled.`);
        await db.collection('users').doc(uid).update({
            'subscription.status': 'canceled'
        });
        console.log('Successfully canceled subscription!');
    } else {
        console.log('User aminhatar01@gmail.com not found.');
    }
  } catch (error) {
    console.error('Error:', error);
  }
}

run();
