// routes/creditCardRoutes.js
const express = require('express');
const router = express.Router();
const creditCardController = require('../controllers/creditCardController');
const authMiddleware = require('../middlewares/auth');

// Logging middleware to debug requests
router.use((req, res, next) => {
  console.log(`${new Date().toISOString()} - ${req.method} ${req.originalUrl}`);
  console.log('Headers:', JSON.stringify(req.headers));
  if (req.method === 'POST' || req.method === 'PUT') {
    console.log('Request body:', JSON.stringify(req.body));
  }
  if (req.method === 'DELETE') {
    console.log('Delete request params:', JSON.stringify(req.params));
  }
  next();
});

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