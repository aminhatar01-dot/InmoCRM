import makeWASocket, { useMultiFileAuthState, DisconnectReason, Browsers } from '@whiskeysockets/baileys';
import QRCode from 'qrcode';
import express from 'express';
import path from 'path';
import { createServer as createViteServer } from 'vite';
import { GoogleGenAI } from '@google/genai';
import * as dotenv from 'dotenv';
import cron from 'node-cron';
import admin from 'firebase-admin';
import { getFirestore } from 'firebase-admin/firestore';
import fs from 'fs';
import nodemailer from 'nodemailer';
import { MercadoPagoConfig, Preference, Payment } from 'mercadopago';

// Sync modules
import { publishToMercadoLibre, updateMercadoLibreListing, changeMercadoLibreStatus } from './src/sync/mercadolibre';
import { publishToArgenprop, updateArgenpropListing } from './src/sync/argenprop';
import { publishToZonaprop, updateZonapropListing } from './src/sync/zonaprop';
import { createMetaAdCampaign } from './src/sync/metaAds';
import { createGoogleAdCampaign } from './src/sync/googleAds';

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
    console.log('[Init] Loaded firebase config with projectId:', firebaseConfig.projectId);
  } else {
    console.warn('[Init] firebase-applet-config.json not found at', configPath);
  }
} catch (e) {
  console.log('Could not load firebase-applet-config.json:', e);
}

// Initialize Firebase Admin (Relies on default credentials in prod, acts as stub if none provided locally)
let adminApp: admin.app.App | null = null;
try {
  if (firebaseConfig.projectId) {
    if (!admin.apps.length) {
      adminApp = admin.initializeApp({
        projectId: firebaseConfig.projectId
      });
      console.log('[Init] Initialized adminApp with projectId');
    } else {
      adminApp = admin.app();
      console.log('[Init] Used existing adminApp');
    }
  } else {
    console.log('[Init] Skipped admin sdk init: no projectId in config');
  }
} catch (e) {
  console.warn('Failed to initialize Firebase Admin:', e);
}

// Nodemailer config for password confirmation
const getMailer = () => {
  return nodemailer.createTransport({
    host: process.env.SMTP_HOST || 'smtp.ethereal.email',
    port: parseInt(process.env.SMTP_PORT || '587'),
    secure: process.env.SMTP_SECURE === 'true',
    auth: {
       user: process.env.SMTP_USER || 'fake_user',
       pass: process.env.SMTP_PASS || 'fake_pass',
    }
  });
};

// ========== AUTOMATION ENGINE ==========
async function executeAction(action: string, params: any) {
  if (!adminApp || !firebaseConfig.firestoreDatabaseId) return;
  const db = getFirestore(adminApp, firebaseConfig.firestoreDatabaseId);
  try {
    switch (action) {
      case 'send_whatsapp': {
        let message = 'Mensaje automático de InmoCRM';
        if (params.templateId) {
          const tSnap = await db.collection('whatsappTemplates').doc(params.templateId).get();
          if (tSnap.exists) message = tSnap.data().content;
        }
        let phone = '';
        if (params.clientId) {
          const cSnap = await db.collection('clients').doc(params.clientId).get();
          if (cSnap.exists) phone = cSnap.data().phone || '';
        }
        if (params.propertyId) {
          const pSnap = await db.collection('properties').doc(params.propertyId).get();
          if (pSnap.exists) {
            const p = pSnap.data();
            message = message.replace(/\{\{nombre\}\}/g, params.clientName || 'cliente')
              .replace(/\{\{propiedad\}\}/g, p.title || '')
              .replace(/\{\{precio\}\}/g, p.price?.toLocaleString() || '');
          }
        }
        if (phone) {
          await db.collection('whatsappQueue').add({
            agentId: params.agentId, clientPhone: phone, message,
            status: 'pending', createdAt: Date.now(),
          });
          console.log(`[Automation] WhatsApp enqueued for ${phone}`);
        }
        break;
      }
      case 'send_email': {
        if (params.clientId) {
          const cSnap = await db.collection('clients').doc(params.clientId).get();
          if (cSnap.exists && cSnap.data().email) {
            try {
              await transporter.sendMail({
                from: process.env.SMTP_USER || 'noreply@inmocrm.com',
                to: cSnap.data().email,
                subject: `InmoCRM - ${params.ruleName || 'Notificación'}`,
                text: `Hola ${cSnap.data().name},\n\n${params.message || 'Tenés una novedad en InmoCRM.'}\n\nSaludos!`,
              });
            } catch (e) { console.error('[Automation] Email error:', e); }
          }
        }
        break;
      }
      case 'update_status': {
        if (params.clientId) {
          await db.collection('clients').doc(params.clientId).update({
            status: 'contactado', updatedAt: Date.now()
          });
        }
        break;
      }
      case 'create_appointment': {
        if (params.clientId && params.propertyId) {
          await db.collection('appointments').add({
            clientId: params.clientId, propertyId: params.propertyId,
            agentId: params.agentId,
            date: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
            status: 'pendiente',
            notes: `Cita automática generada por regla: ${params.ruleName || 'automation'}`,
            createdAt: Date.now(),
          });
        }
        break;
      }
    }
  } catch (e) { console.error('[Automation] executeAction error:', e); }
}

