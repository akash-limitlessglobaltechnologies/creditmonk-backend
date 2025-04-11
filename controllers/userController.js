// controllers/userController.js
const CreditUser = require('../models/creditUser');
const nodemailer = require('nodemailer');
const bcrypt = require('bcrypt');
const CreditCard = require('../models/creditCard');
const jwt = require('jsonwebtoken');
const twilio = require('twilio');

// Twilio configuration
const twilioClient = twilio(
    process.env.TWILIO_ACCOUNT_SID,
    process.env.TWILIO_AUTH_TOKEN
);

// Configure nodemailer
const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS
    }
});

// Generate JWT Token
const generateToken = (userId, email, phone) => {
    return jwt.sign(
        { userId, email, phone },
        process.env.JWT_SECRET,
        { expiresIn: '24h' }
    );
};

// Generate OTP
const generateOTP = () => {
    return Math.floor(100000 + Math.random() * 900000).toString();
};

// Send OTP Email
const sendOTPEmail = async (email, otp) => {
    try {
        await transporter.sendMail({
            from: process.env.EMAIL_USER,
            to: email,
            subject: 'Your OTP for Credit Card System',
            text: `Your Email verification OTP is: ${otp}. This OTP will expire in 5 minutes.`
        });
    } catch (error) {
        throw new Error('Failed to send email OTP');
    }
};

