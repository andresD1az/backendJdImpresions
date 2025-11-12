import { Router } from 'express';
import * as salesController from '../sales/controller';

const router = Router();

router.get('/:id/sales', salesController.getCustomerSales);

export default router;
