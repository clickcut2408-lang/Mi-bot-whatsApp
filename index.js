const { makeWASocket, useMultiFileAuthState, DisconnectReason } = require('@whiskeysockets/baileys');
const pino = require('pino');

const TARGET_PHONE = '5218641114514'; // Número configurado para alertas o administración

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
            console.log('¡Bot conectado exitosamente a WhatsApp!');
        }
    });

    sock.ev.on('messages.upsert', async ({ messages }) => {
        const m = messages[0];
        if (!m.message || m.key.fromMe) return;

        const remoteJid = m.key.remoteJid;
        const messageText = m.message.conversation || m.message.extendedTextMessage?.text;

        if (!messageText) return;

        console.log(`Mensaje recibido de ${remoteJid}: ${messageText}`);

        // Ejemplo de comando básico
        if (messageText.toLowerCase() === '!ping') {
            await sock.sendMessage(remoteJid, { text: '¡Pong! El bot está activo y funcionando.' });
        }
        
        // Comando para verificar el número asignado
        if (messageText.toLowerCase() === '!admin') {
            await sock.sendMessage(remoteJid, { text: `Número de administración principal: ${TARGET_PHONE}` });
        }
    });
}

connectToWhatsApp();
