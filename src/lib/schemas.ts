import { z } from 'zod'

export const FormFeedbackSchema = z.object({
  overallAssessment: z
    .string()
    .describe('1-2 sentence summary of the overall form quality'),

  positives: z
    .array(
      z.object({
        title: z.string().describe('Short label, e.g. "Neutral spine"'),
        description: z
          .string()
          .describe('Why this is correct and the biomechanical benefit'),
      })
    )
    .describe('Things the person is doing correctly'),

  issues: z
    .array(
      z.object({
        title: z.string().describe('Short label, e.g. "Knee cave"'),
        description: z
          .string()
          .describe('What is wrong, why it matters, and how to fix it'),
        severity: z
          .enum(['low', 'medium', 'high'])
          .describe(
            'high = injury risk, medium = inefficiency, low = minor refinement'
          ),
      })
    )
    .describe('Form issues that need correction'),
})

export type FormFeedback = z.infer<typeof FormFeedbackSchema>
