import type { AssessmentInput } from '@/lib/assessmentSchema'

export interface FieldConfig {
  key: keyof AssessmentInput
  label: string
  required?: boolean
  type: 'text' | 'email' | 'tel' | 'date' | 'number'
}

export interface StepConfig {
  title: string
  fields: FieldConfig[]
}

export const steps: StepConfig[] = [
  {
    title: 'Personal Info',
    fields: [
      { key: 'email', label: 'Email', type: 'email' },
      { key: 'date', label: 'Date', required: true, type: 'date' },
      { key: 'name', label: 'Name', required: true, type: 'text' },
      { key: 'contactNumber', label: 'Contact Number', required: true, type: 'tel' },
      { key: 'age', label: 'Age', type: 'number' },
      { key: 'height', label: 'Height (cm)', type: 'number' },
    ],
  },
  {
    title: 'Body Composition',
    fields: [
      { key: 'weight', label: 'Weight (kg)', type: 'number' },
      { key: 'bodyFatPercent', label: 'Body Fat (%)', type: 'number' },
      { key: 'visceralFatLevel', label: 'Visceral Fat Level', type: 'number' },
      { key: 'restingMetabolism', label: 'Resting Metabolism', type: 'number' },
      { key: 'bmi', label: 'BMI (kg/m2)', type: 'number' },
      { key: 'bodyAge', label: 'Body Age', type: 'number' },
    ],
  },
  {
    title: 'Blood Pressure (Normal: < 120/80 mmHg)',
    fields: [
      { key: 'systolicBp', label: 'Systolic BP (mmHg)', type: 'number' },
      { key: 'diastolicBp', label: 'Diastolic BP (mmHg)', type: 'number' },
    ],
  },
  {
    title: 'Blood Glucose',
    fields: [{ key: 'bloodGlucose', label: 'Blood Glucose Level (mmol/L)', type: 'number' }],
  },
  {
    title: 'Notes',
    fields: [{ key: 'remarks', label: 'Remarks', type: 'text' }],
  },
]
