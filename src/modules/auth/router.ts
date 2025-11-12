import { Router } from 'express';
import * as authController from './controller';

const router = Router();

router.post('/login', authController.login);
router.post('/register', authController.register);
router.post('/forgot-password', authController.forgotPassword);
router.post('/logout', authController.logout);
router.get('/profile', authController.getProfile);

export default router;
