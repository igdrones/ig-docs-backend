import vine from "@vinejs/vine";
import { CustomErrorReporter } from "./CustomErrorReporter.js";

vine.errorReporter = () => new CustomErrorReporter();

export const CreateWorkflowTypeSchema = vine.object({
    name: vine.string().minLength(3),
    description: vine.string().minLength(5),
});

export const UpdateWorkflowTypeSchema = vine.object({
    name: vine.string().minLength(3).optional(),
    description: vine.string().minLength(5).optional(),
});
