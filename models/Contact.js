// ===================================================================
// CONTACT MODEL - Emergency Contact Schema
// ===================================================================

const mongoose = require('mongoose');

const contactSchema = new mongoose.Schema({
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    name: {
        type: String,
        required: true,
        trim: true
    },
    phoneNumber: {
        type: String,
        required: true,
        trim: true
    },
    relationship: {
        type: String,
        trim: true
    },
    email: {
        type: String,
        trim: true,
        lowercase: true
    },
    isPrimary: {
        type: Boolean,
        default: false
    },
    isActive: {
        type: Boolean,
        default: true
    }
}, {
    timestamps: true
});

// Index for faster queries
contactSchema.index({ userId: 1, isActive: 1 });

module.exports = mongoose.model('Contact', contactSchema);
