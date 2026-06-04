import makeWASocket, { useMultiFileAuthState, DisconnectReason, Browsers } from '@whiskeysockets/baileys';
import QRCode from 'qrcode';
import express from 'express';
import path from 'path';
import { createServer as createViteServer } from 'vite';
import { GoogleGenAI } from '@google/genai';
import * as dotenv from 'dotenv';
import cron from 'node-cron';
import * as admin from 'firebase-admin';
import { getFirestore } from 'firebase-admin/firestore';
import fs from 'fs';
import nodemailer from 'nodemailer';

dotenv.config();

// Configuración de transportador de correo (Nodemailer)
// Se deben configurar las variables de entorno en el .env
const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST || 'smtp.example.com',
  port: parseInt(process.env.SMTP_PORT || '587'),
  secure: process.env.SMTP_SECURE === 'true', // true for 465, false for other ports
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
});

// Load Firebase Config dynamically
let firebaseConfig: any = {};
try {
  const configPath = path.join(process.cwd(), 'firebase-applet-config.json');
  if (fs.existsSync(configPath)) {
    firebaseConfig = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
  }
} catch (e) {
  console.log('Could not load firebase-applet-config.json:', e);
}

// Initialize Firebase Admin (Relies on default credentials in prod, acts as stub if none provided locally)
let adminApp: admin.app.App | null = null;
try {
  if (firebaseConfig.projectId && !admin.apps.length) {
    adminApp = admin.initializeApp({
      projectId: firebaseConfig.projectId
    });
  }
} catch (e) {
  console.warn('Failed to initialize Firebase Admin:', e);
}