async function processTrigger(trigger: string, context: any) {
  if (!adminApp || !firebaseConfig.firestoreDatabaseId) return;
  try {
    const db = getFirestore(adminApp, firebaseConfig.firestoreDatabaseId);
    const rulesSnap = await db.collection('automations')
      .where('agentId', '==', context.agentId)
      .where('trigger', '==', trigger)
      .get();
    if (rulesSnap.empty) return;
    for (const ruleDoc of rulesSnap.docs) {
      const rule = ruleDoc.data();
      const targetLeads = rule.targetLeads || [];
      if (!targetLeads.includes('all') && !targetLeads.includes('all_leads') &&
          context.clientId && !targetLeads.includes(context.clientId)) continue;
      await executeAction(rule.action, {
        agentId: context.agentId, templateId: rule.whatsappTemplateId,
        clientId: context.clientId, propertyId: context.propertyId,
        clientName: context.clientName, ruleName: rule.name,
      });
      console.log(`[Automation] Rule "${rule.name}" executed: ${trigger} → ${rule.action}`);
    }
  } catch (e) { console.error('[Automation] processTrigger error:', e); }
}

async function syncPropertyToPortalsAndAds(property: any, isNew: boolean) {
  if (!adminApp || !firebaseConfig.firestoreDatabaseId) return;
  try {
    const db = getFirestore(adminApp, firebaseConfig.firestoreDatabaseId);
    const integrationsSnap = await db.collection('integrations').doc(property.agentId).get();
    if (!integrationsSnap.exists) return;
    const integ = integrationsSnap.data() || {};

    // --- Portal Sync ---
    // Mercado Libre
    if (integ.mercadolibre?.connected && integ.mercadolibre.token) {
      try {
        if (isNew || !property.mlItemId) {
          const result = await publishToMercadoLibre(property, integ.mercadolibre.token);
          if (result.id) {
            await db.collection('properties').doc(property.id || property.propertyId).update({ mlItemId: result.id });
          }
        } else {
          await updateMercadoLibreListing(property.mlItemId, property, integ.mercadolibre.token);
          // Status change
          if (property.status) {
            await changeMercadoLibreStatus(property.mlItemId, property.status, integ.mercadolibre.token);
          }
        }
      } catch (e) { console.error('[Sync] MercadoLibre error:', e); }
    }

    // Argenprop
    if (integ.argenprop?.connected && integ.argenprop.token) {
      try {
        if (isNew) {
          await publishToArgenprop(property, integ.argenprop.token);
        } else {
          await updateArgenpropListing(property.id || property.propertyId, property, integ.argenprop.token);
        }
      } catch (e) { console.error('[Sync] Argenprop error:', e); }
    }

    // Zonaprop
    if (integ.zonaprop?.connected && integ.zonaprop.token) {
      try {
        if (isNew) {
          await publishToZonaprop(property, integ.zonaprop.token);
        } else {
          await updateZonapropListing(property.id || property.propertyId, property, integ.zonaprop.token);
        }
      } catch (e) { console.error('[Sync] Zonaprop error:', e); }
    }

    // --- Ad Platforms (only on new properties) ---
    if (isNew) {
      const copyText = property.description || property.title || '';

      // Meta Ads
      if (integ.metaAds?.connected && integ.metaAds.token && integ.metaAds.adAccountId && integ.metaAds.pageId) {
        try {
          await createMetaAdCampaign(property, copyText, {
            accessToken: integ.metaAds.token, adAccountId: integ.metaAds.adAccountId, pageId: integ.metaAds.pageId,
          });
        } catch (e) { console.error('[Sync] MetaAds error:', e); }
      }

      // Google Ads
      if (integ.googleAds?.connected && integ.googleAds.token && integ.googleAds.developerToken && integ.googleAds.customerId) {
        try {
          await createGoogleAdCampaign(property, copyText, {
            accessToken: integ.googleAds.token, developerToken: integ.googleAds.developerToken, customerId: integ.googleAds.customerId,
          });
        } catch (e) { console.error('[Sync] GoogleAds error:', e); }
      }
    }
  } catch (e) { console.error('[Sync] syncPropertyToPortalsAndAds error:', e); }
}

