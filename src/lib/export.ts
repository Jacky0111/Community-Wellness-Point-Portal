export interface AssessmentExportRow {
  Name: string
  'Contact Number': string
  Date: string
  'Height (cm)': number | ''
  'Weight (kg)': number | ''
  BMI: number | ''
  'Body Fat (%)': number | ''
  'Visceral Fat Level': number | ''
  'Systolic BP': number | ''
  'Diastolic BP': number | ''
  'Blood Glucose': number | ''
  'Handled By': string
}

export interface AssessmentForExport {
  name: string
  contactNumber: string
  date: Date
  height: number | null
  weight: number | null
  bmi: number | null
  bodyFatPercent: number | null
  visceralFatLevel: number | null
  systolicBp: number | null
  diastolicBp: number | null
  bloodGlucose: number | null
  handledByPartner: { name: string }
}

export function toExportRow(a: AssessmentForExport): AssessmentExportRow {
  return {
    Name: a.name,
    'Contact Number': a.contactNumber,
    Date: a.date.toISOString().slice(0, 10),
    'Height (cm)': a.height ?? '',
    'Weight (kg)': a.weight ?? '',
    BMI: a.bmi ?? '',
    'Body Fat (%)': a.bodyFatPercent ?? '',
    'Visceral Fat Level': a.visceralFatLevel ?? '',
    'Systolic BP': a.systolicBp ?? '',
    'Diastolic BP': a.diastolicBp ?? '',
    'Blood Glucose': a.bloodGlucose ?? '',
    'Handled By': a.handledByPartner.name,
  }
}
