const { makeWASocket, useMultiFileAuthState, DisconnectReason } = require('@whiskeysockets/baileys');
const pino = require('pino');
const express = require('express');

// Configuración del servidor web express para evitar errores de puertos en la nube (Render)
const app = express();
const PORT = process.env.PORT || 3000;

app.get('/', (req, res) => {
    res.send('¡El servidor del Bot de WhatsApp de Click&Cut está corriendo al 100%!');
});

app.listen(PORT, () => {
    console.log(`[EXPRESS] Servidor web interno escuchando en el puerto ${PORT}`);
});

// Número principal de administración y contacto configurado
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
            console.log('[CONEXIÓN] Conexión cerrada con WhatsApp. Intentando reconectar...', shouldReconnect);
            if (shouldReconnect) {
                connectToWhatsApp();
            }
        } else if (connection === 'open') {
            console.log('[CONEXIÓN] ¡Bot de Click&Cut conectado exitosamente a WhatsApp y listo para operar!');
        }
    });

    sock.ev.on('messages.upsert', async ({ messages }) => {
        try {
            const m = messages[0];
            if (!m.message || m.key.fromMe) return;

            const remoteJid = m.key.remoteJid;
            const messageText = m.message.conversation || m.message.extendedTextMessage?.text;

            if (!messageText) return;

            const text = messageText.trim().toLowerCase();
            console.log(`[MENSAJE] Recibido desde ${remoteJid}: "${text}"`);

            // 1. Menú principal detallado
            if (text === '.menu' || text === '!menu') {
                await sock.sendMessage(remoteJid, { 
                    text: `✨ *SISTEMA AUTOMATIZADO - CLICK&CUT* ✨\n\n` +
                          `Hola, te damos la más cordial bienvenida a nuestro espacio de atención y ventas. A continuación tienes el directorio completo de comandos disponibles para que consultes de forma rápida:\n\n` +
                          `📌 *.catalogo* - Despliega la lista completa de servicios y productos activos.\n` +
                          `📺 *.streaming* - Consulta nuestra disponibilidad de plataformas y entretenimiento.\n` +
                          `📋 *.tramites* - Información sobre asistencia digital y trámites generales.\n` +
                          `💳 *.pagos* o *.datosbanco* - Conoce las formas de pago aceptadas y referencias.\n` +
                          `📦 *.comopedir* o *.formatopedido* - Guía detallada paso a paso para levantar tu orden.\n` +
                          `⏱ *.tiempos* o *.entregas* - Revisa los tiempos estimados de acreditación y entrega.\n` +
                          `📞 *.asesor* o *.contacto* - Enlace directo de comunicación con soporte humano.\n\n` +
                          `_Escribe cualquiera de los comandos anteriores precedidos por un punto para obtener la información._` 
                });
            }
            
            // 2. Catálogo general completo
            else if (text === '.catalogo') {
                await sock.sendMessage(remoteJid, { 
                    text: `🛍 *DIRECTORIO GENERAL DE PRODUCTOS Y SERVICIOS - CLICK&CUT*\n\n` +
                          `1️⃣ *Papelería Creativa & Stickers:* Diseños escolares personalizados, etiquetas adhesivas, charts de tareas y proyectos a medida.\n` +
                          `2️⃣ *Diseño Digital Profesional:* Creación de invitaciones interactivas, posters, flyers publicitarios y material visual para potenciar negocios.\n` +
                          `3️⃣ *Cuentas de Streaming:* Plataformas de entretenimiento estables, con soporte técnico y garantía asegurada.\n` +
                          `4️⃣ *Asistencia y Trámites Digitales:* Soporte especializado en gestión documental y trámites en línea.\n\n` +
                          `💡 *Tip:* Si te interesa una categoría en específico, escribe comandos como *.streaming* o *.tramites* para profundizar.` 
                });
            }

            // 3. Módulo de Streaming
            else if (text === '.streaming') {
                await sock.sendMessage(remoteJid, { 
                    text: `📺 *CENTRO DE ENTRETENIMIENTO DIGITAL (STREAMING)*\n\n` +
                          `Ofrecemos cuentas estables y perfiles seguros orientados a garantizar la mejor experiencia de reproducción sin interrupciones.\n\n` +
                          `• Garantía activa durante todo tu periodo de contratación.\n` +
                          `• Atención personalizada ante cualquier eventualidad técnica.\n\n` +
                          `📲 Para conocer el stock actual, combos disponibles y precios vigentes del mes en curso, comunícate directamente con nosotros usando el comando *.asesor*.` 
                });
            }

            // 4. Trámites y Asistencia
            else if (text === '.tramites') {
                await sock.sendMessage(remoteJid, { 
                    text: `📋 *DEPARTAMENTO DE ASISTENCIA Y TRÁMITES DIGITALES*\n\n` +
                          `Te brindamos acompañamiento profesional y soporte en la gestión de documentos, llenado de formatos oficiales y asesoramiento digital especializado.\n\n` +
                          `Cada trámite se evalúa de manera particular para garantizar un proceso eficiente y seguro.\n\n` +
                          `💬 Solicita una cotización a la medida escribiendo directamente a *.asesor*.` 
                });
            }

            // 5. Métodos de Pago
            else if (text === '.pagos' || text === '.datosbanco') {
                await sock.sendMessage(remoteJid, { 
                    text: `💳 *MÉTODOS Y PASARELA DE PAGOS*\n\n` +
                          `Para tu comodidad, aceptamos los siguientes mecanismos de aportación:\n\n` +
                          `• Transferencias electrónicas interbancarias (SPEI).\n` +
                          `• Depósitos directos en tiendas OXXO y establecimientos afiliados.\n` +
                          `• Pagos móviles y pasarelas autorizadas.\n\n` +
                          `🔒 *Importante:* Por seguridad, los números de cuenta oficiales o tarjetas de depósito deben solicitarse exclusivamente con el administrador escribiendo el comando *.asesor*.` 
                });
            }

            // 6. Cómo hacer un pedido
            else if (text === '.comopedir' || text === '.formatopedido') {
                await sock.sendMessage(remoteJid, { 
                    text: `📦 *GUÍA OFICIAL: ¿CÓMO HACER TU PEDIDO?*\n\n` +
                          `Para agilizar tu compra de forma correcta en el grupo o chat privado, copia y llena el siguiente formato con tus datos:\n\n` +
                          `• *Nombre completo:* \n` +
                          `• *Servicio o producto deseado:* \n` +
                          `• *Método de pago seleccionado:* \n` +
                          `• *Comprobante o captura:* (Adjuntar imagen si ya realizaste el pago)\n\n` +
                          `Una vez enviado el formato, un asesor validará la información y procederá a entregarte tu producto.` 
                });
            }

            // 7. Tiempos de Entrega
            else if (text === '.tiempos' || text === '.entregas') {
                await sock.sendMessage(remoteJid, { 
                    text: `⏱ *POLÍTICAS DE TIEMPOS DE ENTREGA*\n\n` +
                          `Queremos que sepas exactamente cuándo recibirás tu producto:\n\n` +
                          `• *Cuentas de Streaming y Servicios Digitales:* El tiempo estimado de entrega oscila entre 10 y 30 minutos posteriores a la confirmación y validación del pago.\n` +
                          `• *Diseños Gráficos y Papelería Personalizada:* Los plazos varían según el volumen de trabajo y se agenda una fecha exacta de entrega directamente con el administrador.\n\n` +
                          `Agradecemos tu paciencia y preferencia.` 
                });
            }

            // 8. Contacto de Asesor / Soporte
            else if (text === '.asesor' || text === '.contacto') {
                await sock.sendMessage(remoteJid, { 
                    text: `📞 *ATENCIÓN PERSONALIZADA Y SOPORTE*\n\n` +
                          `Si requieres atención humana directa, resolver dudas complejas o concretar una contratación inmediata, puedes comunicarte con nuestro administrador principal a través del siguiente acceso:\n\n` +
                          `🌐 https://wa.me/${TARGET_PHONE}\n\n` +
                          `_¡Estamos listos para atenderte y dar solución a tus requerimientos!_` 
                });
            }

            // Comando de diagnóstico general
            else if (text === '!ping' || text === '.ping') {
                await sock.sendMessage(remoteJid, { text: '¡Pong! El bot principal de Click&Cut opera correctamente en el servidor.' });
            }

        } catch (error) {
            console.error('[ERROR] Ocurrió un fallo al procesar el mensaje entrante:', error);
        }
    });
}

connectToWhatsApp();

