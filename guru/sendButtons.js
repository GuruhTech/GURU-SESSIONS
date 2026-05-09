/**
 * sendButtons — sends an interactive button message via Baileys.
 * Falls back to plain text if button sending fails.
 */
async function sendButtons(sock, jid, opts = {}) {
    const { title = '', text = '', footer = '', buttons = [] } = opts;

    try {
        const msg = {
            buttonsMessage: {
                contentText: text,
                footerText: footer,
                headerType: 1,
                buttons: buttons.map((btn, i) => {
                    const params = btn.buttonParamsJson
                        ? JSON.parse(btn.buttonParamsJson)
                        : {};
                    return {
                        buttonId: String(i + 1),
                        buttonText: { displayText: params.display_text || btn.name || 'Button' },
                        type: 1
                    };
                })
            }
        };
        await sock.sendMessage(jid, msg);
    } catch (btnErr) {
        try {
            await sock.sendMessage(jid, { text: `${text}\n\n${footer}`.trim() });
        } catch (fallbackErr) {
            console.error('sendButtons fallback also failed:', fallbackErr.message);
        }
    }
}

module.exports = { sendButtons };
