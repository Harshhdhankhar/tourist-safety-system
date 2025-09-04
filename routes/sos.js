// ===================================================================
// SOS ROUTES - Emergency Alert System
// ===================================================================
// Handle emergency SOS alerts and notifications

const express = require('express');
const router = express.Router();
const { authenticateUser } = require('../middleware/auth');
const SOSLog = require('../models/SOSLog');
const twilio = require('twilio');

// Initialize Twilio client
const client = twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);

// Trigger SOS Alert
router.post('/trigger', authenticateUser, async (req, res) => {
    try {
        const { location, timestamp, userInfo } = req.body;
        const user = req.user;

        console.log('🚨 SOS Alert received from user:', user.username);
        console.log('📱 User phone number:', user.phoneNumber);
        console.log('🆘 Emergency contact:', user.emergencyContact);

        // Create SOS log entry
        const sosLog = new SOSLog({
            userId: user._id,
            userInfo: {
                fullName: user.fullName,
                email: user.email,
                phoneNumber: user.phoneNumber,
                touristType: user.touristType,
                username: user.username
            },
            location: location || null,
            timestamp: timestamp || new Date(),
            status: 'active',
            alertType: 'emergency',
            emergencyContacts: user.emergencyContact ? [user.emergencyContact] : []
        });

        await sosLog.save();

        // Send SMS alerts using Twilio
        await sendSOSAlerts(user, location, sosLog._id);

        console.log('✅ SOS Alert logged and SMS sent successfully:', sosLog._id);

        res.json({
            success: true,
            message: 'Emergency alert sent successfully',
            alertId: sosLog._id,
            timestamp: sosLog.timestamp
        });

    } catch (error) {
        console.error('SOS Alert error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to send emergency alert'
        });
    }
});

// Get SOS history for user
router.get('/history', authenticateUser, async (req, res) => {
    try {
        const sosLogs = await SOSLog.find({ userId: req.user._id })
            .sort({ timestamp: -1 })
            .limit(10);

        res.json({
            success: true,
            alerts: sosLogs
        });

    } catch (error) {
        console.error('SOS History error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to retrieve SOS history'
        });
    }
});

// Test SMS route (no auth for testing)
router.post('/test-sms', async (req, res) => {
    try {
        const { phoneNumber } = req.body;
        
        // Mock user for testing
        const user = {
            username: 'testuser',
            phoneNumber: phoneNumber || '+919876543210'
        };
        
        console.log('🧪 Testing SMS to:', phoneNumber);
        console.log('👤 User data:', {
            username: user.username,
            phoneNumber: user.phoneNumber,
            emergencyContact: user.emergencyContact
        });
        
        // Format phone number
        function formatPhoneNumber(phone) {
            if (!phone) return null;
            let cleaned = phone.replace(/\D/g, '');
            if (cleaned.length === 10) {
                cleaned = '91' + cleaned;
            }
            if (!cleaned.startsWith('+')) {
                cleaned = '+' + cleaned;
            }
            return cleaned;
        }
        
        const testPhone = formatPhoneNumber(phoneNumber || user.phoneNumber);
        console.log('📱 Formatted test phone:', testPhone);
        
        const currentTime = new Date().toLocaleTimeString('en-IN', { 
            timeZone: 'Asia/Kolkata',
            hour12: true,
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit'
        });

        const testMessage = await client.messages.create({
            body: `🚨 EMERGENCY ALERT 🚨
Location: GPS unavailable
Time: ${currentTime}
Please call back immediately!`,
            from: process.env.TWILIO_PHONE_NUMBER,
            to: testPhone
        });
        
        console.log('✅ Test SMS sent successfully. SID:', testMessage.sid);
        
        res.json({
            success: true,
            message: 'Test SMS sent successfully',
            sid: testMessage.sid,
            to: testPhone
        });
        
    } catch (error) {
        console.error('❌ Test SMS failed:', error);
        res.status(500).json({
            success: false,
            message: 'Test SMS failed',
            error: error.message
        });
    }
});

// Function to send SOS alerts via SMS
async function sendSOSAlerts(user, location, alertId) {
    try {
        const currentTime = new Date().toLocaleTimeString('en-IN', { 
            timeZone: 'Asia/Kolkata',
            hour12: true,
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit'
        });

        const baseMessage = location 
            ? `🚨 EMERGENCY ALERT 🚨
Location: https://maps.google.com/maps?q=${location.latitude},${location.longitude}
Time: ${currentTime}
Please call back immediately!`
            : `🚨 EMERGENCY ALERT 🚨
Location: GPS unavailable
Time: ${currentTime}
Please call back immediately!`;
        
        console.log('📧 Base emergency message content:', baseMessage);
        console.log('📞 Twilio from number:', process.env.TWILIO_PHONE_NUMBER);
        
        // Format phone numbers to E.164 format
        function formatPhoneNumber(phone) {
            if (!phone) return null;
            // Remove all non-digits
            let cleaned = phone.replace(/\D/g, '');
            // Add +91 if it's an Indian number without country code
            if (cleaned.length === 10) {
                cleaned = '91' + cleaned;
            }
            // Add + if not present
            if (!cleaned.startsWith('+')) {
                cleaned = '+' + cleaned;
            }
            return cleaned;
        }
        
        // Function to send triple SMS with 2 second intervals
        async function sendTripleSMS(phoneNumber, messageType) {
            console.log(`📱 Sending triple SMS to ${phoneNumber} (${messageType})`);
            
            for (let i = 0; i < 3; i++) {
                try {
                    const result = await client.messages.create({
                        body: baseMessage,
                        from: process.env.TWILIO_PHONE_NUMBER,
                        to: phoneNumber
                    });
                    console.log(`✅ ${messageType} SMS ${i + 1}/3 sent successfully. SID:`, result.sid);
                    
                    // Wait 2 seconds before sending next message (except for the last one)
                    if (i < 2) {
                        await new Promise(resolve => setTimeout(resolve, 2000));
                    }
                } catch (error) {
                    console.log(`⚠️ ${messageType} SMS ${i + 1}/3 failed:`, error.message);
                }
            }
        }

        // Send all SMS messages in parallel for fastest delivery
        const smsPromises = [];
        
        // Send to dummy police number
        const policeNumber = '+919876543210';
        smsPromises.push(sendTripleSMS(policeNumber, 'Police'));
        
        // Send to user's emergency contacts
        if (user.emergencyContact && user.emergencyContact.phoneNumber) {
            const emergencyPhone = formatPhoneNumber(user.emergencyContact.phoneNumber);
            console.log('📱 Formatted emergency contact:', emergencyPhone);
            smsPromises.push(sendTripleSMS(emergencyPhone, 'Emergency Contact'));
        }
        
        // Send confirmation to user
        if (user.phoneNumber) {
            const userPhone = formatPhoneNumber(user.phoneNumber);
            console.log('📱 Formatted user phone:', userPhone);
            smsPromises.push(sendTripleSMS(userPhone, 'User Confirmation'));
        } else {
            console.log('⚠️ No user phone number found');
        }
        
        // Execute all SMS sends simultaneously
        await Promise.all(smsPromises);
        console.log('🚀 All SMS messages sent in parallel');
        
    } catch (error) {
        console.error('❌ SMS Alert system error:', error);
    }
}

module.exports = router;
