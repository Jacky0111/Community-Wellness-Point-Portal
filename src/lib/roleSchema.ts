import { z } from 'zod'
import { PERMISSION_KEYS } from './permissions'

const permissionsShape = Object.fromEntries(
  PERMISSION_KEYS.map((key) => [key, z.boolean().optional()])
) as Record<(typeof PERMISSION_KEYS)[number], z.ZodOptional<z.ZodBoolean>>

export const roleInputSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  permissions: z.object(permissionsShape),
})

export type RoleInput = z.infer<typeof roleInputSchema>
