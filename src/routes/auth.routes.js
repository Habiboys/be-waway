const router = require('express').Router();
const authController = require('../controllers/auth.controller');
const authMiddleware = require('../middlewares/authMiddleware');
const emailVerifiedMiddleware = require('../middlewares/emailVerifiedMiddleware');

router.post('/register', authController.register);
router.post('/login', authController.login);
router.post('/forgot-password', authController.forgotPassword);
router.post('/reset-password', authController.resetPassword);
router.get('/verify-email', authController.verifyEmail);
router.post('/resend-verification', authController.resendVerification);
router.get('/plans', authController.publicPlans);
router.get('/me', authMiddleware, emailVerifiedMiddleware, authController.me);
router.post('/logout', authMiddleware, emailVerifiedMiddleware, authController.logout);
router.put('/profile', authMiddleware, emailVerifiedMiddleware, authController.updateProfile);
router.post('/change-password', authMiddleware, emailVerifiedMiddleware, authController.changePassword);

module.exports = router;
