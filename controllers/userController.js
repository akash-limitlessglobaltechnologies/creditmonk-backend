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
                name,
                email, 
                emailOtp, 
                phone, 
                phoneOtp, 
                pin
            } = req.body;

            // Step 1: Collect user information and send OTPs
            if (step === 1) {
                if (!name) {
                    return res.status(400).json({
                        success: false,
                        message: 'Name is required',
                        currentStep: 1
                    });
                }

                if (!email || !email.includes('@')) {
                    return res.status(400).json({
                        success: false,
                        message: 'Valid email is required',
                        currentStep: 1
                    });
                }

                if (!phone) {
                    return res.status(400).json({
                        success: false,
                        message: 'Phone number is required',
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

                // Check for existing phone number if not empty
                if (phone) {
                    const existingPhone = await CreditUser.findOne({
                        phone,
                        isVerified: true
                    }).exec();

                    if (existingPhone) {
                        return res.status(400).json({
                            success: false,
                            message: 'Phone number already registered',
                            currentStep: 1
                        });
                    }
                }

                // Generate email OTP
                const emailOtp = generateOTP();
                const otpExpiryTime = new Date(Date.now() + 5 * 60 * 1000);

                // Create or update user record
                const user = await CreditUser.findOneAndUpdate(
                    { email },
                    {
                        name,
                        email,
                        phone,
                        emailOtp: {
                            code: emailOtp,
                            expiresAt: otpExpiryTime
                        },
                        signupStartedAt: new Date(),
                        isEmailVerified: false,
                        isPhoneVerified: false,
                        isVerified: false
                    },
                    { upsert: true, new: true }
                ).exec();

                // Send email OTP
                await sendOTPEmail(email, emailOtp);

                // Send phone OTP via Twilio
                try {
                    await twilioClient.verify.v2
                        .services(process.env.TWILIO_SERVICE_SID)
                        .verifications.create({
                            to: phone,
                            channel: 'sms'
                        });
                } catch (twilioError) {
                    console.error('Twilio error:', twilioError);
                    return res.status(400).json({
                        success: false,
                        message: 'Failed to send phone verification code. Please check your phone number.',
                        currentStep: 1
                    });
                }

                return res.status(200).json({
                    success: true,
                    message: 'Verification codes sent to your email and phone',
                    currentStep: 2,
                    nextStep: 'Verify OTPs'
                });
            }

            // Handle OTP resend request
            if (step === 'resend-otp') {
                if (!email || !phone) {
                    return res.status(400).json({
                        success: false,
                        message: 'Email and phone are required',
                        currentStep: 2
                    });
                }

                const user = await CreditUser.findOne({ email }).exec();
                if (!user) {
                    return res.status(400).json({
                        success: false,
                        message: 'User not found',
                        currentStep: 1
                    });
                }

                // Generate new email OTP
                const emailOtp = generateOTP();
                const otpExpiryTime = new Date(Date.now() + 5 * 60 * 1000);
                
                // Update email OTP
                user.emailOtp = {
                    code: emailOtp,
                    expiresAt: otpExpiryTime
                };
                await user.save();

                // Send email OTP
                await sendOTPEmail(email, emailOtp);

                // Send phone OTP via Twilio
                try {
                    await twilioClient.verify.v2
                        .services(process.env.TWILIO_SERVICE_SID)
                        .verifications.create({
                            to: phone,
                            channel: 'sms'
                        });
                } catch (twilioError) {
                    console.error('Twilio error:', twilioError);
                    return res.status(400).json({
                        success: false,
                        message: 'Failed to resend phone verification code',
                        currentStep: 2
                    });
                }

                return res.status(200).json({
                    success: true,
                    message: 'Verification codes resent successfully',
                    currentStep: 2
                });
            }

            // Step 2: Verify both OTPs
            if (step === 2) {
                if (!email || !emailOtp || !phone || !phoneOtp) {
                    return res.status(400).json({
                        success: false,
                        message: 'Email, email OTP, phone, and phone OTP are required',
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

                // Verify email OTP
                if (user.emailOtp.code !== emailOtp) {
                    return res.status(400).json({
                        success: false,
                        message: 'Invalid email verification code',
                        currentStep: 2
                    });
                }

                if (new Date() > user.emailOtp.expiresAt) {
                    return res.status(400).json({
                        success: false,
                        message: 'Email verification code expired',
                        currentStep: 1
                    });
                }

                // Verify phone OTP with Twilio
                try {
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
                            currentStep: 2
                        });
                    }
                } catch (twilioError) {
                    console.error('Twilio verification error:', twilioError);
                    return res.status(400).json({
                        success: false,
                        message: 'Failed to verify phone code',
                        currentStep: 2
                    });
                }

                // Both OTPs verified successfully
                user.isEmailVerified = true;
                user.isPhoneVerified = true;
                await user.save();

                return res.status(200).json({
                    success: true,
                    message: 'Both verifications successful',
                    currentStep: 3,
                    nextStep: 'Set PIN'
                });
            }

            // Step 3: Set PIN (Final Step)
            if (step === 3) {
                if (!email || !pin) {
                    return res.status(400).json({
                        success: false,
                        message: 'Email and PIN required',
                        currentStep: 3
                    });
                }

                if (pin.length !== 4 || isNaN(pin)) {
                    return res.status(400).json({
                        success: false,
                        message: 'PIN must be 4 digits',
                        currentStep: 3
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
                    name: user.name,
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
                name: user.name,
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
    },

    forgetPin: async (req, res) => {
        try {
            const { identifier, step, otp, newPin } = req.body;

            if (!identifier) {
                return res.status(400).json({
                    success: false,
                    message: 'Email or phone number is required',
                    currentStep: 1
                });
            }

            const isEmail = identifier.includes('@');
            const query = isEmail ? { email: identifier } : { phone: identifier };
            query.isVerified = true;

            const user = await CreditUser.findOne(query).exec();
            if (!user) {
                return res.status(404).json({
                    success: false,
                    message: 'User not found or not verified',
                    currentStep: 1
                });
            }

            // Step 1: Send OTP
            if (!step || step === 1) {
                // Generate OTP and set expiry time
                const otp = generateOTP();
                const otpExpiryTime = new Date(Date.now() + 5 * 60 * 1000);

                if (isEmail) {
                    // Send OTP via email
                    await sendOTPEmail(user.email, otp);

                    // Update user with email OTP
                    user.emailOtp = {
                        code: otp,
                        expiresAt: otpExpiryTime
                    };
                    await user.save();

                    return res.status(200).json({
                        success: true,
                        message: 'OTP sent to your email',
                        currentStep: 2,
                        nextStep: 'Verify OTP'
                    });
                } else {
                    // Send OTP via SMS using Twilio
                    await twilioClient.verify.v2
                        .services(process.env.TWILIO_SERVICE_SID)
                        .verifications.create({
                            to: user.phone,
                            channel: 'sms'
                        });

                    return res.status(200).json({
                        success: true,
                        message: 'OTP sent to your phone',
                        currentStep: 2,
                        nextStep: 'Verify OTP'
                    });
                }
            }

            // Step 2: Verify OTP and set new PIN
            if (step === 2) {
                if (!otp) {
                    return res.status(400).json({
                        success: false,
                        message: 'OTP is required',
                        currentStep: 2
                    });
                }

                if (!newPin || newPin.length !== 4 || isNaN(newPin)) {
                    return res.status(400).json({
                        success: false,
                        message: 'New PIN must be 4 digits',
                        currentStep: 2
                    });
                }

                let otpVerified = false;

                if (isEmail) {
                    // Verify email OTP
                    if (user.emailOtp.code !== otp) {
                        return res.status(400).json({
                            success: false,
                            message: 'Invalid OTP',
                            currentStep: 2
                        });
                    }

                    if (new Date() > user.emailOtp.expiresAt) {
                        return res.status(400).json({
                            success: false,
                            message: 'OTP expired',
                            currentStep: 1
                        });
                    }

                    otpVerified = true;
                } else {
                    // Verify phone OTP with Twilio
                    const verification_check = await twilioClient.verify.v2
                        .services(process.env.TWILIO_SERVICE_SID)
                        .verificationChecks.create({
                            to: user.phone,
                            code: otp
                        });

                    if (verification_check.status !== 'approved') {
                        return res.status(400).json({
                            success: false,
                            message: 'Invalid OTP',
                            currentStep: 2
                        });
                    }

                    otpVerified = true;
                }

                if (otpVerified) {
                    // Hash and update PIN
                    const hashedPin = await bcrypt.hash(newPin, 10);
                    user.pin = hashedPin;
                    
                    // Clear any stored OTPs
                    user.emailOtp = { code: null, expiresAt: null };
                    
                    await user.save();

                    // Generate a new token with updated PIN
                    const token = generateToken(user._id, user.email, user.phone);

                    return res.status(200).json({
                        success: true,
                        message: 'PIN reset successfully',
                        token,
                        currentStep: 'completed'
                    });
                }
            }

            return res.status(400).json({
                success: false,
                message: 'Invalid step',
                currentStep: 1
            });

        } catch (error) {
            console.error('Forget PIN error:', error);
            res.status(500).json({
                success: false,
                message: 'Error in forget PIN process',
                error: error.message,
                currentStep: 1
            });
        }
    }
};

module.exports = userController;