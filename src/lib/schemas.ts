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

const timestamp = z
  .string()
  .regex(/^\d+:\d{2}$/, 'Must be in m:ss format, e.g. "0:03"')
  .optional()
  .describe('Timestamp in the video clip, e.g. "0:03"')

export const VideoFormFeedbackSchema = FormFeedbackSchema.extend({
  positives: z
    .array(
      z.object({
        title: z.string().describe('Short label, e.g. "Neutral spine"'),
        description: z
          .string()
          .describe('Why this is correct and the biomechanical benefit'),
        timestamp,
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
        timestamp,
      })
    )
    .describe('Form issues that need correction'),
})

export type VideoFormFeedback = z.infer<typeof VideoFormFeedbackSchema>

export const LiveFeedbackSchema = z.object({
  recognised: z
    .boolean()
    .describe('Whether an exercise movement is visible and recognisable in the frame. False if the person is just standing, sitting, out of frame, or no workout is happening.'),
  cues: z
    .array(
      z.object({
        text: z.string().describe('Single actionable cue, max 6 words. e.g. "Drive knees out"'),
        severity: z.enum(['low', 'medium', 'high']),
      })
    )
    .describe('Up to 2 form corrections, ordered by severity descending. Empty if recognised is false.'),
  positive: z
    .string()
    .optional()
    .describe('One short positive observation, max 6 words. Omit if nothing notable or if recognised is false.'),
})

export type LiveFeedback = z.infer<typeof LiveFeedbackSchema>
