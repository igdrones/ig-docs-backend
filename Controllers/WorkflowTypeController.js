import prisma from "../DB/db.config.js";
import vine, { errors } from "@vinejs/vine";
import { 
    CreateWorkflowTypeSchema, 
    UpdateWorkflowTypeSchema 
} from "../Validations/schema/WorkflowTypeSchema.js";

class WorkflowTypeController {
    // Create a new Workflow_type
    static async store(req, res) {
        try {
            const validator = vine.compile(CreateWorkflowTypeSchema);
            const payload = await validator.validate(req.body);

            // Check for uniqueness
            const existingWorkflowType = await prisma.workflow_type.findUnique({
                where: { name: payload.name },
            });
            if (existingWorkflowType) {
                return res.status(400).json({ status: 400, message: "Workflow Type already exists" });
            }
            payload.created_by_id = req.user.userId;

            const workflowType = await prisma.workflow_type.create({
                data: payload,
            });

            return res.status(201).json({
                status: 201,
                message: "Workflow Type Created Successfully",
                workflowType,
            });
        } catch (error) {
            if (error instanceof errors.E_VALIDATION_ERROR) {
                return res.status(400).json({ status: 400, message: "Validation Error", errors: error.messages });
            }
            console.error("Error creating Workflow Type:", error);
            return res.status(500).json({ status: 500, message: "Internal Server Error" });
        }
    }


    // Search API with pagination
    static async search(req, res) {
        try {
          const { page = 1, size = 10, name, created_by_id } = req.query;
    
          // Build filters dynamically
          const filters = {};
          if (name) {
            filters.name = { contains: name, mode: "insensitive" };
          }
          if (created_by_id) {
            filters.created_by_id = parseInt(created_by_id);
          }
    
          // Fetch paginated results
          const workflowTypes = await prisma.workflow_type.findMany({
            where: filters,
            skip: (page - 1) * parseInt(size),
            take: parseInt(size),
            include: {
              created_by: {
                select: {
                  id: true,
                  name: true,
                  email: true,
                },
              },
              Workflow: true,
              Documents: true,
            },
            orderBy: { id: "asc" },
          });
    
          // Count total items
          const total = await prisma.workflow_type.count({ where: filters });
    
          // Response with pagination metadata
          return res.status(200).json({
            status: 200,
            message: "Workflow Types Fetched Successfully",
            data: workflowTypes,
            pagination: {
              totalUsers: total,
              totalPages: Math.ceil(total / size),
              currentPage: parseInt(page),
              limit: parseInt(size),
            },
          });
        } catch (error) {
          console.error("Error in search:", error);
          return res.status(500).json({ status: 500, message: "Internal Server Error" });
        }
      }
    
      // Get All API without pagination
      static async getAll(req, res) {
        try {
          const { name, created_by_id } = req.query;
    
          // Build filters dynamically
          const filters = {};
          if (name) {
            filters.name = { contains: name, mode: "insensitive" };
          }
          if (created_by_id) {
            filters.created_by_id = parseInt(created_by_id);
          }
    
          // Fetch all results without pagination
          const workflowTypes = await prisma.workflow_type.findMany({
            where: filters,
            include: {
              created_by: {
                select: {
                  id: true,
                  name: true,
                  email: true,
                },
              },
              Workflow: true,
              Documents: true,
            },
            orderBy: { id: "asc" },
          });
    
          // Response without pagination
          return res.status(200).json({
            status: 200,
            message: "Workflow Types Fetched Successfully",
            data: workflowTypes,
          });
        } catch (error) {
          console.error("Error in getAll:", error);
          return res.status(500).json({ status: 500, message: "Internal Server Error" });
        }
      }

    // Get Workflow_type by ID
    static async getById(req, res) {
        try {
            const { id } = req.params;

            const workflowType = await prisma.workflow_type.findUnique({
                where: { id: parseInt(id) },
                include: {
                    created_by: {
                        select: {
                            id: true,
                            name: true,
                            email: true,
                        }
                    },
                    Workflow: true,
                    Documents: true,
                },
            });

            if (!workflowType) {
                return res.status(404).json({ status: 404, message: "Workflow Type not found" });
            }

            return res.status(200).json({
                status: 200,
                message: "Workflow Type Fetched Successfully",
                workflowType,
            });
        } catch (error) {
            console.error("Error fetching Workflow Type by ID:", error);
            return res.status(500).json({ status: 500, message: "Internal Server Error" });
        }
    }

    // Update Workflow_type
    static async update(req, res) {
        try {
            const { id } = req.params;
            const validator = vine.compile(UpdateWorkflowTypeSchema);
            const payload = await validator.validate(req.body);

            // Check if Workflow Type exists
            const existingWorkflowType = await prisma.workflow_type.findUnique({
                where: { id: parseInt(id) },
            });
            if (!existingWorkflowType) {
                return res.status(404).json({ status: 404, message: "Workflow Type not found" });
            }

            const updatedWorkflowType = await prisma.workflow_type.update({
                where: { id: parseInt(id) },
                data: payload,
            });

            return res.status(200).json({
                status: 200,
                message: "Workflow Type Updated Successfully",
                workflowType: updatedWorkflowType,
            });
        } catch (error) {
            if (error instanceof errors.E_VALIDATION_ERROR) {
                return res.status(400).json({ status: 400, message: "Validation Error", errors: error.messages });
            }
            console.error("Error updating Workflow Type:", error);
            return res.status(500).json({ status: 500, message: "Internal Server Error" });
        }
    }

    // Delete Workflow_type
    static async destroy(req, res) {
        try {
            const { id } = req.params;

            // Check if Workflow Type exists
            const existingWorkflowType = await prisma.workflow_type.findUnique({
                where: { id: parseInt(id) },
            });
            if (!existingWorkflowType) {
                return res.status(404).json({ status: 404, message: "Workflow Type not found" });
            }

            await prisma.workflow_type.delete({
                where: { id: parseInt(id) },
            });

            return res.status(200).json({
                status: 200,
                message: "Workflow Type Deleted Successfully",
            });
        } catch (error) {
            console.error("Error deleting Workflow Type:", error);
            return res.status(500).json({ status: 500, message: "Internal Server Error" });
        }
    }
}


export default WorkflowTypeController;