// ===================================================================
// AUTHENTICATION ROUTES - Registration & Login
// ===================================================================
// Secure user registration and login endpoints

const express = require('express');
const { body, validationResult } = require('express-validator');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const User = require('../models/User');
const { authenticateUser, generateToken } = require('../middleware/auth');

// Twilio setup for OTP
const twilio = require('twilio');
const twilioClient = process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN 
    ? twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN) 
    : null;

// Twilio Verify Service SID
const VERIFY_SERVICE_SID = process.env.TWILIO_VERIFY_SERVICE_SID;

// Debug environment variables
console.log('🔧 Twilio Configuration:');
console.log('Account SID:', process.env.TWILIO_ACCOUNT_SID ? 'Set' : 'Missing');
console.log('Auth Token:', process.env.TWILIO_AUTH_TOKEN ? 'Set' : 'Missing');
console.log('Verify Service SID:', process.env.TWILIO_VERIFY_SERVICE_SID || 'Missing');

const router = express.Router();

// Multer configuration for file uploads
const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        cb(null, 'public/uploads/')
    },
    filename: function (req, file, cb) {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname));
    }
});

const upload = multer({ 
    storage: storage,
    limits: {
        fileSize: parseInt(process.env.MAX_FILE_SIZE) || 5 * 1024 * 1024 // 5MB
    },
    fileFilter: (req, file, cb) => {
        const allowedTypes = /jpeg|jpg|png|pdf/;
        const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
        const mimetype = allowedTypes.test(file.mimetype);
        
        if (mimetype && extname) {
            return cb(null, true);
        } else {
            cb(new Error('Only images (JPEG, PNG) and PDF files are allowed'));
        }
    }
}).single('document');

// Validation rules
const registrationValidation = [
    body('fullName').trim().isLength({ min: 1 }).withMessage('Full name is required'),
    body('email').isEmail().withMessage('Please enter a valid email'),
    body('username').isLength({ min: 3 }).withMessage('Username must be at least 3 characters'),
    body('gender').notEmpty().withMessage('Please select gender'),
    body('password').isLength({ min: 4 }).withMessage('Password must be at least 4 characters'),
    body('phoneNumber').isLength({ min: 10 }).withMessage('Please enter a valid phone number'),
    body('documentNumber').isLength({ min: 1 }).withMessage('Document number is required')
];

const loginValidation = [
    body('identifier').notEmpty().withMessage('Email or username is required'),
    body('password').notEmpty().withMessage('Password is required')
];

// ===================================================================
// REGISTRATION ENDPOINTS
// ===================================================================

// Register Indian Tourist
router.post('/register/indian', upload, async (req, res) => {
    try {
        console.log('Registration request body:', req.body);
        console.log('Registration request file:', req.file);
        
        // Simple validation
        const { fullName, email, username, gender, password, phoneNumber, documentNumber } = req.body;
        
        if (!fullName || !email || !username || !password || !phoneNumber || !documentNumber) {
            return res.status(400).json({
                success: false,
                message: 'All fields are required',
                missing: {
                    fullName: !fullName,
                    email: !email,
                    username: !username,
                    password: !password,
                    phoneNumber: !phoneNumber,
                    documentNumber: !documentNumber
                }
            });
        }

        // Check if user already exists
        const existingUser = await User.findOne({
            $or: [{ email }, { username }, { phoneNumber }]
        });

        if (existingUser) {
            return res.status(400).json({
                success: false,
                message: 'User already exists with this email, username, or phone number'
            });
        }

        // Validate Aadhar number format
        if (!/^\d{12}$/.test(documentNumber.replace(/\s/g, ''))) {
            return res.status(400).json({
                success: false,
                message: 'Invalid Aadhar number format'
            });
        }

        // Format phone number with +91 for storage
        const formattedPhoneNumber = phoneNumber.startsWith('+') ? phoneNumber : '+91' + phoneNumber;
        
        // Create user
        const user = new User({
            fullName,
            email,
            username,
            gender,
            password,
            phoneNumber: formattedPhoneNumber,
            touristType: 'indian',
            documentType: 'aadhar',
            documentNumber: documentNumber.replace(/\s/g, ''),
            documentFile: req.file ? {
                filename: req.file.filename,
                originalName: req.file.originalname,
                mimetype: req.file.mimetype,
                size: req.file.size
            } : null
        });

        await user.save();

        console.log(`User registered successfully: ${user.email}`);

        // Generate JWT token for immediate login
        const token = generateToken({
            userId: user._id,
            username: user.username,
            email: user.email
        });
        
        console.log('🔑 Generated token for user:', user._id, 'Token preview:', token.substring(0, 20) + '...');

        res.status(201).json({
            success: true,
            message: 'Registration successful! Welcome to Tourist Safety System.',
            token: token,
            user: {
                id: user._id,
                fullName: user.fullName,
                email: user.email,
                username: user.username,
                phoneNumber: user.phoneNumber
            }
        });

    } catch (error) {
        console.error('Registration error:', error);
        res.status(500).json({
            success: false,
            message: 'Registration failed. Please try again.'
        });
    }
});

