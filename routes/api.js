import {Router} from 'express';
import userApi from "./userApi.js";
import roleApi from "./roleApi.js";
import permissionApi from "./permissionApi.js";
import authMiddleware from '../middleware/AuthMiddleware.js';
import authApi from './authApi.js';
import workflowRoutes from "./WorkflowRoutes.js";
import workflowTypeRoutes from "./WorkflowTypeRoutes.js";
import documentApi from "./documentApi.js"
import stageApi from "./stageApi.js";
import documentFieldApi from './documentFieldApi.js';
import documentVersionApi from './documentVersionApi.js';
import signatureApi from './signatureApi.js';

const router = new Router();

router.use("/auth", authApi);
router.use("/permission",authMiddleware, permissionApi);
router.use("/role",authMiddleware, roleApi);
router.use("/users",authMiddleware, userApi);
router.use("/workflows", authMiddleware,workflowRoutes);
router.use("/workflowTypes",authMiddleware, workflowTypeRoutes);
router.use("/document", authMiddleware,documentApi);
router.use("/stage",authMiddleware, stageApi);
router.use("/document-field",authMiddleware, documentFieldApi);
router.use("/document-version",authMiddleware, documentVersionApi);
router.use("/signature", signatureApi);


export default router;