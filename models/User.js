// ===================================================================
// USER MODEL - Tourist Registration & Authentication Schema
// ===================================================================
// Secure MongoDB schema for Indian and Foreign tourist registration

const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const userSchema = new mongoose.Schema({
    // Basic Information
    fullName: {
        type: String,
        required: [true, 'Full name is required'],
        trim: true,
        maxlength: [100, 'Name cannot exceed 100 characters']
    },
    email: {
        type: String,
        required: [true, 'Email is required'],
        unique: true,
        lowercase: true,
        match: [/^\w+([.-]?\w+)*@\w+([.-]?\w+)*(\.\w{2,3})+$/, 'Please enter a valid email']
    },
    username: {
        type: String,
        required: [true, 'Username is required'],
        unique: true,
        trim: true,
        minlength: [3, 'Username must be at least 3 characters'],
        maxlength: [20, 'Username cannot exceed 20 characters'],
        match: [/^[a-zA-Z0-9_]+$/, 'Username can only contain letters, numbers, and underscores']
    },
    gender: {
        type: String,
        required: [true, 'Gender is required'],
        enum: ['male', 'female', 'other']
    },
    password: {
        type: String,
        required: [true, 'Password is required'],
        minlength: [8, 'Password must be at least 8 characters']
    },
    
    // Tourist Type
    touristType: {
        type: String,
        required: [true, 'Tourist type is required'],
        enum: ['indian', 'foreign']
    },
    
    // Phone Information
    phoneNumber: {
        type: String,
        required: [true, 'Phone number is required'],
        match: [/^\+?[1-9]\d{1,14}$/, 'Please enter a valid phone number']
    },
    
    // Document Information
    documentType: {
        type: String,
        required: [true, 'Document type is required'],
        enum: ['aadhar', 'passport']
    },
    documentNumber: {
        type: String,
        required: [true, 'Document number is required'],
        validate: {
            validator: function(v) {
                if (this.documentType === 'aadhar') {
                    return /^\d{12}$/.test(v.replace(/\s/g, ''));
                }
                if (this.documentType === 'passport') {
                    return /^[A-Z0-9]{6,9}$/.test(v.toUpperCase());
                }
                return false;
            },
            message: 'Please enter a valid document number'
        }
    },
    documentFile: {
        filename: String,
        originalName: String,
        mimetype: String,
        size: Number,
        uploadDate: {
            type: Date,
            default: Date.now
        }
    },
    
    // Verification Status
    isDocumentVerified: {
        type: Boolean,
        default: false
    },
    isPhoneVerified: {
        type: Boolean,
        default: false
    },
    otpCode: {
        type: String,
        select: false
    },
    otpExpiry: {
        type: Date,
        select: false
    },
    verificationStatus: {
        type: String,
        enum: ['pending', 'approved', 'rejected'],
        default: 'pending'
    },
    verificationNotes: String,
    verifiedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Admin'
    },
    verifiedAt: Date,
    
    // Account Status
    isActive: {
        type: Boolean,
        default: true
    },
    isEmailVerified: {
        type: Boolean,
        default: false
    },
    emailVerificationToken: {
        type: String,
        select: false
    },
    
    // Security
    loginAttempts: {
        type: Number,
        default: 0
    },
    lockUntil: Date,
    lastLogin: Date,
    passwordResetToken: {
        type: String,
        select: false
    },
    passwordResetExpiry: {
        type: Date,
        select: false
    },
    
    // Additional Info for Foreign Tourists
    nationality: {
        type: String,
        required: function() {
            return this.touristType === 'foreign';
        }
    },
    visaNumber: {
        type: String,
        required: function() {
            return this.touristType === 'foreign';
        }
    },
    
    // Emergency Contact (Optional)
    emergencyContact: {
        name: String,
        phone: String,
        relationship: String
    }
}, {
    timestamps: true
});

// Indexes for performance and security
userSchema.index({ email: 1 });
userSchema.index({ username: 1 });
userSchema.index({ phoneNumber: 1 });
userSchema.index({ documentNumber: 1 });
userSchema.index({ touristType: 1, verificationStatus: 1 });

// Virtual for account lock status
userSchema.virtual('isLocked').get(function() {
    return !!(this.lockUntil && this.lockUntil > Date.now());
});

// Pre-save middleware to hash password
userSchema.pre('save', async function(next) {
    if (!this.isModified('password')) return next();
    
    try {
        const rounds = parseInt(process.env.BCRYPT_ROUNDS) || 8;
        const salt = await bcrypt.genSalt(rounds);
        this.password = await bcrypt.hash(this.password, salt);
        next();
    } catch (error) {
        next(error);
    }
});

// Method to compare password
userSchema.methods.comparePassword = async function(candidatePassword) {
    return bcrypt.compare(candidatePassword, this.password);
};

// Method to increment login attempts
userSchema.methods.incLoginAttempts = function() {
    if (this.lockUntil && this.lockUntil < Date.now()) {
        return this.updateOne({
            $unset: { lockUntil: 1 },
            $set: { loginAttempts: 1 }
        });
    }
    
    const updates = { $inc: { loginAttempts: 1 } };
    
    if (this.loginAttempts + 1 >= 5 && !this.isLocked) {
        updates.$set = { lockUntil: Date.now() + 2 * 60 * 60 * 1000 }; // 2 hours
    }
    
    return this.updateOne(updates);
};

// Method to reset login attempts
userSchema.methods.resetLoginAttempts = function() {
    return this.updateOne({
        $unset: { loginAttempts: 1, lockUntil: 1 }
    });
};

// Method to generate OTP for phone verification
userSchema.methods.generateOTP = function() {
    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    this.otpCode = otp;
    this.otpExpiry = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes
    return otp;
};

// Method to verify OTP
userSchema.methods.verifyOTP = function(otp) {
    return this.otpCode === otp && this.otpExpiry > Date.now();
};

module.exports = mongoose.model('User', userSchema);