const userController = {
    signup: async (req, res) => {
        try {
            const { 
                step, 
                email, 
                emailOtp, 
                phone, 
                phoneOtp, 
                pin
            } = req.body;

            // Step 1: Initialize signup with email
            if (step === 1) {
                if (!email || !email.includes('@')) {
                    return res.status(400).json({
                        success: false,
                        message: 'Valid email is required',
                        currentStep: 1
                    });
                }

                const existingUser = await CreditUser.findOne({ 
                    email, 
                    isVerified: true 
                }).exec();

                if (existingUser) {
                    return res.status(400).json({
                        success: false,
                        message: 'User already exists',
                        currentStep: 1
                    });
                }

                const otp = generateOTP();
                const otpExpiryTime = new Date(Date.now() + 5 * 60 * 1000);

                await CreditUser.findOneAndUpdate(
                    { email },
                    {
                        email,
                        emailOtp: {
                            code: otp,
                            expiresAt: otpExpiryTime
                        },
                        signupStartedAt: new Date(),
                        isEmailVerified: false,
                        isPhoneVerified: false,
                        isVerified: false
                    },
                    { upsert: true, new: true }
                ).exec();

                await sendOTPEmail(email, otp);

                return res.status(200).json({
                    success: true,
                    message: 'Email OTP sent successfully',
                    currentStep: 2,
                    nextStep: 'Verify email OTP'
                });
            }

            // Step 2: Verify Email OTP
            if (step === 2) {
                if (!email || !emailOtp) {
                    return res.status(400).json({
                        success: false,
                        message: 'Email and OTP required',
                        currentStep: 2
                    });
                }

                const user = await CreditUser.findOne({ email }).exec();
                if (!user) {
                    return res.status(400).json({
                        success: false,
                        message: 'Please start signup process again',
                        currentStep: 1
                    });
                }

                if (user.emailOtp.code !== emailOtp) {
                    return res.status(400).json({
                        success: false,
                        message: 'Invalid email OTP',
                        currentStep: 2
                    });
                }

                if (new Date() > user.emailOtp.expiresAt) {
                    return res.status(400).json({
                        success: false,
                        message: 'Email OTP expired',
                        currentStep: 1
                    });
                }

                user.isEmailVerified = true;
                await user.save();

                return res.status(200).json({
                    success: true,
                    message: 'Email verified successfully',
                    currentStep: 3,
                    nextStep: 'Submit phone number'
                });
            }

            // Step 3: Submit Phone Number
            if (step === 3) {
                if (!email || !phone) {
                    return res.status(400).json({
                        success: false,
                        message: 'Email and phone number required',
                        currentStep: 3
                    });
                }

                const user = await CreditUser.findOne({ 
                    email, 
                    isEmailVerified: true 
                }).exec();

                if (!user) {
                    return res.status(400).json({
                        success: false,
                        message: 'Please verify email first',
                        currentStep: 1
                    });
                }

                // Send verification code via Twilio
                await twilioClient.verify.v2
                    .services(process.env.TWILIO_SERVICE_SID)
                    .verifications.create({
                        to: phone,
                        channel: 'sms'
                    });

                user.phone = phone;
                await user.save();

                return res.status(200).json({
                    success: true,
                    message: 'Phone verification code sent',
                    currentStep: 4,
                    nextStep: 'Verify phone OTP'
                });
            }

            // Step 4: Verify Phone OTP
            if (step === 4) {
                if (!email || !phone || !phoneOtp) {
                    return res.status(400).json({
                        success: false,
                        message: 'Email, phone and OTP required',
                        currentStep: 4
                    });
                }

                const user = await CreditUser.findOne({ 
                    email, 
                    phone, 
                    isEmailVerified: true 
                }).exec();

                if (!user) {
                    return res.status(400).json({
                        success: false,
                        message: 'Please complete previous steps first',
                        currentStep: 1
                    });
                }

                // Verify phone OTP with Twilio
                const verification_check = await twilioClient.verify.v2
                    .services(process.env.TWILIO_SERVICE_SID)
                    .verificationChecks.create({
                        to: phone,
                        code: phoneOtp
                    });

                if (verification_check.status !== 'approved') {
                    return res.status(400).json({
                        success: false,
                        message: 'Invalid phone verification code',
                        currentStep: 4
                    });
                }

                user.isPhoneVerified = true;
                await user.save();

                return res.status(200).json({
                    success: true,
                    message: 'Phone verified successfully',
                    currentStep: 5,
                    nextStep: 'Set PIN'
                });
            }

            // Step 5: Set PIN (Final Step)
            if (step === 5) {
                if (!email || !pin) {
                    return res.status(400).json({
                        success: false,
                        message: 'Email and PIN required',
                        currentStep: 5
                    });
                }

                if (pin.length !== 4 || isNaN(pin)) {
                    return res.status(400).json({
                        success: false,
                        message: 'PIN must be 4 digits',
                        currentStep: 5
                    });
                }

                const user = await CreditUser.findOne({ 
                    email, 
                    isEmailVerified: true,
                    isPhoneVerified: true
                }).exec();

                if (!user) {
                    return res.status(400).json({
                        success: false,
                        message: 'Please complete verification steps first',
                        currentStep: 1
                    });
                }

                // Check if 5 minutes have passed since signup started
                const timeSinceStart = new Date() - user.signupStartedAt;
                if (timeSinceStart > 5 * 60 * 1000) {
                    // Reset verification status if session expired
                    user.isEmailVerified = false;
                    user.isPhoneVerified = false;
                    user.emailOtp = { code: null, expiresAt: null };
                    await user.save();

                    return res.status(400).json({
                        success: false,
                        message: 'Signup session expired. Please start over',
                        currentStep: 1
                    });
                }

                const hashedPin = await bcrypt.hash(pin, 10);
                user.pin = hashedPin;
                user.isVerified = true;
                user.emailOtp = { code: null, expiresAt: null };
                await user.save();

                const token = generateToken(user._id, email, user.phone);

                return res.status(200).json({
                    success: true,
                    message: 'Account created successfully',
                    email: user.email,
                    phone: user.phone,
                    token,
                    currentStep: 'completed'
                });
            }

            return res.status(400).json({
                success: false,
                message: 'Invalid step',
                currentStep: 1
            });

        } catch (error) {
            console.error('Signup error:', error);
            res.status(500).json({
                success: false,
                message: 'Error in signup process',
                error: error.message,
                currentStep: 1
            });
        }
    },

    // Login with email/phone and PIN
    login: async (req, res) => {
        try {
            const { identifier, pin } = req.body;

            if (!identifier || !pin) {
                return res.status(400).json({
                    success: false,
                    message: 'Identifier (email or phone) and PIN are required'
                });
            }

            const isEmail = identifier.includes('@');
            const query = isEmail ? { email: identifier } : { phone: identifier };
            query.isVerified = true;

            const user = await CreditUser.findOne(query).exec();
            if (!user) {
                return res.status(404).json({
                    success: false,
                    message: 'User not found or not verified'
                });
            }

            const isValidPin = await bcrypt.compare(pin, user.pin);
            if (!isValidPin) {
                return res.status(401).json({
                    success: false,
                    message: 'Invalid PIN'
                });
            }

            const token = generateToken(user._id, user.email, user.phone);

            res.status(200).json({
                success: true,
                message: 'Login successful',
                email: user.email,
                phone: user.phone,
                token
            });
        } catch (error) {
            console.error('Login error:', error);
            res.status(500).json({
                success: false,
                message: 'Error in login process',
                error: error.message
            });
        }
    },
    // Add this method to the userController object in controllers/userController.js

deleteAccount: async (req, res) => {
    console.log('Delete account request received');
    console.log('User in request:', req.user);
    try {
        const userId = req.user.userId;
        
        if (!userId) {
            return res.status(400).json({
                success: false,
                message: 'User ID is required'
            });
        }

        // Find the user
        const user = await CreditUser.findById(userId);
        if (!user) {
            return res.status(404).json({
                success: false,
                message: 'User not found'
            });
        }

        // Delete all associated cards
        await CreditCard.deleteMany({ userId });

        // Delete the user
        await CreditUser.findByIdAndDelete(userId);

        res.status(200).json({
            success: true,
            message: 'Account deleted successfully'
        });
    } catch (error) {
        console.error('Delete account error:', error);
        res.status(500).json({
            success: false,
            message: 'Error deleting account',
            error: error.message
        });
    }
}
};

module.exports = userController;