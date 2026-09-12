const { default: makeWASocket, DisconnectReason, delay, proto, initAuthCreds, BufferJSON } = require('@whiskeysockets/baileys');
const pino = require('pino');
const http = require('http');
const mongoose = require('mongoose');
const { GoogleGenerativeAI } = require('@google/generative-ai');

const NUMERO_BOT = "525644695396";
const NUMERO_BOT_ALT = "5215644695396";
const NUMERO_ADMIN = "5218641114514";
const PORT = process.env.PORT || 3000;
const MONGO_URI = process.env.MONGO_URI;

// Control de encendido/apagado del bot y tiempo de actividad
let botActivo = true;
const tiempoInicio = Date.now();

// Inicializar API de Gemini
const apiKey = process.env.GEMINI_API_KEY || '';
const genAI = apiKey ? new GoogleGenerativeAI(apiKey) : null;

// System Instruction Click & Cut
const SYSTEM_INSTRUCTION = `
Eres la asistente virtual y anfitriona oficial de "Click & Cut".
Representas a la chica de la marca: dulce, tierna, educada, súper atenta, paciente y muy servicial.
Hablas siempre en femenino ("encantada de ayudarte", "lista para atenderte").

Servicios principales que ofreces con calidez:
1. Streaming Digital: Cuentas y perfiles (Netflix, Disney+, Max, Prime, Vix, Paramount, Spotify, YouTube, Apple Music, Tidal, Amazon Music). Renovaciones y activaciones.
2. Trámites y servicios digitales: Actas de registro civil, CURP certificada, RFC/SAT, citas, constancias IMSS/ISSSTE, antecedentes, licencias y formatos.
3. Papelería creativa, diseño y recursos: Stickers personalizados, etiquetas escolares, 42 plantillas Canva, libros para colorear, mangas y proyectos digitales.
4. Servicios adicionales: Recargas con descuento (Telcel, Bait, Movistar, AT&T), diamantes Free Fire, seguidores en redes sociales y números virtuales.

Pautas de respuesta:
- Tutea con dulzura, educación y respeto.
- Usa emojis suaves y bonitos acordes a los servicios (🌸, ✨, 📺, 🍿, 💻, 📄, ✂️, 🎀, 💖).
- Mantén las respuestas claras, ordenadas y directas sin saturar con textos eternos.
- Menciona que pueden ver los precios escribiendo *.stock* o cotizar transferencias con *.pago*.
- Si un cliente tiene dudas de cuentas caídas o reportes, pídele con dulzura su comprobante o captura de pantalla e indícale que escriba *.asesor* para que el equipo humano lo resuelva de inmediato.
`;

// ==========================================
// MODELOS DE MONGODB
// ==========================================
const AuthSchema = new mongoose.Schema({
    _id: String,
    data: String
});
const AuthModel = mongoose.models.WhatsAppAuth || mongoose.model('WhatsAppAuth', AuthSchema);

const ComandoSchema = new mongoose.Schema({
    nombre: { type: String, required: true, unique: true, lowercase: true, trim: true },
    contenido: { type: String, required: true }
});
const ComandoModel = mongoose.models.Comando || mongoose.model('Comando', ComandoSchema);

// ==========================================
// ADAPTADOR DE AUTENTICACIÓN PARA MONGODB
// ==========================================
async function useMongoDBAuthState(collectionPrefix = 'auth_session') {
    const writeData = async (data, id) => {
        try {
            const key = `${collectionPrefix}_${id}`;
            const str = JSON.stringify(data, BufferJSON.replacer);
            await AuthModel.findByIdAndUpdate(key, { data: str }, { upsert: true });
        } catch (e) {
            console.error('[ERROR MONGODB WRITE]', e.message);
        }
    };

    const readData = async (id) => {
        try {
            const key = `${collectionPrefix}_${id}`;
            const doc = await AuthModel.findById(key);
            if (!doc || !doc.data) return null;
            return JSON.parse(doc.data, BufferJSON.reviver);
        } catch (e) {
            return null;
        }
    };

    const removeData = async (id) => {
        try {
            const key = `${collectionPrefix}_${id}`;
            await AuthModel.findByIdAndDelete(key);
        } catch (e) {
            console.error('[ERROR MONGODB DELETE]', e.message);
        }
    };

    const creds = (await readData('creds')) || initAuthCreds();

    return {
        state: {
            creds,
            keys: {
                get: async (type, ids) => {
                    const data = {};
                    for (const id of ids) {
                        let value = await readData(`${type}-${id}`);
                        if (type === 'app-state-sync-key' && value) {
                            value = proto.Message.AppStateSyncKeyData.fromObject(value);
                        }
                        data[id] = value;
                    }
                    return data;
                },
                set: async (data) => {
                    for (const category in data) {
                        for (const id in data[category]) {
                            const value = data[category][id];
                            const key = `${category}-${id}`;
                            if (value) {
                                await writeData(value, key);
                            } else {
                                await removeData(key);
                            }
                        }
                    }
                }
            }
        },
        saveCreds: () => writeData(creds, 'creds')
    };
}

