const dns = require('dns');
const checkNetworkConnectivity = (req, res, next) => {
    dns.lookup('google.com', (err) => {
        if (err && err.code === 'ENOTFOUND') {
            return res.status(503).send('No network connection');
        }
        next();
    });
};

module.exports = checkNetworkConnectivity;
