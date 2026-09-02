import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getCurrentPartner } from '@/lib/authz'
import { assessmentInputSchema } from '@/lib/assessmentSchema'
import { calculateBmi } from '@/lib/bmi'

export async function POST(request: NextRequest) {
  const partner = await getCurrentPartner()
  if (!partner) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
  }

  const body = await request.json()
  const parsed = assessmentInputSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })
  }

  const input = parsed.data
  const bmi = input.bmi ?? calculateBmi(input.height ?? null, input.weight ?? null) ?? undefined

  const assessment = await prisma.assessment.create({
    data: {
      ...input,
      email: input.email || undefined,
      date: new Date(input.date),
      bmi,
      handledByPartnerId: partner.id,
    },
  })

  return NextResponse.json({ assessment }, { status: 201 })
}