async function startServer() {
  const app = express();
  const PORT = 3000;
  
  app.use(express.json());

  /* app.get('/api/debug-env', (req, res) => {
    res.json({
      cwd: process.cwd(),
      configPath: path.join(process.cwd(), 'firebase-applet-config.json'),
      configExists: fs.existsSync(path.join(process.cwd(), 'firebase-applet-config.json')),
      firebaseConfig,
      adminAppIsNull: adminApp === null,
      adminAppsLength: admin.apps.length
    });
  });

  app.post('/api/user/change-password', async (req, res) => {
    try {
      const authHeader = req.headers.authorization;
      if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({ error: 'Unauthorized' });
      }
      
      if (!adminApp) {
        return res.status(500).json({ error: 'Admin SDK not initialized' });
      }

      const token = authHeader.split('Bearer ')[1];
      const decoded = await admin.auth(adminApp).verifyIdToken(token);
      
      const { newPassword } = req.body;
      if (!newPassword || newPassword.length < 6) {
        return res.status(400).json({ error: 'Password must be at least 6 characters' });
      }

      await admin.auth(adminApp).updateUser(decoded.uid, {
        password: newPassword
      });

      // Simulate sending confirmation email
      try {
        const transporter = getMailer();
        await transporter.sendMail({
           from: '"Soporte" <soporte@inmobiliaria.com>',
           to: decoded.email,
           subject: 'Confirmación: Cambio de Contraseña Exitoso',
           text: 'Tu contraseña ha sido actualizada exitosamente desde el panel de configuración.'
        });
        console.log(`Correo de confirmación enviado a: ${decoded.email}`);
      } catch(emailErr) {
        console.log(`Aviso: No se pudo enviar el email real (falta SMTP real), pero la clave se cambió. Error: ${emailErr}`);
      }

      res.status(200).json({ success: true, message: 'Password updated' });
    } catch (e: any) {
      console.error('Error changing password:', e);
      res.status(500).json({ error: e.message });
    }
  }); */

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
    } catch (err: any) {
      if (err.code === 7 || (err.message && err.message.includes('PERMISSION_DENIED'))) {
        console.warn("[Cron] Skipping leads check due to missing permission credentials in this host environment.");
      } else {
        console.error('Error durante la verificación de leads en cron job:', err);
      }
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
    } catch (err: any) {
      if (err.code === 7 || (err.message && err.message.includes('PERMISSION_DENIED'))) {
        console.warn("[Cron] Skipping inactive leads check due to missing permission credentials in this host environment.");
      } else {
        console.error('Error durante la verificación de leads inactivos en cron job:', err);
      }
    }
  });