// Servidor HTTP para Render
http.createServer((req, res) => {
    res.writeHead(200, { 'Content-Type': 'text/plain' });
    res.end('Bot Click&Cut en linea');
}).listen(PORT, () => {
    console.log(`[HTTP] Servidor escuchando en el puerto ${PORT}`);
});

// ==========================================
// CATÁLOGO DE STOCK ACTUALIZADO
// ==========================================
const STOCK_DEFAULT = 
`✨ *APPSTOCK CLICK&CUT* ✨
*¡Actualización de stock y precios!* 🩷
━━━━━━━━━━━━━━━━━━

🎬 *STREAMING & TV*

🍿 *Netflix*
• Normal: 1M $49 | 2M $65 | 3M $82 | 12M $155
• Privado: 1M $55 | 2M $69 | 3M $85
• Extra Privado (bug): 1M $45 | 12M $95
• Completa: 1M $215

🏰 *Disney+ Premium*
• Perfil: 1M $15 | 2M $25 | 3M $32 | 12M $48
• Completa: 1M $60 | 2M $82 | 3M $95 | 12M $145

📺 *MAX Premium*
• Perfil: 1M $18 | 2M $27 | 3M $38 | 12M $65
• Completa: 1M $45 | 2M $59 | 3M $78 | 12M $120

🩶 *HBO Max Platino*
• Perfil: 1M $18 | 2M $29 | 3M $39 | 12M $130
• Completa: 1M $75

📦 *Prime Video*
• Perfil: 1M $15 | 2M $20 | 3M $25 | 12M $40
• Completa: 1M $28 | 2M $35 | 3M $45 | 12M $95

💛 *ViX*
• Perfil: 1M $9 | 2M $15 | 3M $19 | 12M $28
• Completa: 1M $10 | 2M $15 | 3M $25 | 12M $40

⭐ *Paramount+*
• Perfil: 1M $18 | 2M $23 | 3M $29 | 12M $38
• Completa: 1M $45 | 2M $55 | 3M $65 | 12M $110

🍿 *Crunchyroll*
• Perfil: 1M $19 | 2M $24 | 3M $32 | 12M $55
• Completa: 1M $45 | 2M $65 | 3M $80 | 12M $110

🦊 *Fox One*
• Perfil: 1M $19 | 2M $25 | 3M $35 | 12M $58
• Completa: 1M $55

🎧 *Apple TV*
• Perfil: 1M $22 | 2M $26 | 3M $33 | 12M $55
• Completa: 1M $45 | 2M $70

📺 *IPTV*
• Perfil: 1M $19 | 2M $27 | 3M $38 | 12M $60
• Completa: 1M $45 | 2M $55 | 3M $65 | 12M $125

✨ *Más Streaming:*
• Claro Video: $20 | Con Canales: 1M $70
• Mubi: $15
• Universal+: $15
• DAZN: $40

━━━━━━━━━━━━━━━━━━

🎶 *MÚSICA*

▶️ *YouTube Premium*
• Invitación: 1M $15 | 2M $27 | 3M $34
• Individual: $25 (tus datos) | $30 (mis datos)
• Familiar: $30 (tus datos) | $35 (mis datos)

💚 *Spotify*
• 1M $38 | 2M $47 | 3M $58 | 6M $88 | 12M $135

🎵 *Deezer*
• 1M $17 | 2M $25 | 3M $28 | 6M $35 | 12M $55

🍎 *Apple Music (1M)*
• Invitación: $30 | Individual: $40 | Familiar: $70

🎧 *Otras Plataformas*
• Tidal: 1M $40
• Amazon Music (3M): Invitación $25 | Completa $40

━━━━━━━━━━━━━━━━━━

🎨 *DISEÑO, IA & APRENDIZAJE*

🎨 *Canva*
• Invitación: 1M $6 | 2M $11 | 3M $23 | 6M $27 | 12M $39
• Pro: 1M $20 | 2M $35 | 3M $40 | 6M $50 | 12M $70 | 24M $100

🎬 *CapCut (1M)*
• Perfil: $25 | Completa: $55

🤖 *Inteligencia Artificial*
• ChatGPT Go (Compartida): $45
• ChatGPT Plus (Compartida): $85
• Gemini (18M): $60
• IA Fiesta: 1M $55 | 3M $90 | 12M $150

🦉 *Duolingo*
• Perfil: 1M $15 | 2M $21 | 3M $26 | 12M $45
• Completa: 1M $20 | 2M $28 | 3M $32 | 12M $55

━━━━━━━━━━━━━━━━━━

💼 *PRODUCTIVIDAD & GAMING*

📄 *Microsoft Office*
• Invitación: $19
• Individual: $47
• Completa: $55
• Familiar: $40

🎮 *Videojuegos*
• Game Pass Code: $98
• Game Pass Ultimate: $320

━━━━━━━━━━━━━━━━━━

🔞 *ADULTOS (+18)*

🔥 *Brazzers*
• Perfil: 1M $14 | 2M $25 | 3M $28 | 12M $36
• Completa: 1M $25 | 2M $32 | 3M $40 | 12M $60

🔥 *Pornhub*
• Perfil: 1M $15 | 2M $28 | 3M $32

━━━━━━━━━━━━━━━━━━
✨ Si buscas algo en específico y no está en la lista, pide ayuda al .asesor`;

