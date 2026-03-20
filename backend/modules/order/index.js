import express from 'express';
import orderRoutes from './routes/orderRoutes.js';
import etaRoutes from './routes/etaRoutes.js';

const router = express.Router();

// IMPORTANT: ETA quote endpoints must remain public; mount ETA before orderRoutes
// because orderRoutes applies authenticate() middleware for most paths.
router.use('/', etaRoutes); // ETA routes
router.use('/', orderRoutes);

export default router;

