import makeWASocket, { 
    DisconnectReason, 
    delay, 
    proto, 
    initAuthCreds, 
    BufferJSON,
    downloadMediaMessage
} from '@whiskeysockets/baileys';
import pino from 'pino';
import http from 'http';
import mongoose from 'mongoose';
import { GoogleGenerativeAI } from '@google/generative-ai';

// ==========================================
// CONFIGURACIÓN Y VARIABLES DE ENTORNO
// ==========================================
const NUMERO_BOT = process.env.BOT_PHONE_NUMBER || "528641265554";
const NUMERO_ADMIN = "528641114514";
const PORT = process.env.PORT || 3000;
const MONGO_URI = process.env.MONGO_URI;

let botActivo = true;
const tiempoInicio = Date.now();

const apiKey = process.env.GEMINI_API_KEY || '';
const genAI = apiKey ? new GoogleGenerativeAI(apiKey) : null;

// ==========================================
// STOCK Y CATÁLOGO OFICIAL CLICK&CUT
// ==========================================
const STOCK_DEFAULT = `🖤 *CLICK&CUT* 🖤
🤍TU TIENDA DIGITAL🤍
━━━━━━━━━━━━━━━━━━
🦋 𝗣𝗘𝗥𝗙𝗜𝗟𝗘𝗦:

🎬 𝗡𝗲𝘁𝗳𝗹𝗶𝘅 Premium:
📌•Pantalla compartida con PIN personal.
*1M $45 | 3M $85 | 12M $150*

🎬 𝗡𝗲𝘁𝗳𝗹𝗶𝘅 Privado:
📌• Perfil exclusivo para ti.
*1M $55 | 3M $85 | 12M $165*

🎬 Netflix extra bug:
📌•Acceso directo sin caídas ni bloqueos de hogar.
*1M $40 | 3M $65 | 12M $100*

🔥 𝗖𝗨𝗘𝗡𝗧𝗔𝗦 𝗖𝗢𝗠𝗣𝗟𝗘𝗧𝗔𝗦
🎬 𝗡𝗲𝘁𝗳𝗹𝗶𝘅 Premium:
• 1M $55 | 3M $95 | 12M $190

🎬 𝗡𝗲𝘁𝗳𝗹𝗶𝘅 Privado:
• 1M $65 | 3M $85 | 12M $185

🎬 Netflix extra bug:
• 1M $45 | 3M $65 | 12M $130

━━━━━━━━━━━━━━━━━━
🦋 𝗣𝗘𝗥𝗙𝗜𝗟𝗘𝗦:
🏰 𝗗𝗶𝘀𝗻𝗲𝘆+ Premium:
1M $20 | 3M $45 | 12M $85
🔥 𝗖𝗨𝗘𝗡𝗧𝗔𝗦 𝗖𝗢𝗠𝗣𝗟𝗘𝗧𝗔𝗦
🏰 𝗗𝗶𝘀𝗻𝗲𝘆 Premium:
1M $65 | 3M $95 | 12M $185
━━━━━━━━━━━━━━━━━━
🦋 𝗣𝗘𝗥𝗙𝗜𝗟𝗘𝗦:
📺 𝗠𝗔𝗫 Premium:
1M $25 | 3M $45 | 12M $75
🔥 𝗖𝗨𝗘𝗡𝗧𝗔𝗦 𝗖𝗢𝗠𝗣𝗟𝗘𝗧𝗔𝗦:
📺 𝗠𝗔𝗫 Premium:
1M $50 | 3M $85 | 12M $135
━━━━━━━━━━━━━━━━━━
🦋 𝗣𝗘𝗥𝗙𝗜𝗟𝗘𝗦:
📦 𝗣𝗿𝗶𝗺𝗲 Video:
1M $25 | 3M $35 | 12M $55
🔥 𝗖𝗨𝗘𝗡𝗧𝗔𝗦 𝗖𝗢𝗠𝗣𝗟𝗘𝗧𝗔𝗦:
📦 𝗣𝗿𝗶𝗺𝗲 Video:
1M $35 | 3M $65 | 12M $90
━━━━━━━━━━━━━━━━━━
🦋 𝗣𝗘𝗥𝗙𝗜𝗟𝗘𝗦:
🩶 HBO MAX PLATINO:
1M $25 | 3M $45 | 12M $135
🔥 𝗖𝗨𝗘𝗡𝗧𝗔𝗦 𝗖𝗢𝗠𝗣𝗟𝗘𝗧𝗔𝗦:
1M $75 | 3M $95 | 12M $150
━━━━━━━━━━━━━━━━━━
🦋 𝗣𝗘𝗥𝗙𝗜𝗟𝗘𝗦:
💛 𝗩𝗜𝗫:
1M $14 | 3M $32 | 12M $45
🔥 𝗖𝗨𝗘𝗡𝗧𝗔𝗦 𝗖𝗢𝗠𝗣𝗟𝗘𝗧𝗔𝗦:
💛 𝗩𝗜𝗫:
1M $20 | 3M $35 | 12M $60
━━━━━━━━━━━━━━━━━━
🦋 𝗣𝗘𝗥𝗙𝗜𝗟𝗘𝗦:
⭐ 𝗣𝗮𝗿𝗮𝗺𝗼𝘂𝗻𝘁+:
1M $20 | 3M $35 | 12M $45
🔥 𝗖𝗨𝗘𝗡𝗧𝗔𝗦 𝗖𝗢𝗠𝗣𝗟𝗘𝗧𝗔𝗦:
⭐ 𝗣𝗮𝗿𝗮𝗺𝗼𝘂𝗻𝘁+:
1M $55 | 3M $75 | 12M $95
━━━━━━━━━━━━━━━━━━
🦋 𝗣𝗘𝗥𝗙𝗜𝗟𝗘𝗦:
🍿 𝗖𝗿𝘂𝗻𝗰𝗵𝘆𝗿𝗼𝗹𝗹:
1M $20 | 3M $35 | 12M $60
🔥 𝗖𝗨𝗘𝗡𝗧𝗔𝗦 𝗖𝗢𝗠𝗣𝗟𝗘𝗧𝗔𝗦:
🍿 𝗖𝗿𝘂𝗻𝗰𝗵𝘆𝗿𝗼𝗹𝗹:
1M $55 | 3M $75 | 12M $100
━━━━━━━━━━━━━━━━━━
🦋 𝗣𝗘𝗥𝗙𝗜𝗟𝗘𝗦:
🦉 𝗗𝘂𝗼𝗹𝗶𝗻𝗴𝗼:
1M $20 | 3M $35 | 12M $50
🔥 𝗖𝗨𝗘𝗡𝗧𝗔𝗦 𝗖𝗢𝗠𝗣𝗟𝗘𝗧𝗔𝗦:
🦉 𝗗𝘂𝗼𝗹𝗶𝗻𝗴𝗼:
1M $35 | 3M $50 | 12M $70
━━━━━━━━━━━━━━━━━━
🦋 𝗣𝗘𝗥𝗙𝗜𝗟𝗘𝗦:
🦊 𝗙𝗼𝘅 𝗢𝗻𝗲:
1M $24 | 3M $38 | 12M $60
🔥 𝗖𝗨𝗘𝗡𝗧𝗔𝗦 𝗖𝗢𝗠𝗣𝗟𝗘𝗧𝗔𝗦:
🦊 𝗙𝗼𝘅 𝗢𝗻𝗲: 1M $65 | 3M $85
━━━━━━━━━━━━━━━━━━
🦋 𝗣𝗘𝗥𝗙𝗜𝗟𝗘𝗦:
🎧 𝗔𝗽𝗽𝗹𝗲 𝗧𝗩:
1M $23 | 3M $39 | 12M $60
🔥 𝗖𝗨𝗘𝗡𝗧𝗔𝗦 𝗖𝗢𝗠𝗣𝗟𝗘𝗧𝗔𝗦:
🎧 𝗔𝗽𝗽𝗹𝗲 𝗧𝗩:
1M $55 | 3M $75 | 12M $100
━━━━━━━━━━━━━━━━━━
🦋 𝗣𝗘𝗥𝗙𝗜𝗟𝗘𝗦:
📺 𝗜𝗣𝗧𝗩:
1M $26 | 3M $40 | 12M $65
🔥 𝗖𝗨𝗘𝗡𝗧𝗔𝗦 𝗖𝗢𝗠𝗣𝗟𝗘𝗧𝗔𝗦:
📺 𝗜𝗣𝗧𝗩:
1M $50 | 3M $80 | 12M $95
━━━━━━━━━━━━━━━━━━
📺 𝗖𝗹𝗮𝗿𝗼+𝗖𝗮𝗻𝗮𝗹𝗲𝘀:
🔥 𝗖𝗨𝗘𝗡𝗧𝗔𝗦 𝗖𝗢𝗠𝗣𝗟𝗘𝗧𝗔𝗦: 1M $75
*𝗖𝗹𝗮𝗿𝗼 video* : 1M $30 | 3M $50 | 12M $90
━━━━━━━━━━━━━━━━━━
🎬 *MUBI*:
🦋 𝗣𝗘𝗥𝗙𝗜𝗟𝗘𝗦: 1M $20 | 3M $35 | 12M $50
🔥 𝗖𝗨𝗘𝗡𝗧𝗔𝗦 𝗖𝗢𝗠𝗣𝗟𝗘𝗧𝗔𝗦: 1M $50 | 3M $75 | 12M $100

🫧 *Universal+ (a tus datos)*:
🦋 𝗣𝗘𝗥𝗙𝗜𝗟𝗘𝗦: 1M $25 | 3M $33 | 12M $45
🔥 𝗖𝗨𝗘𝗡𝗧𝗔𝗦 𝗖𝗢𝗠𝗣𝗟𝗘𝗧𝗔𝗦: 1M $45 | 3M $58 | 12M $75

⚽️ *DAZN + NFL*:
🦋 𝗣𝗘𝗥𝗙𝗜𝗟𝗘𝗦: 1M $38 | 3M $55 | 12M $85

🏩 *VIKI RAKUTEN*:
🦋 𝗣𝗘𝗥𝗙𝗜𝗟𝗘𝗦: 1M $25 | 3M $45 | 12M $75
🔥 𝗖𝗨𝗘𝗡𝗧𝗔𝗦 𝗖𝗢𝗠𝗣𝗟𝗘𝗧𝗔𝗦: 1M $65 | 3M $85 | 12M $100

🇰🇷 *KOCOWA*:
🦋 𝗣𝗘𝗥𝗙𝗜𝗟𝗘𝗦: 1M $20 | 3M $35 | 12M $58
🔥 𝗖𝗨𝗘𝗡𝗧𝗔𝗦 𝗖𝗢𝗠𝗣𝗟𝗘𝗧𝗔𝗦: 1M $30 | 3M $45 | 12M $65
━━━━━━━━━━━━━━━━━━
🎶 𝗠Ú𝗦𝗜𝗖𝗔
━━━━━━━━━━━━━━━━━━
▶️ *𝗬𝗼𝘂𝗧𝘂𝗯𝗲 Premium Invitación*: 1M $18 | 3M $29 | 12M $58
▶️ *𝗬𝗼𝘂𝗧𝘂𝗯𝗲 Premium Individual*:
• (tus datos): 1M $25 | 3M $45 | 12M $85
• (mis datos): 1M $30 | 3M $50 | 12M $100
▶️ *𝗬𝗼𝘂𝗧𝘂𝗯𝗲 Familiar*:
• (tus datos): 1M $35 | 3M $48 | 12M $85
• (mis datos): 1M $40 | 3M $58 | 12M $95

💚 *SPOTIFY Individual*:
1M $45 | 3M $85 | 12M $150

🎵 *DEEZER*:
1M $22 | 3M $43 | 12M $65

🎵 *APPLE MUSIC*:
• Invitación: 1M $30 | 3M $60 | 12M $95
• Individual: 1M $45 | 3M $65 | 12M $100
• Familiar: 1M $60 | 3M $75

🎶 *TIDAL*:
1M $35 | 3M $45 | 12M $75

🎧 *AMAZON MUSIC*:
🦋 Por invitación: 1M $20 | 3M $35 | 12M $55
🔥 Completa: 1M $25 | 3M $40 | 12M $65
━━━━━━━━━━━━━━━━━━
🫦 𝗢𝗧𝗥𝗢𝗦 & APPS
━━━━━━━━━━━━━━━━━━
🎨 *CANVA*:
• Invitación: 1M $15 | 3M $25 | 12M $40
• Pro: 1M $25 | 3M $35 | 12M $60

📸 *CAPCUT PRO*:
🦋 Acceso: 1M $30 | 3M $52 | 12M $85
🔥 Completa: 1M $70 | 3M $78 | 12M $100

📸 *PICSART*:
🦋 Acceso: 1M $25 | 3M $42 | 12M $55
🔥 Completa: 1M $60 | 3M $75 | 12M $100

🎬 *PELICULAS & LIBROS* 📚:
• Películas: $20
• Libros (PDF): 1x $20 o 3x $50
━━━━━━━━━━━━━━━━━━
🤖 𝗜𝗡𝗧𝗘𝗟𝗜𝗚𝗘𝗡𝗖𝗜𝗔 𝗔𝗥𝗧𝗜𝗙𝗜𝗖𝗜𝗔𝗟
━━━━━━━━━━━━━━━━━━
🤖 *CHATGPT*:
• ChatGPT Go (Compartida): 1M $65 | Completa: $165
• ChatGPT Plus (Compartida): 1M $85 | Completa: 1M $185

🫧 *GEMINI*:
• Invitación: 18M $75

🔮 *IA FIESTA*:
1M $45 | 12M $145
━━━━━━━━━━━━━━━━━━
🔥 𝗘𝗫𝗧𝗥𝗔𝗦 & PRODUCTIVIDAD
━━━━━━━━━━━━━━━━━━
🎮 *VIDEOJUEGOS*:
• Game Pass Code: $120
• Game Pass Ultimate: $350

🪷 *VPN SURFSHARK*:
🔥 Completa: 1M $75 | 3M $95

🐦‍🔥 *APK DRAMA BOX*: $48

🖱 *OFFICE (tus datos)*:
• Individual: $30 | Invitación: $25 | Completa: $45 | Familiar: $55

🖱 *MICROSOFT 365*:
• Invitación: $25 | Completa (tus datos): $45
━━━━━━━━━━━━━━━━━━
⚠️ +𝟭𝟴 𝗦𝗼𝗹𝗼 𝗺𝗮𝘆𝗼𝗿𝗲𝘀 𝗱𝗲 𝗲𝗱𝗮𝗱 ⚠️
━━━━━━━━━━━━━━━━━━
🔥 *BRAZZERS*:
🦋 Perfil: 1M $25 | 3M $33 | 12M $48
🔥 Completa: 1M $30 | 3M $45 | 12M $55

🔥 *PORNHUB*:
🦋 Perfil: 1M $30 | 3M $45 | 12M $60
🔥 Completa: 1M $38 | 3M $48 | 12M $70

💜 Todo sujeto a disponibilidad.
💜 Pregunta antes de transferir 🥰`;

