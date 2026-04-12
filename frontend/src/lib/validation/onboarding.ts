import { z } from 'zod'

export const onboardingAnswerSchema = z.object({
  questionId: z.string().min(1),
  value: z.string().min(1).max(1000),
})

export const submitOnboardingSchema = z.object({
  answers: z.array(onboardingAnswerSchema).min(1).max(20),
})

export type SubmitOnboardingInput = z.infer<typeof submitOnboardingSchema>
