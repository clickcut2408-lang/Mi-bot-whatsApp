const { default: makeWASocket, useMultiFileAuthState, DisconnectReason, delay } = require('@whiskeysockets/baileys');
const pino = require('pino');
const http = require('http');
const fs = require('fs');
const path = require('path');
const { GoogleGenAI } = require('@google/genai');

const NUMERO_BOT = "528641114514";
const NUMERO_ADMIN = "5218641114514"; // Número autorizado para crear o editar comandos
const PORT = process.env.PORT || 3000;

// Inicializar API de Gemini con validación segura
const apiKey = process.env.GEMINI_API_KEY || '';
const ai = apiKey ? new GoogleGenAI({ apiKey }) : null;

// System Prompt del Personaje Click & Cut
const SYSTEM_INSTRUCTION = `
Eres la asistente virtual y anfitriona oficial de "Click & Cut".
Representas a la chica de la marca: dulce, tierna, educada, súper atenta, paciente y muy servicial.
Hablas siempre en femenino ("encantada de ayudarte", "lista para atenderte").

Servicios principales que ofreces con calidez:
1. Streaming Digital: Cuentas y perfiles (Netflix, Disney+, Max, Prime, Vix, Paramount, Spotify, YouTube). Renovaciones, activaciones rápidas y seguras.
2. Trámites y servicios digitales: Actas de nacimiento/matrimonio/defunción, CURP certificada, RFC/SAT, citas, constancias IMSS/ISSSTE, antecedentes, licencias, formatos y pagos por internet.
3. Papelería creativa y diseño: Stickers personalizados, etiquetas escolares, recuerdos, proyectos y detalles hechos a mano con amor.
4. Servicios adicionales: Recargas con descuento (Telcel, Bait, Movistar, AT&T), diamantes Free Fire, seguidores en redes sociales y números virtuales.

Pautas de respuesta:
- Tutea con dulzura, educación y respeto.
- Usa emojis suaves y bonitos acordes a los servicios (🌸, ✨, 📺, 🍿, 💻, 📄, ✂️, 🎀, 💖).
- Mantén las respuestas claras, ordenadas y directas sin saturar con textos eternos.
- Menciona que pueden ver los precios escribiendo *.menu* o cotizar transferencias con *.pago*.
- Si un cliente tiene dudas de cuentas caídas o reportes, pídele con dulzura su comprobante o captura de pantalla e indícale que escriba *.asesor* para que el equipo humano lo resuelva de inmediato.
`;

// Archivo JSON para persistir comandos dinámicos creados con .set
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
        console.log('[ERROR ARCHIVO COMANDOS]', e.message);
        return {};
    }
}

function guardarComandosDinamicos(comandos) {
    try {
        fs.writeFileSync(ARCHIVO_COMANDOS, JSON.stringify(comandos, null, 2));
    } catch (e) {
        console.log('[ERROR GUARDANDO COMANDOS]', e.message);
    }
}

let comandosPersonalizados = cargarComandosDinamicos();

// Servidor HTTP para mantener vivo el servicio en Render
http.createServer((req, res) => {
    res.writeHead(200, { 'Content-Type': 'text/plain' });
    res.end('Bot Click&Cut en linea');
}).listen(PORT, () => {
    console.log(`[HTTP] Servidor escuchando en el puerto ${PORT}`);
});