async function startServer() {
  const app = express();
  const PORT = 3000;
  
  app.use(express.json());

  // Tarea Cron (Se ejecuta diariamente a las 09:00 AM)
  cron.schedule('0 9 * * *', async () => {
    console.log('Ejecutando tarea programada (CRON): Verificando nuevos leads del portafolio...');
    try {
      if (!adminApp || !firebaseConfig.firestoreDatabaseId) {
        console.log('Firebase Admin o databaseId no disponible. Saltando tarea.');
        return;
      }
      
      const db = getFirestore(adminApp, firebaseConfig.firestoreDatabaseId);
      const yesterday = Date.now() - (24 * 60 * 60 * 1000);
      
      // Buscar clientes tipo 'lead' creados en las últimas 24 horas
      const q = db.collection('clients')
        .where('type', '==', 'lead')
        .where('status', '==', 'nuevo')
        .where('createdAt', '>=', yesterday);
        
      const snapshot = await q.get();
      
      if (snapshot.empty) {
        console.log('No hay leads nuevos hoy.');
        return;
      }
      
      const leadsByAgent: Record<string, any[]> = {};
      snapshot.forEach(doc => {
        const lead = doc.data();
        if (lead.agentId) {
          if (!leadsByAgent[lead.agentId]) {
            leadsByAgent[lead.agentId] = [];
          }
          leadsByAgent[lead.agentId].push({ id: doc.id, ...lead });
        }
      });
      
      // Enviar notificación por cada agente
      for (const [agentId, leads] of Object.entries(leadsByAgent)) {
        console.log(`[ALERTA AUTOMÁTICA] Agente ${agentId}: Tienes ${leads.length} prospectos nuevos desde el portafolio público.`);
        
        try {
          // Obtener datos del agente (opcional, si tienes una colección de agentes para obtener su email, aquí usaremos uno de prueba)
          // El email del agente en este caso debería obtenerse de la base de datos o Auth
          const agentEmail = process.env.AGENT_NOTIFICATION_EMAIL || "aminhatar01@gmail.com"; 

          const mailOptions = {
            from: `"Notificaciones AI Studio" <${process.env.SMTP_USER || 'no-reply@example.com'}>`,
            to: agentEmail,
            subject: `¡Tienes ${leads.length} nuevos leads del portafolio!`,
            text: `Hola, tienes ${leads.length} prospectos nuevos que han interactuado con tus propiedades desde tu portafolio público en las últimas 24 horas. Por favor, revisa tu panel de CRM.`,
            html: `
              <h2>Nuevos Leads en tu Portafolio</h2>
              <p>Hola,</p>
              <p>Tienes <strong>${leads.length}</strong> prospectos nuevos que se generaron desde tu portafolio público en las últimas 24 horas.</p>
              <p>Ingresa a tu CRM para revisarlos y contactarlos a la brevedad.</p>
              <br/>
              <p>Saludos,<br/>Equipo AI Studio</p>
            `,
          };

          const info = await transporter.sendMail(mailOptions);
          console.log(`Email enviado con éxito al agente ${agentId}: ${info.messageId}`);
        } catch (mailErr) {
          console.error(`Error enviando email al agente ${agentId}:`, mailErr);
        }
      }
    } catch (err) {
      console.error('Error durante la verificación de leads en cron job:', err);
    }
  });

  // Tarea Cron (Se ejecuta cada hora) - Verificación de leads inactivos >48h
  cron.schedule('0 * * * *', async () => {
    console.log('Ejecutando tarea programada (CRON): Verificando leads inactivos (>48h)...');
    try {
      if (!adminApp || !firebaseConfig.firestoreDatabaseId) {
        return;
      }
      
      const db = getFirestore(adminApp, firebaseConfig.firestoreDatabaseId);
      const fortyEightHoursAgo = Date.now() - (48 * 60 * 60 * 1000);
      
      // Buscar clientes tipo 'lead' que no han avanzado de 'nuevo' y tienen más de 48h de creados
      const q = db.collection('clients')
        .where('status', '==', 'nuevo')
        .where('createdAt', '<', fortyEightHoursAgo);
        
      const snapshot = await q.get();
      
      if (snapshot.empty) {
        console.log('No hay leads inactivos por más de 48h.');
        return;
      }

      const apiKey = process.env.GEMINI_API_KEY;
      
      if (!apiKey) {
        console.log('No se encuentra GEMINI_API_KEY, no se puede generar el mensaje de WhatsApp.');
        return;
      }

      const ai = new GoogleGenAI({ apiKey });
      const batch = db.batch();
      let processed = 0;
      
      for (const doc of snapshot.docs) {
        const lead = doc.data();
        
        // Evitamos volver a generar si ya se hizo
        if (lead.followUpDrafted) continue;
        
        const prompt = `Escribe un mensaje corto, amable y persuasivo para enviar por WhatsApp a un cliente llamado ${lead.name} que mostró interés en una propiedad o servicio (anotaciones: ${lead.notes || 'sin detalles'}) hace un par de días, pero no ha completado el contacto. El objetivo es reactivar la conversación sin ser invasivo. Responde sólo con el texto del mensaje y usa un tono profesional pero cercano, ideal para WhatsApp (con algún emoji relevante, pero no demasiados).`;

        try {
          const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: prompt,
            config: {
              temperature: 0.7,
            }
          });

          const followUpMessage = response.text || '';

          // Guardar el mensaje en una cola de WhatsApp (nueva colección)
          const queueRef = db.collection('whatsappQueue').doc();
          batch.set(queueRef, {
            clientId: doc.id,
            agentId: lead.agentId,
            clientName: lead.name,
            clientPhone: lead.phone,
            message: followUpMessage,
            status: 'pending',
            createdAt: Date.now()
          });

          // Marcar el lead como ya procesado para este seguimiento
          batch.update(doc.ref, { followUpDrafted: true });
          processed++;
          
        } catch (genErr) {
          console.error(`Error generando contenido para lead ${doc.id}:`, genErr);
        }
      }

      if (processed > 0) {
        await batch.commit();
        console.log(`Se procesaron ${processed} leads inactivos y se agregaron a la cola de seguimiento de WhatsApp.`);
      }
    } catch (err) {
      console.error('Error durante la verificación de leads inactivos en cron job:', err);
    }
  });

// En memoria para esta demo/applet
const waSessions: Record<string, { status: string; qr?: string; pairingCode?: string; method?: string; phone?: string; reason?: string }> = {};

