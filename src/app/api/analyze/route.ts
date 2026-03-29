import { anthropic } from '@ai-sdk/anthropic'
import { Output, streamText } from 'ai'
import { FormFeedbackSchema } from '@/lib/schemas'

// Tell Next.js this route does real work at request time — never cache it
export const dynamic = 'force-dynamic'

export async function POST(request: Request) {
  const { image } = await request.json()
  const [header, base64Data] = (image as string).split(',')
  const mediaType = header.match(/:(.*?);/)?.[1]

  if (!base64Data || !mediaType) {
    return new Response(JSON.stringify({ error: 'Invalid image format' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  const result = streamText({
    model: anthropic('claude-sonnet-4-6'),
    output: Output.object({ schema: FormFeedbackSchema }),
    system: `You are an expert strength and conditioning coach with deep knowledge
of biomechanics and injury prevention. Analyse the exercise form shown in the image.

Rules:
- Be specific: name joints, angles, and muscle groups rather than speaking in generalities
- For issues: state what is wrong, why it creates risk or inefficiency, and the exact cue to fix it
- For positives: state what is correct and the biomechanical reason it matters
- Severity guide: high = acute injury risk, medium = chronic overuse risk or power leak, low = minor refinement
- If you cannot clearly see enough of the body to assess a point, omit it rather than guessing`,

    messages: [
      {
        role: 'user',
        content: [
          {
            type: 'image',
            image: base64Data,
            mediaType: mediaType as 'image/jpeg' | 'image/png' | 'image/webp',
          },
          {
            type: 'text',
            text: 'Please analyse my exercise form.',
          },
        ],
      },
    ],
  })
  return result.toTextStreamResponse()
}
