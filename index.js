const { default: makeWASocket, useMultiFileAuthState, DisconnectReason } = require('@whiskeysockets/baileys');
const pino = require('pino');

async function iniciarBot() {
    const { state, saveCreds } = await useMultiFileAuthState('sesion_auth');
    
    const sock = makeWASocket({
        logger: pino({ level: 'silent' }),
        auth: state,
        printQRInTerminal: true
    });

    sock.ev.on('creds.update', saveCreds);

    sock.ev.on('connection.update', (update) => {
        const { connection, lastDisconnect } = update;
        if (connection === 'close') {
            const reconectar = lastDisconnect?.error?.output?.statusCode !== DisconnectReason.loggedOut;
            if (reconectar) iniciarBot();
        } else if (connection === 'open') {
            console.log('Bot Click&Cut conectado con exito a WhatsApp.');
        }
    });

    sock.ev.on('messages.upsert', async ({ messages, type }) => {
        if (type !== 'notify') return;
        const msg = messages[0];
        if (!msg.message || msg.key.fromMe) return;

        const remitente = msg.key.remoteJid;
        const texto = msg.message.conversation || msg.message.extendedTextMessage?.text || '';
        const comando = texto.toLowerCase().trim();

        // Menu Principal
        if (comando === '!menu' || comando === '!servicios') {
            const menu = `🛒 *BIENVENIDO A CLICK&CUT* 🛒\n\n` +
                         `Escribe cualquiera de estas opciones para mas informacion:\n\n` +
                         `📌 *!streaming* - Lista de cuentas y pantallas\n` +
                         `📌 *!tramites* - Servicios y gestiones\n` +
                         `📌 *!pago* - Métodos de pago y transferencias\n` +
                         `📌 *!asesor* - Hablar con atencion al cliente`;
            await sock.sendMessage(remitente, { text: menu });
        }

        // Catalogo de Streaming
        else if (comando === '!streaming') {
            const streaming = `📺 *CATÁLOGO DE STREAMING* 📺\n\n` +
                              `• *Netflix:* Perfil $ / Completa $\n` +
                              `• *Disney+:* Perfil $ / Completa $\n` +
                              `• *Max (HBO):* Perfil $\n` +
                              `• *Prime Video:* Perfil $\n\n` +
                              `_Escribe *!pago* para ver las opciones de compra._`;
            await sock.sendMessage(remitente, { text: streaming });
        }

        // Servicios y Tramites
        else if (comando === '!tramites') {
            const tramites = `📄 *SERVICIOS Y TRÁMITES* 📄\n\n` +
                             `• Servicio 1: [Detalle del tramite]\n` +
                             `• Servicio 2: [Detalle del tramite]\n\n` +
                             `_Para cotizaciones personalizadas escribe *!asesor*._`;
            await sock.sendMessage(remitente, { text: tramites });
        }

        // Datos de Pago
        else if (comando === '!pago') {
            const pago = `💳 *MÉTODOS DE PAGO* 💳\n\n` +
                         `• Transferencia Bancaria (SPEI)\n` +
                         `• Depósito en OXXO\n` +
                         `• Mercado Pago\n\n` +
                         `_Por favor envia tu comprobante en este chat para activar tu servicio._`;
            await sock.sendMessage(remitente, { text: pago });
        }

        // Asesor Humano
        else if (comando === '!asesor') {
            await sock.sendMessage(remitente, { text: `👨‍💻 Un asesor de Click&Cut te atendera en breve. Por favor deja tu mensaje detallado.` });
        }
    });
}

iniciarBot();
