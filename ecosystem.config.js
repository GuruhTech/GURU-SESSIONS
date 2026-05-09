module.exports = {
    apps: [{
        name: 'pantherr-session',
        script: 'index.js',
        cwd: '/root/web/pantherr-session',
        instances: 1,
        autorestart: true,
        watch: false,
    }]
};
