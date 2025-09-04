// ===================================================================
// SOS LOG MODEL - Emergency Alert Records
// ===================================================================
// Database model for storing SOS emergency alerts and logs

const mongoose = require('mongoose');

const sosLogSchema = new mongoose.Schema({
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    userInfo: {
        fullName: { type: String, required: true },
        email: { type: String, required: true },
        phoneNumber: { type: String },
        touristType: { type: String, enum: ['indian', 'foreign'] },
        username: { type: String }
    },
    location: {
        latitude: { type: Number },
        longitude: { type: Number },
        accuracy: { type: Number }
    },
    timestamp: {
        type: Date,
        default: Date.now,
        required: true
    },
    status: {
        type: String,
        enum: ['active', 'resolved', 'cancelled'],
        default: 'active'
    },
    alertType: {
        type: String,
        enum: ['emergency', 'medical', 'security', 'natural_disaster'],
        default: 'emergency'
    },
    emergencyContacts: [{
        name: String,
        phone: String,
        relationship: String
    }],
    responseTime: {
        type: Date
    },
    resolvedBy: {
        type: String
    },
    notes: {
        type: String
    }
}, {
    timestamps: true
});

// Index for efficient queries
sosLogSchema.index({ userId: 1, timestamp: -1 });
sosLogSchema.index({ status: 1 });
sosLogSchema.index({ timestamp: -1 });

module.exports = mongoose.model('SOSLog', sosLogSchema);
