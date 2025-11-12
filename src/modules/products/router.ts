import { Router } from 'express';
import * as salesController from '../sales/controller';

const router = Router();

router.get('/', salesController.getProducts);
router.get('/:id', salesController.getProduct);

export default router;
