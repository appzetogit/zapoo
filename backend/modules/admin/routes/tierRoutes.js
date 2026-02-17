
import express from 'express';
import { createTier, getAllTiers, updateTier, deleteTier, getZonesByTier, getRestaurantsByZone } from '../controllers/tierController.js';
// middleware to check authentication (assuming you have one, typically 'protect' and 'admin')
// For now I will standard routes, and you can add middleware in adminRoutes or here if needed.
// Usually in this project structure routes are protected in the main index.js or adminRoutes.js

const router = express.Router();

router.post('/', createTier);
router.get('/', getAllTiers);
router.put('/:id', updateTier);
router.delete('/:id', deleteTier);
router.get('/:id/zones', getZonesByTier);
router.get('/zones/:zoneId/restaurants', getRestaurantsByZone);

export default router;
