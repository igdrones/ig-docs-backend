import vine from "@vinejs/vine";
import { CustomErrorReporter } from "./CustomErrorReporter.js";

// Use a custom error reporter if required
vine.errorReporter = () => new CustomErrorReporter();

export const CreateStageSchema = vine.object({
    name: vine.string(),
    description: vine.string(),
    action_required: vine.boolean(),
    workflow_id: vine.number(),
    action_by_id: vine.number().optional(),
    role_id: vine.number(),
    status: vine.enum(['Created', 'Accepted', 'Rejected', 'Review', 'Reviewed', 'Opened', 'Completed']),
    node_stage: vine.enum(['Start', 'Intermediate', 'End']),
    stage_type: vine.enum(['Draft', 'Signature', 'Review', 'Finish']),
    node_position_x: vine.string(),
    node_position_y: vine.string(),
});

export const UpdateStageSchema = vine.object({
    id: vine.number().optional(),
    name: vine.string().optional(),
    description: vine.string().optional(),
    sequence: vine.number().optional(),
    action_required: vine.boolean().optional(),
    workflow_id: vine.number().optional(),
    action_by_id: vine.number().optional(),
    role_id: vine.number().optional(),
    status: vine.enum(['Created', 'Accepted', 'Rejected', 'Review', 'Reviewed', 'Opened', 'Completed']).optional(),
    node_stage: vine.enum(['Start', 'Intermediate', 'End']).optional(),
    stage_type: vine.enum(['Draft', 'Signature', 'Review', 'Finish']).optional(),
    node_position_x: vine.string(),
    node_position_y: vine.string(),
});


export const CreateStagesSchema = vine.array(CreateStageSchema);



export const UpdateStagesSchema = vine.array(UpdateStageSchema);


export const StagePositionsNextStageSchema = vine.array(
    vine.object({
        id: vine.number(),
        next_stage_id: vine.number().nullable(),
        node_position_x: vine.string(),
        node_position_y: vine.string(),
    }),
);