// ==========================================
// FUNCIÓN PRINCIPAL DE ARRANQUE
// ==========================================
async function arrancarBot() {
    if (!MONGO_URI) {
        console.error('❌ ERROR: Falta configurar MONGO_URI en Render.');
        return;
    }

    try {
        await mongoose.connect(MONGO_URI);
        console.log('✅ [BD] Conexión establecida con MongoDB Atlas');
        
        // LIMPIEZA TEMPORAL: Fuerza la creación de un nuevo código de vinculación
        await AuthModel.deleteMany({});
        console.log('🗑️ Sesión anterior eliminada. Esperando nuevo código...');

        const stockExiste = await ComandoModel.findOne({ nombre: 'stock' });
        if (!stockExiste) {
            await ComandoModel.create({ nombre: 'stock', contenido: STOCK_DEFAULT });
            console.log('📦 Catálogo inicial cargado en MongoDB.');
        }
    } catch (dbErr) {
        console.error('❌ [ERROR MONGODB CONEXION]', dbErr.message);
        await delay(5000);
        return arrancarBot();
    }

    const { state, saveCreds } = await useMongoDBAuthState();

    const sock = makeWASocket({
        logger: pino({ level: 'silent' }),
        auth: state,
        printQRInTerminal: false,
        syncFullHistory: false,
        markOnlineOnConnect: true
    });

    sock.ev.on('creds.update', saveCreds);

    if (!sock.authState.creds.registered) {
        setTimeout(async () => {
            try {
                const pairingCode = await sock.requestPairingCode(NUMERO_BOT);
                console.log('\n=========================================');
                console.log(`>>> TU CODIGO DE VINCULACION ES: ${pairingCode} <<<`);
                console.log('=========================================\n');
            } catch (err) {
                try {
                    const pairingCodeAlt = await sock.requestPairingCode(NUMERO_BOT_ALT);
                    console.log('\n=========================================');
                    console.log(`>>> TU CODIGO DE VINCULACION ES: ${pairingCodeAlt} <<<`);
                    console.log('=========================================\n');
                } catch (e) {
                    console.log('[ERROR CRITICO CODIGO]', e.message);
                }
            }
        }, 5000);
    }

    sock.ev.on('connection.update', async (update) => {
        const { connection, lastDisconnect } = update;
        if (connection === 'close') {
            const statusCode = lastDisconnect?.error?.output?.statusCode;
            const debeReconectar = statusCode !== DisconnectReason.loggedOut;
            if (debeReconectar) {
                await delay(3000);
                arrancarBot();
            }
        } else if (connection === 'open') {
            console.log('\n✅ BOT CLICK&CUT CONECTADO A WHATSAPP ✅\n');
        }
    });

    sock.ev.on('group-participants.update', async (update) => {
        try {
            const { id, participants, action } = update;
            if (action === 'add') {
                for (const participante of participants) {
                    const numeroLimpio = participante.split('@')[0];
                    const mensajeBienvenida = 
`╭─── 🌸 *BIENVENID@ A CLICK&CUT* 🌸 ───╮
│  ¡Hola @${numeroLimpio}! 💖🍿
╰─────────────────────────────╯

> ✨ Encuentra tus cuentas de streaming, apoyo en trámites digitales y papelería creativa hecha con amor.

┌─ 💡 *PRIMEROS PASOS*
│ • Escribe \`.stock\` o \`.menu\` para ver precios.
│ • Escribe \`.asesor\` para atención personal.
└─────────────────────────────

> 🎀 _¡Ponte cómod@ y déjanos consentirte!_`;

                    await sock.sendMessage(id, {
                        text: mensajeBienvenida,
                        mentions: [participante]
                    });
                }
            }
        } catch (err) {
            console.log('[ERROR EN BIENVENIDA]', err.message);
        }
    });

    sock.ev.on('messages.upsert', async (chatUpdate) => {
        try {
            const msg = chatUpdate.messages ? chatUpdate.messages[0] : null;
            if (!msg || !msg.message) return;

            const remitente = msg.key.remoteJid;
            const esGrupo = remitente.endsWith('@g.us');
            const esPropio = msg.key.fromMe;
            const remitenteNumero = (msg.key.participant || remitente).split('@')[0].replace(/[^0-9]/g, '');

            let cuerpo = msg.message;
            if (cuerpo.ephemeralMessage) cuerpo = cuerpo.ephemeralMessage.message;
            if (cuerpo.viewOnceMessage) cuerpo = cuerpo.viewOnceMessage.message;

            const textoOriginal = cuerpo.conversation ||
                                  cuerpo.extendedTextMessage?.text ||
                                  cuerpo.imageMessage?.caption ||
                                  '';

            if (!textoOriginal) return;

            const esAdministrador = esPropio || remitenteNumero === NUMERO_ADMIN || remitenteNumero === NUMERO_BOT || remitenteNumero === NUMERO_BOT_ALT;

            // Gestión de encendido / apagado
            if (textoOriginal.trim().toLowerCase() === '.on' && esAdministrador) {
                botActivo = true;
                await sock.sendMessage(remitente, { text: '🟢 *Bot activado y respondiendo.*' });
                return;
            }
            if (textoOriginal.trim().toLowerCase() === '.off' && esAdministrador) {
                botActivo = false;
                await sock.sendMessage(remitente, { text: '🔴 *Bot pausado en modo reposo.*' });
                return;
            }
            if (!botActivo && !esAdministrador) return;

            if (esPropio && !textoOriginal.trim().startsWith('.')) return;

            const esComando = textoOriginal.trim().startsWith('.');
            const texto = textoOriginal
                .toLowerCase()
                .trim()
                .normalize("NFD")
                .replace(/[\u0300-\u036f]/g, "");

            if (esComando) {
                // ==========================================
                // MENÚ PRIVADO EXCLUSIVO PARA ADMINISTRADOR
                // ==========================================
                if (['.adminmenu', '.menuadmin', '.panel'].includes(texto)) {
                    if (!esAdministrador) {
                        await sock.sendMessage(remitente, { text: '> ⛔ *Acceso restringido. Este menú es privado para el administrador.*' });
                        return;
                    }

                    const menuPrivado = 
`_*¡𝐇𝐨𝐥𝐚 𝐁𝐢𝐞𝐧𝐯𝐞𝐧𝐢𝐝@ Click&Cut 𝐄𝐬𝐩𝐞𝐫𝐨 𝐲 𝐭𝐞𝐧𝐠𝐚𝐬 𝐮𝐧 𝐠𝐫𝐚𝐧 𝐝𝐢𝐚 ☀️!*_

┌────── •• ──────┐
    「 _*𝐈𝐍𝐅𝐎 𝐃𝐄𝐋 𝐁𝐎𝐓*_ 」
└────── •• ──────┘
┃ 🫧 _𝖬𝐨𝐝𝐨_ : 𝐏𝐑𝐈𝐕𝐀𝐃𝐎
┃ 🫧 _𝐅𝐞𝐜𝐡𝐚_ : 9 de septiembre
┃ 🫧 _𝖢𝐨𝐦𝐚𝐧𝐝𝐨𝐬 𝐞𝐧 𝐭𝐨𝐭𝐚𝐥_ : 133
┃ 🫧 _𝖢𝖱𝖤𝖠𝖣𝖮𝖱_ : BY JENIFER LOPEZ

━━━━━━━━━━━━━━━
_*L I S T A  -  D E  -  C O M A N D O S*_

╭──「 INFO 📚 」──
┃ 🫧 .botreglas
┃ 🫧 .runtime
┃ 🫧 .totalfunciones
┃ 🫧 .Menu
┃ 🫧 .Menujuegos
┃ 🫧 .Menulogo
┃ 🫧 .menuventas
╰━━━━━━━━━━━⬣

╭──「 GRUPOS 👥 」──
┃ 🫧 .bye on / off
┃ 🫧 .welc off
┃ 🫧 .alv
┃ 🫧 .add *<número>*
┃ 🫧 .crear
┃ 🫧 .delete
┃ 🫧 .demote @user
┃ 🫧 .infogp
┃ 🫧 .guía
┃ 🫧 .link
┃ 🫧 .mute @user / .unmute @user
┃ 🫧 .encuesta *<pregunta|opciones>*
┃ 🫧 .promote @user
┃ 🫧 .reglas
┃ 🫧 .resetlink
┃ 🫧 .setbye @user + texto
┃ 🫧 .setreglas + Texto
┃ 🫧 .setwelcome @user + texto
┃ 🫧 .admins <texto>
┃ 🫧 .kick @user
┃ 🫧 .truco
┃ 🫧 .setemojim <emoji|off>
┃ 🫧 .setemoji <emoji|off>
┃ 🫧 .sethidetag <texto|off>
┃ 🫧 .setfoto <imagen|off>
┃ 🫧 .ver
┃ 🫧 .hidetag <texto>
┃ 🫧 .setNombre *<texto>*
┃ 🫧 .nombre
╰━━━━━━━━━━━⬣

╭──「 GESTIÓN DE STOCK & BOT ⚙️ 」──
┃ 🫧 .setstock <nuevo stock>
┃ 🫧 .set <cmd> | <texto>
┃ 🫧 .delset <cmd>
┃ 🫧 .cmdlist
┃ 🫧 .abrir / .cerrar
┃ 🫧 .grupos
╰━━━━━━━━━━━⬣

╭──「 FREE FIRE 📌 」──
┃ 🫧 .4vs4
┃ 🫧 .6vs6
┃ 🫧 .8vs8
┃ 🫧 .12vs12
┃ 🫧 .16vs16
┃ 🫧 .24vs24
╰━━━━━━━━━━━⬣

╭──「 RPG 🌠 」──
┃ 🫧 .carrera
┃ 🫧 .cazar
┃ 🫧 .detective
┃ 🫧 .escape
┃ 🫧 .magia
┃ 🫧 .fotoantiguabot$
╰━━━━━━━━━━━⬣

╭──「 STICKERS 🏞 」──
┃ 🫧 .sticker
┃ 🫧 .s
┃ 🫧 .pfp @user
┃ 🫧 .qc
┃ 🫧 .scat
┃ 🫧 .wm *<nombre>|<autor>*
┃ 🫧 .emojimix *<emoji+emoji>*
┃ 🫧 .brat
┃ 🫧 .bratv
╰━━━━━━━━━━━⬣

╭──「 ON / OFF 📴 」──
┃ 🫧 .on 🟢
┃ 🫧 .off 🔴
╰━━━━━━━━━━━⬣

╭──「 DESCARGAS 📥 」──
┃ 🫧 .imagen *<texto>*
┃ 🫧 .tiktok <url>
┃ 🫧 .ttmp3 🟡
┃ 🫧 .tiktokmp3 🟡
┃ 🫧 .fb *<link>*
┃ 🫧 .mediafire *<link>*
┃ 🫧 .music *<texto>*
╰━━━━━━━━━━━⬣`;

                    await sock.sendMessage(remitente, { text: menuPrivado });
                    return;
                }

                // ==========================================
                // ACCIONES DE GESTIÓN (ADMIN ONLY)
                // ==========================================
                if (texto === '.runtime') {
                    if (!esAdministrador) return;
                    const diff = Math.floor((Date.now() - tiempoInicio) / 1000);
                    const horas = Math.floor(diff / 3600);
                    const minutos = Math.floor((diff % 3600) / 60);
                    const segundos = diff % 60;
                    await sock.sendMessage(remitente, { text: `⏱️ *Tiempo activo:* ${horas}h ${minutos}m ${segundos}s` });
                    return;
                }

                if (texto === '.totalfunciones') {
                    if (!esAdministrador) return;
                    const totalMongo = await ComandoModel.countDocuments();
                    await sock.sendMessage(remitente, { text: `📊 *Total de funciones integradas:* 133 comandos (+${totalMongo} comandos personalizados en MongoDB).` });
                    return;
                }

                if (texto.startsWith('.hidetag') || texto.startsWith('.admins')) {
                    if (!esGrupo) {
                        await sock.sendMessage(remitente, { text: '> ⚠️ Este comando solo funciona en grupos.' });
                        return;
                    }
                    if (!esAdministrador) {
                        await sock.sendMessage(remitente, { text: '> ⛔ *Comando exclusivo de la administradora.*' });
                        return;
                    }

                    const meta = await sock.groupMetadata(remitente);
                    let menciones = [];
                    let contenido = textoOriginal.replace(/^\.\w+\s*/, '').trim() || '¡Atención a todos!';

                    if (texto.startsWith('.admins')) {
                        menciones = meta.participants.filter(p => p.admin).map(p => p.id);
                        contenido = `📢 *LLAMADO A ADMINISTRADORES*\n\n${contenido}`;
                    } else {
                        menciones = meta.participants.map(p => p.id);
                    }

                    await sock.sendMessage(remitente, { text: contenido, mentions: menciones });
                    return;
                }

                if (texto.startsWith('.kick') || texto.startsWith('.alv')) {
                    if (!esGrupo || !esAdministrador) return;
                    const menciones = msg.message?.extendedTextMessage?.contextInfo?.mentionedJid || [];
                    const citado = msg.message?.extendedTextMessage?.contextInfo?.participant;
                    const victimas = menciones.length > 0 ? menciones : (citado ? [citado] : []);

                    if (victimas.length === 0) {
                        await sock.sendMessage(remitente, { text: '> ⚠️ Menciona o responde al mensaje de quien deseas expulsar.' });
                        return;
                    }
                    try {
                        await sock.groupParticipantsUpdate(remitente, victimas, 'remove');
                        await sock.sendMessage(remitente, { text: '> 👢 Usuario expulsado con éxito.' });
                    } catch (e) {
                        await sock.sendMessage(remitente, { text: '> ⚠️ No pude expulsar al usuario. Verifica que el bot sea admin.' });
                    }
                    return;
                }

                if (texto.startsWith('.add')) {
                    if (!esGrupo || !esAdministrador) return;
                    const numero = textoOriginal.slice(4).trim().replace(/[^0-9]/g, '');
                    if (!numero) {
                        await sock.sendMessage(remitente, { text: '> ⚠️ Ingresa el número: `.add 521XXXXXXXXXX`' });
                        return;
                    }
                    try {
                        await sock.groupParticipantsUpdate(remitente, [`${numero}@s.whatsapp.net`], 'add');
                        await sock.sendMessage(remitente, { text: `> ✅ Solicitud enviada para agregar a +${numero}.` });
                    } catch (e) {
                        await sock.sendMessage(remitente, { text: '> ⚠️ Error al añadir al participante.' });
                    }
                    return;
                }

                if (texto.startsWith('.promote')) {
                    if (!esGrupo || !esAdministrador) return;
                    const menciones = msg.message?.extendedTextMessage?.contextInfo?.mentionedJid || [];
                    if (menciones.length === 0) return;
                    await sock.groupParticipantsUpdate(remitente, menciones, 'promote');
                    await sock.sendMessage(remitente, { text: '> 🎖️ Usuario promovido a administrador.' });
                    return;
                }

                if (texto.startsWith('.demote')) {
                    if (!esGrupo || !esAdministrador) return;
                    const menciones = msg.message?.extendedTextMessage?.contextInfo?.mentionedJid || [];
                    if (menciones.length === 0) return;
                    await sock.groupParticipantsUpdate(remitente, menciones, 'demote');
                    await sock.sendMessage(remitente, { text: '> 📉 Rango de administrador retirado.' });
                    return;
                }

                if (texto === '.link') {
                    if (!esGrupo || !esAdministrador) return;
                    try {
                        const code = await sock.groupInviteCode(remitente);
                        await sock.sendMessage(remitente, { text: `🔗 *Enlace del grupo:*\nhttps://chat.whatsapp.com/${code}` });
                    } catch (e) {
                        await sock.sendMessage(remitente, { text: '> ⚠️ El bot debe ser admin para sacar el link.' });
                    }
                    return;
                }

                if (texto === '.delete' || texto === '.del') {
                    if (!esAdministrador) return;
                    const quoted = msg.message?.extendedTextMessage?.contextInfo;
                    if (quoted && quoted.stanzaId) {
                        await sock.sendMessage(remitente, {
                            delete: {
                                remoteJid: remitente,
                                fromMe: false,
                                id: quoted.stanzaId,
                                participant: quoted.participant
                            }
                        });
                    }
                    return;
                }

                // ==========================================
                // GESTIÓN DE STOCK DIRECTO (.setstock)
                // ==========================================
                if (texto.startsWith('.setstock')) {
                    if (!esAdministrador) {
                        await sock.sendMessage(remitente, { text: '> ⛔ *Comando reservado para la administración.*' });
                        return;
                    }

                    const nuevoStock = textoOriginal.slice(9).trim();
                    if (!nuevoStock) {
                        await sock.sendMessage(remitente, { text: '> ⚠️ *Pega el stock completo después del comando:* \`.setstock [texto]\`' });
                        return;
                    }

                    await ComandoModel.findOneAndUpdate(
                        { nombre: 'stock' },
                        { contenido: nuevoStock },
                        { upsert: true }
                    );

                    await sock.sendMessage(remitente, { text: '✅ *Stock actualizado con éxito en MongoDB Atlas.* Ya está disponible con `.stock`.' });
                    return;
                }

                // ==========================================
                // GESTOR DE COMANDOS EN MONGODB (.set / .addcmd)
                // ==========================================
                if (texto.startsWith('.set ') || texto.startsWith('.addcmd ')) {
                    if (!esAdministrador) {
                        await sock.sendMessage(remitente, { text: '> ⛔ *Este comando solo puede ser ejecutado por el administrador.*' });
                        return;
                    }

                    const raw = textoOriginal.startsWith('.set ') ? textoOriginal.slice(5).trim() : textoOriginal.slice(8).trim();
                    let nombreCmd, respuestaCmd;

                    if (raw.includes('|')) {
                        const partes = raw.split('|');
                        nombreCmd = partes[0].trim().toLowerCase().replace('.', '');
                        respuestaCmd = partes.slice(1).join('|').trim();
                    } else {
                        const partes = raw.split(/\s+/);
                        nombreCmd = partes[0].toLowerCase().replace('.', '');
                        respuestaCmd = raw.substring(partes[0].length).trim();
                    }

                    if (!nombreCmd || !respuestaCmd) {
                        await sock.sendMessage(remitente, { text: '⚠️ *Uso:* `.set nombre | Mensaje de respuesta`' });
                        return;
                    }

                    await ComandoModel.findOneAndUpdate(
                        { nombre: nombreCmd },
                        { contenido: respuestaCmd },
                        { upsert: true }
                    );

                    await sock.sendMessage(remitente, { 
                        text: `╭── ✅ *COMANDO GUARDADO EN BD* ──╮\n│ 🔹 *Comando:* \`.${nombreCmd}\`\n╰──────────────────────────────╯\n\n> 💬 *Respuesta:*\n${respuestaCmd}` 
                    });
                    return;
                }

                if (texto.startsWith('.delset ') || texto.startsWith('.delcmd ')) {
                    if (!esAdministrador) return;
                    const nombreCmd = textoOriginal.split(/\s+/)[1]?.toLowerCase().replace('.', '').trim();
                    if (!nombreCmd) return;

                    const eliminado = await ComandoModel.findOneAndDelete({ nombre: nombreCmd });
                    if (eliminado) {
                        await sock.sendMessage(remitente, { text: `> 🗑️ *El comando* \`.${nombreCmd}\` *ha sido eliminado de MongoDB.*` });
                    } else {
                        await sock.sendMessage(remitente, { text: `> ⚠️ *No se encontró el comando* \`.${nombreCmd}\`*.` });
                    }
                    return;
                }

                if (['.cmdlist', '.comandos'].includes(texto)) {
                    if (!esAdministrador) return;
                    const cmds = await ComandoModel.find({}, 'nombre');
                    if (cmds.length === 0) {
                        await sock.sendMessage(remitente, { text: '> ℹ️ No tienes comandos personalizados guardados en MongoDB.' });
                        return;
                    }
                    let lista = `╭── 📋 *COMANDOS EN MONGODB* ──╮\n╰─────────────────────────────╯\n\n`;
                    cmds.forEach(c => {
                        lista += `• \`.${c.nombre}\`\n`;
                    });
                    lista += `\n> _Usa \`.delset <nombre>\` para remover uno._`;
                    await sock.sendMessage(remitente, { text: lista });
                    return;
                }

                // ==========================================
                // COMANDOS DE CONTROL DE GRUPOS
                // ==========================================
                if (texto === '.grupos' && esAdministrador) {
                    try {
                        const grupos = await sock.groupFetchAllParticipating();
                        let respuesta = `╭── 📋 *GRUPOS ACTIVOS CLICK&CUT* ──╮\n╰────────────────────────────╯\n\n`;
                        for (const id in grupos) {
                            respuesta += `┌─ 🔹 *${grupos[id].subject}*\n│ \`ID:\` \`${id}\`\n└────────────────────────────\n`;
                        }
                        respuesta += `\n> _Usa \`.abrir <id>\` o \`.cerrar <id>\` para gestionarlos._`;
                        await sock.sendMessage(remitente, { text: respuesta });
                    } catch (e) {
                        await sock.sendMessage(remitente, { text: '> ⚠️ *No pude obtener la lista de grupos.*' });
                    }
                    return;
                }

                if (texto.startsWith('.cerrar') && esAdministrador) {
                    const partes = textoOriginal.trim().split(/\s+/);
                    let targetJid = esGrupo ? remitente : partes[1];
                    try {
                        await sock.groupSettingUpdate(targetJid, 'announcement');
                        await sock.sendMessage(targetJid, { text: '🔒 *Grupo cerrado por la administración.*' });
                    } catch (err) {
                        await sock.sendMessage(remitente, { text: '> ⚠️ Error al cerrar el grupo.' });
                    }
                    return;
                }

                if (texto.startsWith('.abrir') && esAdministrador) {
                    const partes = textoOriginal.trim().split(/\s+/);
                    let targetJid = esGrupo ? remitente : partes[1];
                    try {
                        await sock.groupSettingUpdate(targetJid, 'not_announcement');
                        await sock.sendMessage(targetJid, { text: '🔓 *Grupo abierto por la administración.*' });
                    } catch (err) {
                        await sock.sendMessage(remitente, { text: '> ⚠️ Error al abrir el grupo.' });
                    }
                    return;
                }

                // ==========================================
                // MENÚ PÚBLICO Y COMANDOS OFICIALES
                // ==========================================
                if (['.menu', '.ayuda'].includes(texto)) {
                    const menu = 
`╭─── 🛒 *CLICK & CUT TIENDA* 🛒 ───╮
│  ✨ *CATÁLOGO DE SERVICIOS* ✨
╰─────────────────────────────╯

> 💡 _Escribe cualquiera de los siguientes comandos:_

┌─ 🍿 *ENTRETENIMIENTO*
│ • \`.stock\` ➜ Stock completo y actualizado 🩷
│ • \`.catalogo\` ➜ Resumen rápido de todo
│ • \`.combos\` ➜ Combos y Dúos Tiernos
│ • \`.streaming\` ➜ Solo TV y Pantallas
│ • \`.musica\` ➜ Spotify, YouTube, Apple Music, Deezer
│ • \`.apps\` ➜ Canva Pro, IA, CapCut y Office
└─────────────────────────────

┌─ 📋 *GESTIÓN Y TRÁMITES*
│ • \`.tramites\` ➜ Actas, licencias, SAT y más
│ • \`.medicos\` ➜ Recetas, notas e incapacidades
│ • \`.recargas\` ➜ Saldo con precio especial
│ • \`.numeros\` ➜ Números virtuales activos
└─────────────────────────────

┌─ 📁 *EXTRAS & DIGITAL*
│ • \`.extras\` ➜ Mangas, películas, APKs y Canva
│ • \`.libros\` ➜ Mega Pack 1000 PDFs
│ • \`.diamantes\` ➜ Free Fire y Pase Booyah
│ • \`.redes\` ➜ Seguidores, likes y vistas
│ • \`.adultos\` ➜ Contenido +18 exclusivo
└─────────────────────────────

┌─ ℹ️ *INFORMACIÓN Y ATENCIÓN*
│ • \`.pago\` ➜ Datos bancarios / transferencias
│ • \`.contacto\` ➜ Canales oficiales y redes
│ • \`.garantia\` ➜ Cobertura y reposiciones
│ • \`.dudas\` ➜ Preguntas frecuentes
│ • \`.horario\` ➜ Horarios de entrega
│ • \`.reglas\` ➜ Condiciones de uso
│ • \`.asesor\` ➜ Soporte humano directo
└─────────────────────────────

> 🌸 _Escribe el comando con punto para recibir la información._`;
                    await sock.sendMessage(remitente, { text: menu });
                    return;
                }

                if (texto === '.catalogo' || texto === '.streaming' || texto === '.stock') {
                    const stockEnBD = await ComandoModel.findOne({ nombre: 'stock' });
                    const contenidoStock = stockEnBD ? stockEnBD.contenido : STOCK_DEFAULT;
                    await sock.sendMessage(remitente, { text: contenidoStock });
                    return;
                }

                if (['.contacto'].includes(texto)) {
                    const contacto = 
`╭── 📱✨ *CANALES OFICIALES* ✨📱 ──╮
│   *ATENCIÓN AL CLIENTE CLICK&CUT*
╰─────────────────────────────╯

┌─ 💬 *WHATSAPP OFICIAL*
│ • \`+52 864 111 4514\`
└─────────────────────────────

┌─ 🌸 *REDES SOCIALES*
│ • \`Facebook Click&Cut:\`
│   https://www.facebook.com/share/1Eb5bH7FRe/?mibextid=wwXIfr
│ • \`Facebook Personal:\`
│   https://www.facebook.com/share/1DnL8mn1tK/?mibextid=wwXIfr
└─────────────────────────────

> 💖 _¡Guarda nuestro número y síguenos para ver promos exclusivas!_`;
                    await sock.sendMessage(remitente, { text: contacto });
                    return;
                }

                if (['.pago'].includes(texto)) {
                    const pago = 
`╭─── 🌸🪞 *DATOS DE TRANSFERENCIA* 🪞🌸 ───╮
│       *CLICK & CUT FORMAS DE PAGO*
╰────────────────────────────────╯

┌─ 💳 *TRANSFERENCIA BANCARIA / STP*
│ • \`Banco:\` Spin by Oxxo o STP
│ • \`CLABE:\` \`728969000094623654\`
│ • \`Titular:\` Jenifer Lopez
└────────────────────────────────

> 💬 *Concepto:* Tu nombre o servicio
> ⚠️ *Importante:* Al completar la transferencia, envíanos la foto o captura clara de tu comprobante.

🎀 _¡Muchas gracias por apoyar mi emprendimiento!_`;
                    await sock.sendMessage(remitente, { text: pago });
                    return;
                }

                if (['.asesor', '.admin'].includes(texto)) {
                    await sock.sendMessage(remitente, {
                        text: `> 👨‍💻 *Click & Cut Soporte:* En un momento te atiende un asesor humano. Por favor escribe con detalle qué servicio deseas adquirir o adjunta tu comprobante aquí.`
                    });
                    return;
                }

                // ==========================================
                // BUSCADOR DE COMANDOS EN MONGODB (DINÁMICOS)
                // ==========================================
                const comandoBuscado = texto.split(/\s+/)[0].replace('.', '');
                const cmdEncontrado = await ComandoModel.findOne({ nombre: comandoBuscado });
                if (cmdEncontrado) {
                    await sock.sendMessage(remitente, { text: cmdEncontrado.contenido });
                    return;
                }
            }

            // ==========================================
            // RESPUESTAS CON IA GEMINI
            // ==========================================
            if (esPropio) return;

            const mencionado = textoOriginal.includes(`@${NUMERO_BOT}`) || textoOriginal.includes(`@${NUMERO_BOT_ALT}`);
            const debeResponderIA = !esGrupo || (esGrupo && mencionado);

            if (debeResponderIA) {
                if (!genAI) return;

                try {
                    const model = genAI.getGenerativeModel({
                        model: 'gemini-1.5-flash',
                        systemInstruction: SYSTEM_INSTRUCTION
                    });

                    const result = await model.generateContent(textoOriginal);
                    const responseText = result.response.text();

                    if (responseText) {
                        await sock.sendMessage(remitente, { text: responseText }, { quoted: msg });
                    }
                } catch (iaError) {
                    console.error('[ERROR GEMINI]', iaError.message);
                }
            }

        } catch (err) {
            console.log('[ERROR PROCESANDO MENSAJE]', err.message);
        }
    });
}

arrancarBot();
