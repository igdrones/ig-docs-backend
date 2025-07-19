
import {
  CreateStageSchema,
  UpdateStageSchema,
  CreateStagesSchema,
  UpdateStagesSchema,
  StagePositionsNextStageSchema,
} from "../Validations/schema/StageSchema.js";
import prisma from "../DB/db.config.js";
import vine, { errors } from "@vinejs/vine";

class StageController {
  static async store(req, res) {
    try {
      const validator = vine.compile(CreateStageSchema);
      const payload = await validator.validate(req.body);

      // Find the workflow by its ID
      const workflow = await prisma.workflow.findUnique({
        where: {
          id: payload.workflow_id,
        },
      });

      if (!workflow) {
        return res.status(404).json({
          status: 404,
          message: "Workflow not found",
        });
      }

      // Check if the role exists
      const role = await prisma.role.findUnique({
        where: {
          id: payload.role_id,
        },
      });

      if (!role) {
        return res.status(404).json({
          status: 404,
          message: "Role not found",
        });
      }

      // Retrieve the existing "Start" and "End" nodes in a single query
      const existingStages = await prisma.stages.findMany({
        where: {
          workflow_id: payload.workflow_id,
          node_stage: {
            in: ["Start", "End"], // Check for both "Start" and "End" stages
          },
        },
      });

      const startNode = existingStages.find(
        (stage) => stage.node_stage === "Start"
      );
      const endNode = existingStages.find(
        (stage) => stage.node_stage === "End"
      );

      // Validate "Start" node existence
      if (payload.node_stage === "Start" && startNode) {
        return res.status(400).json({
          status: 400,
          message: "Workflow already has a Start node",
        });
      }

      // Validate "End" node existence
      if (payload.node_stage === "End" && endNode) {
        return res.status(400).json({
          status: 400,
          message: "Workflow already has an End node",
        });
      }

      // Create the new stage
      const stage = await prisma.stages.create({
        data: payload,
        include: {
          role: {
            select: {
              id: true,
              name: true,
            },
          },
          action_by: {
            select: {
              id: true,
              name: true,
            },
          },
        },
      });

      return res.status(201).json({
        status: 201,
        message: "Stage Created Successfully",
        stage,
      });
    } catch (error) {
      if (error instanceof errors.E_VALIDATION_ERROR) {
        return res.status(400).json({
          status: 400,
          message: "Validation Error",
          errors: error.messages,
        });
      }
      console.error("Error creating stage:", error);
      return res.status(500).json({
        status: 500,
        message: "Internal Server Error",
      });
    }
  }

  static async getAll(req, res) {
    const { role_id, workflow_id } = req.query; // Get filters from query parameters

    try {
      const stages = await prisma.stages.findMany({
        where: {
          ...(role_id && { role_id: Number(role_id) }), // Filter by role_id if provided
          ...(workflow_id && { workflow_id: Number(workflow_id) }), // Filter by workflow_id if provided
        },
        include: {
          role: {
            select: {
              id: true,
              name: true,
            },
          },
          action_by: {
            select: {
              id: true,
              name: true,
            },
          },
        },
        orderBy: {
          sequence: "asc",
        },
      });

      return res.status(200).json({
        status: 200,
        message: "All stages fetched successfully",
        data: stages,
      });
    } catch (error) {
      console.error("Error fetching all stages:", error);
      return res.status(500).json({
        status: 500,
        message: "Internal Server Error",
      });
    }
  }

  static async getById(req, res) {
    try {
      const { id } = req.params;

      const stage = await prisma.stages.findUnique({
        where: { id: parseInt(id) },
        include: {
          workflow: true,
          action_by: true,
          role: true,
        },
      });

      if (!stage || stage.deleted) {
        return res.status(404).json({
          status: 404,
          message: "Stage not found",
        });
      }

      return res.status(200).json({
        status: 200,
        message: "Stage fetched Successfully",
        stage,
      });
    } catch (error) {
      console.error("Error fetching Stage by ID:", error);
      return res
        .status(500)
        .json({ status: 500, message: "Internal Server Error" });
    }
  }

