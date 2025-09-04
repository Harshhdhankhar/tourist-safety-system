// ===================================================================
// OCR DOCUMENT PROCESSING - Backend Routes
// ===================================================================
// Handles document image upload and OCR text extraction

const express = require('express');
const multer = require('multer');
const sharp = require('sharp');
const Tesseract = require('tesseract.js');
const path = require('path');
const fs = require('fs');

const router = express.Router();

// Multer configuration for OCR uploads
const ocrStorage = multer.diskStorage({
    destination: function (req, file, cb) {
        const uploadDir = 'public/uploads/ocr/';
        if (!fs.existsSync(uploadDir)) {
            fs.mkdirSync(uploadDir, { recursive: true });
        }
        cb(null, uploadDir);
    },
    filename: function (req, file, cb) {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, 'ocr-' + uniqueSuffix + path.extname(file.originalname));
    }
});

const ocrUpload = multer({
    storage: ocrStorage,
    limits: {
        fileSize: 10 * 1024 * 1024 // 10MB limit
    },
    fileFilter: function (req, file, cb) {
        const allowedTypes = /jpeg|jpg|png|gif|bmp|webp/;
        const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
        const mimetype = allowedTypes.test(file.mimetype);

        if (mimetype && extname) {
            return cb(null, true);
        } else {
            cb(new Error('Only image files are allowed'));
        }
    }
});

// ===================================================================
// OCR PROCESSING FUNCTIONS
// ===================================================================

async function preprocessImage(imagePath) {
    try {
        const processedPath = imagePath.replace(/\.(jpg|jpeg|png|gif|bmp|webp)$/i, '_processed.png');
        
        await sharp(imagePath)
            .resize(2000, null, { 
                withoutEnlargement: true,
                fit: 'inside'
            })
            .grayscale()
            .normalize()
            .sharpen()
            .png({ quality: 100 })
            .toFile(processedPath);
            
        return processedPath;
    } catch (error) {
        console.error('Image preprocessing error:', error);
        return imagePath; // Return original if preprocessing fails
    }
}

function extractDocumentInfo(text) {
    const lines = text.split('\n').map(line => line.trim()).filter(line => line.length > 0);
    
    let documentNumber = '';
    
    // Extract Aadhar number (12 digits) - try multiple patterns
    const aadharPatterns = [
        /\b\d{4}\s*\d{4}\s*\d{4}\b/,  // 4240 2180 9214
        /\b\d{12}\b/,                  // 424021809214
        /\d{4}\s+\d{4}\s+\d{4}/,      // 4240 2180 9214 (with spaces)
        /\d{4}-\d{4}-\d{4}/           // 4240-2180-9214 (with dashes)
    ];
    
    for (const pattern of aadharPatterns) {
        const match = text.match(pattern);
        if (match) {
            documentNumber = match[0].replace(/[\s-]/g, '');
            console.log('Found Aadhar number:', documentNumber);
            break;
        }
    }
    
    if (!documentNumber) {
        console.log('No Aadhar number found in text');
        console.log('Full text for debugging:', text);
    }
    
    return {
        documentNumber: documentNumber || ''
    };
}

// ===================================================================
// API ENDPOINTS
// ===================================================================

// Process document image with OCR
router.post('/process-document', ocrUpload.single('document'), async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({
                success: false,
                message: 'No image file uploaded'
            });
        }

        console.log('Processing document:', req.file.filename);
        
        // Preprocess image for better OCR results
        const processedImagePath = await preprocessImage(req.file.path);
        
        // Perform OCR
        console.log('Starting OCR processing...');
        const { data: { text, confidence } } = await Tesseract.recognize(
            processedImagePath,
            'eng',
            {
                logger: m => {
                    if (m.status === 'recognizing text') {
                        console.log(`OCR Progress: ${Math.round(m.progress * 100)}%`);
                    }
                }
            }
        );

        console.log('OCR completed. Raw text length:', text.length);
        console.log('OCR confidence:', confidence);
        console.log('=== RAW OCR TEXT START ===');
        console.log(text);
        console.log('=== RAW OCR TEXT END ===');
        console.log('Looking for Aadhar pattern in text...');

        // Extract structured data from OCR text
        const extractedData = extractDocumentInfo(text);
        
        console.log('Extracted data:', extractedData);
        console.log('Text lines for debugging:', text.split('\n').slice(0, 10));
        
        // Clean up processed image if different from original
        if (processedImagePath !== req.file.path) {
            try {
                fs.unlinkSync(processedImagePath);
            } catch (cleanupError) {
                console.warn('Failed to cleanup processed image:', cleanupError.message);
            }
        }

        // Clean up uploaded file after processing
        try {
            fs.unlinkSync(req.file.path);
        } catch (cleanupError) {
            console.warn('Failed to cleanup uploaded file:', cleanupError.message);
        }

        res.json({
            success: true,
            message: 'Document processed successfully',
            data: {
                fullName: extractedData.fullName,
                documentNumber: extractedData.documentNumber,
                confidence: extractedData.confidence,
                ocrConfidence: Math.round(confidence),
                rawText: text.substring(0, 500) // First 500 chars for debugging
            }
        });

    } catch (error) {
        console.error('OCR processing error:', error);
        
        // Clean up files on error
        if (req.file && req.file.path) {
            try {
                fs.unlinkSync(req.file.path);
            } catch (cleanupError) {
                console.warn('Failed to cleanup file on error:', cleanupError.message);
            }
        }
        
        res.status(500).json({
            success: false,
            message: 'Failed to process document. Please try again.',
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
});

// Get OCR processing status (for future async processing)
router.get('/status/:jobId', (req, res) => {
    // Placeholder for future async OCR processing
    res.json({
        success: true,
        status: 'completed',
        message: 'OCR processing completed'
    });
});

module.exports = router;