// Register Foreign Tourist
router.post('/register/foreign', upload, registrationValidation, async (req, res) => {
    try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({
                success: false,
                message: 'Validation failed',
                errors: errors.array()
            });
        }

        const { fullName, email, username, gender, password, phoneNumber, documentNumber, nationality, visaNumber } = req.body;

        // Check if user already exists
        const existingUser = await User.findOne({
            $or: [{ email }, { username }, { phoneNumber }]
        });

        if (existingUser) {
            return res.status(400).json({
                success: false,
                message: 'User already exists with this email, username, or phone number'
            });
        }

        // Validate passport number format
        if (!/^[A-Z0-9]{6,9}$/i.test(documentNumber)) {
            return res.status(400).json({
                success: false,
                message: 'Invalid passport number format'
            });
        }

        // Format phone number with +91 for storage (can be enhanced for other countries)
        const formattedPhoneNumber = phoneNumber.startsWith('+') ? phoneNumber : '+91' + phoneNumber;
        
        // Create user
        const user = new User({
            fullName,
            email,
            username,
            gender,
            password,
            phoneNumber: formattedPhoneNumber,
            touristType: 'foreign',
            documentType: 'passport',
            documentNumber: documentNumber.toUpperCase(),
            nationality,
            visaNumber,
            documentFile: req.file ? {
                filename: req.file.filename,
                originalName: req.file.originalname,
                mimetype: req.file.mimetype,
                size: req.file.size
            } : null
        });

        // Generate and save OTP
        const otp = user.generateOTP();
        await user.save();

        // Send OTP via SMS
        if (twilioClient) {
            try {
                await twilioClient.messages.create({
                    body: `Your Tourist Safety System verification code is: ${otp}. Valid for 10 minutes.`,
                    from: process.env.TWILIO_PHONE_NUMBER,
                    to: formattedPhoneNumber
                });
            } catch (smsError) {
                console.error('SMS sending failed:', smsError);
            }
        }

        res.status(201).json({
            success: true,
            message: 'Registration successful. Please verify your phone number with the OTP sent.',
            userId: user._id,
            requiresOTPVerification: true
        });

    } catch (error) {
        console.error('Registration error:', error);
        res.status(500).json({
            success: false,
            message: 'Registration failed. Please try again.'
        });
    }
});

// ===================================================================
// OTP VERIFICATION
// ===================================================================

// OTP verification removed - users are auto-verified

// Resend OTP removed - no longer needed

// Check username availability
router.post('/check-username', [
    body('username').isLength({ min: 3, max: 30 }).withMessage('Username must be 3-30 characters')
], async (req, res) => {
    try {
        const { username } = req.body;
        
        const existingUser = await User.findOne({ username: username.toLowerCase() });
        
        res.json({
            success: true,
            available: !existingUser,
            message: existingUser ? 'Username already taken' : 'Username available'
        });
        
    } catch (error) {
        console.error('Username check error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to check username availability'
        });
    }
});

// ===================================================================
// LOGIN ENDPOINTS
// ===================================================================

