"use client";

import { useState } from "react";
import { experimental_useObject as useObject } from "@ai-sdk/react";
import Swal from "sweetalert2";
import { FormFeedbackSchema } from "@/lib/schemas";
import ImageDropzone from "@/components/molecules/ImageDropzone";
import FeedbackPanel from "@/components/organisms/FeedbackPanel";
import Button from "@/components/atoms/Button";

export default function AnalyzeForm() {
  const [imageUrl, setImageUrl] = useState<string | null>(null);

  const { object, isLoading, submit } = useObject({
    api: "/api/analyze",
    schema: FormFeedbackSchema,
    onError: () => {
      Swal.fire({
        icon: "error",
        title: "Oops...",
        text: "Something went wrong!",
      });
    },
  });

  function handleAnalyze() {
    if (!imageUrl) return;
    submit({ image: imageUrl });
  }

  const hasResult = !!object;
  const canSubmit = !!imageUrl && !isLoading;

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
            {isLoading ? "Analysing…" : "Analyse form"}
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
      </div>

      {(hasResult || isLoading) && (
        <FeedbackPanel feedback={object ?? {}} isLoading={isLoading} />
      )}
    </div>
  );
}