const SYSTEM_INSTRUCTION = `
Eres la asistente virtual, anfitriona y amiga oficial de "Click & Cut".
Representas a la chica de la marca: dulce, tierna, educada, súper atenta, paciente, platicadora y muy servicial.
Hablas siempre en femenino ("encantada de ayudarte", "lista para atenderte", "amiga").

Pautas de conversación e interacción en grupos y chats:
- Responde activamente a cualquier plática casual, saludo, broma, duda o pregunta general que envíen las personas, integrándote a la conversación con carisma y calidez.
- Tutea con dulzura, educación y respeto.
- Usa emojis bonitos y variados (🌸, ✨, 🍿, 💻, 🎀, 💖, 🥰, 📺).
- Mantén las respuestas naturales, fluidas y concisas para no saturar los grupos de texto enorme.
- Si alguien pregunta por cuentas, servicios o precios, ayúdale con los precios oficiales de tu stock o invítalos con amor a escribir .stock.
- Si alguien necesita pagar, recuérdale que puede escribir .pago.
- Si buscan a la dueña o soporte humano, diles que escriban .asesor.
`;

// Plantilla de la Ficha de Registro de Pedido
const FICHA_PEDIDO = 
`╭─── 🌸🧾 *FICHA DE REGISTRO* 🧾🌸 ───╮
│        *CLICK & CUT OFICIAL*
╰────────────────────────────────╯

¡Muchísimas gracias por tu pago! 💖✨
Para procesar y enviarte tu cuenta de inmediato por privado, por favor completa los siguientes datos respondiendo a este mensaje:

📝 *Nombre completo:* 
📺 *Servicio / Plataforma:* 
👤 *Tipo:* (¿Perfil con PIN o Cuenta Completa?)
⏳ *Meses a adquirir:* (1, 3 o 12 meses)
📧 *Correo de activación* (si aplica a tus datos):

━━━━━━━━━━━━━━━━━━━━
🎀 _En cuanto envíes esta ficha completa, la administradora revisará el comprobante y te entregará tus accesos de inmediato por chat privado._`;

