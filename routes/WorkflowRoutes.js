import express from "express";

import WorkflowController from "../Controllers/WorkflowController.js";

const router = express.Router();

// Create Workflow
router.post("/", WorkflowController.store);

// Get all Workflows
router.get("/search", WorkflowController.search);

router.get("/all", WorkflowController.getAll);

// Get Workflow by ID
router.get("/:id", WorkflowController.getById);

// Update Workflow
router.put("/:id", WorkflowController.update);

// Delete Workflow
router.delete("/:id", WorkflowController.destroy);

export default router;
