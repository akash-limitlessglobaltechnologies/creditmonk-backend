const CreditCard = require('../models/creditCard');

const validateDates = (date) => {
    return date >= 1 && date <= 31;
};

const creditCardController = {
    // Create new card
    createCard: async (req, res) => {
        try {
            const {
                lastFourDigits,
                bankName,
                userName,
                billGenerationDate,
                billDueDate
            } = req.body;

            // Validate required fields
            if (!lastFourDigits || !bankName || !userName || !billGenerationDate || !billDueDate) {
                return res.status(400).json({
                    success: false,
                    message: 'All fields are required'
                });
            }

            // Validate last four digits format
            if (!/^\d{4}$/.test(lastFourDigits)) {
                return res.status(400).json({
                    success: false,
                    message: 'Last four digits must be exactly 4 digits'
                });
            }

            // Validate dates
            if (!validateDates(billGenerationDate) || !validateDates(billDueDate)) {
                return res.status(400).json({
                    success: false,
                    message: 'Bill generation and due dates must be between 1 and 31'
                });
            }

            // Check for existing card
            const existingCard = await CreditCard.findOne({
                userId: req.user.userId,
                lastFourDigits: lastFourDigits
            }).exec();

            if (existingCard) {
                return res.status(400).json({
                    success: false,
                    message: 'A card with these last four digits already exists'
                });
            }

            // Encrypt sensitive data
            const encryptedBankName = CreditCard.encryptData(bankName.trim());
            const encryptedUserName = CreditCard.encryptData(userName.trim());

            // Create new card
            const newCard = new CreditCard({
                userId: req.user.userId,
                lastFourDigits: lastFourDigits.trim(),
                bankName: encryptedBankName,
                userName: encryptedUserName,
                billGenerationDate,
                billDueDate
            });

            await newCard.save();

            res.status(201).json({
                success: true,
                message: 'Credit card added successfully',
                card: newCard.toJSON()
            });

        } catch (error) {
            console.error('Create card error:', error);
            res.status(500).json({
                success: false,
                message: 'Error creating credit card',
                error: error.message
            });
        }
    },

    // Get all cards for user
    getAllCards: async (req, res) => {
        try {
            const cards = await CreditCard.find({ 
                userId: req.user.userId 
            }).sort({ createdAt: -1 }).exec();

            // Return empty array if no cards found
            if (!cards || cards.length === 0) {
                return res.status(200).json({
                    success: true,
                    message: 'No cards found',
                    cards: []
                });
            }

            res.status(200).json({
                success: true,
                message: 'Cards retrieved successfully',
                count: cards.length,
                cards: cards.map(card => card.toJSON())
            });

        } catch (error) {
            console.error('Get cards error:', error);
            res.status(500).json({
                success: false,
                message: 'Error fetching credit cards',
                error: error.message
            });
        }
    },

    // Get single card by last four digits
    getCardByLastFour: async (req, res) => {
        try {
            const { lastFourDigits } = req.params;

            // Validate format
            if (!/^\d{4}$/.test(lastFourDigits)) {
                return res.status(400).json({
                    success: false,
                    message: 'Invalid last four digits format'
                });
            }

            const card = await CreditCard.findOne({
                userId: req.user.userId,
                lastFourDigits: lastFourDigits.trim()
            }).exec();

            if (!card) {
                return res.status(404).json({
                    success: false,
                    message: 'Card not found'
                });
            }

            res.status(200).json({
                success: true,
                message: 'Card retrieved successfully',
                card: card.toJSON()
            });

        } catch (error) {
            console.error('Get card error:', error);
            res.status(500).json({
                success: false,
                message: 'Error fetching card',
                error: error.message
            });
        }
    },

    // Update card
    updateCard: async (req, res) => {
        try {
            const { lastFourDigits } = req.params;
            const updates = req.body;

            // Validate last four digits format
            if (!/^\d{4}$/.test(lastFourDigits)) {
                return res.status(400).json({
                    success: false,
                    message: 'Invalid last four digits format'
                });
            }

            // Find card
            const card = await CreditCard.findOne({
                userId: req.user.userId,
                lastFourDigits: lastFourDigits.trim()
            }).exec();

            if (!card) {
                return res.status(404).json({
                    success: false,
                    message: 'Card not found'
                });
            }

            // Validate and update fields
            if (updates.bankName) {
                card.bankName = CreditCard.encryptData(updates.bankName.trim());
            }
            if (updates.userName) {
                card.userName = CreditCard.encryptData(updates.userName.trim());
            }
            if (updates.billGenerationDate) {
                if (!validateDates(updates.billGenerationDate)) {
                    return res.status(400).json({
                        success: false,
                        message: 'Invalid bill generation date'
                    });
                }
                card.billGenerationDate = updates.billGenerationDate;
            }
            if (updates.billDueDate) {
                if (!validateDates(updates.billDueDate)) {
                    return res.status(400).json({
                        success: false,
                        message: 'Invalid bill due date'
                    });
                }
                card.billDueDate = updates.billDueDate;
            }

            await card.save();

            res.status(200).json({
                success: true,
                message: 'Card updated successfully',
                card: card.toJSON()
            });

        } catch (error) {
            console.error('Update card error:', error);
            res.status(500).json({
                success: false,
                message: 'Error updating card',
                error: error.message
            });
        }
    },

    // Delete card
    deleteCard: async (req, res) => {
        try {
            const { lastFourDigits } = req.params;

            // Validate format
            if (!/^\d{4}$/.test(lastFourDigits)) {
                return res.status(400).json({
                    success: false,
                    message: 'Invalid last four digits format'
                });
            }

            const card = await CreditCard.findOneAndDelete({
                userId: req.user.userId,
                lastFourDigits: lastFourDigits.trim()
            }).exec();

            if (!card) {
                return res.status(404).json({
                    success: false,
                    message: 'Card not found'
                });
            }

            res.status(200).json({
                success: true,
                message: 'Card deleted successfully',
                card: card.toJSON()
            });

        } catch (error) {
            console.error('Delete card error:', error);
            res.status(500).json({
                success: false,
                message: 'Error deleting card',
                error: error.message
            });
        }
    }
};

module.exports = creditCardController;