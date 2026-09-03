export interface MeasurementRange {
  label: string
  normalRange: string
}

export const MEASUREMENT_RANGES: MeasurementRange[] = [
  { label: 'Blood Pressure', normalRange: 'Normal: < 120/80 mmHg' },
  { label: 'Visceral Fat Level', normalRange: 'Normal: ≤ 5' },
  { label: 'Body Fat Percentage', normalRange: 'Normal: 10–20% (male), 18–28% (female)' },
  { label: 'BMI', normalRange: 'Normal: 18.5–24.9 kg/m²' },
  { label: 'Blood Glucose (fasting)', normalRange: 'Normal: 4.0–5.9 mmol/L' },
]
