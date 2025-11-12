import { Router } from 'express';
import * as salesController from './controller';

const router = Router();

// Sales routes
router.post('/', salesController.createSale);
router.get('/', salesController.getSales);
router.get('/:id', salesController.getSale);
router.post('/:id/cancel', salesController.cancelSale);
router.get('/:id/invoice', salesController.getInvoice);

export default router;
