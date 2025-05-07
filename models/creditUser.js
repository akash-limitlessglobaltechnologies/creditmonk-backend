// models/creditUser.js
const mongoose = require('mongoose');

const creditUserSchema = new mongoose.Schema({
    name: {
        type: String,
        required: true,
        trim: true
    },
    email: {
        type: String,
        required: true,
        unique: true,
        lowercase: true,
        trim: true
    },
    phone: {
        type: String,
        unique: true,
        sparse: true
    },
    pin: {
        type: String,
        length: 4
    },
    isEmailVerified: {
        type: Boolean,
        default: false
    },
    isPhoneVerified: {
        type: Boolean,
        default: false
    },
    isVerified: {
        type: Boolean,
        default: false
    },
    emailOtp: {
        code: {
            type: String,
            default: null
        },
        expiresAt: {
            type: Date,
            default: null
        }
    },
    signupStartedAt: {
        type: Date,
        default: null
    }
}, { timestamps: true });

const CreditUser = mongoose.model('CreditUser', creditUserSchema);

module.exports = CreditUser;