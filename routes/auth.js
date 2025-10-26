const express = require('express');
const { authenticate } = require('../middleware/auth');
const { validateRegister, validateLogin } = require('../middleware/validation');
const { register, login, getProfile, updateProfile, changePassword } = require('../services/authService');

const router = express.Router();

router.post('/register', validateRegister, register);

router.post('/login', validateLogin, login);

router.get('/profile', authenticate, getProfile);

router.put('/profile', authenticate, updateProfile);

router.put('/change-password', authenticate, changePassword);

module.exports = router;
