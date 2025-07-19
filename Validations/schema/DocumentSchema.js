import vine from "@vinejs/vine";
import { CustomErrorReporter } from "./CustomErrorReporter.js";

// Use a custom error reporter if required
vine.errorReporter = () => new CustomErrorReporter();

export const CreateDocumentSchema = vine.object({
    name: vine.string().minLength(3),
    workflow_type_id: vine.number(),
    workflow_id: vine.number(),
});

export const UpdateDocumentSchema = vine.object({
    name: vine.string().minLength(3).optional(),
    current_version: vine.number().optional(),
    workflow_type_id: vine.number().optional(),
    filename: vine.string().minLength(3).optional(),
    file_url: vine.string().url().optional(),
    file_size: vine.number().positive().optional(),
    file_type: vine.string().minLength(2).optional(),
    current_stage: vine.number().optional(),
    created_by_id: vine.number().optional(),
});