async function arrancarBot() {
    const { state, saveCreds } = await useMultiFileAuthState('sesion_auth');

    const sock = makeWASocket({
        logger: pino({ level: 'silent' }),
        auth: state,
        printQRInTerminal: false,
        syncFullHistory: false,
        markOnlineOnConnect: true
    });

    sock.ev.on('creds.update', saveCreds);

    // Solicitud de código de vinculación si no hay sesión registrada
    if (!sock.authState.creds.registered) {
        setTimeout(async () => {
            try {
                const pairingCode = await sock.requestPairingCode(NUMERO_BOT);
                console.log('\n=========================================');
                console.log(`>>> TU CODIGO DE VINCULACION ES: ${pairingCode} <<<`);
                console.log('=========================================\n');
            } catch (err) {
                console.log('[ERROR VINCULACION] Reintentando codigo...');
                try {
                    const pairingCodeAlt = await sock.requestPairingCode("5218641114514");
                    console.log('\n=========================================');
                    console.log(`>>> TU CODIGO DE VINCULACION ES: ${pairingCodeAlt} <<<`);
                    console.log('=========================================\n');
                } catch (e) {
                    console.log('[ERROR CRITICO CODIGO]', e.message);
                }
            }
        }, 5000);
    }

    // Monitoreo de conexión
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

    // Bienvenida automática a nuevos participantes en grupos
    sock.ev.on('group-participants.update', async (update) => {
        try {
            const { id, participants, action } = update;
            if (action === 'add') {
                for (const participante of participants) {
                    const numeroLimpio = participante.split('@')[0];
                    const mensajeBienvenida = `¡Hola @${numeroLimpio}! 🌸✨\n\n` +
                        `¡Bienvenid@ a Click & Cut! 💖🍿 Aquí encuentras tus plataformas de streaming favoritas, apoyo en tus trámites y servicios digitales, y toda la magia de la papelería creativa.\n\n` +
                        `Escribe *.menu* para ver todo nuestro catálogo o avísanos si necesitas algo especial. ¡Ponte cómod@! 🎀`;

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

    // Procesamiento de mensajes
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

            // REGLA PARA RESPONDERTE A TI MISMO:
            // Si el mensaje fue enviado desde tu propio número, solo se procesa si empieza con '.'
            // Esto evita que las respuestas automáticas del bot formen bucles infinitos.
            if (esPropio && !textoOriginal.trim().startsWith('.')) return;

            const esComando = textoOriginal.trim().startsWith('.');
            const texto = textoOriginal
                .toLowerCase()
                .trim()
                .normalize("NFD")
                .replace(/[\u0300-\u036f]/g, "");

            console.log(`[MENSAJE] ${remitente}: "${textoOriginal}"`);

            // ==========================================
            // SECCIÓN 1: PROCESAR COMANDOS TRADICIONALES
            // ==========================================
            if (esComando) {
                const esAdministrador = esPropio || remitenteNumero === NUMERO_ADMIN || remitenteNumero === NUMERO_BOT;

                // COMANDO .SET (ADMIN)
                if (texto.startsWith('.set')) {
                    if (!esAdministrador) {
                        await sock.sendMessage(remitente, { text: '⛔ Este comando solo puede ser ejecutado por el administrador.' });
                        return;
                    }

                    const contenido = textoOriginal.slice(4).trim();
                    const partes = contenido.split('|');

                    if (partes.length < 2) {
                        const ayudaSet = `⚙️ *CONFIGURADOR DE COMANDOS CLICK&CUT*\n━━━━━━━━━━━━━━━━━━━━\n` +
                                         `Uso correcto:\n` +
                                         `*.set nombre_comando | Mensaje de respuesta*\n\n` +
                                         `*Ejemplo:*\n` +
                                         `*.set .aviso | Mañana cerramos a las 6:00 PM*\n\n` +
                                         `📌 Para eliminar uno usa:\n` +
                                         `*.delset .nombre_comando*`;
                        await sock.sendMessage(remitente, { text: ayudaSet });
                        return;
                    }

                    let nombreCmd = partes[0].trim().toLowerCase();
                    if (!nombreCmd.startsWith('.')) nombreCmd = '.' + nombreCmd;
                    const respuestaCmd = partes.slice(1).join('|').trim();

                    comandosPersonalizados[nombreCmd] = respuestaCmd;
                    guardarComandosDinamicos(comandosPersonalizados);

                    await sock.sendMessage(remitente, { 
                        text: `✅ *Comando configurado exitosamente*\n━━━━━━━━━━━━━━━━━━━━\n🔹 *Comando:* \`${nombreCmd}\`\n💬 *Respuesta:* \n${respuestaCmd}` 
                    });
                    return;
                }

                // COMANDO .DELSET (ADMIN)
                if (texto.startsWith('.delset')) {
                    if (!esAdministrador) {
                        await sock.sendMessage(remitente, { text: '⛔ Este comando solo puede ser ejecutado por el administrador.' });
                        return;
                    }

                    let nombreCmd = textoOriginal.slice(7).trim().toLowerCase();
                    if (!nombreCmd.startsWith('.')) nombreCmd = '.' + nombreCmd;

                    if (comandosPersonalizados[nombreCmd]) {
                        delete comandosPersonalizados[nombreCmd];
                        guardarComandosDinamicos(comandosPersonalizados);
                        await sock.sendMessage(remitente, { text: `🗑️ El comando \`${nombreCmd}\` ha sido eliminado.` });
                    } else {
                        await sock.sendMessage(remitente, { text: `⚠️ No se encontró el comando dinámico \`${nombreCmd}\`.` });
                    }
                    return;
                }

                // COMANDOS DINÁMICOS GUARDADOS
                const comandoBuscado = texto.split(/\s+/)[0];
                if (comandosPersonalizados[comandoBuscado]) {
                    await sock.sendMessage(remitente, { text: comandosPersonalizados[comandoBuscado] });
                    return;
                }

                // CONTROL DE GRUPO: .GRUPOS
                if (texto === '.grupos') {
                    try {
                        const grupos = await sock.groupFetchAllParticipating();
                        let respuesta = `📋 *GRUPOS ACTIVOS DE CLICK&CUT*\n━━━━━━━━━━━━━━━━━━━━\n`;
                        for (const id in grupos) {
                            respuesta += `🔹 *${grupos[id].subject}*\nID: \`${id}\`\n\n`;
                        }
                        respuesta += `_Usa *.abrir <id>* o *.cerrar <id>* para gestionarlos._`;
                        await sock.sendMessage(remitente, { text: respuesta });
                    } catch (e) {
                        await sock.sendMessage(remitente, { text: '⚠️ No pude obtener la lista de grupos.' });
                    }
                    return;
                }

                // CONTROL DE GRUPO: .CERRAR
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
                                text: `⚠️ Si estás en privado, usa:\n*.cerrar ID_DEL_GRUPO*\n\nConsulta los IDs con *.grupos*` 
                            });
                            return;
                        }
                    }

                    try {
                        await sock.groupSettingUpdate(targetJid, 'announcement');
                        const avisoCierre = `🔒 *GRUPO CERRADO* 🔒\n━━━━━━━━━━━━━━━━━━━━\nEl grupo ha sido cerrado por administración. Los mensajes quedan pausados por el momento.\n\n✨ Para consultas urgentes o pedidos, escribe a un *.asesor* por mensaje privado. ¡Volvemos pronto! 💖`;
                        await sock.sendMessage(targetJid, { text: avisoCierre });
                        if (!esGrupo) {
                            await sock.sendMessage(remitente, { text: `✅ Grupo cerrado con éxito.` });
                        }
                    } catch (err) {
                        await sock.sendMessage(remitente, { text: '⚠️ Error al cerrar el grupo. Verifica que el bot sea Administrador.' });
                    }
                    return;
                }

                // CONTROL DE GRUPO: .ABRIR
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
                                text: `⚠️ Si estás en privado, usa:\n*.abrir ID_DEL_GRUPO*\n\nConsulta los IDs con *.grupos*` 
                            });
                            return;
                        }
                    }

                    try {
                        await sock.groupSettingUpdate(targetJid, 'not_announcement');
                        const avisoApertura = `🔓 *GRUPO ABIERTO* 🔓\n━━━━━━━━━━━━━━━━━━━━\nEl chat ya se encuentra disponible para todos.\n\n🍿 Pueden enviar sus dudas, comprobantes o consultar precios con *.menu*. ¡Excelente día a tod@s! 🎉`;
                        await sock.sendMessage(targetJid, { text: avisoApertura });
                        if (!esGrupo) {
                            await sock.sendMessage(remitente, { text: `✅ Grupo abierto con éxito.` });
                        }
                    } catch (err) {
                        await sock.sendMessage(remitente, { text: '⚠️ Error al abrir el grupo. Verifica que el bot sea Administrador.' });
                    }
                    return;
                }

                // MENÚ PRINCIPAL
                if (['.menu', '.ayuda'].includes(texto)) {
                    const menu = `🛒 *BIENVENIDO A CLICK&CUT* 🛒\n` +
                                 `━━━━━━━━━━━━━━━━━━━━\n` +
                                 `_Escribe el comando que necesites:_\n\n` +
                                 `🍿 *ENTRETENIMIENTO*\n` +
                                 `🎀 *.combos* ➜ Combos y Dúos Tiernos\n\n` +
                                 `📺 *.streaming* ➜ Cuentas y pantallas\n\n` +
                                 `🎶 *.musica* ➜ Spotify, YouTube y Deezer\n\n` +
                                 `🛠️ *.apps* ➜ Canva Pro, IA y Office\n\n` +
                                 `📋 *SERVICIOS Y GESTIÓN*\n` +
                                 `📄 *.tramites* ➜ Actas, licencias y SAT\n\n` +
                                 `🩺 *.extras* ➜ Documentos médicos y recetas\n\n` +
                                 `📲 *.recargas* ➜ Saldo con descuento\n\n` +
                                 `📱 *.numeros* ➜ Números virtuales\n\n` +
                                 `🎮 *JUEGOS Y DIGITAL*\n` +
                                 `💎 *.diamantes* ➜ Free Fire y Booyah\n\n` +
                                 `📚 *.libros* ➜ Mega Pack 1000 PDFs\n\n` +
                                 `🚀 *.redes* ➜ Seguidores, likes y vistas\n\n` +
                                 `🔞 *.adultos* ➜ Contenido +18 exclusivo\n\n` +
                                 `ℹ️ *INFORMACIÓN*\n` +
                                 `📋 *.catalogo* ➜ Lista completa\n\n` +
                                 `💳 *.pago* ➜ Datos de transferencia\n\n` +
                                 `🛡️ *.garantia* ➜ Cobertura de compra\n\n` +
                                 `❓ *.dudas* ➜ Preguntas frecuentes\n\n` +
                                 `⏰ *.horario* ➜ Horarios de entrega\n\n` +
                                 `📜 *.reglas* ➜ Condiciones de uso\n\n` +
                                 `📞 *.contacto* ➜ Canales oficiales\n\n` +
                                 `👨‍💻 *.asesor* ➜ Atención humana\n` +
                                 `━━━━━━━━━━━━━━━━━━━━`;
                    await sock.sendMessage(remitente, { text: menu });
                    return;
                }

                // COMBOS
                if (['.combos', '.duos', '.promos'].includes(texto)) {
                    const combos = `🎀✨ *COMBOS CLICK&CUT* ✨🎀\n` +
                                   `━━━━━━━━━━━━━━━━━━━━\n` +
                                   `🍓 *COMBO FRESITA* 🍓\n` +
                                   `• Netflix + Disney + Max + Prime + Crunchyroll + Vix\n` +
                                   `🏷️ *Precio: $100*\n\n` +
                                   `🌸 *COMBO ALGODONCITO* 🌸\n` +
                                   `• Max + Prime + Crunchyroll + Disney Premium + Vix\n` +
                                   `🏷️ *Precio: $55*\n\n` +
                                   `🐰 *COMBO CONEJITO* 🐰\n` +
                                   `• Netflix + Disney + Max + Prime + Vix Premium\n` +
                                   `🏷️ *Precio: $90*\n\n` +
                                   `☁️ *COMBO NUBECITA* ☁️\n` +
                                   `• Vix + Paramount + Disney + Max + Crunchy\n` +
                                   `🏷️ *Precio: $65*\n\n` +
                                   `🐱 *COMBO GATITO* 🐱\n` +
                                   `• Netflix + Disney + Max\n` +
                                   `🏷️ *Precio: $75*\n\n` +
                                   `🧁 *COMBO PASTELITO* 🧁\n` +
                                   `• Netflix + Disney + Max + Vix\n` +
                                   `🏷️ *Precio: $78*\n` +
                                   `━━━━━━━━━━━━━━━━━━━━\n` +
                                   `✨ *DÚOS TIERNOS* ✨\n\n` +
                                   `💓 *NETFLIX:*\n` +
                                   `• Netflix + Disney = $60\n` +
                                   `• Netflix + HBO Max = $60\n` +
                                   `• Netflix + Prime = $60\n` +
                                   `• Netflix + Paramount = $70\n` +
                                   `• Netflix + Vix = $58\n` +
                                   `• Netflix + Crunchy = $62\n\n` +
                                   `💜 *DISNEY:*\n` +
                                   `• Disney + HBO = $30\n` +
                                   `• Disney + Prime = $28\n` +
                                   `• Disney + Paramount = $29\n` +
                                   `• Disney + Vix 1M = $27\n` +
                                   `• Disney + Crunchy = $30\n` +
                                   `━━━━━━━━━━━━━━━━━━━━\n` +
                                   `_💡 Escribe *.pago* para contratar o *.asesor* para cotizar._`;
                    await sock.sendMessage(remitente, { text: combos });
                    return;
                }

                // STREAMING
                if (['.streaming'].includes(texto)) {
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
                                      `📺 *MAX Completa:* 1M $45 | 2M $59 | 3M $78 | 12M $120\n` +
                                      `━━━━━━━━━━━━━━━━━━\n` +
                                      `📦 *Prime Video (Perfil):*\n1M $10 | 2M $13 | 3M $19 | 12M $30\n` +
                                      `📦 *Prime Video Completa:*\n1M $28 | 2M $35 | 3M $45 | 12M $95\n` +
                                      `━━━━━━━━━━━━━━━━━━\n` +
                                      `💛 *VIX (Perfil):*\n1M $9 | 2M $15 | 3M $19 | 12M $28\n` +
                                      `💛 *VIX (Completa):*\n1M $13 | 2M $20 | 3M $29 | 12M $38\n` +
                                      `━━━━━━━━━━━━━━━━━━\n` +
                                      `⭐ *Paramount+ (Perfil):*\n1M $13 | 2M $18 | 3M $23 | 12M $30\n` +
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
                                      `_Escribe *.pago* para ver las opciones bancarias._`;
                    await sock.sendMessage(remitente, { text: streaming });
                    return;
                }

                // MÚSICA
                if (['.musica'].includes(texto)) {
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
                                   `_Escribe *.pago* para contratar._`;
                    await sock.sendMessage(remitente, { text: musica });
                    return;
                }

                // APPS
                if (['.apps'].includes(texto)) {
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
                                 `• Invitación: $19 | Individual: $47 | Completa: $55\n` +
                                 `━━━━━━━━━━━━━━━━━━\n` +
                                 `🎮 *Game Pass Code:* $98\n\n` +
                                 `_Escribe *.pago* para adquirir tu cuenta._`;
                    await sock.sendMessage(remitente, { text: apps });
                    return;
                }

                // TRÁMITES
                if (['.tramites', '.servicios'].includes(texto)) {
                    const tramites = `✧˚｡⋆ *CLICK&CUT TRÁMITES Y SERVICIOS* ✧˚｡⋆\n` +
                                     `━━━━━━━━━━━━━━━━━━\n` +
                                     `🍒 *Actas:*\n` +
                                     `• Acta de nacimiento — $15\n` +
                                     `• Acta de matrimonio — $15\n` +
                                     `• Acta de divorcio — $15\n` +
                                     `• Acta de defunción — $15\n` +
                                     `• Certificado INEA — $45\n\n` +
                                     `📋 *Trámites Generales:*\n` +
                                     `• Localizar AFORE — $25\n` +
                                     `• Certificado COVID — $40\n` +
                                     `• Recibo CFE — $15\n` +
                                     `• Constancia no derechohabiencia ISSSTE — $40\n` +
                                     `• Constancia no deudor alimentario (DIF) — $45\n` +
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
                                     `• Primaria / Secundaria / Prepa / Bachillerato — $60 c/u\n` +
                                     `• Títulos y cédulas (2009–2023) — $85\n` +
                                     `• Certificado estudios para trabajar — $45\n` +
                                     `• Carta de recomendación con firma/sello — $57\n` +
                                     `• Buró de crédito — $85\n` +
                                     `• Constancia inexistencia de matrimonio — $170\n\n` +
                                     `⛪ *Boletas Sacramentales:*\n` +
                                     `• Bautizo — $45 | Comunión — $45 | Confirmación — $45\n` +
                                     `━━━━━━━━━━━━━━━━━━\n` +
                                     `_Escribe *.pago* para transferir o *.asesor* para cotizar._`;
                    await sock.sendMessage(remitente, { text: tramites });
                    return;
                }

                // EXTRAS
                if (['.extras', '.medicos'].includes(texto)) {
                    const extras = `💗🩺 *DOCUMENTOS MÉDICOS & PERSONALES* 🩺💗\n` +
                                   `━━━━━━━━━━━━━━━━━━━━\n` +
                                   `🏥 *Recetas Médicas:*\n` +
                                   `• Receta IMSS — $50\n` +
                                   `• Receta ISSSTE — $50\n` +
                                   `• Receta Similares — $45\n` +
                                   `• Receta Farmacia del Ahorro — $45\n` +
                                   `• Receta particular — $45\n` +
                                   `• Análisis de laboratorio — $100\n` +
                                   `• Nota médica de urgencias — $70\n\n` +
                                   `📋 *Incapacidades:*\n` +
                                   `• Incapacidad de 1 a 3 días — $40\n` +
                                   `• Incapacidad de 4 a 9 días — $50\n` +
                                   `• Incapacidad de 9 días en adelante — (Se cotiza con asesor)\n` +
                                   `• Hoja de discapacidad — $100\n\n` +
                                   `👨‍👩‍👧 *Documentos Personales:*\n` +
                                   `• Hoja de concubinato — $130\n` +
                                   `• No deudor alimenticio Edomex — $60\n` +
                                   `• No deudor alimenticio Federal — $60\n` +
                                   `━━━━━━━━━━━━━━━━━━━━\n` +
                                   `_💡 Escribe *.pago* para transferir o *.asesor* para cotizar y enviar tus datos._`;
                    await sock.sendMessage(remitente, { text: extras });
                    return;
                }

                // RECARGAS
                if (['.recargas', '.tiempoaire'].includes(texto)) {
                    const recargas = `✨ *CLICK&CUT | RECARGAS AL MEJOR PRECIO* ✨\n` +
                                     `Más megas, más saldo, más ahorro. Rápido, seguro y confiable.\n` +
                                     `━━━━━━━━━━━━━━━━━━━━\n` +
                                     `📲 *TELCEL*\n` +
                                     `• Recarga $200 ➔ Pagas *$175*\n\n` +
                                     `🐝 *BAIT*\n` +
                                     `• Recarga $200 ➔ Pagas *$170*\n` +
                                     `• Recarga $230 ➔ Pagas *$190*\n` +
                                     `• Recarga $250 ➔ Pagas *$220*\n` +
                                     `• Recarga $300 ➔ Pagas *$260*\n` +
                                     `• Recarga $350 ➔ Pagas *$300*\n` +
                                     `• Recarga $550 ➔ Pagas *$450*\n\n` +
                                     `📶 *MOVISTAR*\n` +
                                     `• Recarga $200 ➔ Pagas *$160*\n` +
                                     `• Recarga $230 ➔ Pagas *$190*\n` +
                                     `• Recarga $250 ➔ Pagas *$210*\n` +
                                     `• Recarga $300 ➔ Pagas *$260*\n\n` +
                                     `🌐 *AT&T*\n` +
                                     `• Recarga $200 ➔ Pagas *$165*\n` +
                                     `• Recarga $300 ➔ Pagas *$250*\n` +
                                     `• Recarga $500 ➔ Pagas *$440*\n` +
                                     `━━━━━━━━━━━━━━━━━━━━\n` +
                                     `💖 Tu mejor opción para mantenerte conectado siempre.\n` +
                                     `_💡 Escribe *.pago* para transferir y envía tu número y compañía._`;
                    await sock.sendMessage(remitente, { text: recargas });
                    return;
                }

                // DIAMANTES
                if (['.setdiamantes', '.diamantes', '.freefire'].includes(texto)) {
                    const diamantes = `💎 *DIAMANTES CLICK&CUT* 💎\n` +
                                      `━━━━━━━━━━━━━━━━━━━━\n` +
                                      `🎮 *Recargas para Free Fire*\n\n` +
                                      `💠 110 diamantes — $26\n` +
                                      `💠 220 diamantes — $43\n` +
                                      `💠 342 diamantes — $65\n` +
                                      `💠 562 diamantes — $88\n` +
                                      `💠 1,166 diamantes — $145\n` +
                                      `💠 1,738 diamantes — $225\n` +
                                      `💠 2,398 diamantes — $300\n` +
                                      `💠 2,970 diamantes — $380\n` +
                                      `💠 3,542 diamantes — $485\n` +
                                      `💠 6,160 diamantes — $760\n\n` +
                                      `🎫 *Pase Booyah:* $45\n` +
                                      `━━━━━━━━━━━━━━━━━━━━\n` +
                                      `✅ Entrega rápida\n` +
                                      `✅ Atención 100% confiable\n` +
                                      `📩 Envíanos mensaje o comprobante con *.pago* indicando tu ID de jugador.`;
                    await sock.sendMessage(remitente, { text: diamantes });
                    return;
                }

                // LIBROS
                if (['.libros', '.pdf', '.megapack', '.pack'].includes(texto)) {
                    const libros = `🔥 *¡MEGA PACK DE 1000 ARCHIVOS EN PDF!* 🔥\n` +
                                   `━━━━━━━━━━━━━━━━━━━━\n` +
                                   `📚 Cursos y libros\n` +
                                   `🎨 Material didáctico para niños y para colorear\n` +
                                   `🧁 Recetarios\n` +
                                   `✂️ Plantillas y recursos creativos\n` +
                                   `📖 Cuentos, sagas literarias y mucho más\n\n` +
                                   `🎁 *EXTRA DE REGALO:* Álbum + estampas del Mundial 2026 ⚽🏆\n\n` +
                                   `⚡ Entrega inmediata\n` +
                                   `♾️ Acceso de por vida\n` +
                                   `💰 *Pago único:* **$70**\n` +
                                   `━━━━━━━━━━━━━━━━━━━━\n` +
                                   `_💡 Escribe *.pago* para adquirir tu acceso de inmediato._`;
                    await sock.sendMessage(remitente, { text: libros });
                    return;
                }

                // REDES SOCIALES
                if (['.redes', '.seguidores'].includes(texto)) {
                    const redes = `🚀✨ *SEGUIDORES & CRECIMIENTO EN REDES SOCIALES* ✨🚀\n` +
                                  `━━━━━━━━━━━━━━━━━━━━\n` +
                                  `📸 *INSTAGRAM*\n` +
                                  `🩷 *Seguidores:*\n` +
                                  `• 500 — $45 | 1k — $65 | 2k — $105 | 5k — $195\n` +
                                  `🩷 *Likes (cuentas con antigüedad mundial):*\n` +
                                  `• 500 — $19 | 1k — $25 | 2k — $36 | 5k — $80\n` +
                                  `🩷 *Comentarios latinos (Solo México):*\n` +
                                  `• 10 — $15 | 20 — $17 | 50 — $45\n` +
                                  `🩷 *Vistas Reels (cuentas con antigüedad mundial):*\n` +
                                  `• 5k — $46 | 10k — $70 | 20k — $100\n` +
                                  `━━━━━━━━━━━━━━━━━━━━\n` +
                                  `👤 *FACEBOOK*\n` +
                                  `🩷 *Seguidores:*\n` +
                                  `• 500 — $35 | 1k — $53 | 2k — $79 | 5k — $120\n` +
                                  `🩷 *Likes (cuentas con antigüedad mundial):*\n` +
                                  `• 1k — $20 | 2k — $35 | 5k — $50\n` +
                                  `━━━━━━━━━━━━━━━━━━━━\n` +
                                  `🎵 *TIKTOK*\n` +
                                  `🩷 *Seguidores:*\n` +
                                  `• 500 — $56 | 1k — $80 | 2k — $120 | 5k — $270\n` +
                                  `🩷 *Likes:*\n` +
                                  `• 500 — $15 | 1k — $27 | 2k — $35 | 5k — $50\n` +
                                  `🩷 *Vistas:*\n` +
                                  `• 500 — $10 | 1k — $18 | 2k — $27 | 5k — $38 | 10k — $50\n` +
                                  `🩷 *Compartir:*\n` +
                                  `• 500 — $15 | 1k — $18 | 2k — $24 | 5k — $35\n` +
                                  `━━━━━━━━━━━━━━━━━━━━\n` +
                                  `▶️ *YOUTUBE*\n` +
                                  `🩷 *Suscriptores (50 al día):*\n` +
                                  `• 500 — $220 | 1k — $300 | 2k — $550 | 5k — $1,200\n` +
                                  `🩷 *Vistas:*\n` +
                                  `• 500 — $35 | 1k — $45 | 2k — $70 | 5k — $150\n` +
                                  `🩷 *Likes:*\n` +
                                  `• 500 — $25 | 1k — $34 | 2k — $52 | 5k — $79\n` +
                                  `🩷 *Comentarios personalizados:*\n` +
                                  `• 500 — $70 | 1,000 — $100\n` +
                                  `━━━━━━━━━━━━━━━━━━━━\n` +
                                  `🐦 *TWITTER / X*\n` +
                                  `🩷 *Seguidores:*\n` +
                                  `• 500 — $48 | 1k — $65 | 2k — $120 | 5k — $235\n` +
                                  `━━━━━━━━━━━━━━━━━━━━\n` +
                                  `_💡 Escribe *.pago* para contratar o *.asesor* para cotizaciones especiales._`;
                    await sock.sendMessage(remitente, { text: redes });
                    return;
                }

                // NÚMEROS VIRTUALES
                if (['.numeros', '.virtuales'].includes(texto)) {
                    const virtuales = `📱✨ *NÚMEROS VIRTUALES CLICK&CUT* ✨📱\n` +
                                      `━━━━━━━━━━━━━━━━━━━━\n` +
                                      `📲 *Número Virtual para Activación:* **$60**\n` +
                                      `• Válidos para WhatsApp, Telegram y distintas redes sociales / aplicaciones.\n` +
                                      `• Recepción rápida de código de verificación.\n` +
                                      `━━━━━━━━━━━━━━━━━━━━\n` +
                                      `_💡 Escribe *.pago* para adquirir tu número o *.asesor* para solicitar asistencia inmediata._`;
                    await sock.sendMessage(remitente, { text: virtuales });
                    return;
                }

                // CATÁLOGO COMPLETO
                if (['.catalogo'].includes(texto)) {
                    const stockCompleto = `🩷 *APPSTOCK CLICK&CUT* 🩷\n` +
                                          `━━━━━━━━━━━━━━━━━━\n` +
                                          `🎬 *Netflix TV:* 1M $29 | 2M $38 | 3M $49 | 12M $75\n` +
                                          `🎬 *Netflix Normal:* 1M $49 | 2M $65 | 3M $82 | 12M $155\n` +
                                          `🎬 *Netflix Privado:* 1M $55 | 2M $69 | 3M $85\n` +
                                          `🔥 *Netflix Completa:* 1M $215\n` +
                                          `🏰 *Disney+ Perfil:* 1M $15 | 2M $25 | 3M $38 | 12M $52\n` +
                                          `🏰 *Disney+ Completa:* 1M $56 | 2M $78 | 3M $89 | 12M $155\n` +
                                          `📺 *MAX Perfil:* 1M $15 | 2M $25 | 3M $34 | 12M $55\n` +
                                          `📺 *MAX Completa:* 1M $45 | 2M $59 | 3M $78 | 12M $120\n` +
                                          `📦 *Prime Video Perfil:* 1M $10 | 2M $13 | 3M $19 | 12M $30\n` +
                                          `📦 *Prime Video Completa:* 1M $28 | 2M $35 | 3M $45 | 12M $95\n` +
                                          `💛 *VIX Perfil:* 1M $9 | Completa: 1M $13\n` +
                                          `⭐ *Paramount+ Perfil:* 1M $13 | Completa: 1M $45\n` +
                                          `🍿 *Crunchyroll Perfil:* 1M $17 | Completa: 1M $45\n` +
                                          `🦉 *Duolingo Perfil:* 1M $12 | Completa: 1M $14\n` +
                                          `🦊 *Fox One:* Perfil $19 | Completa $55\n` +
                                          `🎧 *Apple TV:* Perfil $19 | Completa $45\n` +
                                          `📺 *IPTV:* Perfil $17 | Completa $45\n` +
                                          `📺 *Claro+Canales:* 1M $70\n` +
                                          `━━━━━━━━━━━━━━━━━━\n` +
                                          `🎶 *MÚSICA:*\n` +
                                          `▶️ YouTube Premium: Invi $15 | Indiv $22/$30 | Fam $26/$30\n` +
                                          `💚 Spotify: 1M $37 | 2M $45 | 3M $55 | 6M $85 | Anual $135\n` +
                                          `🎵 Deezer: 1M $14 | 2M $21 | 3M $26 | 6M $30 | Anual $45\n` +
                                          `━━━━━━━━━━━━━━━━━━\n` +
                                          `🫦 *APPS & TOOLS:*\n` +
                                          `🎨 Canva Invitación: 1M $6 | 2M $11 | 3M $23 | 6M $27 | 12M $39\n` +
                                          `🎨 Canva Pro: 1M $20 | 2M $35 | 3M $40 | 6M $50 | 12M $70\n` +
                                          `🤖 ChatGPT: Perfil $45 | Compartido $57 | Plus $85\n` +
                                          `🤖 GEMINI: 18M $60 | 🎮 Game Pass: $98\n` +
                                          `📄 Office: Invitación $19 | Individual $47 | Completa $55\n` +
                                          `━━━━━━━━━━━━━━━━━━\n` +
                                          `🔞 *ADULTOS +18:*\n` +
                                          `Brazzers Perfil: 1M $14 | Completa: 1M $25\n` +
                                          `Pornhub Perfil: 1M $15\n` +
                                          `━━━━━━━━━━━━━━━━━━\n` +
                                          `💜 *Todo sujeto a disponibilidad. Pregunta antes de transferir.*`;
                    await sock.sendMessage(remitente, { text: stockCompleto });
                    return;
                }

                // CONTENIDO +18
                if (['.adultos'].includes(texto)) {
                    const adultos = `🔞 *CONTENIDO +18 (Solo Mayores)* 🔞\n` +
                                    `━━━━━━━━━━━━━━━━━━\n` +
                                    `🦋 *Brazzers (Perfil):*\n1M $14 | 2M $25 | 3M $28 | 12M $36\n` +
                                    `🔥 *Brazzers (Completa):*\n1M $25 | 2M $32 | 3M $40 | 12M $60\n` +
                                    `━━━━━━━━━━━━━━━━━━\n` +
                                    `🔥 *Pornhub (Perfil):*\n1M $15 | 2M $28 | 3M $32\n\n` +
                                    `_Escribe *.pago* para ver las opciones bancarias._`;
                    await sock.sendMessage(remitente, { text: adultos });
                    return;
                }

                // DATOS DE PAGO
                if (['.pago'].includes(texto)) {
                    const pago = `🌸🪞 *TRANSFERENCIAS Y DEPÓSITOS* 🪞🌸\n\n` +
                                 `🏦 *Banco:* Spin by Oxxo o STP\n` +
                                 `💳 *CLABE / Tarjeta:* 7289 6900 0094 6236 54\n` +
                                 `👸🏻 *Titular:* Jenifer Lopez\n` +
                                 `━━━━━━━━━━━━━━━━━━\n` +
                                 `💬 *Concepto:* SU NOMBRE O ABONO\n` +
                                 `⚠️ *Importante:* Una vez realizada la transferencia, por favor envíanos tu comprobante de pago para validar tu compra.\n\n` +
                                 `¡Muchas gracias por elegir Click & Cut! 💖`;
                    await sock.sendMessage(remitente, { text: pago });
                    return;
                }

                // GARANTÍA
                if (['.garantia'].includes(texto)) {
                    const garantia = `🛡️ *COBERTURA DE GARANTÍAS CLICK&CUT* 🛡️\n` +
                                     `━━━━━━━━━━━━━━━━━━━━\n` +
                                     `✂️ 1 mes ➜ 25 días de respaldo\n` +
                                     `✂️ 2 meses ➜ 45 días de respaldo\n` +
                                     `✂️ 3 meses ➜ 75 días de respaldo\n` +
                                     `✂️ 6 meses ➜ 5 meses de respaldo\n` +
                                     `✂️ 12 meses ➜ 10 meses de respaldo\n` +
                                     `━━━━━━━━━━━━━━━━━━━━\n` +
                                     `⚠️ *Condiciones:*\n` +
                                     `• Cubre caídas de cuenta o problemas de acceso.\n` +
                                     `• Se solicita captura de pantalla clara al reportar.\n` +
                                     `• No aplica si modificaste correo, PIN o contraseña ajena.`;
                    await sock.sendMessage(remitente, { text: garantia });
                    return;
                }

                // PREGUNTAS FRECUENTES
                if (['.dudas', '.faq'].includes(texto)) {
                    const dudas = `❓ *PREGUNTAS FRECUENTES Y DUDAS COMUNES* ❓\n` +
                                  `━━━━━━━━━━━━━━━━━━━━\n` +
                                  `🔹 *¿Cómo realizo una compra o trámite?*\n` +
                                  `1. Elige tu servicio en el menú (*.menu*).\n` +
                                  `2. Consulta datos de depósito con *.pago*.\n` +
                                  `3. Envía tu comprobante de pago legible indicando qué servicio requieres.\n\n` +
                                  `🔹 *¿En cuánto tiempo entregan mi cuenta o recarga?*\n` +
                                  `De 15 minutos a 3 horas una vez validado el comprobante (puede variar en días de alta demanda).\n\n` +
                                  `🔹 *¿Las cuentas de streaming son renovables?*\n` +
                                  `Sí, la mayoría son renovables mes con mes. Te recomendamos realizar tu pago de 2 a 3 días antes de que termine tu periodo para conservar tu perfil e historial.\n\n` +
                                  `🔹 *¿Qué pasa si mi cuenta presenta fallas?*\n` +
                                  `Cuentas con garantía activa (*.garantia*). Solo envíanos una captura de pantalla clara a este chat y te brindaremos solución o reemplazo.\n\n` +
                                  `🔹 *¿Puedo cambiar contraseña o PIN en perfiles compartidos?*\n` +
                                  `❌ No. Está estrictamente prohibido modificar correo, contraseña, PIN o perfiles ajenos. Si se detectan cambios, la garantía se anula de inmediato.\n\n` +
                                  `🔹 *¿Los trámites digitales son válidos y oficiales?*\n` +
                                  `Sí, las actas, CURP, constancias y documentos se descargan y gestionan con validez oficial directamente en los sistemas correspondientes.\n` +
                                  `━━━━━━━━━━━━━━━━━━━━\n` +
                                  `_💬 Si tu duda no aparece aquí, escribe *.asesor* y con gusto te atenderemos personalmente._`;
                    await sock.sendMessage(remitente, { text: dudas });
                    return;
                }

                // REGLAS
                if (['.reglas'].includes(texto)) {
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
                                   `💜 Por el momento no manejamos horario fijo, pero te responderemos a la brevedad.\n` +
                                   `✨ ¡Trabajamos para brindarles soporte 24/7 muy pronto!\n` +
                                   `━━━━━━━━━━━━━━━━━━━━\n` +
                                   `📦 *ENTREGAS*\n` +
                                   `✂️ De 15 minutos a 3 horas (puede variar en alta demanda).\n` +
                                   `━━━━━━━━━━━━━━━━━━━━\n` +
                                   `🛡️ *GARANTÍAS*\n` +
                                   `✂️ 1 mes ➜ 25 días | 2 meses ➜ 45 días\n` +
                                   `✂️ 3 meses ➜ 75 días | 6 meses ➜ 5 meses\n` +
                                   `✂️ 12 meses ➜ 10 meses\n` +
                                   `_(Cubre caídas del servicio; no aplica por mal uso de cuenta)_\n` +
                                   `━━━━━━━━━━━━━━━━━━━━\n` +
                                   `💌 *AVISO IMPORTANTE*\n` +
                                   `✂️ Reporta fallas con captura de pantalla.\n` +
                                   `✂️ No hay reembolsos tras entregar el servicio.\n` +
                                   `✂️ Al recibir tu cuenta aceptas estas condiciones.\n\n` +
                                   `🍿 ¡Disfruta tu entretenimiento al máximo! ✂️✨`;
                    await sock.sendMessage(remitente, { text: reglas });
                    return;
                }

                // HORARIO
                if (['.horario', '.atencion'].includes(texto)) {
                    const horario = `⏰ *HORARIO DE ATENCIÓN & ENTREGAS* ⏰\n` +
                                    `━━━━━━━━━━━━━━━━━━━━\n` +
                                    `💜 Por el momento no manejamos un horario fijo, pero atendemos y procesamos pedidos todos los días a la brevedad posible.\n\n` +
                                    `✨ El bot está activo para recibir tus mensajes, consultar precios y registrar comprobantes de pago.\n\n` +
                                    `_¡Pronto contaremos con soporte administrativo 24/7!_`;
                    await sock.sendMessage(remitente, { text: horario });
                    return;
                }

                // CONTACTO
                if (['.contacto'].includes(texto)) {
                    const contacto = `📱✨ *CANALES Y CONTACTO CLICK&CUT* ✨📱\n` +
                                     `━━━━━━━━━━━━━━━━━━━━\n` +
                                     `💬 *WhatsApp Atención:* +52 864 111 4514\n` +
                                     `🛍️ *Catálogo digital:* Escribe *.catalogo*\n` +
                                     `📄 *Servicios de papelería y trámites:* Escribe *.tramites*\n\n` +
                                     `_¡Guarda nuestro contacto para ver promociones y novedades en los estados!_ 💖`;
                    await sock.sendMessage(remitente, { text: contacto });
                    return;
                }

                // ASESOR
                if (['.asesor', '.admin'].includes(texto)) {
                    await sock.sendMessage(remitente, {
                        text: `👨‍💻 *Click&Cut:* Un asesor te atenderá personalmente en un momento. Por favor déjanos escrito qué servicio, combo o trámite requieres o adjunta tu comprobante de pago.`
                    });
                    return;
                }
            }

            // ==========================================
            // SECCIÓN 2: PERSONAJE CON INTELIGENCIA ARTIFICIAL
            // ==========================================
            // No procesar con IA si el mensaje lo enviaste tú misma
            if (esPropio) return;

            const mencionado = textoOriginal.includes(`@${NUMERO_BOT}`) || textoOriginal.includes(`@5218641114514`);
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
                            text: 'Ay, se me enredó un poquito la señal 🌸✨. Dame un momentito y te respondo en cuanto esté lista.' 
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
