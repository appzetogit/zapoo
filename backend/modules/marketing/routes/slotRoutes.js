import express from 'express';
import { configureSlots, getSlotConfigurations, getSlotsByZone } from '../controllers/slotController.js';

const router = express.Router();

router.post('/configure', configureSlots);
router.get('/', getSlotConfigurations);
router.get('/zone/:zoneId', getSlotsByZone);

export default router;
