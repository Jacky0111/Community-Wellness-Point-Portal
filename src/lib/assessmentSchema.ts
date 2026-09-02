import { z } from 'zod'

export const assessmentInputSchema = z.object({
  email: z.string().email().optional().or(z.literal('')),
  date: z.string().min(1, 'Date is required'),
  name: z.string().min(1, 'Name is required'),
  contactNumber: z.string().min(1, 'Contact number is required'),
  age: z.number().int().positive().optional(),
  height: z.number().positive().optional(),
  weight: z.number().positive().optional(),
  bodyFatPercent: z.number().min(0).max(100).optional(),
  visceralFatLevel: z.number().min(0).optional(),
  bmi: z.number().positive().optional(),
  restingMetabolism: z.number().positive().optional(),
  bodyAge: z.number().int().positive().optional(),
  systolicBp: z.number().int().positive().optional(),
  diastolicBp: z.number().int().positive().optional(),
  bloodGlucose: z.number().positive().optional(),
  remarks: z.string().optional(),
})

export type AssessmentInput = z.infer<typeof assessmentInputSchema>