  static async update(req, res) {
    try {
      const { id } = req.params;
  
      // Step 1: Validate incoming payload
      const validator = vine.compile(UpdateStageSchema);
      const payload = await validator.validate(req.body);
  
      // Step 2: Check if the stage exists and is not deleted
      const existingStage = await prisma.stages.findUnique({
        where: { id: parseInt(id, 10) },
      });
  
      if (!existingStage || existingStage.deleted) {
        return res.status(404).json({
          status: 404,
          message: "Stage not found or has been deleted",
        });
      }
  
      // Step 3: Validate workflow existence
      if (payload.workflow_id) {
        const workflow = await prisma.workflow.findUnique({
          where: { id: payload.workflow_id },
        });
  
        if (!workflow) {
          return res.status(404).json({
            status: 404,
            message: "Workflow not found",
          });
        }
      }
  
      // Step 4: Validate role existence
      if (payload.role_id) {
        const role = await prisma.role.findUnique({
          where: { id: payload.role_id },
        });
  
        if (!role) {
          return res.status(404).json({
            status: 404,
            message: "Role not found",
          });
        }
      }
  
      // Step 5: Check for "Start" and "End" node uniqueness
      if (payload.node_stage === "Start" || payload.node_stage === "End") {
        const conflictingStages = await prisma.stages.findMany({
          where: {
            workflow_id: payload.workflow_id || existingStage.workflow_id,
            node_stage: payload.node_stage, // Check for either "Start" or "End"
            NOT: { id: parseInt(id, 10) }, // Exclude the current stage
          },
        });
  
        if (conflictingStages.length > 0) {
          return res.status(400).json({
            status: 400,
            message: `Workflow already has a ${payload.node_stage} node`,
          });
        }
      }
  
      // Step 6: Update the stage
      const updatedStage = await prisma.stages.update({
        where: { id: parseInt(id, 10) },
        data: payload,
        include: {
          role: {
            select: {
              id: true,
              name: true,
            },
          },
          action_by: {
            select: {
              id: true,
              name: true,
            },
          },
        },
      });
  
      // Step 7: Return success response
      return res.status(200).json({
        status: 200,
        message: "Stage Updated Successfully",
        stage: updatedStage,
      });
    } catch (error) {
      // Handle validation errors
      if (error instanceof errors.E_VALIDATION_ERROR) {
        return res.status(400).json({
          status: 400,
          message: "Validation Error",
          errors: error.messages,
        });
      }
  
      // Handle other errors
      console.error("Error updating stage:", error);
      return res.status(500).json({
        status: 500,
        message: "Internal Server Error",
      });
    }
  }
  

