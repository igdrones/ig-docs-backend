
import prisma from "../DB/db.config.js";
import vine, {errors} from '@vinejs/vine'
import { messages } from "@vinejs/vine/defaults";
import { NameDescriptionOptionalSchema, NameDescriptionSchema, PermissionIdsArraySchema } from "../Validations/schema/CommonSchema.js";

class RoleControllers {



    static async store(req, res) {
        try {
            
            const body = req.body;
            const validator = vine.compile(NameDescriptionSchema);
            const payload = await validator.validate(body);
            console.log(payload);
            delete payload.id; 
            payload.name = payload.name.toUpperCase(); 
            const roleExists = await prisma.role.findFirst({
                where: {
                    name: payload.name
                }
            });

            if (roleExists) {
                return res.status(409).json({ status: 409, message: "Role already exists" });
            }
            const role = await prisma.role.create({
                data: payload
            });
            return res.status(201).json({ status: 201, message: "Role created successfully", role: role });
            } catch (error) {
            if (error instanceof errors.E_VALIDATION_ERROR) {
                console.log(error.messages);
            }else {
                console.log(error);
                return res.status(500).json({ status: 500, message: "Internal Server Error"});
            }
            return res.status(500).json({ errors: error.messages })
        }
    }

    static async search(req, res) {
        try {
            // Retrieve page and limit from query parameters, with defaults
            const page = parseInt(req.query.page, 10) || 1;
            const limit = parseInt(req.query.limit, 10) || 10;
            const skip = (page - 1) * limit;
    
            // Count total records for pagination metadata
            const totalRecords = await prisma.role.count({
                where: { deleted: false }
            });
    
            // Fetch paginated roles
            const roles = await prisma.role.findMany({
                skip, // Offset
                take: limit, // Limit
                select: {
                    id: true,
                    name: true,
                    description: true,
                    created_at: true,
                    updated_at: true,
                    permissions: {
                        where: { deleted: false },
                        select: {
                            permission: {
                                select: {
                                    id: true,
                                    name: true
                                }
                            }
                        }
                    }
                },
                where: { deleted: false }
            });
    
            // Format roles data
            const formattedRoles = roles.map(role => ({
                id: role.id,
                name: role.name,
                description: role.description,
                created_at: role.created_at,
                updated_at: role.updated_at,
                permissions: role.permissions.map(rp => ({
                    id: rp.permission.id,
                    name: rp.permission.name
                }))
            }));
    
            // Pagination metadata
            const totalPages = Math.ceil(totalRecords / limit);
            const hasNextPage = page < totalPages;
            const hasPreviousPage = page > 1;
    
            // Response with roles and pagination info
            return res.status(200).json({
                status: 200,
                roles: formattedRoles,
                pagination: {
                    totalRecords,
                    totalPages,
                    currentPage: page,
                    hasNextPage,
                    hasPreviousPage
                }
            });
        } catch (error) {
            console.error(error);
            return res.status(500).json({ status: 500, message: "Internal Server Error" });
        }
    }
    
    static async getAll(req, res) {
        try {
            const roles = await prisma.role.findMany({
                select: {
                    id: true,
                    name: true,
                    created_at: true,
                    updated_at: true,
                    permissions: {
                        where: {
                            deleted: false 
                        },
                        select: {
                            permission: {
                                select: {
                                    id: true,
                                    name: true
                                }
                            }
                        }
                    }
                },
                where: {
                    deleted: false 
                }
            });
    
            const formattedRoles = roles.map(role => ({
                id: role.id,
                name: role.name,
                description: role.description,
                created_at: role.created_at,
                updated_at: role.updated_at,
                permissions: role.permissions.map(rp => ({
                    id: rp.permission.id,
                    name: rp.permission.name
                }))
            }));
    
            return res.status(200).json({ status: 200, roles: formattedRoles });
        } catch (error) {
            console.log(error);
            return res.status(500).json({ status: 500, message: "Internal Server Error" });
        }
    }

