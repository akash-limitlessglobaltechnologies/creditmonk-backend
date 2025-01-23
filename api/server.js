const app = require('../server');

// Export the app for Vercel's serverless environment
module.exports = (req, res) => {
    app(req, res);
};
