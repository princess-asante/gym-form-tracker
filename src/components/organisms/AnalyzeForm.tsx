'use client'

import { useState } from 'react'
import { experimental_useObject as useObject } from '@ai-sdk/react'
import { FormFeedbackSchema } from '@/lib/schemas'
import ImageDropzone from '@/components/molecules/ImageDropzone'
import FeedbackPanel from '@/components/organisms/FeedbackPanel'
import Button from '@/components/atoms/Button'

export default function AnalyzeForm() {
  const [imageUrl, setImageUrl] = useState<string | null>(null)

  // useObject wires the component to our /api/analyze route.
  // It manages three things for us:
  //   object     — a DeepPartial of FormFeedback that fills in as tokens arrive
  //   isLoading  — true while the stream is open
  //   error      — set if the request fails
  //   submit     — kicks off the request with the given payload
  const { object, isLoading, error, submit } = useObject({
    api: '/api/analyze',
    schema: FormFeedbackSchema,
  })

  function handleAnalyze() {
    if (!imageUrl) return
    // submit() sends { image } as the JSON body to POST /api/analyze.
    // The route receives it via request.json() — this is the bridge between
    // the client hook and our server route handler.
    submit({ image: imageUrl })
  }

  const hasResult = !!object
  const canSubmit = !!imageUrl && !isLoading

  return (
    <div className="flex flex-col gap-8 w-full">
      <div className="flex flex-col gap-4">
        <ImageDropzone
          imageUrl={imageUrl}
          onImageChange={setImageUrl}
          disabled={isLoading}
        />

        <div className="flex items-center gap-3">
          <Button
            onClick={handleAnalyze}
            disabled={!canSubmit}
            loading={isLoading}
            className="w-full"
          >
            {isLoading ? 'Analysing…' : 'Analyse form'}
          </Button>

          {imageUrl && !isLoading && (
            <Button
              variant="ghost"
              onClick={() => setImageUrl(null)}
              aria-label="Remove image"
            >
              Clear
            </Button>
          )}
        </div>

        {error && (
          <p role="alert" className="text-sm text-red-600 dark:text-red-400">
            Something went wrong. Please try again.
          </p>
        )}
      </div>

      {/* FeedbackPanel renders as soon as the first tokens arrive, showing
          skeleton loaders for sections that haven't streamed in yet */}
      {(hasResult || isLoading) && (
        <FeedbackPanel feedback={object ?? {}} isLoading={isLoading} />
      )}
    </div>
  )
}