app.post('/api/whatsapp/connect', async (req, res) => {
const startWhatsApp = async (userId: string, overrideMethod?: 'qr' | 'phone', overridePhone?: string) => {
    const authFolder = `wa_auth_${userId}`;
    const method = overrideMethod || waSessions[userId]?.method;
    const phone = overridePhone || waSessions[userId]?.phone;

    waSessions[userId] = { ...waSessions[userId], status: 'starting', method, phone };

    const { state, saveCreds } = await useMultiFileAuthState(authFolder);

    const sock = makeWASocket({
      auth: state,
      printQRInTerminal: false,
      browser: ['Ubuntu', 'Chrome', '10.0.0'],
    });

    sock.ev.on('creds.update', saveCreds);

    sock.ev.on('connection.update', async (update) => {
      const { connection, qr } = update;
      
      if (qr && waSessions[userId]?.method === 'qr') {
        try {
          const qrBase64 = await QRCode.toDataURL(qr);
          waSessions[userId] = { ...waSessions[userId], status: 'qr_ready', qr: qrBase64 };
        } catch (e) {
          console.error("Error generating QR:", e);
        }
      }

      if (connection === 'open') {
        waSessions[userId] = { ...waSessions[userId], status: 'connected' };
        console.log(`WhatsApp connected for user ${userId}`);
      }

      if (connection === 'close') {
        const statusCode = (update.lastDisconnect?.error as any)?.output?.statusCode;
        const shouldReconnect = statusCode !== DisconnectReason.loggedOut && statusCode !== 401; // 401 is conflict/device_removed
        console.log(`WhatsApp connection closed for ${userId}, reconnecting: ${shouldReconnect}, statusCode: ${statusCode}`);
        
        if (shouldReconnect) {
            waSessions[userId] = { ...waSessions[userId], status: 'starting', reason: update.lastDisconnect?.error?.message };
            setTimeout(() => startWhatsApp(userId), 2000);
        } else {
           waSessions[userId] = { ...waSessions[userId], status: 'disconnected', reason: update.lastDisconnect?.error?.message };
           // Delete session folder if logged out or conflict
           if (fs.existsSync(authFolder)) {
             fs.rmSync(authFolder, { recursive: true, force: true });
           }
        }
      }
    });

    if (method === 'phone' && phone && !sock.authState.creds.me) {
      setTimeout(async () => {
        try {
          const code = await sock.requestPairingCode(phone.replace(/[^0-9]/g, ''));
          waSessions[userId] = { ...waSessions[userId], status: 'code_ready', pairingCode: code };
        } catch (e) {
          console.error("Error requesting pairing code:", e);
          waSessions[userId] = { ...waSessions[userId], status: 'error' };
        }
      }, 3000); // Wait bit before requesting
    }
    
    return sock;
  };

  try {
    const { method, phone, userId } = req.body; // method: 'qr' | 'phone'
    if (!userId) return res.status(400).json({ error: 'User ID required' });

    // Si había una petición para conectar nuevamente, limpiamos el estado anterior para empezar fresco en caso de error
    const authFolder = `wa_auth_${userId}`;
    if (waSessions[userId] && ['disconnected', 'error'].includes(waSessions[userId].status)) {
      if (fs.existsSync(authFolder)) {
        fs.rmSync(authFolder, { recursive: true, force: true });
      }
    }

    waSessions[userId] = { status: 'starting', method, phone };
    await startWhatsApp(userId, method, phone);

    if (method === 'phone' && phone) {
      return res.json({ success: true, message: 'Requesting pairing code...' });
    }

    res.json({ success: true });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Internal error' });
  }
});

app.post('/api/whatsapp/reset', (req, res) => {
  const { userId } = req.body;
  if (!userId) return res.status(400).json({ error: 'User ID required' });
  
  waSessions[userId] = { status: 'none' };
  const authFolder = `wa_auth_${userId}`;
  if (fs.existsSync(authFolder)) {
    fs.rmSync(authFolder, { recursive: true, force: true });
  }
  
  res.json({ success: true });
});

