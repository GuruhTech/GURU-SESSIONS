async function sendButtons(sock, jid, opts = {}) {
    const { text = '', footer = '', buttons = [] } = opts;

    try {
        const { generateWAMessageFromContent, proto } = await import('@whiskeysockets/baileys');

        const nativeButtons = buttons.map((btn, i) => {
            const params = btn.buttonParamsJson ? JSON.parse(btn.buttonParamsJson) : {};
            if (btn.name === 'cta_copy') {
                return {
                    name: 'cta_copy',
                    buttonParamsJson: JSON.stringify({
                        display_text: params.display_text || 'Copy',
                        copy_code: params.copy_code || ''
                    })
                };
            }
            if (btn.name === 'cta_url') {
                return {
                    name: 'cta_url',
                    buttonParamsJson: JSON.stringify({
                        display_text: params.display_text || 'Open',
                        url: params.url || '',
                        merchant_url: params.url || ''
                    })
                };
            }
            return {
                name: 'quick_reply',
                buttonParamsJson: JSON.stringify({
                    display_text: params.display_text || btn.name || 'Button',
                    id: String(i + 1)
                })
            };
        });

        const msg = generateWAMessageFromContent(jid, {
            viewOnceMessage: {
                message: {
                    interactiveMessage: proto.Message.InteractiveMessage.fromObject({
                        body: proto.Message.InteractiveMessage.Body.fromObject({ text }),
                        footer: proto.Message.InteractiveMessage.Footer.fromObject({ text: footer }),
                        header: proto.Message.InteractiveMessage.Header.fromObject({ hasMediaAttachment: false }),
                        nativeFlowMessage: proto.Message.InteractiveMessage.NativeFlowMessage.fromObject({
                            buttons: nativeButtons
                        })
                    })
                }
            }
        }, { userJid: sock.user.id });

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
