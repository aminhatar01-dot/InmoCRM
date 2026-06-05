const admin = require('firebase-admin');
try {
  const adminApp = admin.initializeApp({ projectId: 'project-f8f06e59-a2fc-42bf-9b4' });
  console.log("Success", !!adminApp);
} catch (e) {
  console.log("Failed", e);
}
