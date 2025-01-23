// models/creditCard.js
const mongoose = require('mongoose');
const crypto = require('crypto');

// Encryption key setup
const key = crypto.scryptSync('Limitlessencryptionkey', 'salt', 32);

const creditCardSchema = new mongoose.Schema({
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'CreditUser',
        required: true
    },
    lastFourDigits: {
        type: String,
        required: true,
        trim: true
    },
    bankName: {
        encrypted: { type: String },
        iv: { type: String }
    },
    userName: {
        encrypted: { type: String },
        iv: { type: String }
    },
    billGenerationDate: {
        type: Number,
        required: true
    },
    billDueDate: {
        type: Number,
        required: true
    }
}, { timestamps: true });

function encrypt(text) {
    const iv = crypto.randomBytes(16);
    const cipher = crypto.createCipheriv('aes-256-cbc', key, iv);
    let encrypted = cipher.update(text, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    return {
        encrypted,
        iv: iv.toString('hex')
    };
}

function decrypt(encryptedData) {
    try {
        if (!encryptedData.encrypted || !encryptedData.iv) return '';
        const iv = Buffer.from(encryptedData.iv, 'hex');
        const decipher = crypto.createDecipheriv('aes-256-cbc', key, iv);
        let decrypted = decipher.update(encryptedData.encrypted, 'hex', 'utf8');
        decrypted += decipher.final('utf8');
        return decrypted;
    } catch (error) {
        console.error('Decryption error:', error);
        return '';
    }
}

creditCardSchema.methods.toJSON = function() {
    const obj = this.toObject();
    return {
        _id: obj._id,
        userId: obj.userId,
        lastFourDigits: obj.lastFourDigits,
        bankName: decrypt(obj.bankName || {}),
        userName: decrypt(obj.userName || {}),
        billGenerationDate: obj.billGenerationDate,
        billDueDate: obj.billDueDate,
        createdAt: obj.createdAt,
        updatedAt: obj.updatedAt
    };
};

// Static method to encrypt data before saving
creditCardSchema.statics.encryptData = function(text) {
    return encrypt(text);
};

const CreditCard = mongoose.model('CreditCard', creditCardSchema);

module.exports = CreditCard;
