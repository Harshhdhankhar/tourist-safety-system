// ===================================================================
// ADMIN ROUTES - Document Verification & Management
// ===================================================================
// Admin panel for verifying tourist documents and managing users

const express = require('express');
const { body, validationResult } = require('express-validator');
const User = require('../models/User');
const Admin = require('../models/Admin');
const { authenticateAdmin, requirePermission, generateToken } = require('../middleware/auth');
const router = express.Router();

// ===================================================================
// ADMIN AUTHENTICATION
// ===================================================================

// Admin login
router.post('/login', [
    body('identifier').notEmpty().withMessage('Email or username is required'),
    body('password').notEmpty().withMessage('Password is required')
], async (req, res) => {
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

        const admin = await Admin.findOne({
            $or: [{ email: identifier }, { username: identifier }],
            isActive: true
        });

        if (!admin || !(await admin.comparePassword(password))) {
            return res.status(401).json({
                success: false,
                message: 'Invalid credentials'
            });
        }

        admin.lastLogin = new Date();
        await admin.save();

        const token = generateToken({
            id: admin._id,
            username: admin.username,
            email: admin.email
        }, 'admin');

        res.json({
            success: true,
            message: 'Admin login successful',
            token,
            admin: {
                id: admin._id,
                fullName: admin.fullName,
                email: admin.email,
                role: admin.role,
                permissions: admin.permissions
            }
        });

    } catch (error) {
        console.error('Admin login error:', error);
        res.status(500).json({
            success: false,
            message: 'Login failed'
        });
    }
});

// ===================================================================
// DOCUMENT VERIFICATION
// ===================================================================

// Get pending verifications
router.get('/verifications', authenticateAdmin, async (req, res) => {
    try {
        const pendingUsers = await User.find({
            verificationStatus: 'pending',
            isPhoneVerified: true
        }).select('fullName email username phoneNumber touristType documentType documentNumber documentFile createdAt');

        res.json({
            success: true,
            verifications: pendingUsers
        });

    } catch (error) {
        console.error('Get pending verifications error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch pending verifications'
        });
    }
});

// Verify document (approve/reject)
router.post('/verify-document/:id', authenticateAdmin, requirePermission('verify-documents'), [
    body('action').isIn(['approve', 'reject']).withMessage('Action must be approve or reject'),
    body('notes').optional().isLength({ max: 500 }).withMessage('Notes cannot exceed 500 characters')
], async (req, res) => {
    try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({
                success: false,
                message: 'Validation failed',
                errors: errors.array()
            });
        }

        const { action, notes } = req.body;
        const user = await User.findById(req.params.id);
        
        if (!user) {
            return res.status(404).json({
                success: false,
                message: 'User not found'
            });
        }

        user.verificationStatus = action === 'approve' ? 'approved' : 'rejected';
        user.isDocumentVerified = action === 'approve';
        user.verificationNotes = notes;
        user.verifiedBy = req.admin._id;
        user.verifiedAt = new Date();

        await user.save();

        res.json({
            success: true,
            message: `Document ${action}d successfully`
        });

    } catch (error) {
        console.error('Document verification error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to verify document'
        });
    }
});

// Get admin profile
router.get('/profile', authenticateAdmin, async (req, res) => {
    try {
        const admin = await Admin.findById(req.admin._id).select('-password');
        
        res.json({
            success: true,
            admin
        });

    } catch (error) {
        console.error('Get admin profile error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch admin profile'
        });
    }
});

// Get dashboard statistics
router.get('/statistics', authenticateAdmin, async (req, res) => {
    try {
        const stats = await Promise.all([
            User.countDocuments({ isActive: true }),
            User.countDocuments({ verificationStatus: 'pending', isPhoneVerified: true }),
            User.countDocuments({ verificationStatus: 'approved' }),
            User.countDocuments({ createdAt: { $gte: new Date(Date.now() - 24 * 60 * 60 * 1000) } })
        ]);

        res.json({
            success: true,
            totalUsers: stats[0],
            pendingVerifications: stats[1],
            approvedUsers: stats[2],
            newUsersToday: stats[3]
        });

    } catch (error) {
        console.error('Get stats error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch statistics'
        });
    }
});

// Get user details for verification
router.get('/user/:id', authenticateAdmin, requirePermission('verify-documents'), async (req, res) => {
    try {
        const user = await User.findById(req.params.id).select('-password -otpCode -otpExpiry');
        
        if (!user) {
            return res.status(404).json({
                success: false,
                message: 'User not found'
            });
        }

        res.json({
            success: true,
            user
        });

    } catch (error) {
        console.error('Get user details error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch user details'
        });
    }
});

