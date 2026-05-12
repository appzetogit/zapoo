import express from 'express';
import { getSupportPublic } from '../controllers/supportContactController.js';

const router = express.Router();

router.get('/support/public', getSupportPublic);

export default router;