  static async delete(req, res) {
    try {
      const { id } = req.params;

      const existingStage = await prisma.stages.findUnique({
        where: { id: parseInt(id) },
      });

      if (!existingStage || existingStage.deleted) {
        return res.status(404).json({
          status: 404,
          message: "Stage not found",
        });
      }

      await prisma.stages.delete({
        where: { id: parseInt(id) },
      });

      return res.status(200).json({
        status: 200,
        message: "Stage Deleted Successfully",
      });
    } catch (error) {
      console.error("Error deleting Stage:", error);
      return res
        .status(500)
        .json({ status: 500, message: "Internal Server Error" });
    }
  }

//   static async storeMany(req, res) {
//     try {
//       const validator = vine.compile(CreateStagesSchema);
//       const payload = await validator.validate(req.body);

//       const workflowIds = [
//         ...new Set(payload.map((stage) => stage.workflow_id)),
//       ];
//       const roleIds = [...new Set(payload.map((stage) => stage.role_id))];

//       const workflows = await prisma.workflow.findMany({
//         where: { id: { in: workflowIds } },
//       });

//       const roles = await prisma.role.findMany({
//         where: { id: { in: roleIds } },
//       });

//       if (
//         workflows.length !== workflowIds.length ||
//         roles.length !== roleIds.length
//       ) {
//         return res.status(404).json({
//           status: 404,
//           message: "One or more workflows or roles not found",
//         });
//       }

//       const createdStages = await Promise.all(
//         payload.map(async (stage) => {
//           return await prisma.stages.create({
//             data: stage,
//           });
//         })
//       );

//       return res.status(201).json({
//         status: 201,
//         message: "Stages Created Successfully",
//         stages: createdStages,
//       });
//     } catch (error) {
//       if (error instanceof errors.E_VALIDATION_ERROR) {
//         return res.status(400).json({
//           status: 400,
//           message: "Validation Error",
//           errors: error.messages,
//         });
//       }
//       console.error("Error creating stages:", error);
//       return res.status(500).json({
//         status: 500,
//         message: "Internal Server Error",
//       });
//     }
//   }

//   static async updateMany(req, res) {
//     try {
//       const validator = vine.compile(UpdateStagesSchema);
//       const payload = await validator.validate(req.body);

//       const stageIds = payload.map((item) => item.id);
//       const existingStages = await prisma.stages.findMany({
//         where: { id: { in: stageIds } },
//       });

//       if (existingStages.length !== stageIds.length) {
//         return res.status(404).json({
//           status: 404,
//           message: "One or more stages not found",
//         });
//       }

//       const updatePromises = payload.map(async (stageData) => {
//         return await prisma.stages.update({
//           where: { id: stageData.id },
//           data: stageData,
//         });
//       });

//       const updatedStages = await Promise.all(updatePromises);

//       return res.status(200).json({
//         status: 200,
//         message: "Stages Updated Successfully",
//         updatedStages,
//       });
//     } catch (error) {
//       if (error instanceof errors.E_VALIDATION_ERROR) {
//         return res.status(400).json({
//           status: 400,
//           message: "Validation Error",
//           errors: error.messages,
//         });
//       }
//       console.error("Error updating stages:", error);
//       return res.status(500).json({
//         status: 500,
//         message: "Internal Server Error",
//       });
//     }
//   }

  static async updateStagesWithPositionAndNext(req, res) {
    try {
      // Step 1: Validate incoming request payload
      const validator = vine.compile(StagePositionsNextStageSchema);
      const payload = await validator.validate(req.body);

      // Step 2: Use a transaction for bulk updates
      const updatedStageIds = await prisma.$transaction(async (prismaTx) => {
        const updates = payload.map(async (stage) => {
          // Check if the `next_stage_id` exists in the database
          if (stage.next_stage_id) {
            const nextStage = await prismaTx.stages.findUnique({
              where: { id: stage.next_stage_id },
            });

            if (!nextStage) {
              throw new Error(
                `Invalid next_stage_id: ${stage.next_stage_id} does not exist.`
              );
            }
          }

          // Perform the update for this stage
          await prismaTx.stages.update({
            where: { id: stage.id },
            data: {
              next_stage_id: stage.next_stage_id,
              node_position_x: stage.node_position_x,
              node_position_y: stage.node_position_y,
            },
          });

          return stage.id;
        });

        // Await all update operations and return the IDs of updated stages
        return Promise.all(updates);
      });

      // Step 3: Fetch all updated stages with the required structure
      const updatedStages = await prisma.stages.findMany({
        where: {
          id: { in: updatedStageIds },
        },
        include: {
          role: {
            select: {
              id: true,
              name: true,
            },
          },
          action_by: {
            select: {
              id: true,
              name: true,
            },
          },
        },
        orderBy: {
          sequence: "asc",
        },
      });

      // Step 4: Return success response with updated stages
      return res.status(200).json({
        status: 200,
        message: "Stages updated successfully.",
        stages: updatedStages,
      });
    } catch (error) {
      // Handle validation errors
      if (error instanceof errors.E_VALIDATION_ERROR) {
        return res.status(400).json({
          status: 400,
          message: "Validation Error",
          errors: error.messages,
        });
      }

      // Handle other errors
      console.error("Error updating stages:", error);
      return res.status(500).json({
        status: 500,
        message: "Internal Server Error",
      });
    }
  }
}

export default StageController;