// Login with email/username and password
router.post('/login', loginValidation, async (req, res) => {
    const loginStart = Date.now();
    console.log('🚀 Login request received');
    
    try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({
                success: false,
                message: 'Validation failed',
                errors: errors.array()
            });
        }

        const { identifier, password } = req.body;
        console.log(`👤 Login attempt for: ${identifier}`);

        // Find user by email or username with timing
        console.log('🔍 Starting user lookup...');
        const userLookupStart = Date.now();
        const user = await User.findOne({
            $or: [{ email: identifier }, { username: identifier }],
            isActive: true
        });
        console.log(`🔍 User lookup took ${Date.now() - userLookupStart}ms`);

        if (!user) {
            return res.status(401).json({
                success: false,
                message: 'Invalid credentials'
            });
        }

        // Check if account is locked
        if (user.isLocked) {
            return res.status(423).json({
                success: false,
                message: 'Account is temporarily locked due to multiple failed login attempts'
            });
        }

        // Verify password with timing log
        console.log('🔐 Starting password verification...');
        const startTime = Date.now();
        const isPasswordValid = await user.comparePassword(password);
        const endTime = Date.now();
        console.log(`🔐 Password verification took ${endTime - startTime}ms`);
        
        if (!isPasswordValid) {
            await user.incLoginAttempts();
            return res.status(401).json({
                success: false,
                message: 'Invalid credentials'
            });
        }

        // Generate JWT token immediately
        console.log('🔑 Generating JWT token...');
        const tokenStart = Date.now();
        const token = generateToken({
            userId: user._id,
            username: user.username,
            email: user.email
        });
        console.log(`🔑 Token generation took ${Date.now() - tokenStart}ms`);

        // Send response immediately
        const totalTime = Date.now() - loginStart;
        console.log(`✅ Total login time: ${totalTime}ms`);
        
        res.json({
            success: true,
            message: 'Login successful',
            token,
            user: {
                id: user._id,
                fullName: user.fullName,
                email: user.email,
                username: user.username,
                touristType: user.touristType,
                isPhoneVerified: user.isPhoneVerified,
                verificationStatus: user.verificationStatus
            }
        });

        // Update user data asynchronously (don't wait)
        setImmediate(async () => {
            try {
                await user.resetLoginAttempts();
                user.lastLogin = new Date();
                await user.save();
                console.log('📝 User data updated asynchronously');
            } catch (error) {
                console.error('Error updating user data:', error);
            }
        });

    } catch (error) {
        console.error('Login error:', error);
        res.status(500).json({
            success: false,
            message: 'Login failed'
        });
    }
});

// Removed OTP login - simplified to password-only authentication

// Verify OTP for login
router.post('/login/verify-otp', [
    body('userId').isMongoId().withMessage('Invalid user ID'),
    body('otp').isLength({ min: 6, max: 6 }).isNumeric().withMessage('OTP must be 6 digits')
], async (req, res) => {
    try {
        const { userId, otp } = req.body;

        const user = await User.findById(userId).select('+otpCode +otpExpiry');
        if (!user || !user.isActive) {
            return res.status(404).json({
                success: false,
                message: 'User not found'
            });
        }

        if (!user.verifyOTP(otp)) {
            return res.status(400).json({
                success: false,
                message: 'Invalid or expired OTP'
            });
        }

        // Clear OTP and update last login
        user.otpCode = undefined;
        user.otpExpiry = undefined;
        user.lastLogin = new Date();
        await user.save();

        // Generate JWT token
        const token = generateToken(user._id);

        res.json({
            success: true,
            message: 'Login successful',
            token,
            user: {
                id: user._id,
                fullName: user.fullName,
                email: user.email,
                username: user.username,
                touristType: user.touristType,
                isPhoneVerified: user.isPhoneVerified,
                verificationStatus: user.verificationStatus
            }
        });

    } catch (error) {
        console.error('OTP login verification error:', error);
        res.status(500).json({
            success: false,
            message: 'Login verification failed'
        });
    }
});

// Get current user profile
router.get('/profile', authenticateUser, async (req, res) => {
    res.json({
        success: true,
        user: {
            id: req.user._id,
            fullName: req.user.fullName,
            email: req.user.email,
            username: req.user.username,
            gender: req.user.gender,
            touristType: req.user.touristType,
            phoneNumber: req.user.phoneNumber,
            isPhoneVerified: req.user.isPhoneVerified,
            documentType: req.user.documentType,
            documentNumber: req.user.documentNumber,
            verificationStatus: req.user.verificationStatus,
            nationality: req.user.nationality,
            visaNumber: req.user.visaNumber,
            emergencyContact: req.user.emergencyContact,
            createdAt: req.user.createdAt
        }
    });
});

