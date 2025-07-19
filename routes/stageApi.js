import express from "express";

import StageController from "../Controllers/StageController.js";

const router = express.Router();

// Create Workflow
// router.post('/many', StageController.storeMany);
// Add this route in your routes file
// router.put('/many', StageController.updateMany);
router.post("/add", StageController.store);
router.get("/all", StageController.getAll);
router.put("/updateStagePositionEdge", StageController.updateStagesWithPositionAndNext);
router.get("/:id", StageController.getById);
router.put("/:id", StageController.update);
router.delete("/:id", StageController.delete);





export default router;