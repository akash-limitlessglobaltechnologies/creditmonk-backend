// routes/userRoutes.js
const express = require('express');
const router = express.Router();
const userController = require('../controllers/userController');

// Single signup route for all steps
router.post('/signup', userController.signup);

// Login route
router.post('/login', userController.login);
router.delete('/account', userController.deleteAccount);
router.post('/find-by-email', userController.findByEmail);
router.delete('/delete-by-email', userController.deleteByEmail);

module.exports = router;