// Verify phone number with OTP (for existing users)
// Verify phone number using Twilio Verify API
router.post('/verify-phone', [
    body('otp').isLength({ min: 4, max: 10 }).isAlphanumeric().withMessage('Invalid OTP format')
], authenticateUser, async (req, res) => {
    try {
        const { otp } = req.body;
        const user = req.user;

        if (user.isPhoneVerified) {
            return res.status(400).json({
                success: false,
                message: 'Phone number is already verified'
            });
        }

        if (!twilioClient || !VERIFY_SERVICE_SID) {
            return res.status(500).json({
                success: false,
                message: 'SMS service not configured. Please contact support.'
            });
        }

        try {
            // Verify OTP using Twilio Verify API
            const verificationCheck = await twilioClient.verify.v2
                .services(VERIFY_SERVICE_SID)
                .verificationChecks
                .create({
                    to: user.phoneNumber,
                    code: otp
                });

            console.log(`🔍 Twilio Verify Check:`);
            console.log(`Phone: ${user.phoneNumber}`);
            console.log(`Entered OTP: ${otp}`);
            console.log(`Verification Status: ${verificationCheck.status}`);
            console.log(`Valid: ${verificationCheck.valid}`);

            if (verificationCheck.status === 'approved' && verificationCheck.valid) {
                // Mark phone as verified
                user.isPhoneVerified = true;
                // Clear any manual OTP fields (cleanup)
                user.otpCode = undefined;
                user.otpExpiry = undefined;
                await user.save();

                res.json({
                    success: true,
                    message: 'Phone number verified successfully',
                    user: {
                        id: user._id,
                        isPhoneVerified: user.isPhoneVerified
                    }
                });
            } else {
                res.status(400).json({
                    success: false,
                    message: 'Invalid or expired OTP',
                    status: verificationCheck.status
                });
            }

        } catch (twilioError) {
            console.error('Twilio Verify Check Error:', twilioError);
            
            // Handle specific Twilio verification errors
            let errorMessage = 'Invalid or expired OTP';
            if (twilioError.code === 60202) {
                errorMessage = 'Maximum verification attempts reached. Please request a new OTP.';
            } else if (twilioError.code === 60203) {
                errorMessage = 'Phone number verification failed';
            } else if (twilioError.code === 60200) {
                errorMessage = 'Invalid phone number';
            }

            res.status(400).json({
                success: false,
                message: errorMessage,
                twilioError: process.env.NODE_ENV === 'development' ? twilioError.message : undefined
            });
        }

    } catch (error) {
        console.error('Phone verification error:', error);
        res.status(500).json({
            success: false,
            message: 'Phone verification failed'
        });
    }
});

// Send OTP for phone verification (for existing users)
router.post('/send-verification-otp', authenticateUser, async (req, res) => {
    try {
        const user = req.user;

        if (user.isPhoneVerified) {
            return res.status(400).json({
                success: false,
                message: 'Phone number is already verified'
            });
        }

        if (!twilioClient || !VERIFY_SERVICE_SID) {
            return res.status(500).json({
                success: false,
                message: 'SMS service not configured. Please contact support.'
            });
        }

        try {
            // Send OTP using Twilio Verify API
            const verification = await twilioClient.verify.v2
                .services(VERIFY_SERVICE_SID)
                .verifications
                .create({
                    to: user.phoneNumber,
                    channel: 'sms'
                });

            console.log(`📱 OTP sent to ${user.phoneNumber} via Twilio Verify`);
            console.log(`Verification Status: ${verification.status}`);

            res.json({
                success: true,
                message: 'OTP sent successfully to your phone number',
                status: verification.status
            });

        } catch (twilioError) {
            console.error('Twilio Verify Error:', twilioError);
            
            // Handle specific Twilio errors
            let errorMessage = 'Failed to send OTP';
            if (twilioError.code === 60200) {
                errorMessage = 'Invalid phone number format';
            } else if (twilioError.code === 60203) {
                errorMessage = 'Phone number is not verified in Twilio (trial account limitation)';
            } else if (twilioError.code === 60212) {
                errorMessage = 'Too many verification attempts. Please try again later.';
            }

            res.status(400).json({
                success: false,
                message: errorMessage,
                twilioError: process.env.NODE_ENV === 'development' ? twilioError.message : undefined
            });
        }

    } catch (error) {
        console.error('Send OTP error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to send OTP'
        });
    }
});

// Handle upload errors
function handleUploadError(error, req, res, next) {
    if (error instanceof multer.MulterError) {
        if (error.code === 'LIMIT_FILE_SIZE') {
            return res.status(400).json({
                success: false,
                message: 'File too large. Maximum size is 5MB.'
            });
        }
    }
    
    if (error.message.includes('Only images')) {
        return res.status(400).json({
            success: false,
            message: error.message
        });
    }
    
    next(error);
}

router.use(handleUploadError);

module.exports = router;
