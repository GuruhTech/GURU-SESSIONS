try {
    const express = require('express');
    const path = require('path');
    const bodyParser = require('body-parser');
    const config = require('./config');
    const { PORT } = config;
    const { qrRoute, pairRoute } = require('./routes');
    const { init, isConfigured, getSession } = require('./guru/sessionStore');

    const app = express();
    app.set('json spaces', 2);

    require('events').EventEmitter.defaultMaxListeners = 2000;

    app.use(bodyParser.json());
    app.use(bodyParser.urlencoded({ extended: true }));
    app.use(express.static(path.join(__dirname, 'public')));

    app.get('/pair', (req, res) => {
        res.sendFile(path.join(__dirname, 'public', 'pair.html'), { dotfiles: 'allow' }, (err) => {
            if (err) res.status(500).send('Error serving page: ' + err.message);
        });
    });

    app.get('/', (req, res) => {
        res.sendFile(path.join(__dirname, 'public', 'index.html'), { dotfiles: 'allow' }, (err) => {
            if (err) res.status(500).send('Error serving page: ' + err.message);
        });
    });

    app.get('/qr', (req, res) => {
        res.sendFile(path.join(__dirname, 'public', 'qr.html'), { dotfiles: 'allow' }, (err) => {
            if (err) res.status(500).send('Error serving page: ' + err.message);
        });
    });

    app.use('/qr', qrRoute);
    app.use('/code', pairRoute);

    app.get('/session/:id', async (req, res) => {
        if (!isConfigured()) {
            return res.status(503).send('No database configured on this server.');
        }
        try {
            const session = await getSession(req.params.id);
            if (!session) return res.status(404).send('Session not found.');
            res.setHeader('Content-Type', 'text/plain; charset=utf-8');
            res.send(session);
        } catch (e) {
            res.status(500).send('Error retrieving session.');
        }
    });

    app.get('/health', (req, res) => {
        res.json({
            status: 200,
            success: true,
            service: 'PANTHERR Session',
            storage: isConfigured() ? 'database' : 'inline-zlib',
            timestamp: new Date().toISOString(),
        });
    });

    if (require.main === module) {
        app.listen(PORT, () => {
            console.log(`\nPANTHERR Session Server running on http://localhost:${PORT}`);
            init(config);
        });
    } else {
        init(config);
    }

    module.exports = app;

} catch (startupError) {
    console.error('STARTUP CRASH:', startupError);
    // Export a fallback express app that reports the error
    const express = require('express');
    const app = express();
    app.use((req, res) => {
        res.status(500).json({
            error: 'Startup failed',
            message: startupError.message,
            stack: startupError.stack
        });
    });
    module.exports = app;
}
