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

    // Track active pairing sessions
    let activeSessions = 0;
    app.use('/code', (req, res, next) => {
        activeSessions++;
        res.on('finish', () => { activeSessions = Math.max(0, activeSessions - 1); });
        next();
    });
    app.use('/qr', (req, res, next) => {
        if (req.path === '/session') {
            activeSessions++;
            res.on('finish', () => { activeSessions = Math.max(0, activeSessions - 1); });
        }
        next();
    });

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

    app.get('/status', (req, res) => {
        res.sendFile(path.join(__dirname, 'public', 'status.html'), { dotfiles: 'allow' }, (err) => {
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
        const mem = process.memoryUsage();
        const uptimeSec = Math.floor(process.uptime());
        const hh = Math.floor(uptimeSec / 3600);
        const mm = Math.floor((uptimeSec % 3600) / 60);
        const ss = uptimeSec % 60;
        const uptime = hh + 'h ' + mm + 'm ' + ss + 's';

        let storageType = 'inline-zlib';
        if (isConfigured()) {
            const dbUrl = process.env.DATABASE_URL || '';
            if (dbUrl.startsWith('mongodb')) storageType = 'mongodb';
            else if (dbUrl.startsWith('postgres')) storageType = 'postgresql';
            else storageType = 'database';
        }

        res.json({
            status: 200,
            success: true,
            service: 'PANTHERR Session',
            version: '1.0.0',
            environment: process.env.VERCEL ? 'vercel' : (process.env.NODE_ENV || 'local'),
            storage: {
                type: storageType,
                configured: isConfigured()
            },
            sessions: {
                active: activeSessions
            },
            system: {
                uptime,
                node: process.version,
                memory: {
                    used_mb: Math.round(mem.heapUsed / 1024 / 1024),
                    total_mb: Math.round(mem.heapTotal / 1024 / 1024),
                    rss_mb: Math.round(mem.rss / 1024 / 1024)
                }
            },
            timestamp: new Date().toISOString()
        });
    });

    if (require.main === module) {
        app.listen(PORT, () => {
            console.log('\nPANTHERR Session Server running on http://localhost:' + PORT);
            init(config);
        });
    } else {
        init(config);
    }

    module.exports = app;

} catch (startupError) {
    console.error('STARTUP CRASH:', startupError);
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
