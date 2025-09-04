// ===================================================================
// AREAS API ROUTES - Manage Safe and Restricted Areas
// ===================================================================

const express = require('express');
const router = express.Router();
const RestrictedArea = require('../models/RestrictedArea');
const { authenticateUser } = require('../middleware/auth');

// ===================================================================
// GET ALL RESTRICTED AREAS
// ===================================================================
router.get('/restricted', async (req, res) => {
    try {
        const areas = await RestrictedArea.find({ 
            isActive: true,
            $or: [
                { validUntil: { $exists: false } },
                { validUntil: { $gte: new Date() } }
            ]
        }).select('-createdBy');
        
        res.json({
            success: true,
            areas: areas
        });
    } catch (error) {
        console.error('Error fetching restricted areas:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch restricted areas'
        });
    }
});

// ===================================================================
// ADD NEW RESTRICTED AREA (Admin/User)
// ===================================================================
router.post('/restricted', authenticateUser, async (req, res) => {
    try {
        const {
            name,
            description,
            latitude,
            longitude,
            radius,
            severity,
            category,
            validUntil,
            alertMessage
        } = req.body;

        // Validate required fields
        if (!name || !latitude || !longitude) {
            return res.status(400).json({
                success: false,
                message: 'Name, latitude, and longitude are required'
            });
        }

        // Validate coordinates
        if (latitude < -90 || latitude > 90 || longitude < -180 || longitude > 180) {
            return res.status(400).json({
                success: false,
                message: 'Invalid coordinates'
            });
        }

        const newArea = new RestrictedArea({
            name,
            description,
            location: {
                latitude: parseFloat(latitude),
                longitude: parseFloat(longitude)
            },
            radius: radius || 1000,
            severity: severity || 'medium',
            category: category || 'other',
            validUntil: validUntil ? new Date(validUntil) : undefined,
            alertMessage: alertMessage || 'This area is restricted for safety reasons. Please avoid entering.',
            createdBy: req.user.id
        });

        await newArea.save();

        res.status(201).json({
            success: true,
            message: 'Restricted area added successfully',
            area: {
                id: newArea._id,
                name: newArea.name,
                location: newArea.location,
                radius: newArea.radius,
                severity: newArea.severity,
                category: newArea.category
            }
        });
    } catch (error) {
        console.error('Error adding restricted area:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to add restricted area'
        });
    }
});

// ===================================================================
// UPDATE RESTRICTED AREA
// ===================================================================
router.put('/restricted/:id', authenticateUser, async (req, res) => {
    try {
        const { id } = req.params;
        const updateData = req.body;

        // Find and update the area (only if created by the user)
        const area = await RestrictedArea.findOneAndUpdate(
            { _id: id, createdBy: req.user.id },
            updateData,
            { new: true, runValidators: true }
        );

        if (!area) {
            return res.status(404).json({
                success: false,
                message: 'Restricted area not found or unauthorized'
            });
        }

        res.json({
            success: true,
            message: 'Restricted area updated successfully',
            area: area
        });
    } catch (error) {
        console.error('Error updating restricted area:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to update restricted area'
        });
    }
});

// ===================================================================
// DELETE RESTRICTED AREA
// ===================================================================
router.delete('/restricted/:id', authenticateUser, async (req, res) => {
    try {
        const { id } = req.params;

        const area = await RestrictedArea.findOneAndDelete({
            _id: id,
            createdBy: req.user.id
        });

        if (!area) {
            return res.status(404).json({
                success: false,
                message: 'Restricted area not found or unauthorized'
            });
        }

        res.json({
            success: true,
            message: 'Restricted area deleted successfully'
        });
    } catch (error) {
        console.error('Error deleting restricted area:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to delete restricted area'
        });
    }
});

// ===================================================================
// GET USER'S RESTRICTED AREAS
// ===================================================================
router.get('/restricted/my-areas', authenticateUser, async (req, res) => {
    try {
        const areas = await RestrictedArea.find({ 
            createdBy: req.user.id 
        }).sort({ createdAt: -1 });
        
        res.json({
            success: true,
            areas: areas
        });
    } catch (error) {
        console.error('Error fetching user areas:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch your areas'
        });
    }
});

module.exports = router;
