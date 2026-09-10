const { default: makeWASocket, DisconnectReason, delay, proto, initAuthCreds, BufferJSON } = require('@whiskeysockets/baileys');
const pino = require('pino');
const http = require('http');
const fs = require('fs');
const path = require('path');
const mongoose = require('mongoose');
const { GoogleGenAI } = require('@google/genai');

const NUMERO_BOT = "525644695396";
const NUMERO_BOT_ALT = "5215644695396";
const NUMERO_ADMIN = "5218641114514";
const PORT = process.env.PORT || 3000;
const MONGO_URI = process.env.MONGO_URI;

// Inicializar API de Gemini
const apiKey = process.env.GEMINI_API_KEY || '';
const ai = apiKey ? new GoogleGenAI({ apiKey }) : null;

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
- Menciona que pueden ver los precios escribiendo *.menu* o cotizar transferencias con *.pago*.
- Si un cliente tiene dudas de cuentas caídas o reportes, pídele con dulzura su comprobante o captura de pantalla e indícale que escriba *.asesor* para que el equipo humano lo resuelva de inmediato.
`;

// ==========================================
// ADAPTADOR DE AUTENTICACIÓN PARA MONGODB
// ==========================================
const AuthSchema = new mongoose.Schema({
    _id: String,
    data: String
});
const AuthModel = mongoose.models.WhatsAppAuth || mongoose.model('WhatsAppAuth', AuthSchema);

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

// ==========================================
// COMANDOS DINÁMICOS LOCALES
// ==========================================
const ARCHIVO_COMANDOS = path.join(__dirname, 'comandos_personalizados.json');

function cargarComandosDinamicos() {
    try {
        if (!fs.existsSync(ARCHIVO_COMANDOS)) {
            fs.writeFileSync(ARCHIVO_COMANDOS, JSON.stringify({}, null, 2));
            return {};
        }
        const data = fs.readFileSync(ARCHIVO_COMANDOS, 'utf-8');
        return JSON.parse(data);
    } catch (e) {
        return {};
    }
}

function guardarComandosDinamicos(comandos) {
    try {
        fs.writeFileSync(ARCHIVO_COMANDOS, JSON.stringify(comandos, null, 2));
    } catch (e) {}
}

let comandosPersonalizados = cargarComandosDinamicos();

// Servidor HTTP para Render
http.createServer((req, res) => {
    res.writeHead(200, { 'Content-Type': 'text/plain' });
    res.end('Bot Click&Cut en linea');
}).listen(PORT, () => {
    console.log(`[HTTP] Servidor escuchando en el puerto ${PORT}`);
});

// ==========================================
// FUNCIÓN PRINCIPAL DE ARRANQUE
// ==========================================
async function arrancarBot() {
    if (!MONGO_URI) {
        console.error('❌ ERROR: Falta configurar la variable MONGO_URI en el panel de Render.');
        return;
    }

    try {
        await mongoose.connect(MONGO_URI);
        console.log('✅ [BD] Conexión establecida con MongoDB Atlas');
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
                console.log('[ERROR VINCULACION] Reintentando con prefijo alterno...');
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
            console.log(`[CONEXION CERRADA] Razon: ${statusCode}. Reconectando: ${debeReconectar}`);
            if (debeReconectar) {
                await delay(3000);
                arrancarBot();
            }
        } else if (connection === 'open') {
            console.log('\n************************************************');
            console.log('✅ BOT CLICK&CUT CONECTADO CON EXITO A WHATSAPP ✅');
            console.log('************************************************\n');
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
│ • Escribe \`.menu\` para ver todo el catálogo.
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

            if (esPropio && !textoOriginal.trim().startsWith('.')) return;

            const esComando = textoOriginal.trim().startsWith('.');
            const texto = textoOriginal
                .toLowerCase()
                .trim()
                .normalize("NFD")
                .replace(/[\u0300-\u036f]/g, "");

            console.log(`[MENSAJE] ${remitente}: "${textoOriginal}"`);

            if (esComando) {
                const esAdministrador = esPropio || remitenteNumero === NUMERO_ADMIN || remitenteNumero === NUMERO_BOT || remitenteNumero === NUMERO_BOT_ALT;

                if (texto.startsWith('.set')) {
                    if (!esAdministrador) {
                        await sock.sendMessage(remitente, { text: '> ⛔ *Este comando solo puede ser ejecutado por el administrador.*' });
                        return;
                    }

                    const contenido = textoOriginal.slice(4).trim();
                    const partes = contenido.split('|');

                    if (partes.length < 2) {
                        const ayudaSet = 
`╭── ⚙️ *CONFIGURADOR DE COMANDOS* ──╮
│  *CLICK & CUT PANEL ADMIN*
╰─────────────────────────────╯

