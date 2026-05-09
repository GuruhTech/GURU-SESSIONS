require('dotenv').config();

module.exports = {
    PORT: process.env.PORT || 50900,
    SESSION_PREFIX: process.env.SESSION_PREFIX || "GURU~",
    GC_JID: process.env.GC_JID || "LZE4CoZNhLB28z5jtqwNLA",
    DATABASE_URL: process.env.DATABASE_URL || "",
    BOT_REPO: process.env.BOT_REPO || "https://github.com/GuruhTech/ULTRA-GURU",
    WA_CHANNEL: process.env.WA_CHANNEL || "https://whatsapp.com/channel/0029VbCl2UX3rZZilMSvxN1e",
    MSG_FOOTER: process.env.MSG_FOOTER || "> *ᴘᴏᴡᴇʀᴇᴅ ʙʏ GuruTech ᴛᴇᴄʜ*",
};