// Approve document
router.post('/verify/:id/approve', authenticateAdmin, requirePermission('verify-documents'), [
    body('notes').optional().isLength({ max: 500 }).withMessage('Notes cannot exceed 500 characters')
], async (req, res) => {
    try {
        const { notes } = req.body;

        const user = await User.findById(req.params.id);
        if (!user) {
            return res.status(404).json({
                success: false,
                message: 'User not found'
            });
        }

        user.verificationStatus = 'approved';
        user.isDocumentVerified = true;
        user.verificationNotes = notes;
        user.verifiedBy = req.admin._id;
        user.verifiedAt = new Date();

        await user.save();

        res.json({
            success: true,
            message: 'Document approved successfully'
        });

    } catch (error) {
        console.error('Document approval error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to approve document'
        });
    }
});

// Reject document
router.post('/verify/:id/reject', authenticateAdmin, requirePermission('verify-documents'), [
    body('notes').notEmpty().withMessage('Rejection reason is required')
        .isLength({ max: 500 }).withMessage('Notes cannot exceed 500 characters')
], async (req, res) => {
    try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({
                success: false,
                message: 'Validation failed',
                errors: errors.array()
            });
        }

        const { notes } = req.body;

        const user = await User.findById(req.params.id);
        if (!user) {
            return res.status(404).json({
                success: false,
                message: 'User not found'
            });
        }

        user.verificationStatus = 'rejected';
        user.isDocumentVerified = false;
        user.verificationNotes = notes;
        user.verifiedBy = req.admin._id;
        user.verifiedAt = new Date();

        await user.save();

        res.json({
            success: true,
            message: 'Document rejected successfully'
        });

    } catch (error) {
        console.error('Document rejection error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to reject document'
        });
    }
});

// ===================================================================
// USER MANAGEMENT
// ===================================================================

// Get all users with filters
router.get('/users', authenticateAdmin, async (req, res) => {
    try {
        const { 
            page = 1, 
            limit = 20, 
            touristType, 
            verificationStatus, 
            search 
        } = req.query;

        const filter = { isActive: true };
        
        if (touristType) filter.touristType = touristType;
        if (verificationStatus) filter.verificationStatus = verificationStatus;
        if (search) {
            filter.$or = [
                { fullName: { $regex: search, $options: 'i' } },
                { email: { $regex: search, $options: 'i' } },
                { username: { $regex: search, $options: 'i' } }
            ];
        }

        const users = await User.find(filter)
            .select('-password -otpCode -otpExpiry')
            .sort({ createdAt: -1 })
            .limit(limit * 1)
            .skip((page - 1) * limit);

        const total = await User.countDocuments(filter);

        res.json({
            success: true,
            users,
            pagination: {
                current: page,
                pages: Math.ceil(total / limit),
                total
            }
        });

    } catch (error) {
        console.error('Get users error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch users'
        });
    }
});

// Deactivate user
router.post('/users/:id/deactivate', authenticateAdmin, requirePermission('manage-users'), async (req, res) => {
    try {
        const user = await User.findById(req.params.id);
        if (!user) {
            return res.status(404).json({
                success: false,
                message: 'User not found'
            });
        }

        user.isActive = false;
        await user.save();

        res.json({
            success: true,
            message: 'User deactivated successfully'
        });

    } catch (error) {
        console.error('User deactivation error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to deactivate user'
        });
    }
});

// ===================================================================
// STATISTICS & REPORTS
// ===================================================================

// Get dashboard statistics
router.get('/stats', authenticateAdmin, requirePermission('view-reports'), async (req, res) => {
    try {
        const stats = await Promise.all([
            User.countDocuments({ isActive: true }),
            User.countDocuments({ touristType: 'indian', isActive: true }),
            User.countDocuments({ touristType: 'foreign', isActive: true }),
            User.countDocuments({ verificationStatus: 'pending' }),
            User.countDocuments({ verificationStatus: 'approved' }),
            User.countDocuments({ verificationStatus: 'rejected' }),
            User.countDocuments({ isPhoneVerified: true }),
            User.countDocuments({ createdAt: { $gte: new Date(Date.now() - 24 * 60 * 60 * 1000) } })
        ]);

        res.json({
            success: true,
            stats: {
                totalUsers: stats[0],
                indianTourists: stats[1],
                foreignTourists: stats[2],
                pendingVerifications: stats[3],
                approvedUsers: stats[4],
                rejectedUsers: stats[5],
                verifiedPhones: stats[6],
                newUsersToday: stats[7]
            }
        });

    } catch (error) {
        console.error('Get stats error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch statistics'
        });
    }
});

module.exports = router;
