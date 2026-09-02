import { describe, expect, it } from 'vitest'
import { toExportRow } from './export'

describe('toExportRow', () => {
  it('maps an assessment to a flat export row', () => {
    const row = toExportRow({
      name: 'Jane Doe',
      contactNumber: '+60123456789',
      date: new Date('2026-09-03'),
      height: 170,
      weight: 70,
      bmi: 24.2,
      bodyFatPercent: 22,
      visceralFatLevel: 4,
      systolicBp: 118,
      diastolicBp: 76,
      bloodGlucose: 5.2,
      handledByPartner: { name: 'Alex Tan' },
    })

    expect(row).toEqual({
      Name: 'Jane Doe',
      'Contact Number': '+60123456789',
      Date: '2026-09-03',
      'Height (cm)': 170,
      'Weight (kg)': 70,
      BMI: 24.2,
      'Body Fat (%)': 22,
      'Visceral Fat Level': 4,
      'Systolic BP': 118,
      'Diastolic BP': 76,
      'Blood Glucose': 5.2,
      'Handled By': 'Alex Tan',
    })
  })

  it('fills missing numeric fields with an empty string', () => {
    const row = toExportRow({
      name: 'Jane Doe',
      contactNumber: '+60123456789',
      date: new Date('2026-09-03'),
      height: null,
      weight: null,
      bmi: null,
      bodyFatPercent: null,
      visceralFatLevel: null,
      systolicBp: null,
      diastolicBp: null,
      bloodGlucose: null,
      handledByPartner: { name: 'Alex Tan' },
    })

    expect(row['Height (cm)']).toBe('')
    expect(row.BMI).toBe('')
  })
})
