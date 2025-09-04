// ===================================================================
// EMERGENCY CONTACTS ROUTES
// ===================================================================
// Handle emergency contacts CRUD operations

const express = require('express');
const router = express.Router();
const { authenticateUser } = require('../middleware/auth');
const Contact = require('../models/Contact');

// Get all emergency contacts for user
router.get('/', authenticateUser, async (req, res) => {
    try {
        const contacts = await Contact.find({ userId: req.user._id })
            .sort({ createdAt: -1 });

        res.json({
            success: true,
            contacts: contacts
        });

    } catch (error) {
        console.error('Get contacts error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to retrieve contacts'
        });
    }
});

// Add new emergency contact
router.post('/', authenticateUser, async (req, res) => {
    try {
        const { name, phoneNumber, relationship, email } = req.body;

        if (!name || !phoneNumber) {
            return res.status(400).json({
                success: false,
                message: 'Name and phone number are required'
            });
        }

        const contact = new Contact({
            userId: req.user._id,
            name,
            phoneNumber,
            relationship,
            email
        });

        await contact.save();

        res.json({
            success: true,
            message: 'Emergency contact added successfully',
            contact: contact
        });

    } catch (error) {
        console.error('Add contact error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to add contact'
        });
    }
});

// Update emergency contact
router.put('/:contactId', authenticateUser, async (req, res) => {
    try {
        const { name, phoneNumber, relationship, email } = req.body;
        const { contactId } = req.params;

        const contact = await Contact.findOne({
            _id: contactId,
            userId: req.user._id
        });

        if (!contact) {
            return res.status(404).json({
                success: false,
                message: 'Contact not found'
            });
        }

        contact.name = name;
        contact.phoneNumber = phoneNumber;
        contact.relationship = relationship;
        contact.email = email;

        await contact.save();

        res.json({
            success: true,
            message: 'Contact updated successfully',
            contact: contact
        });

    } catch (error) {
        console.error('Update contact error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to update contact'
        });
    }
});

// Delete emergency contact
router.delete('/:contactId', authenticateUser, async (req, res) => {
    try {
        const { contactId } = req.params;

        const contact = await Contact.findOneAndDelete({
            _id: contactId,
            userId: req.user._id
        });

        if (!contact) {
            return res.status(404).json({
                success: false,
                message: 'Contact not found'
            });
        }

        res.json({
            success: true,
            message: 'Contact deleted successfully'
        });

    } catch (error) {
        console.error('Delete contact error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to delete contact'
        });
    }
});

module.exports = router;
