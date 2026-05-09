<div align="center">

<img src="https://i.ibb.co/k6SxWhdR/84bb97a4a575.jpg" alt="BLACK PANTHER MD Banner" width="100%"/>

<br/>

```
╭═══════════════════════════════════════════════╮
│                                               │
│        🐾  B L A C K  P A N T H E R  M D     │
│                                               │
│            ✊🏿  W A K A N D A  F O R E V E R   │
│                                               │
╰═══════════════════════════════════════════════╯
```

<br/>

[![Status](https://img.shields.io/badge/Status-Active-brightgreen?style=for-the-badge&logo=whatsapp&logoColor=white)](https://wa.me/254105521300)
[![Node.js](https://img.shields.io/badge/Node.js-20.x-339933?style=for-the-badge&logo=nodedotjs&logoColor=white)](https://nodejs.org)
[![Platform](https://img.shields.io/badge/Platform-Multi--Device-7B2FBE?style=for-the-badge&logo=whatsapp)](https://github.com)
[![License](https://img.shields.io/badge/License-MIT-blue?style=for-the-badge)](LICENSE)
[![Commands](https://img.shields.io/badge/Commands-200%2B-ff6b35?style=for-the-badge)](#)
[![Made in Kenya](https://img.shields.io/badge/Made%20in-Kenya%20%F0%9F%87%B0%F0%9F%87%AA-black?style=for-the-badge)](https://wa.me/254105521300)

<br/>

> **The most powerful WhatsApp MD bot on the continent.**  
> Session generator for **BLACK PANTHER MD** and any Baileys-based bot.  
> Supports **pair code** and **QR code** login — forged from Vibranium, built in Wakanda.

<br/>

**[📲 Deploy Now](#-deployment) · [📡 Join Channel](https://whatsapp.com/channel/0029VbCl2UX3rZZilMSvxN1e) · [👑 Contact Owner](https://wa.me/254105521300)**

</div>

---

## 🐾 What is BLACK PANTHER MD?

**BLACK PANTHER MD** is a feature-rich, multi-device WhatsApp bot built on [Baileys](https://github.com/WhiskeySockets/Baileys) — fast, modular, and loaded with **200+ commands** spanning AI chat, music downloads, group moderation, games, and much more.

Proudly built and maintained by **[GuruTech](https://wa.me/254105521300)** 🇰🇪

---

## ✨ Features

| Feature | Description |
|---|---|
| 🔗 **Pair Code Login** | No phone needed — enter code in WhatsApp → Linked Devices |
| 📷 **QR Code Login** | Traditional QR scan for quick access |
| 🗜️ **Long Session** | Full zlib/base64 inline string — works anywhere, no DB needed |
| 🗃️ **Short Session** | Compact ID stored in MongoDB or PostgreSQL (auto-falls back to long) |
| ⚡ **Auto DB Detection** | Detects `mongodb://` or `postgres://` from `DATABASE_URL` automatically |
| 🛡️ **Vibranium Security** | AES-256 encrypted sessions — credentials never touch a disk |
| 🌍 **Multi-Device** | Runs on unlimited linked devices simultaneously |

---

## ⚙️ Environment Variables

Set these in a `.env` file or your hosting dashboard:

| Variable | Required | Description |
|---|---|---|
| `DATABASE_URL` | Optional | MongoDB (`mongodb+srv://...`) or PostgreSQL (`postgres://...`). If unset, all sessions use long format. |
| `SESSION_PREFIX` | Optional | Prefix prepended to session strings. Default: `BlackPanther~` |
| `PORT` | Optional | Port to listen on. Default: `50900` |
| `BOT_REPO` | Optional | GitHub URL shown in WhatsApp message button |
| `WA_CHANNEL` | Optional | WhatsApp channel URL shown in message button |
| `MSG_FOOTER` | Optional | Footer text in WhatsApp session message |

---

## 🌐 API Endpoints

| Endpoint | Description |
|---|---|
| `GET /` | Home landing page |
| `GET /pair` | Pair code login page |
| `GET /qr` | QR code landing page |
| `GET /qr/session?type=short\|long` | Generates and displays QR code |
| `GET /code?number=2547xxx&type=short\|long` | Returns pair code JSON `{ code, fallback }` |
| `GET /health` | Server health + storage backend status |

> `fallback: true` in the `/code` response means short was requested but no DB is configured — automatically falls back to a long session.

---

## 🔧 Usage in Your Bot

### Session Loader

```js
// lib/session.js
const fs = require('fs');
const zlib = require('zlib');
const path = require('path');
const axios = require('axios');

const sessionDir = path.join(__dirname, '..', 'session');
const credsPath = path.join(sessionDir, 'creds.json');

if (!fs.existsSync(sessionDir)) fs.mkdirSync(sessionDir, { recursive: true });

async function loadSession(SESSION_ID) {
    if (!SESSION_ID || typeof SESSION_ID !== 'string') {
        throw new Error('SESSION_ID is missing or invalid');
    }

    if (fs.existsSync(credsPath)) fs.unlinkSync(credsPath);

    const PREFIX = 'BlackPanther~';

    if (!SESSION_ID.startsWith(PREFIX)) {
        throw new Error(`Invalid session format. Expected to start with "${PREFIX}"`);
    }

    const payload = SESSION_ID.slice(PREFIX.length);

    if (payload.length < 50) {
        // SHORT SESSION — fetch from server
        const serverUrl = `https://your-deployment-url.vercel.app/session/${payload}`;
        const response = await axios.get(serverUrl, { timeout: 10000 });
        const fullSession = response.data;
        return loadSession(fullSession.trim());
    } else {
        // LONG SESSION — decode zlib/base64 inline
        const compressedData = Buffer.from(payload, 'base64');
        const decompressedData = zlib.gunzipSync(compressedData);
        fs.writeFileSync(credsPath, decompressedData, 'utf8');
        console.log('✅ Session loaded — Wakanda Forever ✊🏿');
    }
}

module.exports = { loadSession };
```

### Bot Start File

```js
// index.js
const { loadSession } = require('./lib/session');
const { useMultiFileAuthState, fetchLatestBaileysVersion } = require('@whiskeysockets/baileys');

async function connectToWhatsApp() {
    await loadSession(process.env.SESSION_ID);

    const { state, saveCreds } = await useMultiFileAuthState('./session');
    const { version } = await fetchLatestBaileysVersion();

    const sock = makeWASocket({
        version,
        auth: state,
        printQRInTerminal: !process.env.SESSION_ID,
        // ... your other options
    });

    sock.ev.on('creds.update', saveCreds);
    // ... rest of your bot logic
}

connectToWhatsApp();
```

### Example `.env`

```env
SESSION_ID=BlackPanther~abc123xyz      # short session
# or
SESSION_ID=BlackPanther~H4sIAAAAA...   # long session (full zlib string)
```

---

## 🔑 Getting Your Session ID

1. Open the bot's **Pair Code page** on your deployment
2. Enter your WhatsApp number (e.g. `2547XXXXXXXX`)
3. Approve the pairing code in WhatsApp → *Linked Devices*
4. Copy the `SESSION_ID` and paste it into your `.env` config

---

## 📲 Deployment

### ⚡ One-Click Deploy

<div align="center">

[![Deploy to Heroku](https://img.shields.io/badge/Deploy%20to-Heroku-430098?style=for-the-badge&logo=heroku)](https://heroku.com/deploy)
[![Deploy to Render](https://img.shields.io/badge/Deploy%20to-Render-46E3B7?style=for-the-badge&logo=render)](https://render.com/deploy)
[![Deploy to Koyeb](https://img.shields.io/badge/Deploy%20to-Koyeb-121212?style=for-the-badge)](https://app.koyeb.com)
[![Deploy to Vercel](https://img.shields.io/badge/Deploy%20to-Vercel-000000?style=for-the-badge&logo=vercel)](https://vercel.com)

</div>

### 🖥️ Local / VPS Setup

```bash
# 1. Clone the repo
git clone https://github.com/koyoteh/BLACK-PANTHER.git
cd BLACK-PANTHER

# 2. Install dependencies
npm install --legacy-peer-deps

# 3. Configure environment
cp .env.example .env
nano .env   # Fill in SESSION_ID, OWNER_NUMBER, etc.

# 4. Start the bot
npm start
```

> 💡 **Keep it alive on VPS with PM2:**
> ```bash
> npm install -g pm2
> pm2 start index.js --name "black-panther"
> pm2 save && pm2 startup
> ```

---

## 📡 Stay Connected

<div align="center">

| Platform | Link |
|---|---|
| 📲 WhatsApp Channel | [Join Here](https://whatsapp.com/channel/0029VbCl2UX3rZZilMSvxN1e) |
| 👑 Owner Direct | [wa.me/254105521300](https://wa.me/254105521300) |
| 🐙 GitHub | [koyoteh/BLACK-PANTHER](https://github.com/koyoteh/BLACK-PANTHER) |

</div>

---

## ⚖️ License

MIT License — © 2025 GuruTech

Permission is granted, free of charge, to use, copy, modify, and distribute this software, provided the above copyright notice appears in all copies.

---

<div align="center">

**Made with ❤️ in Kenya 🇰🇪 by [GuruTech](https://wa.me/254105521300)**

*If BLACK PANTHER MD helped you — please ⭐ star the repo and share it!*

```
╭═══════════════════════════════════════╮
│                                       │
│   🐾  BLACK PANTHER MD  🐾            │
│       Wakanda Forever  ✊🏿             │
│          by  GuruTech  🇰🇪            │
│                                       │
╰═══════════════════════════════════════╯
```

<a><img src='https://i.imgur.com/LyHic3i.gif' width="100%"/></a>

</div>
