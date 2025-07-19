import vine from "@vinejs/vine";

import { CustomErrorReporter } from "./CustomErrorReporter.js";

// Use a custom error reporter if required
vine.errorReporter = () => new CustomErrorReporter();

export const FieldSchema = vine.object({
  field_name: vine.string().minLength(3),
  field_type: vine.enum(['Text', 'Signature']),
  page_numbers: vine.number(),
  field_label: vine.string().minLength(3),
  x_coordinates: vine.number(),
  y_coordinates: vine.number(),
  font_size: vine.number().optional(),
  width: vine.number().optional(),
  height: vine.number().optional(),
  stages: vine.number().positive(),
});

export const CreateDocumentFieldSchema = vine.object({
    document_id: vine.number(),
    doc_data: vine.array(FieldSchema)

})


export const UpdateDocumentFieldSchema = vine.object({
    doc_data: vine.array(FieldSchema)
})
