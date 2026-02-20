import express from 'express';
import adRoutes from './routes/adRoutes.js';

const router = express.Router();

router.use('/ads', adRoutes);

export default router;

