import {Router} from 'express';

import PermissionsController from "../Controllers/PermissionController.js";
import authorizePermission from '../middleware/AuthorizePermission.js';
const permissionApiRouter = Router();

permissionApiRouter.get("/all", authorizePermission("VIEW_ALL_PERMISSION"), PermissionsController.getAll);
permissionApiRouter.get("/my",PermissionsController.getMyPermissions);

export default permissionApiRouter;