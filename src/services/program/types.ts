/**
 * Wire-type interfaces matching backend DTOs EXACTLY.
 * Source of truth: coppAddresdBack DTOs (ProgramProgressDtos.cs).
 * Dates: YYYY-MM-DD strings. Nullable date-times: ISO strings.
 * Additive fields: optional with safe defaults (R7.1).
 * verbatimModuleSyntax: use `import type` for all type imports.
 */

export type TaskCode = 'podcast' | 'vitals' | 'nut' | 'ejercicio' | 'nutribiotico' | 'emocional'

export type TaskStatus = 'Pending' | 'Completed'

export type WeekStatus = 'Locked' | 'Active' | 'Completed'

export type EnrollmentStatus = 'Active' | 'Paused' | 'Withdrawn'

// --- Nested DTOs ---

export interface NutritionMealDto {
  mealType: string
  description?: string | null
  foods?: string | null
  calories?: number | null
  proteinG?: number | null
  carbsG?: number | null
  fatG?: number | null
  fiberG?: number | null
  waterMl?: number | null
  notes?: string | null
  sortOrder: number
}

export interface ExerciseItemDto {
  name: string
  description?: string | null
  sets?: number | null
  repetitions?: number | null
  durationSecs?: number | null
  restSeconds?: number | null
  targetMuscle?: string | null
  equipment?: string | null
  tips?: string | null
  sortOrder: number
}

export interface PodcastChapterDto {
  atSeconds: number
  label: string
}

export interface RecentVitalsDto {
  heartRate?: number | null
  systolic?: number | null
  diastolic?: number | null
  o2Saturation?: number | null
  glucose?: number | null
  weightKg?: number | null
  temperatureC?: number | null
  recordedAt?: string | null
}

export interface TodayTaskContentDto {
  mediaId?: string | null
  title?: string | null
  durationSecs?: number | null
  thumbnailUrl?: string | null
  nutritionPlanId?: string | null
  nutritionPlanName?: string | null
  nutritionPlanDayNumber?: number | null
  dailyCalorieTarget?: number | null
  dailyProteinTarget?: number | null
  dailyCarbsTarget?: number | null
  dailyFatTarget?: number | null
  dailyFiberTarget?: number | null
  nutritionMeals?: NutritionMealDto[] | null
  exerciseRoutineId?: string | null
  exerciseRoutineName?: string | null
  recentVitals?: RecentVitalsDto | null
  author?: string | null
  description?: string | null
  mediaUrl?: string | null
  chapters?: PodcastChapterDto[] | null
  takeaways?: string[] | null
  contentUnavailable?: boolean
  exercises?: ExerciseItemDto[] | null
}

export interface TodayTaskDto {
  taskCode: TaskCode
  title: string
  short: string
  points: number
  status: TaskStatus
  completedAt: string | null
  content?: TodayTaskContentDto | null
}

export interface XpInfoDto {
  balance: number
  level: string
  nextLevelAt: number
}

export interface NbNextMilestoneDto {
  days: number
  xp: number
  daysRemaining: number
}

export interface StreakInfoDto {
  current: number
  longest: number
  freezesRemaining: number
  multiplierActive: number
  multiplierEndsAt: string | null
  multiplierRemainingHours: number
  // Additive fields (R7.1) — optional
  nbStreak?: number | null
  nbLongestStreak?: number | null
  nbNextMilestone?: NbNextMilestoneDto | null
  nbWeekDays?: boolean[] | null
}

export interface ProgramTemplateDto {
  id: string
  code: string
  name: string
  totalWeeks: number
  currentWeekNumber: number
  currentWeekStatus: WeekStatus
  currentWeekStartDateLocal: string
  currentWeekEndDateLocal: string
  // Additive fields (R7.1) — optional
  streakMinTasks?: number | null
  essentialTaskCodes?: TaskCode[] | null
}

// --- Top-level DTOs ---

export interface ProgramSnapshotDto {
  enrollmentId: string
  template: ProgramTemplateDto
  todayLocalDate: string
  todayTasks: TodayTaskDto[]
  todayPoints: number
  todayBonusAvailable: boolean
  todayPointsMax: number
  xp: XpInfoDto
  streak: StreakInfoDto
  nextMilestoneDays: number
  calendar: unknown[]
}

export interface ProgramEnrollmentDto {
  id: string
  patientId: string
  templateId: string
  status: EnrollmentStatus
  xpBalance: number
  streakCurrent: number
  freezesRemaining: number
  // Additive fields (R7.1) — optional
  startedAt?: string | null
}

export interface CompleteTaskInput {
  enrollmentId: string
  localDate: string
  taskCode: TaskCode
  clientRequestId: string
  clientCompletedAt?: string
  moodScore?: number
  barriers?: string
  contentFingerprint?: string
}

export interface CompleteTaskResponseDto {
  taskCompletionId: string
  pointsAwarded: number
  xpBalanceAfter: number
  isPerfectDay: boolean
  dailyBonusAwarded: number
  streakCurrent: number
  freezesRemaining: number
  dayPoints: number
  dayPointsMax: number
}

// --- Calendar ---

export interface CalendarDayDetailDto {
  localDate: string
  weekday: string
  weekNumber: number
  isPerfectDay: boolean
  points: number
  bonusAwarded: number
  completedTaskCodes: TaskCode[]
}

export interface CalendarSummaryDto {
  perfectDays: number
  missedDays: number
  totalXp: number
}

export interface ProgramCalendarDto {
  days: CalendarDayDetailDto[]
  summary: CalendarSummaryDto
}

// --- Path ---

export interface ProgramPathWeekDto {
  weekNumber: number
  status: WeekStatus
  isPerfectWeek: boolean
  points: number
  weekStartDateLocal: string
  weekEndDateLocal: string
}

export interface ProgramPathDto {
  weeks: ProgramPathWeekDto[]
}

// --- Scores ---

export interface IndicatorDetailDto {
  name: string
  value: number
  maxValue: number
  unit?: string | null
}

export interface HealthScoreDimensionsDto {
  adherence: number
  clinical: number
  nutrition: number
  psychology: number
  exercise: number
}

export interface HealthScoreDto {
  current: number
  previous?: number | null
  trend: string
  dimensions?: HealthScoreDimensionsDto | null
  score?: number
  indicators?: IndicatorDetailDto[] | null
}

export interface TransformationDetailDto {
  name: string
  baseline: number
  current: number
  unit: string
  delta: number
  changePercent?: number | null
}

export interface TransformationScoreDto {
  current: number
  previous?: number | null
  trend: string
  week?: number
  detail?: Record<string, TransformationDetailDto> | null
  score?: number
  indicators?: IndicatorDetailDto[] | null
}

export interface ScoresResponseDto {
  health_score?: HealthScoreDto
  transformation_score?: TransformationScoreDto
  healthScore?: HealthScoreDto
  transformationScore?: TransformationScoreDto
}

// --- Nutrition ---

export interface NutritionLogResultDto {
  mealCode: string
  localDate: string
  xpAwarded: number
}

// --- Enrollment request ---

export interface EnrollRequest {
  patientId: null
  templateId?: string | null
  timezone: string
  startLocalDate?: string | null
}
