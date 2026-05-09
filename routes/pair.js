const { guruId, removeFile } = require('../guru');
const { SESSION_PREFIX, GC_JID, BOT_REPO, WA_CHANNEL, MSG_FOOTER } = require('../config');
const { isConfigured, saveSession } = require('../guru/sessionStore');
const { sendButtons } = require('../guru/sendButtons');
const zlib = require('zlib');
const express = require('express');
const fs = require('fs');
const path = require('path');
const pino = require('pino');
const {
    default: guruConnect,
    useMultiFileAuthState,
    delay,
    fetchLatestBaileysVersion,
    makeCacheableSignalKeyStore,
    Browsers
} = require('@whiskeysockets/baileys');

let router = express.Router();

// /tmp is the ONLY writable directory on Vercel
const SESSION_BASE = process.env.VERCEL ? '/tmp/sessions' : path.join(__dirname, 'session');

router.get('/', async (req, res) => {
    const id = guruId();
    const sessionDir = path.join(SESSION_BASE, id);
    let num = (req.query.number || '').replace(/[^0-9]/g, '');
    const sessionType = (req.query.type || 'short').toLowerCase();

    if (!num || num.length < 7) {
        return res.status(400).json({ code: 'Invalid phone number' });
    }

    let responseSent = false;
    let cleaned = false;
    let pairingDone = false;
    let reconnectCount = 0;
    const MAX_RECONNECTS = 8;

    try { fs.mkdirSync(sessionDir, { recursive: true }); } catch (_) {}

    async function cleanup() {
        if (!cleaned) {
            cleaned = true;
            try { await removeFile(sessionDir); } catch (_) {}
        }
    }

    const cleanupTimeout = setTimeout(() => cleanup(), 280000);

    async function GURU_PAIR_CODE() {
        const { version } = await fetchLatestBaileysVersion();
        const { state, saveCreds } = await useMultiFileAuthState(sessionDir);
        const logger = pino({ level: 'fatal' }).child({ level: 'fatal' });

        let Guru;
        try {
            Guru = guruConnect({
                version,
                auth: {
                    creds: state.creds,
                    keys: makeCacheableSignalKeyStore(state.keys, logger),
                },
                printQRInTerminal: false,
                logger,
                browser: Browsers.macOS('Safari'),
                syncFullHistory: false,
                generateHighQualityLinkPreview: false,
                shouldIgnoreJid: jid => !!jid?.endsWith('@g.us'),
                getMessage: async () => undefined,
                markOnlineOnConnect: true,
                connectTimeoutMs: 60000,
                keepAliveIntervalMs: 25000,
            });
        } catch (err) {
            console.error(`[pair:${id}] connect failed:`, err.message);
            if (!responseSent && !res.headersSent) {
                res.status(500).json({ code: 'Service Unavailable' });
                responseSent = true;
            }
            clearTimeout(cleanupTimeout);
            await cleanup();
            return;
        }

        Guru.ev.on('creds.update', saveCreds);

        Guru.ev.on('connection.update', async (s) => {
            const { connection, lastDisconnect } = s;
            const statusCode = lastDisconnect?.error?.output?.statusCode;

            if (connection === 'open') {
                pairingDone = true;
                console.log(`[pair:${id}] Connection open — reading session`);

                try {
                    try { await Guru.groupAcceptInvite(GC_JID); } catch (_) {}

                    let sessionData = null;
                    for (let i = 0; i < 20; i++) {
                        await delay(3000);
                        try {
                            const credsPath = path.join(sessionDir, 'creds.json');
                            if (fs.existsSync(credsPath)) {
                                const data = fs.readFileSync(credsPath);
                                if (data && data.length > 100) { sessionData = data; break; }
                            }
                        } catch (_) {}
                    }

                    if (!sessionData) {
                        console.error(`[pair:${id}] Could not read creds.json`);
                        clearTimeout(cleanupTimeout);
                        await cleanup();
                        return;
                    }

                    const compressed = zlib.gzipSync(sessionData);
                    const b64 = compressed.toString('base64');
                    const fullSession = SESSION_PREFIX + b64;

                    let msgText, msgButtons;

                    if (isConfigured() && sessionType === 'short') {
                        const shortId = await saveSession(fullSession);
                        const shortSession = `${SESSION_PREFIX}${shortId}`;
                        msgText = `*SESSION ID ✅*\n\n${shortSession}`;
                        msgButtons = [
                            { name: 'cta_copy', buttonParamsJson: JSON.stringify({ display_text: 'Copy Session', copy_code: shortSession }) },
                            { name: 'cta_url', buttonParamsJson: JSON.stringify({ display_text: 'Visit Bot Repo', url: BOT_REPO }) },
                            { name: 'cta_url', buttonParamsJson: JSON.stringify({ display_text: 'Join WaChannel', url: WA_CHANNEL }) }
                        ];
                    } else {
                        msgText = `*SESSION ID ✅*\n\n${fullSession}`;
                        msgButtons = [
                            { name: 'cta_copy', buttonParamsJson: JSON.stringify({ display_text: 'Copy Session', copy_code: fullSession }) },
                            { name: 'cta_url', buttonParamsJson: JSON.stringify({ display_text: 'Visit Bot Repo', url: BOT_REPO }) },
                            { name: 'cta_url', buttonParamsJson: JSON.stringify({ display_text: 'Join WaChannel', url: WA_CHANNEL }) }
                        ];
                    }

                    await delay(3000);
                    let sent = false;
                    for (let i = 0; i < 5 && !sent; i++) {
                        try {
                            await sendButtons(Guru, Guru.user.id, {
                                title: '', text: msgText, footer: MSG_FOOTER, buttons: msgButtons
                            });
                            sent = true;
                        } catch (e) {
                            console.error(`[pair:${id}] send attempt ${i + 1} failed:`, e.message);
                            if (i < 4) await delay(3000);
                        }
                    }

                    await delay(2000);
                    try { await Guru.ws.close(); } catch (_) {}

                } catch (e) {
                    console.error(`[pair:${id}] session processing error:`, e.message);
                } finally {
                    clearTimeout(cleanupTimeout);
                    await cleanup();
                }

            } else if (connection === 'close') {
                if (pairingDone || statusCode === 401 || reconnectCount >= MAX_RECONNECTS) {
                    clearTimeout(cleanupTimeout);
                    await cleanup();
                    return;
                }
                reconnectCount++;
                console.log(`[pair:${id}] Reconnect #${reconnectCount} (status ${statusCode})`);
                await delay(4000);
                GURU_PAIR_CODE();
            }
        });

        if (!Guru.authState.creds.registered) {
            await delay(1500);
            try {
                const code = await Guru.requestPairingCode(num);
                console.log(`[pair:${id}] Code issued: ${code}`);
                if (!responseSent && !res.headersSent) {
                    res.json({ code, fallback: sessionType === 'short' && !isConfigured() });
                    responseSent = true;
                }
            } catch (err) {
                console.error(`[pair:${id}] requestPairingCode error:`, err.message);
                if (!responseSent && !res.headersSent) {
                    res.status(500).json({ code: 'Failed to generate pairing code' });
                    responseSent = true;
                }
                clearTimeout(cleanupTimeout);
                await cleanup();
            }
        }
    }

    try {
        await GURU_PAIR_CODE();
    } catch (err) {
        console.error(`[pair:${id}] fatal:`, err.message);
        clearTimeout(cleanupTimeout);
        await cleanup();
        if (!responseSent && !res.headersSent) {
            res.status(500).json({ code: 'Service Error' });
        }
    }
});

module.exports = router;
