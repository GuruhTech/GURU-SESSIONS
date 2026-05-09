const { gifted } = require('gifted-btns');

async function sendButtons(sock, jid, opts = {}) {
    const { text = '', footer = '', buttons = [] } = opts;

    try {
        const msg = gifted(jid, {
            text,
            footer,
            buttons: buttons.map((btn, i) => {
                const params = btn.buttonParamsJson ? JSON.parse(btn.buttonParamsJson) : {};
                if (btn.name === 'cta_copy') {
                    return { type: 'cta_copy', copy_code: params.copy_code || '', display_text: params.display_text || 'Copy' };
                }
                if (btn.name === 'cta_url') {
                    return { type: 'cta_url', url: params.url || '', display_text: params.display_text || 'Open' };
                }
                return { type: 'reply', id: String(i + 1), display_text: params.display_text || btn.name || 'Button' };
            })
        });
        await sock.relayMessage(jid, msg.message, { messageId: msg.key.id });
    } catch (btnErr) {
        try {
            await sock.sendMessage(jid, { text: (text + '\n\n' + footer).trim() });
        } catch (fallbackErr) {
            console.error('sendButtons fallback also failed:', fallbackErr.message);
        }
    }
}

module.exports = { sendButtons };
