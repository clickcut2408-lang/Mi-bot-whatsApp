const { default: makeWASocket, useMultiFileAuthState, DisconnectReason } = require('@whiskeysockets/baileys');
const pino = require('pino');
const http = require('http');

// Configuración de tu número de WhatsApp
const NUMERO_BOT = "528641141976";

const port = process.env.PORT || 3000;
http.createServer((req, res) => {
    res.writeHead(200, { 'Content-Type': 'text/plain' });
    res.end('Bot Click&Cut activo');
}).listen(port, () => {
    console.log(`Servidor activo en el puerto ${port}`);
});

async function iniciarBot() {
    const { state, saveCreds } = await useMultiFileAuthState('sesion_auth');
    
    const sock = makeWASocket({
        logger: pino({ level: 'silent' }),
        auth: state,
        printQRInTerminal: false
    });

    sock.ev.on('creds.update', saveCreds);

    if (!sock.authState.creds.registered) {
        setTimeout(async () => {
            try {
                const code = await sock.requestPairingCode(NUMERO_BOT);
                console.log(`\n=========================================`);
                console.log(`TU CODIGO DE VINCULACION ES: ${code}`);
                console.log(`=========================================\n`);
            } catch (err) {
                console.log('Error generando código, reintentando con prefijo alterno...');
                try {
                    const codeAlt = await sock.requestPairingCode("5218641141976");
                    console.log(`\n=========================================`);
                    console.log(`TU CODIGO DE VINCULACION ES: ${codeAlt}`);
                    console.log(`=========================================\n`);
                } catch (e) {
                    console.log('Fallo al solicitar código:', e.message);
                }
            }
        }, 5000);
    }

    sock.ev.on('connection.update', (update) => {
        const { connection, lastDisconnect } = update;
        if (connection === 'close') {
            const reconectar = lastDisconnect?.error?.output?.statusCode !== DisconnectReason.loggedOut;
            if (reconectar) {
                iniciarBot();
            }
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

        if (comando === '!menu' || comando === '!ayuda') {
            const menu = `🛒 *BIENVENIDO A CLICK&CUT* 🛒\n\n` +
                         `Escribe cualquiera de estos comandos en el chat o grupo:\n\n` +
                         `📌 *!streaming* - Películas, series y TV (Netflix, Disney, MAX...)\n` +
                         `📌 *!musica* - Spotify, YouTube Premium y Deezer\n` +
                         `📌 *!apps* - Canva Pro, ChatGPT, Gemini, Office y Game Pass\n` +
                         `📌 *!tramites* - Gestiones, actas, certificados y licencias\n` +
                         `📌 *!catalogo* - Lista completa de streaming y apps\n` +
                         `📌 *!adultos* - Cuentas +18\n` +
                         `📌 *!pago* - Cuentas para transferencias y depósitos\n` +
                         `📌 *!reglas* - Reglas, entregas y garantías\n` +
                         `📌 *!asesor* o *!admin* - Contacto con atención al cliente`;
            await sock.sendMessage(remitente, { text: menu });

        } else if (comando === '!reglas') {
            const reglas = `✂️✨ *¡BIENVENID@ A CLICK&CUT STREAMING!* ✨✂️\n` +
                           `¡Gracias por confiar en nosotros! 💜 Lee estas breves reglas para cuidar tu servicio y mantener tu garantía activa:\n` +
                           `━━━━━━━━━━━━━━━━━━━━\n` +
                           `📌 *REGLAS BÁSICAS*\n` +
                           `✂️ Prohibido modificar correo, contraseña, PIN o perfiles.\n` +
                           `✂️ Prohibido compartir la cuenta o exceder pantallas permitidas.\n` +
                           `✂️ Si hay alguna falla, repórtala antes de mover cualquier ajuste.\n` +
                           `✂️ No te salgas del grupo (la garantía se anula de inmediato).\n` +
                           `━━━━━━━━━━━━━━━━━━━━\n` +
                           `🕒 *HORARIO Y ATENCIÓN*\n` +
                           `💜 Por el momento no manejamos un horario fijo, pero te responderemos a la brevedad posible.\n` +
                           `✨ ¡Estamos trabajando arduamente en la administración para que muy pronto su servidora y el equipo les brindemos soporte 24/7!\n` +
                           `━━━━━━━━━━━━━━━━━━━━\n` +
                           `📦 *ENTREGAS*\n` +
                           `✂️ De 15 minutos a 3 horas (puede variar un poco en días de alta demanda).\n` +
                           `━━━━━━━━━━━━━━━━━━━━\n` +
                           `🛡️ *GARANTÍAS*\n` +
                           `✂️ 1 mes ➜ 25 días\n` +
                           `✂️ 2 meses ➜ 45 días\n` +
                           `✂️ 3 meses ➜ 75 días\n` +
                           `✂️ 6 meses ➜ 5 meses\n` +
                           `✂️ 12 meses ➜ 10 meses\n` +
                           `_(Cubre únicamente caídas del servicio; no aplica si cambias datos o haces mal uso de la cuenta)_\n` +
                           `━━━━━━━━━━━━━━━━━━━━\n` +
                           `💌 *AVISO IMPORTANTE*\n` +
                           `✂️ Reporta fallas con captura de pantalla.\n` +
                           `✂️ No hay reembolsos tras entregar el servicio.\n` +
                           `✂️ Al recibir tu cuenta aceptas estas condiciones.\n\n` +
                           `🍿 ¡Disfruta tu entretenimiento al máximo! ✂️✨`;
            await sock.sendMessage(remitente, { text: reglas });

        } else if (comando === '!tramites' || comando === '!servicios') {
            const tramites = `✧˚｡⋆ *CLICK&CUT TRÁMITES Y SERVICIOS* ✧˚｡⋆\n` +
                             `━━━━━━━━━━━━━━━━━━\n` +
                             `🍒 *Actas & Educación:*\n` +
                             `• Acta de nacimiento — $15\n` +
                             `• Acta de matrimonio — $15\n` +
                             `• Acta de divorcio — $15\n` +
                             `• Acta de defunción — $15\n` +
                             `• Certificado INEA — $45\n\n` +
                             `📋 *Trámites Generales:*\n` +
                             `• Localizar AFORE — $25\n` +
                             `• Certificado COVID — $40\n` +
                             `• Recibo CFE — $15\n` +
                             `• Constancia de no derechohabiencia ISSSTE — $40\n` +
                             `• Constancia de no deudor alimentario (DIF) — $45\n` +
                             `• Talón de pago ISSSTE — $28\n` +
                             `• Hoja REPUVE — $28\n` +
                             `• CURP certificada — $15\n` +
                             `• Número Seguro Social 2 hojas (NSS) — $32\n` +
                             `• Vigencia de derechos IMSS — $32\n` +
                             `• Semanas cotizadas IMSS — $32\n\n` +
                             `⚖️ *Antecedentes No Penales:*\n` +
                             `• Estatales — $70\n` +
                             `• Federales — $85\n\n` +
                             `🚗 *Vehículos y Licencias:*\n` +
                             `• Permiso para circular sin placas (30 días) — $80\n` +
                             `• Reposición tarjeta de circulación — $700\n` +
                             `• Licencia — $750 + envío\n` +
                             `• Licencia Guerrero Digital (3 y 5 años) — $200 / $230\n` +
                             `• Títulos americanos de vehículos — $1,300\n\n` +
                             `🛂 *Pasaporte y Nacionalidad:*\n` +
                             `• Renovación de pasaporte — $800\n` +
                             `• Doble nacionalidad — (Cotizar con asesor)\n` +
                             `• Alta acta nacimiento (Jalisco) — (Cotizar con asesor)\n\n` +
                             `🏠 *INFONAVIT:*\n` +
                             `• Registro de cuenta Infonavit — $120\n` +
                             `• Histórico de saldo — $120\n` +
                             `• Nueva clave Infonavit — $120\n` +
                             `• Desbloqueo de cuenta Infonavit — $120\n\n` +
                             `📄 *RFC y SAT:*\n` +
                             `• RFC original — $135\n` +
                             `• RFC clon — $45\n` +
                             `• Renovación e.firma (con contraseña) — $600\n` +
                             `• Facturación / Refacturación — desde $250\n` +
                             `• Hoja de retención IMSS — $140\n\n` +
                             `🎓 *Certificados Verificables:*\n` +
                             `• Primaria / Secundaria / Preparatoria / Bachillerato — $60 c/u\n` +
                             `• Títulos y cédulas (2009–2023) — $85\n` +
                             `• Certificado estudios para trabajar — $45\n` +
                             `• Carta de recomendación (con firma y sello) — $57\n` +
                             `• Buró de crédito — $85\n` +
                             `• Constancia de inexistencia de matrimonio — $170\n\n` +
                             `⛪ *Boletas Sacramentales:*\n` +
                             `• Bautizo — $45\n` +
                             `• Comunión — $45\n` +
                             `• Confirmación — $45\n` +
                             `━━━━━━━━━━━━━━━━━━\n` +
                             `_Escribe *!pago* para transferir o *!asesor* para cotizar._`;
            await sock.sendMessage(remitente, { text: tramites });

        } else if (comando === '!streaming') {
            const streaming = `📺 *STREAMING & SERIES* 📺\n` +
                              `━━━━━━━━━━━━━━━━━━\n` +
                              `🎬 *Netflix Solo TV:*\n1M $29 | 2M $38 | 3M $49 | 12M $75\n` +
                              `🎬 *Netflix Normal:*\n1M $49 | 2M $65 | 3M $82 | 12M $155\n` +
                              `🎬 *Netflix Privado:*\n1M $55 | 2M $69 | 3M $85\n` +
                              `🎬 *Netflix Completa:* 1M $215\n` +
                              `━━━━━━━━━━━━━━━━━━\n` +
                              `🏰 *Disney+ Premium (Perfil):*\n1M $15 | 2M $25 | 3M $38 | 12M $52\n` +
                              `🏰 *Disney+ Premium (Completa):*\n1M $56 | 2M $78 | 3M $89 | 12M $155\n` +
                              `━━━━━━━━━━━━━━━━━━\n` +
                              `📺 *MAX Premium (Perfil):*\n1M $15 | 2M $25 | 3M $34 | 12M $55\n` +
                              `📺 *MAX Premium (Completa):*\n1M $45 | 2M $59 | 3M $78 | 12M $120\n` +
                              `━━━━━━━━━━━━━━━━━━\n` +
                              `📦 *Prime Video (Perfil):*\n1M $10 | 2M $13 | 3M $19 | 12M $30\n` +
                              `📦 *Prime Video (Completa):*\n1M $28 | 2M $35 | 3M $45 | 12M $95\n` +
                              `━━━━━━━━━━━━━━━━━━\n` +
                              `💛 *VIX (Perfil):*\n1M $9 | 2M $15 | 3M $19 | 12M $28\n` +
                              `💛 *VIX (Completa):*\n1M $13 | 2M $20 | 3M $29 | 12M $38\n` +
                              `━━━━━━━━━━━━━━━━━━\n` +
                              `⭐ *Paramount+:*\n1M $13 | 2M $18 | 3M $23 | 12M $30\n` +
                              `⭐ *Paramount+ (Completa):*\n1M $45 | 2M $55 | 3M $65 | 12M $110\n` +
                              `━━━━━━━━━━━━━━━━━━\n` +
                              `🍿 *Crunchyroll (Perfil):*\n1M $17 | 2M $24 | 3M $32 | 12M $48\n` +
                              `🍿 *Crunchyroll (Completa):*\n1M $45 | 2M $65 | 3M $80 | 12M $110\n` +
                              `━━━━━━━━━━━━━━━━━━\n` +
                              `🦊 *Fox One (Perfil):*\n1M $19 | 2M $25 | 3M $35 | 12M $58\n` +
                              `🦊 *Fox One (Completa):* 1M $55\n` +
                              `🎧 *Apple TV (Perfil):*\n1M $19 | 2M $25 | 3M $33 | 12M $48\n` +
                              `🎧 *Apple TV (Completa):* 1M $45 | 2M $70\n` +
                              `📺 *IPTV (Perfil):*\n1M $17 | 2M $27 | 3M $37 | 12M $57\n` +
                              `📺 *IPTV (Completa):*\n1M $45 | 2M $55 | 3M $65 | 12M $125\n` +
                              `📺 *Claro+Canales (Completa):* 1M $70\n\n` +
                              `_Escribe *!pago* para ver las cuentas bancarias._`;
            await sock.sendMessage(remitente, { text: streaming });

        } else if (comando === '!musica') {
            const musica = `🎶 *MÚSICA Y AUDIO* 🎶\n` +
                           `━━━━━━━━━━━━━━━━━━\n` +
                           `💚 *Spotify Premium:*\n` +
                           `1M $37 | 2M $45 | 3M $55 | 6M $85 | Anual $135\n` +
                           `━━━━━━━━━━━━━━━━━━\n` +
                           `▶️ *YouTube Premium:*\n` +
                           `• Invitación: 1M $15 | 2M $27 | 3M $34\n` +
                           `• Individual: $22 (tus datos) | $30 (mis datos)\n` +
                           `• Familiar: $26 (tus datos) | $30 (mis datos)\n` +
                           `━━━━━━━━━━━━━━━━━━\n` +
                           `🎵 *Deezer:*\n` +
                           `1M $14 | 2M $21 | 3M $26 | 6M $30 | Anual $45\n\n` +
                           `_Escribe *!pago* para contratar._`;
            await sock.sendMessage(remitente, { text: musica });

        } else if (comando === '!apps') {
            const apps = `🛠️ *HERRAMIENTAS, APPS & JUEGOS* 🛠️\n` +
                         `━━━━━━━━━━━━━━━━━━\n` +
                         `🎨 *Canva Invitación:*\n1M $6 | 2M $11 | 3M $23 | 6M $27 | 12M $39\n` +
                         `🎨 *Canva Pro:*\n1M $20 | 2M $35 | 3M $40 | 6M $50 | 12M $70 | 24M $100\n` +
                         `━━━━━━━━━━━━━━━━━━\n` +
                         `🤖 *Inteligencia Artificial:*\n` +
                         `• ChatGPT Perfil: $45 (1M) | $70 (3M)\n` +
                         `• ChatGPT Compartido: $57\n` +
                         `• ChatGPT Go: $65\n` +
                         `• ChatGPT Plus: $85\n` +
                         `• GEMINI: 18M $60\n` +
                         `━━━━━━━━━━━━━━━━━━\n` +
                         `🦉 *Duolingo (Perfil):*\n1M $12 | 2M $21 | 3M $26 | 12M $37\n` +
                         `🦉 *Duolingo (Completa):*\n1M $14 | 2M $25 | 3M $29 | 12M $40\n` +
                         `━━━━━━━━━━━━━━━━━━\n` +
                         `📄 *Microsoft Office:*\n` +
                         `• Invitación: $19\n` +
                         `• Individual: $47\n` +
                         `• Completa: $55\n` +
                         `━━━━━━━━━━━━━━━━━━\n` +
                         `🎮 *Game Pass Code:* $98\n\n` +
                         `_Escribe *!pago* para adquirir tu cuenta._`;
            await sock.sendMessage(remitente, { text: apps });

        } else if (comando === '!adultos') {
            const adultos = `🔞 *CONTENIDO +18 (Solo Mayores)* 🔞\n` +
                            `━━━━━━━━━━━━━━━━━━\n` +
                            `🦋 *Brazzers (Perfil):*\n1M $14 | 2M $25 | 3M $28 | 12M $36\n` +
                            `🔥 *Brazzers (Completa):*\n1M $25 | 2M $32 | 3M $40 | 12M $60\n` +
                            `━━━━━━━━━━━━━━━━━━\n` +
                            `🔥 *Pornhub (Perfil):*\n1M $15 | 2M $28 | 3M $32\n\n` +
                            `_Escribe *!pago* para ver las opciones de compra._`;
            await sock.sendMessage(remitente, { text: adultos });

        } else if (comando === '!catalogo') {
            const stockCompleto = `🩷 *APPSTOCK CLICK&CUT* 🩷\n` +
                                  `━━━━━━━━━━━━━━━━━━\n` +
                                  `🦋 *PERFILES NETFLIX:*\n` +
                                  `🎬 Solo TV: 1M $29 | 2M $38 | 3M $49 | 12M $75\n` +
                                  `🎬 Normal: 1M $49 | 2M $65 | 3M $82 | 12M $155\n` +
                                  `🎬 Privado: 1M $55 | 2M $69 | 3M $85\n` +
                                  `🔥 Cuentas Completas Netflix: 1M $215\n` +
                                  `━━━━━━━━━━━━━━━━━━\n` +
                                  `🏰 *Disney+ Premium:*\n` +
                                  `Perfil: 1M $15 | 2M $25 | 3M $38 | 12M $52\n` +
                                  `Completa: 1M $56 | 2M $78 | 3M $89 | 12M $155\n` +
                                  `━━━━━━━━━━━━━━━━━━\n` +
                                  `📺 *MAX Premium:*\n` +
                                  `Perfil: 1M $15 | 2M $25 | 3M $34 | 12M $55\n` +
                                  `Completa: 1M $45 | 2M $59 | 3M $78 | 12M $120\n` +
                                  `━━━━━━━━━━━━━━━━━━\n` +
                                  `📦 *Prime Video:*\n` +
                                  `Perfil: 1M $10 | 2M $13 | 3M $19 | 12M $30\n` +
                                  `Completa: 1M $28 | 2M $35 | 3M $45 | 12M $95\n` +
                                  `━━━━━━━━━━━━━━━━━━\n` +
                                  `💛 *VIX:*\n` +
                                  `Perfil: 1M $9 | 2M $15 | 3M $19 | 12M $28\n` +
                                  `Completa: 1M $13 | 2M $20 | 3M $29 | 12M $38\n` +
                                  `━━━━━━━━━━━━━━━━━━\n` +
                                  `⭐ *Paramount+:*\n` +
                                  `Perfil: 1M $13 | 2M $18 | 3M $23 | 12M $30\n` +
                                  `Completa: 1M $45 | 2M $55 | 3M $65 | 12M $110\n` +
                                  `━━━━━━━━━━━━━━━━━━\n` +
                                  `🍿 *Crunchyroll:*\n` +
                                  `Perfil: 1M $17 | 2M $24 | 3M $32 | 12M $48\n` +
                                  `Completa: 1M $45 | 2M $65 | 3M $80 | 12M $110\n` +
                                  `━━━━━━━━━━━━━━━━━━\n` +
                                  `🦉 *Duolingo:*\n` +
                                  `Perfil: 1M $12 | 2M $21 | 3M $26 | 12M $37\n` +
                                  `Completa: 1M $14 | 2M $25 | 3M $29 | 12M $40\n` +
                                  `━━━━━━━━━━━━━━━━━━\n` +
                                  `🦊 Fox One Perfil: 1M $19 | 2M $25 | 3M $35 | 12M $58\n` +
                                  `🦊 Fox One Completa: 1M $55\n` +
                                  `🎧 Apple TV Perfil: 1M $19 | 2M $25 | 3M $33 | 12M $48\n` +
                                  `🎧 Apple TV Completa: 1M $45 | 2M $70\n` +
                                  `📺 IPTV Perfil: 1M $17 | 2M $27 | 3M $37 | 12M $57\n` +
                                  `📺 IPTV Completa: 1M $45 | 2M $55 | 3M $65 | 12M $125\n` +
                                  `📺 Claro+Canales Completa: 1M $70\n` +
                                  `━━━━━━━━━━━━━━━━━━\n` +
                                  `🎶 *MÚSICA:*\n` +
                                  `▶️ YouTube Invitación: 1M $15 | 2M $27 | 3M $34\n` +
                                  `▶️ YouTube Individual: $22 (tus datos) | $30 (mis datos)\n` +
                                  `▶️ YouTube Familiar: $26 (tus datos) | $30 (mis datos)\n` +
                                  `💚 Spotify: 1M $37 | 2M $45 | 3M $55 | 6M $85 | Anual $135\n` +
                                  `🎵 Deezer: 1M $14 | 2M $21 | 3M $26 | 6M $30 | Anual $45\n` +
                                  `━━━━━━━━━━━━━━━━━━\n` +
                                  `🫦 *APPS & TOOLS:*\n` +
                                  `🎨 Canva Invitación: 1M $6 | 2M $11 | 3M $23 | 6M $27 | 12M $39\n` +
                                  `🎨 Canva Pro: 1M $20 | 2M $35 | 3M $40 | 6M $50 | 12M $70 | 24M $100\n` +
                                  `🤖 ChatGPT Individual: 1M $45 | 3M $70\n` +
                                  `🤖 ChatGPT Compartido: $57 | Go: $65 | Plus: $85\n` +
                                  `🤖 GEMINI: 18M $60\n` +
                                  `🎮 Game Pass: $98\n` +
                                  `📄 Office: Invitación $19 | Individual $47 | Completa $55\n` +
                                  `━━━━━━━━━━━━━━━━━━\n` +
                                  `🔞 *ADULTOS +18:*\n` +
                                  `Brazzers Perfil: 1M $14 | 2M $25 | 3M $28 | 12M $36\n` +
                                  `Brazzers Completa: 1M $25 | 2M $32 | 3M $40 | 12M $60\n` +
                                  `Pornhub Perfil: 1M $15 | 2M $28 | 3M $32\n` +
                                  `━━━━━━━━━━━━━━━━━━\n` +
                                  `💜 *Todo sujeto a disponibilidad*\n` +
                                  `💜 *Pregunta antes de transferir 🥰*`;
            await sock.sendMessage(remitente, { text: stockCompleto });

        } else if (comando === '!pago') {
            const pago = `🌸🪞 *TRANSFERENCIAS Y DEPÓSITOS* 🪞🌸\n\n` +
                         `🏦 *Banco:* Spin by Oxxo o STP\n` +
                         `💳 *CLABE / Tarjeta:* 7289 6900 0094 6236 54\n` +
                         `👸🏻 *Titular:* Jenifer Lopez\n` +
                         `━━━━━━━━━━━━━━━━━━\n` +
                         `💬 *Concepto:* SU NOMBRE O ABONO\n` +
                         `⚠️ *Importante:* Una vez realizada la transferencia, por favor envíanos tu comprobante de pago para poder validar tu compra.\n\n` +
                         `¡Muchas gracias por elegir Click & Cut! 💖`;
            await sock.sendMessage(remitente, { text: pago });

        } else if (comando === '!asesor' || comando === '!admin') {
            await sock.sendMessage(remitente, { text: `👨‍💻 *Click&Cut:* Un asesor te atenderá personalmente en un momento. Por favor déjanos escrito qué trámite o cuenta requieres.` });
        }
    });
}

iniciarBot();