app.get('/api/whatsapp/status/:userId', (req, res) => {
  const session = waSessions[req.params.userId];
  if (!session) {
    return res.json({ status: 'none' });
  }
  res.json(session);
});
  app.get('/api/webhook/whatsapp', (req, res) => {
    const verify_token = process.env.WHATSAPP_VERIFY_TOKEN || "inmocrm_webhook_token";
    const mode = req.query["hub.mode"];
    const token = req.query["hub.verify_token"];
    const challenge = req.query["hub.challenge"];

    if (mode && token) {
      if (mode === "subscribe" && token === verify_token) {
        console.log("WEBHOOK_VERIFIED");
        res.status(200).send(challenge);
      } else {
        res.sendStatus(403);
      }
    } else {
      res.sendStatus(400);
    }
  });

  // Endpoint para recibir mensajes vía Webhook de WhatsApp (POST)
  app.post('/api/webhook/whatsapp', async (req, res) => {
    try {
      if (!adminApp || !firebaseConfig.firestoreDatabaseId) {
        console.warn('Firebase no inicializado, webhook de WhatsApp ignorado');
        return res.sendStatus(200);
      }
      
      const db = getFirestore(adminApp, firebaseConfig.firestoreDatabaseId);

      // Verificamos que contenga objeto (WhatsApp Business Cloud API)
      if (req.body.object) {
        if (
          req.body.entry &&
          req.body.entry[0].changes &&
          req.body.entry[0].changes[0] &&
          req.body.entry[0].changes[0].value.messages &&
          req.body.entry[0].changes[0].value.messages[0]
        ) {
          const phoneNumber = req.body.entry[0].changes[0].value.messages[0].from; // El número desde el cual envían
          const messageText = req.body.entry[0].changes[0].value.messages[0].text?.body || "Mensaje sin texto";

          console.log(`Mensaje recibido de ${phoneNumber}: ${messageText}`);

          // Buscar leads con ese número telefónico
          // Se busca como llegó, o agregándole un '+' al inicio, dependiendo de cómo se guardó
          let q = db.collection('clients').where('phone', '==', phoneNumber);
          let snapshot = await q.get();

          if (snapshot.empty) {
            q = db.collection('clients').where('phone', '==', `+${phoneNumber}`);
            snapshot = await q.get();
          }

          if (!snapshot.empty) {
            const batch = db.batch();
            for (const doc of snapshot.docs) {
              const leadData = doc.data();
              const updateData: any = {};
              
              // Cambiar estado a 'contactado' si estaba en 'nuevo'
              if (leadData.status === 'nuevo') {
                updateData.status = 'contactado';
              }
              
              const currentNotes = leadData.notes || '';
              updateData.notes = `${currentNotes}\n\n[Mensaje WhatsApp ${new Date().toLocaleString()}]: ${messageText}`.trim();
              
              batch.update(doc.ref, updateData);
              console.log(`Lead ${doc.id} actualizado por respuesta de WhatsApp.`);
            }
            await batch.commit();
          } else {
            console.log(`Lead no encontrado para el número de remitente: ${phoneNumber}`);
          }
        }
        res.sendStatus(200);
      } else {
        res.sendStatus(404);
      }
    } catch (e) {
      console.error('Error procesando webhook de WhatsApp:', e);
      res.sendStatus(500);
    }
  });

  app.post('/api/test-email', async (req, res) => {
    try {
      const { email } = req.body;
      if (!email) {
        return res.status(400).json({ error: 'Email is required' });
      }

      const mailOptions = {
        from: `"Notificaciones AI Studio" <${process.env.SMTP_USER || 'no-reply@example.com'}>`,
        to: email,
        subject: `Prueba de Conexión SMTP`,
        text: `Hola, esta es una prueba de conexión SMTP desde tu panel de AI Studio.`,
        html: `
          <h2>Prueba Exitosa</h2>
          <p>Hola,</p>
          <p>Si estás recibiendo este mensaje, tu configuración SMTP está funcionando correctamente.</p>
          <br/>
          <p>Saludos,<br/>Equipo AI Studio</p>
        `,
      };

      const info = await transporter.sendMail(mailOptions);
      console.log(`Test email sent to ${email}: ${info.messageId}`);
      res.json({ success: true, messageId: info.messageId });
    } catch (error: any) {
      console.error(`Error sending test email:`, error);
      res.status(500).json({ error: error.message || 'Error sending test email' });
    }
  });

  app.post('/api/generate-copy', async (req, res) => {
    try {
      const { prompt, platform } = req.body;
      
      const apiKey = process.env.GEMINI_API_KEY;
      if (!apiKey) {
        return res.status(500).json({ error: 'GEMINI_API_KEY environment variable is missing.' });
      }

      const ai = new GoogleGenAI({ apiKey });
      
      const systemInstruction = `You are an expert real estate marketing copywriter. Create compelling, high-converting ad copy for ${platform}. Include relevant emojis and hashtags. Respond in Spanish. Please format your response in plain text.`;
      
      const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: prompt,
        config: {
          systemInstruction,
          temperature: 0.7,
        }
      });
      
      res.json({ copy: response.text });
    } catch (err: any) {
      console.error(err);
      res.status(500).json({ error: err.message || 'Error generating content' });
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    // Serve static files in production
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