> 💡 *Uso correcto:*
\`\`\`.set nombre_comando | Mensaje de respuesta\`\`\`

┌─ 📌 *EJEMPLOS*
│ • \`.set .aviso | Mañana cerramos a las 6:00 PM\`
│ • \`.delset .nombre_comando\` (para eliminar)
└─────────────────────────────`;
                        await sock.sendMessage(remitente, { text: ayudaSet });
                        return;
                    }

                    let nombreCmd = partes[0].trim().toLowerCase();
                    if (!nombreCmd.startsWith('.')) nombreCmd = '.' + nombreCmd;
                    const respuestaCmd = partes.slice(1).join('|').trim();

                    comandosPersonalizados[nombreCmd] = respuestaCmd;
                    guardarComandosDinamicos(comandosPersonalizados);

                    await sock.sendMessage(remitente, { 
                        text: `╭── ✅ *COMANDO GUARDADO* ──╮\n│ 🔹 *Comando:* \`${nombreCmd}\`\n╰──────────────────────╯\n\n> 💬 *Respuesta configurada:*\n${respuestaCmd}` 
                    });
                    return;
                }

                if (texto.startsWith('.delset')) {
                    if (!esAdministrador) {
                        await sock.sendMessage(remitente, { text: '> ⛔ *Este comando solo puede ser ejecutado por el administrador.*' });
                        return;
                    }

                    let nombreCmd = textoOriginal.slice(7).trim().toLowerCase();
                    if (!nombreCmd.startsWith('.')) nombreCmd = '.' + nombreCmd;

                    if (comandosPersonalizados[nombreCmd]) {
                        delete comandosPersonalizados[nombreCmd];
                        guardarComandosDinamicos(comandosPersonalizados);
                        await sock.sendMessage(remitente, { text: `> 🗑️ *El comando* \`${nombreCmd}\` *ha sido eliminado con éxito.*` });
                    } else {
                        await sock.sendMessage(remitente, { text: `> ⚠️ *No se encontró el comando dinámico* \`${nombreCmd}\`*.` });
                    }
                    return;
                }

                const comandoBuscado = texto.split(/\s+/)[0];
                if (comandosPersonalizados[comandoBuscado]) {
                    await sock.sendMessage(remitente, { text: comandosPersonalizados[comandoBuscado] });
                    return;
                }

                if (texto === '.grupos') {
                    try {
                        const grupos = await sock.groupFetchAllParticipating();
                        let respuesta = `╭── 📋 *GRUPOS ACTIVOS CLICK&CUT* ──╮\n╰────────────────────────────╯\n\n`;
                        for (const id in grupos) {
                            respuesta += `┌─ 🔹 *${grupos[id].subject}*\n│ \`ID:\` \`${id}\`\n└────────────────────────────\n`;
                        }
                        respuesta += `\n> _Usa \`.abrir <id>\` o \`.cerrar <id>\` para gestionarlos._`;
                        await sock.sendMessage(remitente, { text: respuesta });
                    } catch (e) {
                        await sock.sendMessage(remitente, { text: '> ⚠️ *No pude obtener la lista de grupos participantes.*' });
                    }
                    return;
                }

                if (texto.startsWith('.cerrar')) {
                    const partes = textoOriginal.trim().split(/\s+/);
                    let targetJid = esGrupo ? remitente : partes[1];

                    if (!targetJid || !targetJid.endsWith('@g.us')) {
                        const grupos = await sock.groupFetchAllParticipating();
                        const ids = Object.keys(grupos);
                        if (ids.length === 1) {
                            targetJid = ids[0];
                        } else {
                            await sock.sendMessage(remitente, { 
                                text: `> ⚠️ *Si estás en privado usa:* \`.cerrar ID_DEL_GRUPO\`\n> _Consulta los IDs con \`.grupos\`_` 
                            });
                            return;
                        }
                    }

                    try {
                        await sock.groupSettingUpdate(targetJid, 'announcement');
                        const avisoCierre = 
`╭── 🔒 *GRUPO CERRADO* 🔒 ──╮
│   *CLICK & CUT AVISO*
╰─────────────────────────╯

> El grupo ha sido pausado por el equipo de administración.

┌─ ✨ *¿NECESITAS ATENCIÓN?*
│ • Puedes consultar precios con \`.menu\`
│ • Contrataciones y pagos con \`.pago\`
│ • Asistencia directa con un \`.asesor\`
└─────────────────────────

> 💖 _¡Volvemos a abrir en breve!_`;
                        await sock.sendMessage(targetJid, { text: avisoCierre });
                        if (!esGrupo) {
                            await sock.sendMessage(remitente, { text: '> ✅ *Grupo cerrado con éxito.*' });
                        }
                    } catch (err) {
                        await sock.sendMessage(remitente, { text: '> ⚠️ *Error al cerrar el grupo. Verifica que el bot sea Administrador.*' });
                    }
                    return;
                }

                if (texto.startsWith('.abrir')) {
                    const partes = textoOriginal.trim().split(/\s+/);
                    let targetJid = esGrupo ? remitente : partes[1];

                    if (!targetJid || !targetJid.endsWith('@g.us')) {
                        const grupos = await sock.groupFetchAllParticipating();
                        const ids = Object.keys(grupos);
                        if (ids.length === 1) {
                            targetJid = ids[0];
                        } else {
                            await sock.sendMessage(remitente, { 
                                text: `> ⚠️ *Si estás en privado usa:* \`.abrir ID_DEL_GRUPO\`\n> _Consulta los IDs con \`.grupos\`_` 
                            });
                            return;
                        }
                    }

                    try {
                        await sock.groupSettingUpdate(targetJid, 'not_announcement');
                        const avisoApertura = 
`╭── 🔓 *GRUPO ABIERTO* 🔓 ──╮
│   *CLICK & CUT EN LÍNEA*
╰─────────────────────────╯

> El chat ya está disponible para dudas, pedidos y comprobantes.

┌─ 🍿 *ACCESOS RÁPIDOS*
│ • Escribe \`.menu\` para el catálogo general.
│ • Escribe \`.combos\` para combos en promoción.
│ • Escribe \`.pago\` para transferir directo.
└─────────────────────────

> 🎉 _¡Lindo día y felices compras a tod@s!_`;
                        await sock.sendMessage(targetJid, { text: avisoApertura });
                        if (!esGrupo) {
                            await sock.sendMessage(remitente, { text: '> ✅ *Grupo abierto con éxito.*' });
                        }
                    } catch (err) {
                        await sock.sendMessage(remitente, { text: '> ⚠️ *Error al abrir el grupo. Verifica que el bot sea Administrador.*' });
                    }
                    return;
                }

                if (['.menu', '.ayuda'].includes(texto)) {
                    const menu = 
`╭─── 🛒 *CLICK & CUT TIENDA* 🛒 ───╮
│  ✨ *CATÁLOGO DE SERVICIOS* ✨
╰─────────────────────────────╯

> 💡 _Escribe cualquiera de los siguientes comandos:_

┌─ 🍿 *ENTRETENIMIENTO*
│ • \`.catalogo\` ➜ Resumen rápido de stock general
│ • \`.combos\` ➜ Combos y Dúos Tiernos
│ • \`.streaming\` ➜ Cuentas completas y pantallas
│ • \`.musica\` ➜ Spotify, YouTube, Apple Music y más
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

                if (texto === '.catalogo') {
                    const stockCompleto = 
`╭─── 🩷 *CATÁLOGO GENERAL CLICK&CUT* 🩷 ───╮
│      *RESUMEN RÁPIDO DE TODOS LOS SERVICIOS*
╰──────────────────────────────────────────╯

┌─ 🎬 *STREAMING (PERFIL / COMPLETA)*
│ • Netflix: TV \`1M $29\` | Normal \`1M $49\` | Full \`$215\`
│ • Disney+: Perfil \`1M $15\` | Full \`1M $56\`
│ • Max: Perfil \`1M $15\` | Full \`1M $45\`
│ • Prime Video: Perfil \`1M $10\` | Full \`1M $28\`
│ • Vix: Perfil \`1M $9\` | Full \`1M $13\`
│ • Paramount+: Perfil \`1M $13\` | Full \`1M $45\`
│ • Crunchyroll: Perfil \`1M $17\` | Full \`1M $45\`
│ • Apple TV: Perfil \`1M $19\` | IPTV: \`1M $17\`
└──────────────────────────────────────────

┌─ 🎶 *MÚSICA & APPS*
│ • Spotify: \`1M $37\` | Anual \`$135\`
│ • YouTube: Invitación \`1M $15\` | Personal \`$22\`
│ • Apple Music: \`$30\` | Amazon Music: \`3M $25\`
│ • Canva Pro: Invitación \`1M $6\` | Cuenta \`1M $20\`
│ • CapCut: Perfil \`$25\` | Completa \`$55\`
│ • ChatGPT: Perfil \`$45\` | Gemini: \`18M $60\`
└──────────────────────────────────────────

┌─ 📋 *TRÁMITES DIGITALES*
│ • Actas (Nacimiento, Matrimonio, etc.): \`$15\`
│ • CURP Certificada: \`$15\` | Recibo CFE: \`$15\`
│ • NSS / Vigencia IMSS / Semanas: \`$32\`
│ • Antecedentes: Estatales \`$70\` | Federales \`$85\`
│ • Permiso sin placas: \`$80\` | RFC original: \`$135\`
└──────────────────────────────────────────

┌─ 📲 *RECARGAS TELEFÓNICAS*
│ • Telcel: $200 ➔ \`$175\`
│ • Bait: $200 ➔ \`$170\` | $300 ➔ \`$260\`
│ • Movistar: $200 ➔ \`$160\` | $300 ➔ \`$260\`
│ • AT&T: $200 ➔ \`$165\` | $300 ➔ \`$250\`
└──────────────────────────────────────────

┌─ 💎 *DIAMANTES FREE FIRE*
│ • 110: \`$26\` | 342: \`$65\` | 562: \`$88\`
│ • 1,166: \`$145\` | 2,398: \`$300\` | Booyah: \`$45\`
└──────────────────────────────────────────

┌─ 📁 *EXTRAS & CREATIVO*
│ • Mangas (+250) / Colorear / Disney: \`$25 c/u\`
│ • Películas (+270): \`$50\` | Películas Barbie: \`$50 pack\`
│ • APKs Android: \`$15 c/u\` o \`$100 todas\`
│ • 42 Plantillas Canva: \`$55\` | Mega Pack PDFs: \`$70\`
│ • Redes (1k seguidores IG/TikTok): \`$65 / $80\`
└──────────────────────────────────────────

> ⚠️ _Todo sujeto a disponibilidad. Pregunta antes de transferir._
> 💳 _Escribe \`.pago\` para transferir o el comando específico para más detalles._`;
                    await sock.sendMessage(remitente, { text: stockCompleto });
                    return;
                }

                if (texto === '.streaming') {
                    const streaming = 
`╭─── 🩷 *APPSTOCK CLICK&CUT* 🩷 ───╮
│    *CUENTAS Y PANTALLAS EN HD/4K*
╰────────────────────────────────╯

┌─ 🎬 *NETFLIX*
│ 🦋 \`Solo TV:\` 1M $29 | 2M $38 | 3M $49 | 12M $75
│ 🦋 \`Normal:\` 1M $49 | 2M $65 | 3M $82 | 12M $155
│ 🦋 \`Privado:\` 1M $55 | 2M $69 | 3M $85
│ 🔥 \`Cuenta Completa:\` 1M $215
└────────────────────────────────

┌─ 🏰 *DISNEY+ PREMIUM*
│ 🦋 \`Perfil:\` 1M $15 | 2M $25 | 3M $28 | 12M $43
│ 🔥 \`Cuenta Completa:\` 1M $56 | 2M $78 | 3M $89 | 12M $130
└────────────────────────────────

┌─ 📺 *MAX PREMIUM*
│ 🦋 \`Perfil:\` 1M $15 | 2M $25 | 3M $34 | 12M $55
│ 🔥 \`Cuenta Completa:\` 1M $45 | 2M $59 | 3M $78 | 12M $120
└────────────────────────────────

┌─ 📦 *PRIME VIDEO*
│ 🦋 \`Perfil:\` 1M $10 | 2M $13 | 3M $19 | 12M $30
│ 🔥 \`Cuenta Completa:\` 1M $28 | 2M $35 | 3M $45 | 12M $95
└────────────────────────────────

┌─ 💛 *VIX PREMIUM*
│ 🦋 \`Perfil:\` 1M $9 | 2M $15 | 3M $19 | 12M $28
│ 🔥 \`Cuenta Completa:\` 1M $13 | 2M $20 | 3M $29 | 12M $38
└────────────────────────────────

┌─ ⭐ *PARAMOUNT+*
│ 🦋 \`Perfil:\` 1M $13 | 2M $18 | 3M $23 | 12M $30
│ 🔥 \`Cuenta Completa:\` 1M $45 | 2M $55 | 3M $65 | 12M $110
└────────────────────────────────

┌─ 🍿 *CRUNCHYROLL*
│ 🦋 \`Perfil:\` 1M $17 | 2M $24 | 3M $32 | 12M $48
│ 🔥 \`Cuenta Completa:\` 1M $45 | 2M $65 | 3M $80 | 12M $110
└────────────────────────────────

┌─ 🦉 *DUOLINGO*
│ 🦋 \`Perfil:\` 1M $12 | 2M $21 | 3M $26 | 12M $37
│ 🔥 \`Cuenta Completa:\` 1M $14 | 2M $25 | 3M $29 | 12M $40
└────────────────────────────────

┌─ 🦊 *FOX ONE*
│ 🦋 \`Perfil:\` 1M $19 | 2M $25 | 3M $35 | 12M $58
│ 🔥 \`Cuenta Completa:\` 1M $55
└────────────────────────────────

┌─ 🎧 *APPLE TV*
│ 🦋 \`Perfil:\` 1M $19 | 2M $25 | 3M $33 | 12M $48
│ 🔥 \`Cuenta Completa:\` 1M $45 | 2M $70
└────────────────────────────────

┌─ 📺 *IPTV & CANALES*
│ 🦋 \`IPTV Perfil:\` 1M $17 | 2M $27 | 3M $37 | 12M $57
│ 🔥 \`IPTV Completa:\` 1M $45 | 2M $55 | 3M $65 | 12M $125
│ 🔥 \`Claro + Canales:\` 1M $70
└────────────────────────────────

> 💜 _Todo sujeto a disponibilidad. Pregunta antes de transferir 🥰_
> 💡 _Escribe \`.pago\` para obtener los datos bancarios._`;
                    await sock.sendMessage(remitente, { text: streaming });
                    return;
                }

                if (['.musica'].includes(texto)) {
                    const musica = 
`╭─── 🎶 *MÚSICA Y AUDIO PREMIUM* 🎶 ───╮
│     *TUS PLAYLISTS SIN ANUNCIOS*
╰────────────────────────────────╯

┌─ ▶️ *YOUTUBE PREMIUM*
│ • Invitación: \`1M $15\` | \`2M $27\` | \`3M $34\`
│ • Individual: \`$22\` (tus datos) | \`$30\` (mis datos)
│ • Familiar: \`$26\` (tus datos) | \`$30\` (mis datos)
└────────────────────────────────

┌─ 💚 *SPOTIFY PREMIUM*
│ • 1 Mes ➔ \`$37\`
│ • 2 Meses ➔ \`$45\`
│ • 3 Meses ➔ \`$55\`
│ • 6 Meses ➔ \`$85\`
│ • Anual ➔ \`$135\`
└────────────────────────────────

┌─ 🎵 *DEEZER PREMIUM*
│ • 1 Mes ➔ \`$14\`
│ • 2 Meses ➔ \`$21\`
│ • 3 Meses ➔ \`$26\`
│ • 6 Meses ➔ \`$30\`
│ • Anual ➔ \`$45\`
└────────────────────────────────

┌─ 🍎 *APPLE MUSIC*
│ • Invitación ➔ \`$30\`
│ • Individual ➔ \`$40\`
│ • Familiar ➔ \`$70\`
└────────────────────────────────

┌─ 🌊 *TIDAL & AMAZON MUSIC*
│ • Tidal ➔ \`$40\`
│ • Amazon Music (Invitación) ➔ \`3M $25\`
│ • Amazon Music (Completa) ➔ \`3M $40\`
└────────────────────────────────

> 💡 _Escribe \`.pago\` para realizar tu transferencia._`;
                    await sock.sendMessage(remitente, { text: musica });
                    return;
                }

                if (['.apps'].includes(texto)) {
                    const apps = 
`╭─── 🛠️ *HERRAMIENTAS & APPS* 🛠️ ───╮
│    *PRODUCTIVIDAD, DISEÑO E IA*
╰─────────────────────────────╯

┌─ 🎨 *CANVA*
│ • Invitación: \`1M $6\` | \`2M $11\` | \`3M $23\` | \`6M $27\` | \`12M $39\`
│ • Pro Cuenta: \`1M $20\` | \`2M $35\` | \`3M $40\` | \`6M $50\` | \`12M $70\` | \`24M $100\`
└─────────────────────────────

┌─ 🎬 *CAPCUT*
│ • Perfil ➔ \`1M $25\`
│ • Completa ➔ \`1M $55\`
└─────────────────────────────

┌─ 🤖 *INTELIGENCIA ARTIFICIAL*
│ • ChatGPT Perfil Individual: \`1M $45\` | \`3M $70\`
│ • ChatGPT Compartido: \`$57\`
│ • ChatGPT Go: \`$65\`
│ • ChatGPT Plus: \`$85\`
│ • Gemini Advanced: \`18M $60\`
│ • IA Fiesta: \`1M $55\` | \`3M $90\` (Individual)
└─────────────────────────────

┌─ 📄 *MICROSOFT OFFICE 365*
│ • Invitación: \`$19\`
│ • Cuenta Individual: \`$47\`
│ • Cuenta Completa: \`$55\`
└─────────────────────────────

┌─ 🎮 *JUEGOS Y DEPORTES*
│ • DAZN: \`$35\`
│ • Xbox Game Pass Code: \`$98\`
└─────────────────────────────

> 💡 _Escribe \`.pago\` para solicitar tu cuenta de inmediato._`;
                    await sock.sendMessage(remitente, { text: apps });
                    return;
                }

                if (['.extras'].includes(texto)) {
                    const extras = 
`╭─── 📁✨ *EXTRAS & DIGITAL CLICK&CUT* ✨📁 ───╮
│       *DRIVES, PLANTILLAS, APKS Y MÁS*
╰─────────────────────────────────────────╯

┌─ 🔥 *MANGA ANIME EN DRIVE* — \`$25\`
│ • Más de 250 mangas completos organizados
└─────────────────────────────────────────

┌─ 🌈 *LIBROS PARA COLOREAR CUTE* — \`$25\`
│ • Drive con más de 30 libros listos para imprimir
└─────────────────────────────────────────

┌─ 🎬 *PELÍCULAS EN DRIVE* — \`$50\`
│ • Más de 270 películas (estrenos y clásicas)
└─────────────────────────────────────────

┌─ ✨ *LIBROS DISNEY PARA COLOREAR* — \`$25\`
│ • Formato digital de alta calidad para peques
└─────────────────────────────────────────

┌─ 📲 *APKS PARA ANDROID*
│ • Más de 25 aplicaciones funcionales
│ • \`$15 c/u\` a elegir ó \`$100 por todas\`
└─────────────────────────────────────────

┌─ 🩷 *PELÍCULAS BARBIE (2001 - 2013)*
│ • Películas individuales: \`$15 c/u\`
│ • Colección completa: \`$50\`
└─────────────────────────────────────────

┌─ 🎨 *42 PLANTILLAS CANVA PRO* — \`$55\`
│ • Trámites, recetas, diseños y formatos editables
└─────────────────────────────────────────

> 💡 _Escribe \`.pago\` para adquirir tu enlace de descarga inmediato._`;
                    await sock.sendMessage(remitente, { text: extras });
                    return;
                }

                if (['.medicos', '.recetas'].includes(texto)) {
                    const medicos = 
`╭── 💗🩺 *DOCUMENTOS MÉDICOS* 🩺💗 ──╮
│    *CLICK & CUT GESTIÓN PERSONAL*
╰─────────────────────────────╯

┌─ 🏥 *RECETAS MÉDICAS*
│ • Receta IMSS ➔ \`$50\`
│ • Receta ISSSTE ➔ \`$50\`
│ • Receta Farmacias Similares ➔ \`$45\`
│ • Receta Farmacia del Ahorro ➔ \`$45\`
│ • Receta particular ➔ \`$45\`
│ • Análisis de laboratorio ➔ \`$100\`
│ • Nota médica de urgencias ➔ \`$70\`
└─────────────────────────────

┌─ 📋 *INCAPACIDADES*
│ • De 1 a 3 días ➔ \`$40\`
│ • De 4 a 9 días ➔ \`$50\`
│ • 9 días en adelante ➔ _(Cotizar con asesor)_
│ • Hoja de discapacidad ➔ \`$100\`
└─────────────────────────────

┌─ 👨‍👩‍👧 *FORMATOS PERSONALES*
│ • Hoja de concubinato ➔ \`$130\`
│ • No deudor alimentario (Edomex / Federal) ➔ \`$60\`
└─────────────────────────────

> 💡 _Escribe \`.pago\` y adjunta los datos requeridos para tu formato._`;
                    await sock.sendMessage(remitente, { text: medicos });
                    return;
                }

                if (['.combos', '.duos', '.promos'].includes(texto)) {
                    const combos = 
`╭─── 🎀 *COMBOS CLICK & CUT* 🎀 ───╮
│   ✨ *SUPER PROMOCIONES Y DÚOS* ✨
╰─────────────────────────────╯

┌─ 🍓 *COMBO FRESITA* — \`$100\`
│ Netflix + Disney + Max + Prime + Crunchyroll + Vix
└─────────────────────────────

┌─ 🌸 *COMBO ALGODONCITO* — \`$55\`
│ Max + Prime + Crunchyroll + Disney + Vix
└─────────────────────────────

┌─ 🐰 *COMBO CONEJITO* — \`$90\`
│ Netflix + Disney + Max + Prime + Vix
└─────────────────────────────

┌─ ☁️ *COMBO NUBECITA* — \`$65\`
│ Vix + Paramount + Disney + Max + Crunchy
└─────────────────────────────

┌─ 🐱 *COMBO GATITO* — \`$75\`
│ Netflix + Disney + Max
└─────────────────────────────

┌─ 🧁 *COMBO PASTELITO* — \`$78\`
│ Netflix + Disney + Max + Vix
└─────────────────────────────

╭─── 💓 *DÚOS TIERNOS CON NETFLIX* ───╮
│ • Netflix + Disney ➔ \`$60\`
│ • Netflix + Max ➔ \`$60\`
│ • Netflix + Prime ➔ \`$60\`
│ • Netflix + Paramount ➔ \`$70\`
│ • Netflix + Vix ➔ \`$58\`
│ • Netflix + Crunchy ➔ \`$62\`
╰─────────────────────────────╯

╭─── 💜 *DÚOS TIERNOS CON DISNEY* ────╮
│ • Disney + Max ➔ \`$30\`
│ • Disney + Prime ➔ \`$28\`
│ • Disney + Paramount ➔ \`$29\`
│ • Disney + Vix ➔ \`$27\`
│ • Disney + Crunchy ➔ \`$30\`
╰─────────────────────────────╯

> 💡 _Escribe \`.pago\` para pagar o \`.asesor\` para cotizaciones._`;
                    await sock.sendMessage(remitente, { text: combos });
                    return;
                }

                if (['.tramites', '.servicios'].includes(texto)) {
                    const tramites = 
`╭── ✧˚｡⋆ *TRÁMITES Y SERVICIOS* ✧˚｡⋆ ──╮
│    *GESTIÓN DIGITAL Y OFICIAL*
╰─────────────────────────────╯

┌─ 🍒 *ACTAS DEL REGISTRO CIVIL*
│ • Nacimiento ➔ \`$15\`
│ • Matrimonio ➔ \`$15\`
│ • Divorcio ➔ \`$15\`
│ • Defunción ➔ \`$15\`
│ • Certificado INEA ➔ \`$45\`
└─────────────────────────────

┌─ 📋 *DOCUMENTOS & AFORE*
│ • Localizar AFORE ➔ \`$25\`
│ • Certificado COVID ➔ \`$40\`
│ • Recibo CFE actualizado ➔ \`$15\`
│ • CURP certificada ➔ \`$15\`
│ • NSS (Seguro Social 2 hojas) ➔ \`$32\`
│ • Vigencia de derechos IMSS ➔ \`$32\`
│ • Semanas cotizadas IMSS ➔ \`$32\`
│ • Constancia ISSSTE no derechohabiencia ➔ \`$40\`
└─────────────────────────────

┌─ ⚖️ *ANTECEDENTES NO PENALES*
│ • Estatales ➔ \`$70\`
│ • Federales ➔ \`$85\`
└─────────────────────────────

┌─ 🚗 *VEHÍCULOS Y LICENCIAS*
│ • Permiso para circular sin placas (30 días) ➔ \`$80\`
│ • Licencia Guerrero Digital (3 y 5 años) ➔ \`$200 / $230\`
│ • Reposición tarjeta de circulación ➔ \`$700\`
│ • Títulos americanos de vehículos ➔ \`$1,300\`
└─────────────────────────────

┌─ 📄 *RFC, SAT & CERTIFICADOS*
│ • RFC original ➔ \`$135\` | RFC clon ➔ \`$45\`
│ • Renovación e.firma (con contraseña) ➔ \`$600\`
│ • Certificados Primaria / Secundaria / Prepa ➔ \`$60\`
│ • Buró de crédito especial ➔ \`$85\`
└─────────────────────────────

> 💡 _Escribe \`.pago\` o consúltanos con \`.asesor\` para enviar tus datos._`;
                    await sock.sendMessage(remitente, { text: tramites });
                    return;
                }

                if (['.recargas', '.tiempoaire'].includes(texto)) {
                    const recargas = 
`╭─── ✨ *RECARGAS TELEFÓNICAS* ✨ ───╮
│    *MÁS SALDO POR MENOS DINERO*
╰─────────────────────────────╯

┌─ 📲 *TELCEL*
│ • Recarga $200 ➔ Pagas \`$175\`
└─────────────────────────────

┌─ 🐝 *BAIT*
│ • Recarga $200 ➔ Pagas \`$170\`
│ • Recarga $230 ➔ Pagas \`$190\`
│ • Recarga $250 ➔ Pagas \`$220\`
│ • Recarga $300 ➔ Pagas \`$260\`
│ • Recarga $350 ➔ Pagas \`$300\`
│ • Recarga $550 ➔ Pagas \`$450\`
└─────────────────────────────

┌─ 📶 *MOVISTAR*
│ • Recarga $200 ➔ Pagas \`$160\`
│ • Recarga $250 ➔ Pagas \`$210\`
│ • Recarga $300 ➔ Pagas \`$260\`
└─────────────────────────────

┌─ 🌐 *AT&T*
│ • Recarga $200 ➔ Pagas \`$165\`
│ • Recarga $300 ➔ Pagas \`$250\`
│ • Recarga $500 ➔ Pagas \`$440\`
└─────────────────────────────

> 💡 _Paga con \`.pago\` y envía tu número celular junto a tu compañía._`;
                    await sock.sendMessage(remitente, { text: recargas });
                    return;
                }

                if (['.setdiamantes', '.diamantes', '.freefire'].includes(texto)) {
                    const diamantes = 
`╭─── 💎 *DIAMANTES FREE FIRE* 💎 ───╮
│     *ENTREGA RÁPIDA CON ID*
╰─────────────────────────────╯

┌─ 💠 *RECARGAS DIRECTAS*
│ • 110 diamantes ➔ \`$26\`
│ • 220 diamantes ➔ \`$43\`
│ • 342 diamantes ➔ \`$65\`
│ • 562 diamantes ➔ \`$88\`
│ • 1,166 diamantes ➔ \`$145\`
│ • 1,738 diamantes ➔ \`$225\`
│ • 2,398 diamantes ➔ \`$300\`
│ • 2,970 diamantes ➔ \`$380\`
│ • 3,542 diamantes ➔ \`$485\`
│ • 6,160 diamantes ➔ \`$760\`
└─────────────────────────────

┌─ 🎫 *PASE BOOYAH*
│ • Pase Booyah Activo ➔ \`$45\`
└─────────────────────────────

> 💡 _Escribe \`.pago\` para transferir y déjanos tu ID de jugador aquí._`;
                    await sock.sendMessage(remitente, { text: diamantes });
                    return;
                }

                if (['.libros', '.pdf', '.megapack', '.pack'].includes(texto)) {
                    const libros = 
`╭─── 🔥 *MEGA PACK 1000 EN PDF* 🔥 ───╮
│   *BIBLIOTECA DIGITAL CLICK&CUT*
╰─────────────────────────────╯

┌─ 📚 *CONTENIDO INCLUIDO*
│ • Cursos completos y literatura clásica y moderna
│ • Material didáctico infantil y libros para colorear
│ • Recetarios de repostería y cocina fácil
│ • Plantillas y recursos de papelería creativa
│ 🎁 *REGALO:* Álbum digital + estampas Mundial 2026
└─────────────────────────────

> ⚡ *Acceso vitalicio por solo:* \`$70 MXN\`
> 💳 _Escribe \`.pago\` para recibir el enlace de descarga inmediato._`;
                    await sock.sendMessage(remitente, { text: libros });
                    return;
                }

                if (['.redes', '.seguidores'].includes(texto)) {
                    const redes = 
`╭─── 🚀 *CRECIMIENTO SOCIAL* 🚀 ───╮
│    *SEGUIDORES, LIKES Y VISITAS*
╰─────────────────────────────╯

┌─ 📸 *INSTAGRAM*
│ • 500 seguidores ➔ \`$45\` | 1k ➔ \`$65\` | 5k ➔ \`$195\`
│ • 1k likes globales ➔ \`$25\` | 5k likes ➔ \`$80\`
│ • 10k vistas en Reels ➔ \`$70\`
└─────────────────────────────

┌─ 🎵 *TIKTOK*
│ • 500 seguidores ➔ \`$56\` | 1k ➔ \`$80\` | 5k ➔ \`$270\`
│ • 1k likes ➔ \`$27\` | 10k vistas ➔ \`$50\`
└─────────────────────────────

┌─ 👤 *FACEBOOK*
│ • 500 seguidores ➔ \`$35\` | 1k ➔ \`$53\` | 5k ➔ \`$120\`
│ • 1k likes globales ➔ \`$20\`
└─────────────────────────────

┌─ ▶️ *YOUTUBE*
│ • 500 suscriptores ➔ \`$220\` | 1k suscriptores ➔ \`$300\`
│ • 1k vistas ➔ \`$45\` | 1k likes ➔ \`$34\`
└─────────────────────────────

> 💡 _Escribe \`.pago\` para contratar o déjanos tu enlace de perfil._`;
                    await sock.sendMessage(remitente, { text: redes });
                    return;
                }

                if (['.numeros', '.virtuales'].includes(texto)) {
                    const virtuales = 
`╭── 📱✨ *NÚMEROS VIRTUALES* ✨📱 ──╮
│    *ACTIVACIÓN RÁPIDA Y SEGURA*
╰─────────────────────────────╯

┌─ 📲 *ACTIVACIÓN EXPRESS* — \`$60\`
│ • Códigos para WhatsApp, Telegram y redes sociales
│ • Recepción inmediata del código de verificación
└─────────────────────────────

> 💡 _Escribe \`.pago\` para adquirir tu número y avísanos de qué app es._`;
                    await sock.sendMessage(remitente, { text: virtuales });
                    return;
                }

                if (['.adultos'].includes(texto)) {
                    const adultos = 
`╭── 🔞 *CONTENIDO ADULTOS (+18)* 🔞 ──╮
│    *SERVICIOS EXCLUSIVOS PARA MAYORES*
╰─────────────────────────────╯

┌─ 🦋 *BRAZZERS*
│ • Perfil: \`1M $14\` | \`2M $25\` | \`3M $28\` | \`12M $36\`
│ • Completa: \`1M $25\` | \`2M $32\` | \`3M $40\` | \`12M $60\`
└─────────────────────────────

┌─ 🔥 *PORNHUB*
│ • Perfil: \`1M $15\` | \`2M $28\` | \`3M $32\`
└─────────────────────────────

> 💡 _Escribe \`.pago\` para realizar tu pago de forma discreta._`;
                    await sock.sendMessage(remitente, { text: adultos });
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

┌─ 💡 *ACCESOS RÁPIDOS*
│ • \`.catalogo\` ➔ Stock resumido
│ • \`.tramites\` ➔ Gestiones oficiales
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

                if (['.garantia'].includes(texto)) {
                    const garantia = 
`╭── 🛡️ *POLÍTICA DE GARANTÍAS* 🛡️ ──╮
│   *RESPALDO TOTAL EN TU SERVICIO*
╰─────────────────────────────╯

┌─ ✂️ *TIEMPOS DE COBERTURA*
│ • 1 mes ➔ \`25 días de respaldo\`
│ • 2 meses ➔ \`45 días de respaldo\`
│ • 3 meses ➔ \`75 días de respaldo\`
│ • 6 meses ➔ \`5 meses de respaldo\`
│ • 12 meses ➔ \`10 meses de respaldo\`
└─────────────────────────────

> ⚠️ *Condiciones:* Cubre caídas del servicio enviando captura. No aplica si alteras el PIN, correo o contraseña asignada.`;
                    await sock.sendMessage(remitente, { text: garantia });
                    return;
                }

                if (['.dudas', '.faq'].includes(texto)) {
                    const dudas = 
`╭── ❓ *PREGUNTAS FRECUENTES* ❓ ──╮
│   *RESOLUCIÓN DE DUDAS COMUNES*
╰─────────────────────────────╯

> 🔹 *¿Cómo realizo una compra?*
Elige en el menú (\`.menu\`), transfiere con \`.pago\` y manda foto de tu comprobante.

> 🔹 *¿Cuánto tarda la entrega?*
De 15 minutos a 3 horas tras validar el depósito.

> 🔹 *¿Las cuentas son renovables?*
Sí, la gran mayoría. Recomendamos renovar 2 a 3 días antes del vencimiento.

> 🔹 *¿Tienen garantía?*
Claro que sí, respaldamos tu cuenta con reposición inmediata (\`.garantia\`).

💬 _¿Tienes otra consulta? Escribe \`.asesor\` para hablar directamente._`;
                    await sock.sendMessage(remitente, { text: dudas });
                    return;
                }

                if (['.reglas'].includes(texto)) {
                    const reglas = 
`╭── ✂️✨ *REGLAS DE SERVICIO* ✨✂️ ──╮
│   *CUIDA TU SERVICIO Y TU GARANTÍA*
╰─────────────────────────────╯

┌─ 📌 *CONDICIONES OBLIGATORIAS*
│ 1. No alterar contraseñas, correos ni PINs asignados.
│ 2. No exceder las pantallas o dispositivos acordados.
│ 3. Enviar captura de pantalla clara al reportar caídas.
│ 4. No salirte de los grupos de avisos y dinámicas.
└─────────────────────────────

> 🍿 _¡Siguiendo estos pasos disfrutas tu contenido sin interrupciones!_`;
                    await sock.sendMessage(remitente, { text: reglas });
                    return;
                }

                if (['.horario', '.atencion'].includes(texto)) {
                    const horario = 
`╭── ⏰ *HORARIOS DE ATENCIÓN* ⏰ ──╮
│   *DISPONIBILIDAD Y ENTREGAS*
╰─────────────────────────────╯

> 💜 No contamos con un horario estricto, pero contestamos y liberamos pedidos a lo largo de todo el día.

┌─ ✨ *SISTEMA ACTIVO*
│ • El bot toma comprobantes y resuelve dudas las 24 hrs.
│ • Escribe \`.asesor\` si necesitas confirmación humana.
└─────────────────────────────`;
                    await sock.sendMessage(remitente, { text: horario });
                    return;
                }

                if (['.asesor', '.admin'].includes(texto)) {
                    await sock.sendMessage(remitente, {
                        text: `> 👨‍💻 *Click & Cut Soporte:* En un momento te atiende un asesor humano. Por favor escribe con detalle qué servicio deseas adquirir o adjunta tu comprobante aquí.`
                    });
                    return;
                }
            }

            // IA Gemini
            if (esPropio) return;

            const mencionado = textoOriginal.includes(`@${NUMERO_BOT}`) || textoOriginal.includes(`@${NUMERO_BOT_ALT}`);
            const debeResponderIA = !esGrupo || (esGrupo && mencionado);

            if (debeResponderIA) {
                if (!ai) {
                    console.warn('[AVISO GEMINI] Falta configurar GEMINI_API_KEY en las variables de entorno.');
                    return;
                }

                try {
                    const response = await ai.models.generateContent({
                        model: 'gemini-2.5-flash',
                        contents: textoOriginal,
                        config: {
                            systemInstruction: SYSTEM_INSTRUCTION,
                            maxOutputTokens: 250,
                            temperature: 0.7
                        }
                    });

                    if (response && response.text) {
                        await sock.sendMessage(remitente, { text: response.text }, { quoted: msg });
                    }
                } catch (iaError) {
                    console.error('[ERROR GEMINI]', iaError.message);
                    if (!esGrupo) {
                        await sock.sendMessage(remitente, { 
                            text: '> 🌸✨ _Ay, se me enredó un poquito la señal. Dame un momentito y te respondo en cuanto esté lista._' 
                        });
                    }
                }
            }

        } catch (err) {
            console.log('[ERROR PROCESANDO MENSAJE]', err.message);
        }
    });
}

arrancarBot();
