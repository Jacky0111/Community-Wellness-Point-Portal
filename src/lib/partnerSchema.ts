import { z } from 'zod'

export const partnerInputSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  email: z.string().email('A valid email is required'),
  roleId: z.string().min(1, 'A role is required'),
})

export type PartnerInput = z.infer<typeof partnerInputSchema>
