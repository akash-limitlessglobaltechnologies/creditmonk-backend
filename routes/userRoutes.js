// routes/userRoutes.js
const express = require('express');
const router = express.Router();
const userController = require('../controllers/userController');
const authMiddleware = require('../middlewares/auth');
// Single signup route for all steps
router.post('/signup', userController.signup);
console.log('Setting up delete account route');
router.delete('/account', authMiddleware, userController.deleteAccount);
// Login route
router.post('/login', userController.login);
router.post('/forget-pin', userController.forgetPin);

module.exports = router;