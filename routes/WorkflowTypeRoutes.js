import express from "express";
import WorkflowTypeController from "../Controllers/WorkflowTypeController.js";

const router = express.Router();

// Create Workflow_type
router.post("/", WorkflowTypeController.store);

// Get all Workflow_types
router.get("/all", WorkflowTypeController.getAll);

// Search Workflow_types
router.get("/search", WorkflowTypeController.search);

// Get Workflow_type by ID
router.get("/:id", WorkflowTypeController.getById);

// Update Workflow_type
router.put("/:id", WorkflowTypeController.update);

// Delete Workflow_type
router.delete("/:id", WorkflowTypeController.destroy);

export default router;
