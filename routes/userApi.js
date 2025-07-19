import { Router } from "express";
import UserControllers, { upload } from "../Controllers/UserControllers.js";
import authorizePermission from "../middleware/AuthorizePermission.js";

const router = Router();


router.post("/add", authorizePermission("CREATE_USER"), UserControllers.store);
router.get('/all', authorizePermission("VIEW_ALL_USER"), UserControllers.getAll);
router.get('/search', UserControllers.search);
router.get("/me", UserControllers.getMe);
router.get('/:id', authorizePermission("VIEW_USER"), UserControllers.getById);
router.put('/:id', authorizePermission("EDIT_USER"), UserControllers.update);
router.delete('/:id', authorizePermission("DELETE_USER"), UserControllers.delete);
router.post('/activate', UserControllers.activateUser);
router.post(
    "/upload-avatar",
    upload.single("avatar"),
    UserControllers.uploadAvatar
  );

  router.post(
    "/upload-sign",
    upload.single("sign"),
    UserControllers.uploadSignature
  );

export default router;