    static async getById(req, res) {
        
    }

  
    static async update(req, res) {
        try {
            const id =  req.params.id;
            const body = req.body;
            const validator = vine.compile(NameDescriptionOptionalSchema);
            const payload = await validator.validate(body);
            payload.name = payload.name.toUpperCase(); 
            const role =  await prisma.role.findUnique({
                where: {
                    id: parseInt(id)
                }
            });
            if (!role) {
                return res.status(404).json({ status: 404, message: "Role not found" });
            }

            const roleExists = await prisma.role.findUnique({
                where: {
                    name: payload.name
                }
            });

            if (roleExists) {
                return res.status(409).json({ status: 409, message: "Role name already exists" });
            }

            const updatedRole = await prisma.role.update({
                where: {
                    id: parseInt(id)
                },
                data: payload
            });

            return res.status(200).json({ status: 201, message: "Role Updated", role: updatedRole });
            } catch (error) {
            if (error instanceof errors.E_VALIDATION_ERROR) {
                console.log(error.messages);
            }else {
                console.log(error);
                return res.status(500).json({ status: 500, message: "Internal Server Error"});
            }
            return res.status(500).json({ errors: error.messages })
        }
       
    }
    

    static async delete(req, res) {
        try {
            const id = parseInt(req.params.id); 
    
            // Check if the role exists
            const role = await prisma.role.findUnique({
                where: {
                    id: id
                }
            });
    
            if (!role) {
                return res.status(404).json({ status: 404, message: "Role not found" });
            }

            await prisma.role.update({
                where: {
                    id: id
                },
                data: {
                    deleted: true,
                    deleted_at: new Date() 
                }
            });
    
            return res.status(200).json({ status: 200, message: "Role deleted successfully" });
        } catch (error) {
            console.error(error);
            return res.status(500).json({ status: 500, message: "Internal Server Error" });
        }
    }
    


    static async setPermissionToRoles(req, res) {
        try {
            const roleId = parseInt(req.params.id);
    
            // Validate the input using your schema
            const validator = vine.compile(PermissionIdsArraySchema);
            const payload = await validator.validate(req.body);
            const { permissionIds } = payload;
    
            // Check if the role exists
            const role = await prisma.role.findUnique({
                where: { id: roleId }
            });
    
            if (!role) {
                return res.status(404).json({ status: 404, message: "Role not found" });
            }
    
            // Fetch current permissions for the role
            const currentRolePermissions = await prisma.role_has_permissions.findMany({
                where: { role_id: roleId, deleted: false }
            });
            const currentPermissionIds = currentRolePermissions.map(rp => rp.permission_id);
    
            // Fetch soft-deleted permissions
            const softDeletedRolePermissions = await prisma.role_has_permissions.findMany({
                where: { role_id: roleId, deleted: true, permission_id: { in: permissionIds } }
            });
            const softDeletedPermissionIds = softDeletedRolePermissions.map(rp => rp.permission_id);
    
            // Determine changes
            const permissionsToAdd = permissionIds.filter(pid => !currentPermissionIds.includes(pid) && !softDeletedPermissionIds.includes(pid));
            const permissionsToUndelete = softDeletedPermissionIds.filter(pid => permissionIds.includes(pid));
            const permissionsToRemove = currentPermissionIds.filter(pid => !permissionIds.includes(pid));
    
            // Transaction to handle updates
            await prisma.$transaction(async (prisma) => {
                // Delete permissions
                for (const pid of permissionsToRemove) {
                    await prisma.role_has_permissions.delete({
                        where: {
                            role_id_permission_id: { // Use compound unique constraint
                                role_id: roleId,
                                permission_id: pid
                            }
                        }
                    });
                }
    
                // Add new permissions
                if (permissionsToAdd.length > 0) {
                    await prisma.role_has_permissions.createMany({
                        data: permissionsToAdd.map(pid => ({
                            role_id: roleId,
                            permission_id: pid
                        })),
                        skipDuplicates: true
                    });
                }
    
                // Undelete soft-deleted permissions
                if (permissionsToUndelete.length > 0) {
                    await prisma.role_has_permissions.updateMany({
                        where: {
                            role_id: roleId,
                            permission_id: { in: permissionsToUndelete },
                            deleted: true
                        },
                        data: {
                            deleted: false,
                            deleted_at: null,
                            updated_at: new Date()
                        }
                    });
                }
            });
    
            // Fetch updated permissions
            const updatedRolePermissions = await prisma.role_has_permissions.findMany({
                where: { role_id: roleId, deleted: false },
                include: { permission: true }
            });
    
            // Respond with updated permissions
            return res.status(200).json({
                status: 200,
                message: "Permissions updated successfully",
                permissions: updatedRolePermissions.map(rp => rp.permission.name)
            });
        } catch (error) {
            console.error(error);
            return res.status(500).json({ status: 500, message: "Internal Server Error" });
        }
    }
    
    
    
    
    
    

 

}


export default RoleControllers;