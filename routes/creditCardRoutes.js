// routes/creditCardRoutes.js
const express = require('express');
const router = express.Router();
const creditCardController = require('../controllers/creditCardController');
const authMiddleware = require('../middlewares/auth');

// Apply auth middleware to all routes
router.use(authMiddleware);

// Create new card
router.post('/', creditCardController.createCard);

// Get all cards
router.get('/', creditCardController.getAllCards);

// Get single card
router.get('/:lastFourDigits', creditCardController.getCardByLastFour);

// Update card
router.put('/:lastFourDigits', creditCardController.updateCard);

// Delete card
router.delete('/:lastFourDigits', creditCardController.deleteCard);

module.exports = router;