// ==========================================
// ESQUEMAS DE MONGODB
// ==========================================
const AuthSchema = new mongoose.Schema({ _id: String, data: String });
const AuthModel = mongoose.models.WhatsAppAuth || mongoose.model('WhatsAppAuth', AuthSchema);

const ComandoSchema = new mongoose.Schema({
    nombre: { type: String, required: true, unique: true, lowercase: true, trim: true },
    contenido: { type: String, required: true }
});
const ComandoModel = mongoose.models.Comando || mongoose.model('Comando', ComandoSchema);

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
                                await AuthModel.findByIdAndDelete(key);
                            }
                        }
                    }
                }
            }
        },
        saveCreds: () => writeData(creds, 'creds')
    };
}

http.createServer((req, res) => {
    res.writeHead(200, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end('Bot Click&Cut activo 24/7 🌸');
}).listen(PORT, () => {
    console.log(`[HTTP] Servidor en puerto ${PORT}`);
});

// ==========================================
// ARRANQUE PRINCIPAL
// ==========================================
async function arrancarBot() {
    if (!MONGO_URI) {
        console.error('❌ Falta configurar MONGO_URI en Render.');
        return;
    }

    try {
        await mongoose.connect(MONGO_URI);
        console.log('✅ [BD] Conexión establecida con MongoDB Atlas');

        await ComandoModel.findOneAndUpdate(
            { nombre: 'stock' },
            { contenido: STOCK_DEFAULT },
            { upsert: true }
        );
    } catch (dbErr) {
        console.error('❌ [ERROR MONGODB]', dbErr.message);
        await delay(5000);
        return arrancarBot();
    }

    const { state, saveCreds } = await useMongoDBAuthState();

    const sock = makeWASocket({
        logger: pino({ level: 'silent' }),
        auth: state,
        printQRInTerminal: false,
        syncFullHistory: false,
        browser: ['Ubuntu', 'Chrome', '114.0.5735.198']
    });

    sock.ev.on('creds.update', saveCreds);

    let codigoSolicitado = false;
    const pedirCodigo = async () => {
        if (codigoSolicitado || sock.authState.creds.registered) return;
        codigoSolicitado = true;

        try {
            await AuthModel.deleteMany({});
            let numero = NUMERO_BOT.replace(/[^0-9]/g, '');
            console.log(`[CONEXIÓN] Solicitando código para: ${numero}...`);
            const pairingCode = await sock.requestPairingCode(numero);
            console.log('\n=========================================');
            console.log(`>>> TU CODIGO DE VINCULACION ES: ${pairingCode} <<<`);
            console.log('Ingrésalo de inmediato en WhatsApp');
            console.log('=========================================\n');
        } catch (err) {
            codigoSolicitado = false;
            console.error('[ERROR CODIGO VINCULACION]', err.message);
        }
    };

    sock.ev.on('connection.update', async (update) => {
        const { connection, lastDisconnect, qr } = update;

        if (qr && !sock.authState.creds.registered) {
            await pedirCodigo();
        }

        if (connection === 'close') {
            const statusCode = lastDisconnect?.error?.output?.statusCode;
            const debeReconectar = statusCode !== DisconnectReason.loggedOut;
            if (debeReconectar) {
                await delay(4000);
                arrancarBot();
            }
        } else if (connection === 'open') {
            console.log('\n✅ BOT CLICK&CUT CONECTADO A WHATSAPP ✅\n');
        }
    });

    setTimeout(async () => {
        if (!sock.authState.creds.registered && !codigoSolicitado) {
            await pedirCodigo();
        }
    }, 5000);

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

> ✨ Cuentas de streaming, trámites digitales, papelería creativa y más.

┌─ 💡 *PRIMEROS PASOS*
│ • Escribe \`.stock\` o \`.menu\` para ver precios.
│ • Escribe \`.asesor\` para atención personal.
└─────────────────────────────

🎀 _¡Ponte cómod@ y déjanos consentirte!_`;

                    await sock.sendMessage(id, {
                        text: mensajeBienvenida,
                        mentions: [participante]
                    });
                }
            }
        } catch (err) {
            console.log('[ERROR BIENVENIDA]', err.message);
        }
    });

    // ==========================================
    // MANEJO DE MENSAJES E IMÁGENES
    // ==========================================
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

            const esImagen = !!cuerpo.imageMessage;
            const textoOriginal = cuerpo.conversation ||
                                  cuerpo.extendedTextMessage?.text ||
                                  cuerpo.imageMessage?.caption ||
                                  '';

            const esAdministrador = esPropio || remitenteNumero === NUMERO_ADMIN || remitenteNumero === NUMERO_BOT;

            // Encendido y apagado
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

            // =========================================================================
            // RECONOCIMIENTO AUTOMÁTICO DE COMPROBANTES DE PAGO CON GEMINI VISION
            // =========================================================================
            if (esImagen && !esPropio && genAI) {
                try {
                    // Descargar el buffer de la imagen enviada
                    const bufferImagen = await downloadMediaMessage(
                        msg,
                        'buffer',
                        {},
                        { logger: pino({ level: 'silent' }), reuploadRequest: sock.updateMediaMessage }
                    );

                    const visionModel = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });
                    const promptComprobante = 
                        "Analiza esta imagen con precisión. ¿Es un comprobante de pago, transferencia bancaria (BBVA, Spin by Oxxo, Mercado Pago, Banorte, Banamex, etc.), captura de app bancaria o ticket de depósito? Responde ÚNICAMENTE con la palabra 'SI' o 'NO'.";

                    const imagePart = {
                        inlineData: {
                            data: bufferImagen.toString('base64'),
                            mimeType: cuerpo.imageMessage.mimetype || 'image/jpeg'
                        }
                    };

                    const visionResult = await visionModel.generateContent([promptComprobante, imagePart]);
                    const analisis = visionResult.response.text().trim().toUpperCase();

                    if (analisis.includes('SI')) {
                        // 1. Responder con la ficha al cliente
                        await sock.sendMessage(remitente, { text: FICHA_PEDIDO }, { quoted: msg });

                        // 2. Notificar inmediatamente al administrador con los datos del cliente
                        const jidAdmin = `${NUMERO_ADMIN}@s.whatsapp.net`;
                        const avisoAdmin = 
`🚨 *¡NUEVO PAGO RECIBIDO!* 🚨
━━━━━━━━━━━━━━━━━━━━
👤 *Cliente:* +${remitenteNumero}
📍 *Lugar:* ${esGrupo ? 'En Grupo' : 'Chat Privado'}
✨ *Acción:* Se le envió la ficha de registro automáticamente.
━━━━━━━━━━━━━━━━━━━━`;
                        await sock.sendMessage(jidAdmin, { text: avisoAdmin });
                        return; // Detener flujo para no duplicar con respuesta de texto
                    }
                } catch (imgError) {
                    console.error('[ERROR VISION PAGO]', imgError.message);
                }
            }

            // Si no hay texto tras evaluar imagen, finalizar
            if (!textoOriginal || !textoOriginal.trim()) return;

            const esComando = textoOriginal.trim().startsWith('.');
            const texto = textoOriginal.toLowerCase().trim().normalize("NFD").replace(/[\u0300-\u036f]/g, "");

            // ==========================================
            // COMANDOS OFICIALES
            // ==========================================
            if (esComando) {
                if (['.menu', '.ayuda'].includes(texto)) {
                    const menu = 
`╭─── 🖤 *CLICK & CUT DIGITAL* 🤍 ───╮
│    *CATÁLOGO Y SERVICIOS 2026*
╰─────────────────────────────╯

> 💡 _Escribe cualquiera de los siguientes comandos:_

┌─ 🍿 *STREAMING & ENTRETENIMIENTO*
│ • \`.stock\` ➜ Todo el catálogo con precios completos
│ • \`.streaming\` ➜ Netflix, Disney, Max, Prime, Vix, IPTV...
│ • \`.musica\` ➜ Spotify, YouTube, Apple Music, Deezer...
│ • \`.apps\` ➜ Canva Pro, CapCut, Picsart, Office 365...
│ • \`.ia\` ➜ ChatGPT, Gemini, IA Fiesta...
│ • \`.adultos\` ➜ Brazzers y Pornhub (+18)
└─────────────────────────────

┌─ 📋 *GESTIÓN Y TRÁMITES*
│ • \`.tramites\` ➜ Actas de nacimiento, RFC, CURP, IMSS
│ • \`.recargas\` ➜ Saldo y paquetes con descuento
│ • \`.redes\` ➜ Seguidores, likes y vistas
└─────────────────────────────

┌─ ℹ️ *INFORMACIÓN & ATENCIÓN*
│ • \`.pago\` ➜ Cuentas para transferir (Spin / STP)
│ • \`.ficha\` ➜ Formato de entrega de cuenta
│ • \`.contacto\` ➜ Canales y redes sociales oficiales
│ • \`.asesor\` ➜ Atención con la dueña / soporte humano
└─────────────────────────────

🎀 _Escribe el comando con punto para recibir la información._`;
                    await sock.sendMessage(remitente, { text: menu });
                    return;
                }

                if (['.stock', '.catalogo'].includes(texto)) {
                    const stockEnBD = await ComandoModel.findOne({ nombre: 'stock' });
                    await sock.sendMessage(remitente, { text: stockEnBD ? stockEnBD.contenido : STOCK_DEFAULT });
                    return;
                }

                if (texto === '.ficha') {
                    await sock.sendMessage(remitente, { text: FICHA_PEDIDO }, { quoted: msg });
                    return;
                }

                if (texto === '.streaming') {
                    const streamingMsg = 
`🎬 *STREAMING & PANTALLAS CLICK&CUT* 🍿
━━━━━━━━━━━━━━━━━━
• *Netflix Premium:* Perfil 1M $45 | 3M $85 | 12M $150 (Completa: 1M $55)
• *Netflix Privado:* Perfil 1M $55 | 3M $85 | 12M $165 (Completa: 1M $65)
• *Netflix Extra Bug:* Perfil 1M $40 | 3M $65 | 12M $100 (Completa: 1M $45)
• *Disney+ Premium:* Perfil 1M $20 | 3M $45 | 12M $85 (Completa: 1M $65)
• *MAX Premium:* Perfil 1M $25 | 3M $45 | 12M $75 (Completa: 1M $50)
• *Prime Video:* Perfil 1M $25 | 3M $35 | 12M $55 (Completa: 1M $35)
• *HBO Max Platino:* Perfil 1M $25 | 3M $45 (Completa: 1M $75)
• *ViX Premium:* Perfil 1M $14 | 3M $32 (Completa: 1M $20)
• *Paramount+:* Perfil 1M $20 | 3M $35 (Completa: 1M $55)
• *Crunchyroll:* Perfil 1M $20 | 3M $35 (Completa: 1M $55)
• *Apple TV:* Perfil 1M $23 | 3M $39 (Completa: 1M $55)
• *IPTV Canales:* Perfil 1M $26 | 3M $40 (Completa: 1M $50)
• *Claro Video / Canales:* 1M $30 | Con Canales: 1M $75
• *MUBI:* Perfil 1M $20 | Completa 1M $50
• *Universal+:* Perfil 1M $25 | Completa 1M $45
• *DAZN + NFL:* Perfil 1M $38 | 3M $55
• *Viki Rakuten:* Perfil 1M $25 | Completa 1M $65
• *Kocowa:* Perfil 1M $20 | Completa 1M $30

> 💳 Pide tus datos de pago con *.pago*`;
                    await sock.sendMessage(remitente, { text: streamingMsg });
                    return;
                }

                if (texto === '.musica') {
                    const musicaMsg = 
`🎶 *MÚSICA & AUDIO CLICK&CUT* 🎧
━━━━━━━━━━━━━━━━━━
▶️ *YouTube Premium:*
• Invitación: 1M $18 | 3M $29 | 12M $58
• Individual: (tus datos) 1M $25 | (mis datos) 1M $30
• Familiar: (tus datos) 1M $35 | (mis datos) 1M $40

💚 *Spotify Individual:*
• 1M $45 | 3M $85 | 12M $150

🎵 *Apple Music:*
• Invitación: 1M $30 | 3M $60 | 12M $95
• Individual: 1M $45 | 3M $65 | 12M $100
• Familiar: 1M $60 | 3M $75

🎵 *Deezer:* 1M $22 | 3M $43 | 12M $65
🎶 *Tidal:* 1M $35 | 3M $45 | 12M $75
🎧 *Amazon Music:* Invitación 1M $20 | Completa 1M $25

> 💳 Pide tus datos de pago con *.pago*`;
                    await sock.sendMessage(remitente, { text: musicaMsg });
                    return;
                }

                if (texto === '.apps') {
                    const appsMsg = 
`🎨 *DISEÑO, APPS & PRODUCTIVIDAD* 💻
━━━━━━━━━━━━━━━━━━
🎨 *Canva:* Invitación 1M $15 | 3M $25 | Pro: 1M $25 | 3M $35
📸 *CapCut Pro:* Acceso 1M $30 | Completa 1M $70
📸 *Picsart:* Acceso 1M $25 | Completa 1M $60
🦉 *Duolingo:* Perfil 1M $20 | Completa 1M $35
📄 *Office 365:* Individual $30 | Invitación $25 | Completa $45 | Familiar $55
🎮 *Game Pass:* Code $120 | Ultimate $350
🪷 *VPN Surfshark:* Completa 1M $75 | 3M $95
🐦‍🔥 *APK Drama Box:* $48
📚 *Libros PDF:* 1x $20 o 3x $50 | Películas: $20

> 💳 Pide tus datos de pago con *.pago*`;
                    await sock.sendMessage(remitente, { text: appsMsg });
                    return;
                }

                if (texto === '.ia') {
                    const iaMsg = 
`🤖 *INTELIGENCIA ARTIFICIAL* 🔮
━━━━━━━━━━━━━━━━━━
💬 *ChatGPT Go:* Compartida 1M $65 | Completa $165
💬 *ChatGPT Plus:* Compartida 1M $85 | Completa 1M $185
🫧 *Gemini:* Invitación 18M $75
🔮 *IA Fiesta:* 1M $45 | 12M $145

> 💳 Pide tus datos de pago con *.pago*`;
                    await sock.sendMessage(remitente, { text: iaMsg });
                    return;
                }

                if (['.adultos', '.18', '.xxx'].includes(texto)) {
                    const adultosMsg = 
`⚠️ *ADULTOS (+18) CLICK&CUT* 🔥
━━━━━━━━━━━━━━━━━━
🔥 *Brazzers:*
• Perfil: 1M $25 | 3M $33 | 12M $48
• Completa: 1M $30 | 3M $45 | 12M $55

🔥 *Pornhub:*
• Perfil: 1M $30 | 3M $45 | 12M $60
• Completa: 1M $38 | 3M $48 | 12M $70

> 💳 Pide tus datos de pago con *.pago*`;
                    await sock.sendMessage(remitente, { text: adultosMsg });
                    return;
                }

                if (texto === '.pago') {
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
> ⚠️ *Importante:* Al completar el pago envía tu captura clara aquí.

🎀 _¡Muchas gracias por apoyar mi emprendimiento!_`;
                    await sock.sendMessage(remitente, { text: pago });
                    return;
                }

                if (['.asesor', '.admin'].includes(texto)) {
                    await sock.sendMessage(remitente, {
                        text: `> 👩‍💻 *Click & Cut Soporte:* En un momento te atiendo personalmente. Escribe aquí el servicio que deseas o adjunta tu comprobante.`
                    });
                    return;
                }

                if (texto.startsWith('.setstock') && esAdministrador) {
                    const nuevo = textoOriginal.slice(9).trim();
                    if (!nuevo) {
                        await sock.sendMessage(remitente, { text: '⚠️ Escribe el nuevo stock después de `.setstock`' });
                        return;
                    }
                    await ComandoModel.findOneAndUpdate({ nombre: 'stock' }, { contenido: nuevo }, { upsert: true });
                    await sock.sendMessage(remitente, { text: '✅ Stock actualizado exitosamente en MongoDB Atlas.' });
                    return;
                }

                const comandoBuscado = texto.split(/\s+/)[0].replace('.', '');
                const cmdEncontrado = await ComandoModel.findOne({ nombre: comandoBuscado });
                if (cmdEncontrado) {
                    await sock.sendMessage(remitente, { text: cmdEncontrado.contenido });
                    return;
                }
            }

            // ==========================================
            // RESPUESTA AUTOMÁTICA ILIMITADA CON IA GEMINI
            // ==========================================
            if (!esPropio && genAI) {
                try {
                    const model = genAI.getGenerativeModel({
                        model: 'gemini-1.5-flash',
                        systemInstruction: `${SYSTEM_INSTRUCTION}\n\nCatálogo de precios oficial disponible:\n${STOCK_DEFAULT}`
                    });

                    const result = await model.generateContent(textoOriginal);
                    const responseText = result.response.text();

                    if (responseText && responseText.trim()) {
                        await sock.sendMessage(remitente, { text: responseText }, { quoted: msg });
                    }
                } catch (iaError) {
                    console.error('[ERROR GEMINI]', iaError.message);
                }
            }

        } catch (err) {
            console.error('[ERROR GENERAL PROCESANDO]', err.message);
        }
    });
}

arrancarBot();
