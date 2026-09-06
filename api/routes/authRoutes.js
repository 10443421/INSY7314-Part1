//line2-27 The IIE (2014, p.38-39,94) 
const express = require('express');
const router = express.Router();

//import controller functions
const {registerUser, loginUser,getUserProfile
} = require('../controllers/authController');

//import input validation middleware
const{
    validateRegisterInput,
    validateLoginInput
} = require('../middleware/validateAuthInput');

//import JWT protection middleware
const verifyToken = require('../middleware/authMiddleware');

//POST /api/auth/register - Register with validation
router.post('/register', validateRegisterInput, registerUser);

// POST /api/auth/login - Login with validation
router.post('/login', validateLoginInput, loginUser);

// GET /api/auth/profile - Protected route requiring valid bearer JWT
router.get('/profile', verifyToken, getUserProfile);

module.exports = router;

//Reference List
//The Independent Institute of Education (IIE), 2025. APPLICATION DEVELOPMENT SECURITY [INSY7314 Module Manual] The Independent Institute of Education: Unpublished.