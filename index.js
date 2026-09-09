const { makeWASocket, useMultiFileAuthState, DisconnectReason } = require('@whiskeysockets/baileys');
const pino = require('pino');
const express = require('express');

const app = express();
const PORT = process.env.PORT || 3000;

app.get('/', (req, res) => {
    res.send('¡Bot de ventas de Click&Cut activo y en línea!');
});

app.listen(PORT, () => {
    console.log(`Servidor web corriendo en el puerto ${PORT}`);
});

const TARGET_PHONE = '5218641114514';

async function connectToWhatsApp() {
    const { state, saveCreds } = await useMultiFileAuthState('auth_info_baileys');
    
    const sock = makeWASocket({
        auth: state,
        printQRInTerminal: true,
        logger: pino({ level: 'silent' })
    });

    sock.ev.on('creds.update', saveCreds);

    sock.ev.on('connection.update', (update) => {
        const { connection, lastDisconnect } = update;
        if (connection === 'close') {
            const shouldReconnect = lastDisconnect?.error?.output?.statusCode !== DisconnectReason.loggedOut;
            console.log('Conexión cerrada. Reconectando...', shouldReconnect);
            if (shouldReconnect) {
                connectToWhatsApp();
            }
        } else if (connection === 'open') {
            console.log('¡Bot de Click&Cut conectado exitosamente a WhatsApp!');
        }
    });

    sock.ev.on('messages.upsert', async ({ messages }) => {
        const m = messages[0];
        if (!m.message || m.key.fromMe) return;

        const remoteJid = m.key.remoteJid;
        const messageText = m.message.conversation || m.message.extendedTextMessage?.text;

        if (!messageText) return;

        const text = messageText.trim().toLowerCase();

        // Menú principal de Click&Cut
        if (text === '.menu' || text === '!menu') {
            await sock.sendMessage(remoteJid, { 
                text: `✨ *BIENVENIDOS A CLICK&CUT* ✨\n\n` +
                      `Aquí tienes los comandos disponibles:\n\n` +
                      `📌 *.catalogo* - Ver nuestros servicios y productos\n` +
                      `📺 *.streaming* - Cuentas y servicios de streaming\n` +
                      `📋 *.tramites* - Asistencia digital y trámites\n` +
                      `💳 *.pagos* - Métodos y datos de pago\n` +
                      `📦 *.comopedir* - Guía para hacer tu pedido\n` +
                      `⏱ *.tiempos* - Tiempos de entrega\n` +
                      `📞 *.asesor* - Contactar con atención al cliente\n\n` +
                      `_¡Escribe el comando que necesites!_` 
            });
        }
        
        // Catálogo general
        else if (text === '.catalogo') {
            await sock.sendMessage(remoteJid, { 
                text: `🛍 *CATÁLOGO CLICK&CUT*\n\n` +
                      `1️⃣ *Papelería Creativa & Stickers:* Etiquetas escolares, charts y personalizados.\n` +
                      `2️⃣ *Diseño Digital:* Invitaciones, posters y flyers para negocios.\n` +
                      `3️⃣ *Streaming:* Plataformas de entretenimiento estables.\n` +
                      `4️⃣ *Asistencia Administrativa:* Gestión y trámites digitales.\n\n` +
                      `Escribe *.streaming* o *.tramites* para más detalles.` 
            });
        }

        // Streaming
        else if (text === '.streaming') {
            await sock.sendMessage(remoteJid, { 
                text: `📺 *SERVICIOS DE STREAMING DISPONIBLES*\n\n` +
                      `Contamos con perfiles y cuentas completas estables y con garantía.\n` +
                      `Escribe a un asesor con *.asesor* para consultar disponibilidad y precios actuales del mes.` 
            });
        }

        // Trámites y Asistencia
        else if (text === '.tramites') {
            await sock.sendMessage(remoteJid, { 
                text: `📋 *ASISTENCIA Y TRÁMITES DIGITALES*\n\n` +
                      `Te ayudamos con gestión de documentos, formato de solicitudes, asesoría digital y más.\n` +
                      `Pide cotización directa usando *.asesor*.` 
            });
        }

        // Pagos
        else if (text === '.pagos' || text === '.datosbanco') {
            await sock.sendMessage(remoteJid, { 
                text: `💳 *MÉTODO DE PAGOS*\n\n` +
                      `Aceptamos transferencias bancarias, depósitos en OXXO y pagos móviles.\n` +
                      `Solicita el número de cuenta o tarjeta directamente con el administrador escribiendo a *.asesor*.` 
            });
        }

        // Cómo pedir y formatos
        else if (text === '.comopedir' || text === '.formatopedido') {
            await sock.sendMessage(remoteJid, { 
                text: `📦 *¿CÓMO HACER TU PEDIDO?*\n\n` +
                      `Envíanos un mensaje con los siguientes datos:\n` +
                      `• Nombre completo:\n` +
                      `• Servicio o producto deseado:\n` +
                      `• Comprobante de pago (en caso de ya haber pagado):\n\n` +
                      `¡Con gusto te atenderemos a la brevedad!` 
            });
        }

        // Tiempos de entrega
        else if (text === '.tiempos' || text === '.entregas') {
            await sock.sendMessage(remoteJid, { 
                text: `⏱ *TIEMPOS DE ENTREGA*\n\n` +
                      `• *Streaming / Digitales:* Entre 10 a 30 minutos tras confirmar pago.\n` +
                      `• *Diseños / Papelería:* Depende del volumen, se agenda previamente con el administrador.` 
            });
        }

        // Asesor / Contacto principal
        else if (text === '.asesor' || text === '.contacto') {
            await sock.sendMessage(remoteJid, { 
                text: `📞 *ATENCIÓN PERSONALIZADA*\n\n` +
                      `Puedes comunicarte directamente con nuestro administrador principal en el siguiente enlace o número:\n` +
                      `Wa.me/${TARGET_PHONE}` 
            });
        }

        // Comando básico de ping
        else if (text === '!ping') {
            await sock.sendMessage(remoteJid, { text: '¡Pong! El bot de Click&Cut está activo y funcionando.' });
        }
    });
}

connectToWhatsApp();

