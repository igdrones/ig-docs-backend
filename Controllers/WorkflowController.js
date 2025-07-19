import prisma from "../DB/db.config.js";
import vine, { errors } from "@vinejs/vine";
import { 
    CreateWorkflowSchema, 
    UpdateWorkflowSchema 
} from "../Validations/schema/WorkflowSchema.js";

class WorkflowController {
    // Create a new Workflow
    static async store(req, res) {
        try {
            const validator = vine.compile(CreateWorkflowSchema);
            const payload = await validator.validate(req.body);

            // Check for uniqueness
            const existingWorkflow = await prisma.workflow.findUnique({
                where: { name: payload.name },
            });
            if (existingWorkflow) {
                return res.status(400).json({ status: 400, message: "Workflow already exists" });
            }

            // Check if the workflow_type_id exists
            const workflowType = await prisma.workflow_type.findUnique({
                where: { id: payload.workflow_type_id },
            });
            if (!workflowType) {
                return res.status(404).json({ status: 404, message: "Workflow Type not found" });
            }

            payload.created_by_id = req.user.userId;

            const workflow = await prisma.workflow.create({
                data: payload,
            });

            return res.status(201).json({
                status: 201,
                message: "Workflow Created Successfully",
                workflow,
            });
        } catch (error) {
            if (error instanceof errors.E_VALIDATION_ERROR) {
                return res.status(400).json({ status: 400, message: "Validation Error", errors: error.messages });
            }
            console.error("Error creating Workflow:", error);
            return res.status(500).json({ status: 500, message: "Internal Server Error" });
        }
    }

    // Get all Workflows with filtering and pagination
    static async search(req, res) {
        try {
            const { page = 1, size = 10, name, workflow_type_id, created_by_id } = req.query;

            // Build filters dynamically
            const filters = {};
            if (name) {
                filters.name = { contains: name, mode: "insensitive" };
            }
            if (workflow_type_id) {
                filters.workflow_type_id = parseInt(workflow_type_id);
            }
            if (created_by_id) {
                filters.created_by_id = parseInt(created_by_id);
            }
            filters.deleted = false;

            const workflows = await prisma.workflow.findMany({
                where: filters,
                skip: (page - 1) * parseInt(size),
                take: parseInt(size),
                include: {
                    workflow_type: {
                        select: {
                            id: true,
                            name: true,
                            description: true,
                        }
                    },
                    created_by: {
                        select: {
                            id: true,
                            name: true,
                            email: true,
                        }
                    },
                    Documents: true,
                    Stages: true,
                },
                orderBy: { id: "asc" },
            });

            const total = await prisma.workflow.count({ where: filters });

            return res.status(200).json({
                status: 200,
                message: "Workflows Fetched Successfully",
                workflow: workflows,
                pagination: {
                    total,
                    page: parseInt(page),
                    size: parseInt(size),
                    totalPages: Math.ceil(total / size),
                },
            });
        } catch (error) {
            console.error("Error fetching Workflows:", error);
            return res.status(500).json({ status: 500, message: "Internal Server Error" });
        }
    }

static async getAll(req, res) {
    try {
        const workflows = await prisma.workflow.findMany({
            where: { deleted: false },
            include: {
                workflow_type: {
                    select: {
                        id: true,
                        name: true,
                        description: true,
                    }
                },
                created_by: {
                    select: {
                        id: true,
                        name: true,
                        email: true,
                    }
                },
                Documents: true,
                Stages: true,
            },
            orderBy: { id: "asc" },
        });

        return res.status(200).json({
            status: 200,
            message: "All Workflows Fetched Successfully",
            workflows: workflows,
        });
    } catch (error) {
        console.error("Error fetching all Workflows:", error);
        return res.status(500).json({ status: 500, message: "Internal Server Error" });
    }
}


    // Get Workflow by ID
    static async getById(req, res) {
        try {
            const { id } = req.params;

            const workflow = await prisma.workflow.findUnique({
                where: { id: parseInt(id) },
                include: {
                    workflow_type: {
                        select: {
                            id: true,
                            name: true,
                            description: true,
                        }
                    },
                    created_by: {
                        select: {
                            id: true,
                            name: true,
                            email: true,
                        }
                    },
                    Documents: true,
                    Stages: true,
                },
            });

            if (!workflow || workflow.deleted) {
                return res.status(404).json({ status: 404, message: "Workflow not found" });
            }

            return res.status(200).json({
                status: 200,
                message: "Workflow Fetched Successfully",
                workflow,
            });
        } catch (error) {
            console.error("Error fetching Workflow by ID:", error);
            return res.status(500).json({ status: 500, message: "Internal Server Error" });
        }
    }

    // Update Workflow
    static async update(req, res) {
        try {
            const { id } = req.params;
            const validator = vine.compile(UpdateWorkflowSchema);
            const payload = await validator.validate(req.body);

            // Check if Workflow exists
            const existingWorkflow = await prisma.workflow.findUnique({
                where: { id: parseInt(id) },
            });
            if (!existingWorkflow || existingWorkflow.deleted) {
                return res.status(404).json({ status: 404, message: "Workflow not found" });
            }

            const updatedWorkflow = await prisma.workflow.update({
                where: { id: parseInt(id) },
                data: payload,
            });

            return res.status(200).json({
                status: 200,
                message: "Workflow Updated Successfully",
                workflow: updatedWorkflow,
            });
        } catch (error) {
            if (error instanceof errors.E_VALIDATION_ERROR) {
                return res.status(400).json({ status: 400, message: "Validation Error", errors: error.messages });
            }
            console.error("Error updating Workflow:", error);
            return res.status(500).json({ status: 500, message: "Internal Server Error" });
        }
    }

    // Soft Delete Workflow
    static async destroy(req, res) {
        try {
            const { id } = req.params;

            const existingWorkflow = await prisma.workflow.findUnique({
                where: { id: parseInt(id) },
            });
            if (!existingWorkflow || existingWorkflow.deleted) {
                return res.status(404).json({ status: 404, message: "Workflow not found" });
            }

            await prisma.workflow.update({
                where: { id: parseInt(id) },
                data: { deleted: true, deleted_at: new Date() },
            });

            return res.status(200).json({
                status: 200,
                message: "Workflow Deleted Successfully",
            });
        } catch (error) {
            console.error("Error deleting Workflow:", error);
            return res.status(500).json({ status: 500, message: "Internal Server Error" });
        }
    }
}

export default WorkflowController;
