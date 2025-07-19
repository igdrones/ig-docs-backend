import express from "express";
import DocumentController, {upload} from "../Controllers/DocumentController.js";
import authorizePermission from "../middleware/AuthorizePermission.js";
import multer from "multer";

const router = express.Router();

router.post("/add",upload.single("document"), DocumentController.createDocument);


router.get("/search", DocumentController.search);
router.get("/stage-action/me", DocumentController.getDocumentStageAction);
router.get("/stage-request/me", DocumentController.getMyDocumentRequests);
router.put("/update-stage/:id", DocumentController.updateDocumentStage);
router.post("/submit/:id", DocumentController.submitDocument);
router.get("/:id", DocumentController.getDocumentById);

// router.put("/documents/:id", DocumentController.updateDocument);

export default router;