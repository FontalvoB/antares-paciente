import { afterEach, describe, expect, it, vi } from 'vitest'
import type { ButtonHTMLAttributes } from 'react'
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import { I18nProvider, useI18n } from '../../../i18n/I18nContext'
import { NutraceuticLesson } from '../NutraceuticLesson'
import { WearableMeasurementFeedback } from '../../../components/WearableMeasurementFeedback'
import { NutritionPlanTab } from '../../../components/nutrition/NutritionPlanTab'
import { ApiError } from '../../../utils/apiClient'

vi.mock('@ionic/react', async (original) => ({
  ...(await original<typeof import('@ionic/react')>()),
  IonButton: ({ children, onClick, disabled }: ButtonHTMLAttributes<HTMLButtonElement>) => <button disabled={disabled} onClick={onClick}>{children}</button>,
  IonIcon: () => null,
}))

function LanguageSwitch() {
  const { toggleLang } = useI18n()
  return <button onClick={toggleLang}>Switch language</button>
}

afterEach(() => { cleanup(); localStorage.clear() })

describe('English care flows', () => {
  it('localizes the unified nutrition plan macros while preserving clinical free text and meal types', () => {
    localStorage.setItem('antares_lang', 'en')
    const meal = { sortOrder: 1, mealType: 'Desayuno', description: 'Avena indicada por mi equipo', foods: 'Avena y fruta', calories: 400, proteinG: 20, carbsG: 50, fatG: 10, fiberG: 5 }
    const plan = { id: 'clinical', name: 'Plan clínico de noviembre', dailyCalorieTarget: 1800, dailyProteinTarget: 80,
      dailyCarbsTarget: 200, dailyFatTarget: 60, dailyFiberTarget: 25, meals: [meal] }
    const { container } = render(<I18nProvider><NutritionPlanTab plan={plan} isLoading={false} error={null}
      fallbackRows={[]} locale="en-US" onRetry={() => {}} /></I18nProvider>)
    expect(screen.getByText('1,800 kcal')).toBeTruthy()
    expect(document.documentElement.lang).toBe('en')
    const breakfast = container.querySelector('#nutrition-meal-des-0')!
    expect(within(breakfast as HTMLElement).getByRole('heading', { name: 'Breakfast' })).toBeTruthy()
    expect(within(breakfast as HTMLElement).getByText('Protein')).toBeTruthy()
    expect(within(breakfast as HTMLElement).getByText('20 g')).toBeTruthy()
    expect(within(breakfast as HTMLElement).getByText('Carbs')).toBeTruthy()
    expect(within(breakfast as HTMLElement).getByText('50 g')).toBeTruthy()
    expect(screen.getByText(meal.description)).toBeTruthy()
    expect(screen.getByText(meal.foods)).toBeTruthy()
    expect(screen.getByText(plan.name)).toBeTruthy()
    expect(meal.mealType).toBe('Desayuno')
    expect(meal.description).toBe('Avena indicada por mi equipo')
  })

  it('shows the matching approved nutrition translation and preserves meal-specific notes', () => {
    localStorage.setItem('antares_lang', 'en')
    const plan = { id: 'approved', name: 'Plan clínico', days: [{ dayNumber: 1, meals: [
      { mealType: 'Desayuno', foods: 'Avena: 50 g', notes: 'Revisar porciones', notesEn: 'Review portions' },
      { mealType: 'Almuerzo', foods: 'Pollo: 100 g', notes: 'Indicación específica del almuerzo', notesEn: null },
    ] }] }
    render(<I18nProvider><LanguageSwitch /><NutritionPlanTab plan={plan} isLoading={false} error={null} fallbackRows={[]} locale="en-US" onRetry={() => {}} /></I18nProvider>)
    expect(screen.getByText('Review portions')).toBeTruthy()
    expect(screen.queryByText('Revisar porciones')).toBeNull()
    expect(screen.getByText('Indicación específica del almuerzo')).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Switch language' }))
    expect(document.documentElement.lang).toBe('es')
    expect(screen.getByText('Revisar porciones')).toBeTruthy()
    expect(screen.queryByText('Review portions')).toBeNull()
    expect(plan.days[0].meals[0].notes).toBe('Revisar porciones')
    expect(plan.days[0].meals[0].notesEn).toBe('Review portions')
  })

  it('reformats a freshly logged nutraceutical timestamp when language changes', () => {
    const instant = new Date(2026, 10, 5, 16, 30).toISOString()
    render(<I18nProvider><LanguageSwitch /><NutraceuticLesson done pts={80} takenAt={instant} onComplete={() => {}} /></I18nProvider>)
    const date = new Date(instant)
    expect(screen.getByText(`Registrado · ${date.toLocaleTimeString('es-ES', { hour: 'numeric', minute: '2-digit' })}`)).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Switch language' }))
    expect(screen.getByText(`Logged · ${date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}`)).toBeTruthy()
  })

  it('updates an inline wearable recovery notice and its actions when language changes', () => {
    const result = { ok: false as const, kind: 'heart_rate' as const, message: 'No pudimos confirmar una nueva lectura. Inténtalo de nuevo.' }
    render(<I18nProvider><LanguageSwitch /><WearableMeasurementFeedback result={result} canMeasure
      onRetry={() => {}} onNext={() => {}} onClose={() => {}} /></I18nProvider>)
    expect(screen.getByText(result.message)).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Switch language' }))
    expect(screen.getByText('We could not confirm a new reading. Try again.')).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Retry' })).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Measure next' })).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Close' })).toBeTruthy()
    expect(screen.queryByText(result.message)).toBeNull()
    expect(result.message).toBe('No pudimos confirmar una nueva lectura. Inténtalo de nuevo.')
  })

  it('provides an English recovery message for an untranslated meal-plan error', () => {
    localStorage.setItem('antares_lang', 'en')
    const error = new ApiError({ message: 'Detalle técnico sin traducción', status: 503 })
    render(<I18nProvider><NutritionPlanTab plan={null} isLoading={false} error={error} fallbackRows={[]} locale="en-US" onRetry={() => {}} /></I18nProvider>)
    expect(screen.getByRole('alert').textContent).toBe('Could not load the meal plan')
    expect(screen.queryByText(error.message)).toBeNull()
  })
})