// En memoria para esta demo/applet
const waSessions: Record<string, { status: string; qr?: string; pairingCode?: string; method?: string; phone?: string; reason?: string; sock?: any }> = {};

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
    
    waSessions[userId] = { ...waSessions[userId], sock };

    sock.ev.on('creds.update', saveCreds);

    sock.ev.on('messages.upsert', async (m) => {
      const msg = m.messages[0];
      if (!msg.message || msg.key.fromMe) return;

      const phoneNumber = msg.key.remoteJid?.split('@')[0];
      const messageText = msg.message.conversation || msg.message.extendedTextMessage?.text || '';

      if (!phoneNumber || !messageText) return;

      console.log(`[Baileys] Mensaje recibido de ${phoneNumber}: ${messageText}`);

      // Persistir mensaje entrante en Firestore (messages + conversations)
      try {
        if (adminApp && firebaseConfig.firestoreDatabaseId) {
          const db2 = getFirestore(adminApp, firebaseConfig.firestoreDatabaseId);
          const agentId = userId;
          const chatId = `${agentId}_${phoneNumber}`;

          await db2.collection('messages').add({
            chatId, agentId, clientPhone: phoneNumber,
            text: messageText, direction: 'incoming',
            timestamp: Date.now(), read: false,
          });

          const convRef = db2.collection('conversations').doc(chatId);
          const convSnap = await convRef.get();
          if (convSnap.exists) {
            await convRef.update({
              lastMessage: messageText, lastMessageAt: Date.now(),
              unreadCount: admin.firestore.FieldValue.increment(1),
            });
          } else {
            let clientName = phoneNumber;
            try {
              const clientsSnap = await db2.collection('clients')
                .where('agentId', '==', agentId).where('phone', '==', phoneNumber).limit(1).get();
              if (!clientsSnap.empty) clientName = clientsSnap.docs[0].data().name;
            } catch (_) {}
            await convRef.set({
              agentId, clientPhone: phoneNumber, clientName,
              lastMessage: messageText, lastMessageAt: Date.now(),
              unreadCount: 1, aiPaused: false, createdAt: Date.now(),
            });
          }
        }
      } catch (e) { console.error('[Baileys] Error persistiendo mensaje entrante:', e); }

      try {
        if (!adminApp || !firebaseConfig.firestoreDatabaseId) return;
        const db = getFirestore(adminApp, firebaseConfig.firestoreDatabaseId);

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
            
            if (leadData.status === 'nuevo') {
              updateData.status = 'contactado';
            }
            
            const currentNotes = leadData.notes || '';
            updateData.notes = `${currentNotes}\n\n[Mensaje WhatsApp ${new Date().toLocaleString()}]: ${messageText}`.trim();
            
            batch.update(doc.ref, updateData);
            console.log(`Lead ${doc.id} actualizado por respuesta de WhatsApp.`);
          }
          await batch.commit();
        }
      } catch (err) {
        console.error('Error procesando mensaje entrante de Baileys:', err);
      }
    });

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

// Función de Auto-Hidratación de sesiones persistentes en disco
const restoreSessions = () => {
  try {
    const files = fs.readdirSync(process.cwd());
    const authFolders = files.filter(f => f.startsWith('wa_auth_') && fs.statSync(f).isDirectory());
    for (const folder of authFolders) {
      const userId = folder.replace('wa_auth_', '');
      console.log(`[Auto-Hydration] Restoring WhatsApp session for user: ${userId}`);
      waSessions[userId] = { status: 'starting', method: 'qr' }; 
      startWhatsApp(userId);
    }
  } catch (err) {
    console.error('Error reading dir for auto-hydration:', err);
  }
};

restoreSessions();

