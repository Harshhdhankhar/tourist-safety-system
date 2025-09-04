// ===================================================================
// TOURIST SAFETY SYSTEM - Main Server
// ===================================================================
// Web application for Indian and Foreign tourist registration
// Features: Document verification, OTP authentication, file storage

require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 5000;

// ===================================================================
// BASIC MIDDLEWARE
// ===================================================================

// Basic CORS configuration
app.use(cors());

// ===================================================================
// DATABASE CONNECTION
// ===================================================================

mongoose.connect(process.env.MONGODB_URI, {
    useNewUrlParser: true,
    useUnifiedTopology: true
}).then(() => {
    console.log('📊 Connected to MongoDB');
}).catch(err => {
    console.error('❌ MongoDB connection error:', err.message);
    process.exit(1);
});

// ===================================================================
// MIDDLEWARE
// ===================================================================

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use('/uploads', express.static(path.join(__dirname, 'public/uploads')));
app.use(express.static(path.join(__dirname, 'public')));

// ===================================================================
// ROUTES
// ===================================================================

// Routes
app.use('/api/auth', require('./routes/auth'));
app.use('/api/admin', require('./routes/admin'));
app.use('/api/ocr', require('./routes/ocr'));
app.use('/api/phone', require('./routes/phone-verification'));
app.use('/api/contacts', require('./routes/contacts'));
app.use('/api/areas', require('./routes/areas'));
app.use('/api/sos', require('./routes/sos'));

// Serve static pages
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'views', 'index.html'));
});

app.get('/register-indian', (req, res) => {
    res.sendFile(path.join(__dirname, 'views', 'register-indian.html'));
});

app.get('/register-foreign', (req, res) => {
    res.sendFile(path.join(__dirname, 'views', 'register-foreign.html'));
});

app.get('/login', (req, res) => {
    res.sendFile(path.join(__dirname, 'views', 'login.html'));
});

app.get('/admin', (req, res) => {
    res.sendFile(path.join(__dirname, 'views', 'admin.html'));
});

app.get('/dashboard', (req, res) => {
    res.sendFile(path.join(__dirname, 'views', 'dashboard.html'));
});

// Health check endpoint
app.get('/api/health', (req, res) => {
    res.json({
        success: true,
        message: 'Tourist Safety System is running',
        timestamp: new Date().toISOString()
    });
});

// ===================================================================
// ERROR HANDLING
// ===================================================================

// 404 handler
app.use('*', (req, res) => {
    res.status(404).json({
        success: false,
        message: 'Route not found'
    });
});

// Global error handler
app.use((error, req, res, next) => {
    console.error('Global error:', error);
    
    res.status(error.status || 500).json({
        success: false,
        message: process.env.NODE_ENV === 'production' 
            ? 'Something went wrong' 
            : error.message
    });
});

// ===================================================================
// START SERVER
// ===================================================================

app.listen(PORT, () => {
    console.log(`🚀 Tourist Safety System running on http://localhost:${PORT}`);
    console.log(`📱 Environment: ${process.env.NODE_ENV || 'development'}`);
});

// Graceful shutdown
process.on('SIGTERM', () => {
    console.log('SIGTERM received, shutting down gracefully');
    mongoose.connection.close(() => {
        console.log('MongoDB connection closed');
        process.exit(0);
    });
});
