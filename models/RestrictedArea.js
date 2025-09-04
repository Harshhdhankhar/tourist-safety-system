// ===================================================================
// RESTRICTED AREA MODEL - Custom Safety Zones
// ===================================================================
// Database model for storing user-defined restricted areas

const mongoose = require('mongoose');

const restrictedAreaSchema = new mongoose.Schema({
    name: {
        type: String,
        required: true,
        trim: true
    },
    description: {
        type: String,
        trim: true
    },
    location: {
        latitude: {
            type: Number,
            required: true,
            min: -90,
            max: 90
        },
        longitude: {
            type: Number,
            required: true,
            min: -180,
            max: 180
        }
    },
    radius: {
        type: Number,
        default: 1000, // meters
        min: 100,
        max: 50000
    },
    severity: {
        type: String,
        enum: ['low', 'medium', 'high', 'critical'],
        default: 'medium'
    },
    category: {
        type: String,
        enum: ['military', 'border', 'construction', 'natural_disaster', 'crime_hotspot', 'political_unrest', 'other'],
        default: 'other'
    },
    isActive: {
        type: Boolean,
        default: true
    },
    createdBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    validFrom: {
        type: Date,
        default: Date.now
    },
    validUntil: {
        type: Date
    },
    alertMessage: {
        type: String,
        default: 'This area is restricted for safety reasons. Please avoid entering.'
    }
}, {
    timestamps: true
});

// Index for efficient geospatial queries
restrictedAreaSchema.index({ "location": "2dsphere" });
restrictedAreaSchema.index({ isActive: 1, validFrom: 1, validUntil: 1 });
restrictedAreaSchema.index({ createdBy: 1 });

module.exports = mongoose.model('RestrictedArea', restrictedAreaSchema);