app.post('/api/whatsapp/connect', async (req, res) => {
  try {
    const { method, phone, userId } = req.body; // method: 'qr' | 'phone'
    if (!userId) return res.status(400).json({ error: 'User ID required' });

    // Verificar si el agente puede usar automatizaciones (si pago subscripcion)
    if (adminApp && firebaseConfig.firestoreDatabaseId) {
      const db = getFirestore(adminApp, firebaseConfig.firestoreDatabaseId);
      const userRef = await db.collection("users").doc(userId).get();
      if (userRef.exists) {
         const profile = userRef.data();
         if (profile?.subscription) {
            const { status, trialEndsAt, gracePeriodEndsAt } = profile.subscription;
             const isTrialExpired = status === 'trial' && Date.now() > trialEndsAt;
             const isGraceExpired = status === 'past_due' && gracePeriodEndsAt && Date.now() > gracePeriodEndsAt;
             if (isTrialExpired || isGraceExpired || status === 'canceled') {
                return res.status(403).json({ error: 'Suscripción expirada. No puedes conectar WhatsApp.' });
             }
         }
      }
    }

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

// ========== WHATSAPP INBOX ENDPOINTS ==========
app.post('/api/whatsapp/send', async (req, res) => {
  try {
    const { agentId, clientPhone, text } = req.body;
    if (!agentId || !clientPhone || !text) {
      return res.status(400).json({ error: 'agentId, clientPhone, and text required' });
    }
    const session = waSessions[agentId];
    if (!session || session.status !== 'connected' || !session.sock) {
      return res.status(400).json({ error: 'WhatsApp not connected' });
    }
    let jid = clientPhone.replace(/[^0-9]/g, '');
    if (jid.startsWith('54') && !jid.startsWith('549')) jid = jid.replace('54', '549');
    if (!jid.includes('@')) jid = `${jid}@s.whatsapp.net`;
    await session.sock.sendMessage(jid, { text });

    if (adminApp && firebaseConfig.firestoreDatabaseId) {
      const db2 = getFirestore(adminApp, firebaseConfig.firestoreDatabaseId);
      const chatId = `${agentId}_${clientPhone.replace(/[^0-9]/g, '')}`;
      await db2.collection('messages').add({
        chatId, agentId, clientPhone: clientPhone.replace(/[^0-9]/g, ''),
        text, direction: 'outgoing', timestamp: Date.now(), read: true,
      });
      await db2.collection('conversations').doc(chatId).update({
        lastMessage: text, lastMessageAt: Date.now(),
      });
    }
    res.json({ success: true });
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

app.get('/api/whatsapp/conversations/:agentId', async (req, res) => {
  try {
    if (!adminApp) return res.status(500).json({ error: 'Admin SDK not initialized' });
    const db2 = getFirestore(adminApp, firebaseConfig.firestoreDatabaseId);
    const snap = await db2.collection('conversations')
      .where('agentId', '==', req.params.agentId)
      .orderBy('lastMessageAt', 'desc')
      .get();
    res.json(snap.docs.map(d => ({ id: d.id, ...d.data() })));
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

app.get('/api/whatsapp/messages/:agentId/:clientPhone', async (req, res) => {
  try {
    if (!adminApp) return res.status(500).json({ error: 'Admin SDK not initialized' });
    const db2 = getFirestore(adminApp, firebaseConfig.firestoreDatabaseId);
    const chatId = `${decodeURIComponent(req.params.agentId)}_${decodeURIComponent(req.params.clientPhone)}`;
    const snap = await db2.collection('messages')
      .where('chatId', '==', chatId)
      .orderBy('timestamp', 'asc')
      .limit(100)
      .get();
    res.json(snap.docs.map(d => ({ id: d.id, ...d.data() })));
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

app.post('/api/whatsapp/ai-toggle', async (req, res) => {
  try {
    if (!adminApp) return res.status(500).json({ error: 'Admin SDK not initialized' });
    const db2 = getFirestore(adminApp, firebaseConfig.firestoreDatabaseId);
    const { chatId, aiPaused } = req.body;
    await db2.collection('conversations').doc(chatId).update({ aiPaused });
    res.json({ success: true });
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

  // ========== MERCADO PAGO INTEGRATION ==========
  const getMPClient = () => {
    const token = process.env.MERCADOPAGO_ACCESS_TOKEN || "APP_USR-1747214109303653-060614-841518725d5cc7f41eacf95c8a4a2250-814682618";
    if (!token) return null;
    return new MercadoPagoConfig({ accessToken: token });
  };

  app.post('/api/mercadopago/preference', async (req, res) => {
    try {
      const { plan, userId, userEmail } = req.body;
      const client = getMPClient();
      if (!client) {
        return res.status(500).json({ error: 'MercadoPago ACCESS_TOKEN no configurado en el servidor (.env)' });
      }

      const numPrice = plan === 'plus' ? 29000 : 49000;

      const preference = new Preference(client);
      const appUrl = (req.headers.origin || req.protocol + '://' + req.get('host')).replace(/\/$/, "");

      const result = await preference.create({
        body: {
          items: [
            {
              id: 'inmocrm_' + plan,
              title: `Suscripción Mensual - Plan ${plan.toUpperCase()}`,
              quantity: 1,
              unit_price: numPrice,
              currency_id: 'ARS',
            }
          ],
          payer: {
            email: userEmail
          },
          metadata: {
            // Note: MP snake-cases this on fetch to "user_id" wait...
            // It actually preserves it sometimes. Let's send user_id directly to be safe
            user_id: userId,
            plan: plan
          },
          back_urls: {
            success: `${appUrl}/settings?payment=success`,
            failure: `${appUrl}/settings?payment=failure`,
            pending: `${appUrl}/settings?payment=pending`
          },
          auto_return: 'approved',
          notification_url: `${appUrl}/api/mercadopago/webhook`
        }
      });

      res.json({ init_point: result.init_point });
    } catch (e: any) {
      console.error('Error MP Preference:', e);
      res.status(500).json({ error: e.message || 'Error creando link de pago' });
    }
  });

  app.post('/api/mercadopago/webhook', async (req, res) => {
    try {
      const { type, action, data } = req.body;
      
      if ((type === 'payment' || action === 'payment.created') && data && data.id) {
        const client = getMPClient();
        if (client && adminApp && firebaseConfig.firestoreDatabaseId) {
          const paymentClient = new Payment(client);
          const paymentInfo = await paymentClient.get({ id: data.id });
          
          if (paymentInfo.status === 'approved' && paymentInfo.metadata) {
             const { user_id: userId, plan } = paymentInfo.metadata;
             
             if (userId) {
               const db = getFirestore(adminApp, firebaseConfig.firestoreDatabaseId);
               const userRef = db.collection('users').doc(userId);
               
               await userRef.update({
                 'subscription.status': 'active',
                 'subscription.plan': plan,
                 'subscription.currentPeriodEnd': Date.now() + 30 * 24 * 60 * 60 * 1000 // +30 days
               });
               console.log(`[MercadoPago] Suscripción activada para el usuario ${userId} (${plan})`);
             }
          }
        }
      }
      res.sendStatus(200);
    } catch (e) {
      console.error('[MercadoPago] Webhook Error:', e);
      res.sendStatus(500);
    }
  });

  app.post('/api/subscription/cancel', async (req, res) => {
    try {
      const { userId } = req.body;
      if (!userId) return res.status(400).json({ error: 'User ID required' });
      
      if (adminApp && firebaseConfig.firestoreDatabaseId) {
        const db = getFirestore(adminApp, firebaseConfig.firestoreDatabaseId);
        const userRef = db.collection('users').doc(userId);
        await userRef.update({
          'subscription.status': 'canceled'
        });
        res.json({ success: true });
      } else {
        res.status(500).json({ error: 'Firebase Admin not initialized' });
      }
    } catch (e: any) {
      console.error('Error canceling subscription:', e);
      res.status(500).json({ error: e.message });
    }
  });
  // ==============================================



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

  // ========== AUTOMATION TRIGGER LISTENERS ==========
  if (adminApp && firebaseConfig.firestoreDatabaseId) {
    const autoDb = getFirestore(adminApp, firebaseConfig.firestoreDatabaseId);

    // Trigger: nuevo_lead — cuando se crea un cliente nuevo
    autoDb.collection('clients').onSnapshot((snapshot) => {
      snapshot.docChanges().forEach(async (change) => {
        if (change.type === 'added') {
          const client = { id: change.doc.id, ...change.doc.data() } as any;
          if (client.createdAt && Date.now() - client.createdAt < 30000 && client.agentId) {
            await processTrigger('nuevo_lead', {
              agentId: client.agentId, clientId: client.id, clientName: client.name,
            });
          }
        }
      });
    });

    // Trigger: cambio_estado — cuando un cliente cambia de status
    autoDb.collection('clients').onSnapshot((snapshot) => {
      snapshot.docChanges().forEach(async (change) => {
        if (change.type === 'modified') {
          const data = change.doc.data() as any;
          if (data.agentId) {
            await processTrigger('cambio_estado', {
              agentId: data.agentId, clientId: change.doc.id,
              clientName: data.name, newStatus: data.status,
            });
          }
        }
      });
    });

    // Trigger: cita_creada — cuando se agenda una cita nueva
    autoDb.collection('appointments').onSnapshot((snapshot) => {
      snapshot.docChanges().forEach(async (change) => {
        if (change.type === 'added') {
          const appt = change.doc.data() as any;
          if (appt.createdAt && Date.now() - appt.createdAt < 30000 && appt.agentId) {
            await processTrigger('cita_creada', {
              agentId: appt.agentId, clientId: appt.clientId, propertyId: appt.propertyId,
            });
          }
        }
      });
    });

    // Trigger: propiedad_actualizada — cuando se modifica una propiedad
    autoDb.collection('properties').onSnapshot((snapshot) => {
      snapshot.docChanges().forEach(async (change) => {
        if (change.type === 'added') {
          const prop = { id: change.doc.id, ...change.doc.data() } as any;
          if (prop.agentId) {
            await processTrigger('propiedad_actualizada', {
              agentId: prop.agentId, propertyId: change.doc.id, propTitle: prop.title,
            });
            await syncPropertyToPortalsAndAds(prop, true);
          }
        }
        if (change.type === 'modified') {
          const prop = change.doc.data() as any;
          if (prop.agentId) {
            await processTrigger('propiedad_actualizada', {
              agentId: prop.agentId, propertyId: change.doc.id, propTitle: prop.title,
            });
            await syncPropertyToPortalsAndAds({ ...prop, id: change.doc.id, propertyId: change.doc.id }, false);
          }
        }
      });
    });
  }

  // Procesador de Cola de WhatsApp (Baileys) (Cada minuto)
  setInterval(async () => {
    try {
      if (!adminApp || !firebaseConfig.firestoreDatabaseId) return;
      const db = getFirestore(adminApp, firebaseConfig.firestoreDatabaseId);
      
      const snapshot = await db.collection('whatsappQueue').where('status', '==', 'pending').limit(20).get();
      if (snapshot.empty) return;
      
      for (const doc of snapshot.docs) {
        const item = doc.data();
        const agentSession = waSessions[item.agentId];
        
        // Verificar Subscripcion activa antes de automatizar
        const profileSnap = await db.collection("users").doc(item.agentId).get();
        if (profileSnap.exists) {
           const sub = profileSnap.data()?.subscription;
           if (sub) {
             const isTrialExpired = sub.status === 'trial' && Date.now() > sub.trialEndsAt;
             const isGraceExpired = sub.status === 'past_due' && sub.gracePeriodEndsAt && Date.now() > sub.gracePeriodEndsAt;
             if (isTrialExpired || isGraceExpired || sub.status === 'canceled') {
                continue; // Saltar porque la cuenta esta bloqueada
             }
           }
        }
        
        if (agentSession && agentSession.status === 'connected' && agentSession.sock) {
           try {
             let jid = item.clientPhone.replace(/[^0-9]/g, '');
             // Si es argentino aseguramos el 9
             if (jid.startsWith('54') && !jid.startsWith('549')) jid = jid.replace('54', '549');
             if (!jid.includes('@')) jid = `${jid}@s.whatsapp.net`;
             
             await agentSession.sock.sendMessage(jid, { text: item.message });
             await doc.ref.update({ status: 'sent', sentAt: Date.now() });
             console.log(`[WhatsApp Queue] Mensaje enviado a ${jid} (Agente: ${item.agentId})`);
           } catch (e: any) {
             console.error(`[WhatsApp Queue] Error en doc ${doc.id}:`, e);
             await doc.ref.update({ status: 'error', error: e.message || String(e) });
           }
        }
      }
    } catch (e: any) {
      if (e.code === 7 || (e.message && e.message.includes('PERMISSION_DENIED'))) {
        console.warn("[WhatsApp Queue] Skipping queue processing due to missing permission credentials in this host environment.");
      } else {
        console.error("Error process whatsapp queue", e);
      }
    }
  }, 60000);

  // ========== APPOINTMENT REMINDERS (cada 30 min) ==========
  setInterval(async () => {
    if (!adminApp || !firebaseConfig.firestoreDatabaseId) return;
    try {
      const db = getFirestore(adminApp, firebaseConfig.firestoreDatabaseId);
      const now = Date.now();
      const snap = await db.collection('appointments')
        .where('status', '==', 'pendiente')
        .get();

      for (const apptDoc of snap.docs) {
        const appt = { id: apptDoc.id, ...apptDoc.data() } as any;
        const apptTime = new Date(appt.date).getTime();
        const hoursUntil = (apptTime - now) / (1000 * 60 * 60);

        const shouldRemind24h = hoursUntil <= 24 && hoursUntil > 23 && !appt.reminded24h;
        const shouldRemind1h = hoursUntil <= 1 && hoursUntil > 0 && !appt.reminded1h;

        if (!shouldRemind24h && !shouldRemind1h) continue;

        const clientSnap = await db.collection('clients').doc(appt.clientId).get();
        const clientName = clientSnap.exists ? clientSnap.data()?.name || 'Cliente' : 'Cliente';
        const clientPhone = clientSnap.exists ? clientSnap.data()?.phone || '' : '';

        let propertyTitle = '';
        if (appt.propertyId) {
          const propSnap = await db.collection('properties').doc(appt.propertyId).get();
          if (propSnap.exists) propertyTitle = propSnap.data()?.title || '';
        }

        const apptDate = new Date(appt.date).toLocaleString('es-AR', {
          day: '2-digit', month: '2-digit', year: 'numeric',
          hour: '2-digit', minute: '2-digit',
        });

        const reminderMsg = shouldRemind24h
          ? `Hola ${clientName}, te recordamos que mañana tenés una cita ${propertyTitle ? `para ver "${propertyTitle}"` : 'con nosotros'} el ${apptDate}. ¡Te esperamos!`
          : `Hola ${clientName}, tu cita ${propertyTitle ? `para ver "${propertyTitle}"` : 'con nosotros'} es en 1 hora (${apptDate}). ¡No faltes!`;

        if (clientPhone) {
          await db.collection('whatsappQueue').add({
            agentId: appt.agentId, clientPhone, message: reminderMsg,
            status: 'pending', createdAt: now,
          });
        }

        const updateField = shouldRemind24h ? { reminded24h: true } : { reminded1h: true };
        await apptDoc.ref.update(updateField);

        console.log(`[Reminders] Recordatorio enviado para cita ${appt.id} (${shouldRemind24h ? '24h' : '1h'} antes)`);
      }
    } catch (e) { console.error('[Reminders] Error:', e); }
  }, 30 * 60 * 1000);

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