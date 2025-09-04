// ===================================================================
// PHONE VERIFICATION ROUTES - OTP for Mobile Verification
// ===================================================================

const express = require('express');
const User = require('../models/User');
const { authenticateUser } = require('../middleware/auth');

// Twilio setup for OTP
const twilio = require('twilio');
const twilioClient = process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN 
    ? twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN) 
    : null;

const router = express.Router();

// Send OTP for phone verification
router.post('/send-otp', authenticateUser, async (req, res) => {
    try {
        console.log('🔍 Phone verification - user ID from token:', req.user.userId || req.user.id);
        const user = await User.findById(req.user.userId || req.user.id);
        
        if (!user) {
            return res.status(404).json({
                success: false,
                message: 'User not found'
            });
        }

        if (user.isPhoneVerified) {
            return res.status(400).json({
                success: false,
                message: 'Phone number is already verified'
            });
        }

        // Generate OTP
        const otp = user.generateOTP();
        await user.save();

        // Send OTP via SMS (if Twilio is configured)
        if (twilioClient) {
            try {
                await twilioClient.messages.create({
                    body: `Your Tourist Safety System verification code is: ${otp}. Valid for 10 minutes.`,
                    from: process.env.TWILIO_PHONE_NUMBER,
                    to: user.phoneNumber
                });
                
                console.log(`OTP sent to ${user.phoneNumber}: ${otp}`);
            } catch (smsError) {
                console.error('SMS sending failed:', smsError);
                // Continue anyway - OTP is still generated and can be used
                console.log(`⚠️ SMS failed, but OTP generated for ${user.phoneNumber}: ${otp}`);
            }
        } else {
            console.log(`OTP generated for ${user.phoneNumber}: ${otp} (Twilio not configured)`);
        }

        res.json({
            success: true,
            message: 'OTP sent successfully to your phone number. Check server console for OTP if SMS failed.'
        });

    } catch (error) {
        console.error('Send OTP error:', error);
        res.status(500).json({
            success: false,
            message: 'Server error'
        });
    }
});

// Verify OTP for phone verification
router.post('/verify-otp', authenticateUser, async (req, res) => {
    try {
        const { otp } = req.body;
        
        if (!otp) {
            return res.status(400).json({
                success: false,
                message: 'OTP is required'
            });
        }

        console.log('🔍 OTP verification - user ID from token:', req.user.userId || req.user.id);
        const user = await User.findById(req.user.userId || req.user.id).select('+otpCode +otpExpiry');
        
        if (!user) {
            return res.status(404).json({
                success: false,
                message: 'User not found'
            });
        }

        if (user.isPhoneVerified) {
            return res.status(400).json({
                success: false,
                message: 'Phone number is already verified'
            });
        }

        if (!user.verifyOTP(otp)) {
            return res.status(400).json({
                success: false,
                message: 'Invalid or expired OTP'
            });
        }

        // Mark phone as verified and clear OTP
        user.isPhoneVerified = true;
        user.otpCode = undefined;
        user.otpExpiry = undefined;
        await user.save();

        res.json({
            success: true,
            message: 'Phone number verified successfully'
        });

    } catch (error) {
        console.error('Verify OTP error:', error);
        res.status(500).json({
            success: false,
            message: 'Server error'
        });
    }
});

module.exports = router;
