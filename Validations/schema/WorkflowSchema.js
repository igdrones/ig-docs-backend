import vine from "@vinejs/vine";
import { CustomErrorReporter } from "./CustomErrorReporter.js";

vine.errorReporter = () => new CustomErrorReporter();

export const CreateWorkflowSchema = vine.object({
    name: vine.string().minLength(3),
    description: vine.string().minLength(5),
    workflow_type_id: vine.number(),
});

export const UpdateWorkflowSchema = vine.object({
    name: vine.string().minLength(3).optional(),
    description: vine.string().minLength(5).optional(),
    workflow_type_id: vine.number().optional(),
});
