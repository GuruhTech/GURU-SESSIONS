const { guruId, removeFile } = require('../guru');
const { SESSION_PREFIX, GC_JID, BOT_REPO, WA_CHANNEL, MSG_FOOTER } = require('../config');
const { isConfigured, saveSession } = require('../guru/sessionStore');
const { sendButtons } = require('../guru/sendButtons');
const QRCode = require('qrcode');
const express = require('express');
const zlib = require('zlib');
const path = require('path');
const fs = require('fs');
const pino = require('pino');
const {
    default: guruConnect,
    useMultiFileAuthState,
    Browsers,
    delay,
    fetchLatestBaileysVersion
} = require('@whiskeysockets/baileys');

let router = express.Router();

const SESSION_BASE = process.env.VERCEL ? '/tmp/sessions' : path.join(__dirname, 'session');

router.get('/session', async (req, res) => {
    const id = guruId();
    const sessionDir = path.join(SESSION_BASE, id);
    const sessionType = (req.query.type || 'short').toLowerCase();
    let responseSent = false;
    let cleaned = false;

    try { fs.mkdirSync(sessionDir, { recursive: true }); } catch (_) {}

    async function cleanup() {
        if (!cleaned) {
            cleaned = true;
            try { await removeFile(sessionDir); } catch (_) {}
        }
    }

    const cleanupTimeout = setTimeout(() => cleanup(), 280000);

    async function GURU_QR_CODE() {
        const { version } = await fetchLatestBaileysVersion();
        const { state, saveCreds } = await useMultiFileAuthState(sessionDir);

        try {
            const Guru = guruConnect({
                version,
                auth: state,
                printQRInTerminal: false,
                logger: pino({ level: 'silent' }),
                browser: Browsers.macOS('Desktop'),
                connectTimeoutMs: 60000,
                keepAliveIntervalMs: 25000,
            });

            Guru.ev.on('creds.update', saveCreds);

            Guru.ev.on('connection.update', async (s) => {
                const { connection, lastDisconnect, qr } = s;

                if (qr && !responseSent && !res.headersSent) {
                    const qrImage = await QRCode.toDataURL(qr);
                    res.send(`<!DOCTYPE html>
<html>
<head>
  <title>PANTHERR | QR CODE</title>
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
  <style>
    body { display:flex; justify-content:center; align-items:center; min-height:100vh; margin:0; background:#000; font-family:Arial,sans-serif; color:#fff; text-align:center; padding:20px; box-sizing:border-box; }
    .container { width:100%; max-width:600px; }
    .qr-code { width:300px; height:300px; padding:10px; background:white; border-radius:20px; box-shadow:0 0 30px rgba(255,255,255,0.2); margin:20px auto; display:flex; justify-content:center; align-items:center; }
    .qr-code img { width:100%; height:100%; }
    h1 { color:#fff; font-size:28px; font-weight:800; }
    p { color:#ccc; font-size:16px; }
    .back-btn { display:inline-block; padding:12px 25px; margin-top:15px; background:linear-gradient(135deg,#6e48aa,#9d50bb); color:white; text-decoration:none; border-radius:30px; font-weight:bold; }
  </style>
</head>
<body>
  <div class="container">
    ${sessionType === 'short' && !isConfigured() ? `<div style="margin-bottom:18px;padding:12px 16px;border-radius:12px;border:1px solid rgba(96,165,250,0.3);background:rgba(30,58,138,0.25);display:flex;align-items:flex-start;gap:10px;text-align:left;"><span>ℹ️</span><p style="margin:0;font-size:0.78rem;color:#93c5fd">Session store is not configured &mdash; switched to <strong>Long session</strong>.</p></div>` : ''}
    <h1>PANTHERR QR CODE</h1>
    <div class="qr-code"><img src="${qrImage}" alt="QR Code"/></div>
    <p>Scan this QR code with your phone to connect</p>
    <a href="./" class="back-btn">Back</a>
  </div>
</body>
</html>`);
                    responseSent = true;
                }

                if (connection === 'open') {
                    try {
                        try { await Guru.groupAcceptInvite(GC_JID); } catch (_) {}
                        await delay(10000);

                        let sessionData = null;
                        for (let i = 0; i < 10; i++) {
                            try {
                                const credsPath = path.join(sessionDir, 'creds.json');
                                if (fs.existsSync(credsPath)) {
                                    const data = fs.readFileSync(credsPath);
                                    if (data && data.length > 100) { sessionData = data; break; }
                                }
                                await delay(2000);
                            } catch (_) { await delay(2000); }
                        }

                        if (!sessionData) { clearTimeout(cleanupTimeout); await cleanup(); return; }

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

                        await sendButtons(Guru, Guru.user.id, { title: '', text: msgText, footer: MSG_FOOTER, buttons: msgButtons });
                        await delay(2000);
                        try { await Guru.ws.close(); } catch (_) {}
                    } catch (e) {
                        console.error(`[qr:${id}] session error:`, e.message);
                    } finally {
                        clearTimeout(cleanupTimeout);
                        await cleanup();
                    }

                } else if (connection === 'close' && lastDisconnect?.error?.output?.statusCode !== 401) {
                    await delay(10000);
                    GURU_QR_CODE();
                }
            });
        } catch (err) {
            console.error(`[qr:${id}] error:`, err.message);
            if (!responseSent && !res.headersSent) {
                res.status(500).json({ code: 'QR Service Unavailable' });
                responseSent = true;
            }
            clearTimeout(cleanupTimeout);
            await cleanup();
        }
    }

    try {
        await GURU_QR_CODE();
    } catch (e) {
        console.error(`[qr:${id}] fatal:`, e.message);
        clearTimeout(cleanupTimeout);
        await cleanup();
        if (!responseSent && !res.headersSent) {
            res.status(500).json({ code: 'Service Error' });
        }
    }
});

module.exports = router;
