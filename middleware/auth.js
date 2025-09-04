// ===================================================================
// AUTHENTICATION MIDDLEWARE - JWT & Security
// ===================================================================
// Secure authentication and authorization middleware

const jwt = require('jsonwebtoken');
const User = require('../models/User');
const Admin = require('../models/Admin');

// Verify JWT token for users
const authenticateUser = async (req, res, next) => {
    try {
        const token = req.header('Authorization')?.replace('Bearer ', '') || 
                     req.cookies?.token;
        
        console.log('🔍 Auth middleware - token received:', token ? token.substring(0, 30) + '...' : 'NO TOKEN');
        
        if (!token) {
            return res.status(401).json({ 
                success: false, 
                message: 'Access denied. No token provided.' 
            });
        }

        console.log('🔐 JWT_SECRET available:', process.env.JWT_SECRET ? 'Yes' : 'No');
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        console.log('🔍 Token decoded:', { userId: decoded.userId, id: decoded.id, username: decoded.username });
        const user = await User.findById(decoded.userId || decoded.id).select('-password');
        console.log('👤 User found:', user ? `${user.username} (${user._id})` : 'NOT FOUND');
        
        if (!user || !user.isActive) {
            return res.status(401).json({ 
                success: false, 
                message: 'Invalid token or user not found.' 
            });
        }

        if (user.isLocked) {
            return res.status(423).json({ 
                success: false, 
                message: 'Account is temporarily locked due to multiple failed login attempts.' 
            });
        }

        req.user = user;
        next();
    } catch (error) {
        console.error('❌ Token verification error:', error.message);
        res.status(401).json({ 
            success: false, 
            message: 'Invalid token.' 
        });
    }
};

// Verify JWT token for admins
const authenticateAdmin = async (req, res, next) => {
    try {
        const token = req.header('Authorization')?.replace('Bearer ', '') || 
                     req.cookies?.adminToken;
        
        if (!token) {
            return res.status(401).json({ 
                success: false, 
                message: 'Access denied. Admin token required.' 
            });
        }

        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        const admin = await Admin.findById(decoded.id).select('-password');
        
        if (!admin || !admin.isActive) {
            return res.status(401).json({ 
                success: false, 
                message: 'Invalid admin token.' 
            });
        }

        req.admin = admin;
        next();
    } catch (error) {
        res.status(401).json({ 
            success: false, 
            message: 'Invalid admin token.' 
        });
    }
};

// Check if user's phone is verified
const requirePhoneVerification = (req, res, next) => {
    if (!req.user.isPhoneVerified) {
        return res.status(403).json({
            success: false,
            message: 'Phone verification required.',
            requiresPhoneVerification: true
        });
    }
    next();
};

// Check if user's document is verified
const requireDocumentVerification = (req, res, next) => {
    if (req.user.verificationStatus !== 'approved') {
        return res.status(403).json({
            success: false,
            message: 'Document verification required.',
            verificationStatus: req.user.verificationStatus
        });
    }
    next();
};

// Check admin permissions
const requirePermission = (permission) => {
    return (req, res, next) => {
        if (!req.admin.permissions.includes(permission) && req.admin.role !== 'super-admin') {
            return res.status(403).json({
                success: false,
                message: 'Insufficient permissions.'
            });
        }
        next();
    };
};

// Generate JWT token
const generateToken = (payload, type = 'user') => {
    // Handle both old format (id) and new format (object with userId)
    const tokenPayload = typeof payload === 'object' ? payload : { id: payload };
    tokenPayload.type = type;
    
    return jwt.sign(
        tokenPayload, 
        process.env.JWT_SECRET, 
        { expiresIn: '7d' }
    );
};

module.exports = {
    authenticateUser,
    authenticateAdmin,
    requirePhoneVerification,
    requireDocumentVerification,
    requirePermission,
    generateToken
};
