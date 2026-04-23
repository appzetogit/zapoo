import express from "express";
import { getCodeOfConductPublic } from "../controllers/codeOfConductController.js";

const router = express.Router();

router.get("/code-of-conduct/public", getCodeOfConductPublic);

export default router;

