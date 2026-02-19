import express from 'express';
import adRoutes from './routes/adRoutes.js';
import slotRoutes from './routes/slotRoutes.js';

const router = express.Router();

router.use('/ads', adRoutes);
router.use('/slots', slotRoutes);

export default router;
