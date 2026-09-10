/**
 * Wire-type interfaces matching backend DTOs EXACTLY.
 * Source of truth: coppAddresdBack DTOs (ProgramProgressDtos.cs).
 * Dates: YYYY-MM-DD strings. Nullable date-times: ISO strings.
 * Additive fields: optional with safe defaults (R7.1).
 * verbatimModuleSyntax: use `import type` for all type imports.
 */

export type TaskCode = 'podcast' | 'vitals' | 'nut' | 'ejercicio' | 'nutraceutico' | 'emocional'

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

/**
 * Log de intake de hoy del snapshot `nut` (SPEC nutrition-intake-adherence):
 * verdad server-side del progreso nutricional. Para `nut` la lista SIEMPRE
 * viene materializada (`[]` sin logs, nunca null).
 */
export interface NutritionIntakeLogDto {
  mealCode: 'des' | 'alm' | 'mer' | 'cen' | 'agua'
  localDate: string
  calories?: number | null
  proteinG?: number | null
  carbsG?: number | null
  fatG?: number | null
  fiberG?: number | null
  waterMl?: number | null
  source: string
  foodAnalysisId?: string | null
  createdAt: string
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

/**
 * Nested vitals payload carried by `CompleteTaskInput` for the `vitals` task.
 * Wire contract mirrors the backend `VitalsPayload` record
 * (ProgramProgressDtos.cs): ints for fc/pa/spo2, decimals for glu/peso/temp.
 * All fields optional — an all-null payload is treated as "no vitals" and
 * does NOT alter completion behaviour (backwards compatible).
 * `measuredAt` is an ISO-8601 string when the client knows the measurement
 * time; the backend falls back to UtcNow when null.
 */
export interface VitalsPayload {
  heartRate?: number | null
  systolic?: number | null
  diastolic?: number | null
  o2Saturation?: number | null
  glucose?: number | null
  weightKg?: number | null
  temperatureC?: number | null
  measuredAt?: string | null
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
  /** Logs de intake de hoy (siempre `[]` para `nut`, nunca null). */
  nutritionIntakeLogs?: NutritionIntakeLogDto[] | null
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

/**
 * Streak chest from the snapshot (chests module): milestone definition from
 * the active STREAK_* catalog rules plus its REAL grant state from the XP
 * ledger (once-per-enrollment). The UI must render chests from this truth and
 * never derive claim state from `streak.current` (break + regrow would
 * resurrect already-paid chests). Additive field — treat as optional (R7.1).
 */
export interface StreakChestDto {
  days: number
  xp: number
  granted: boolean
  grantedAt?: string | null
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
  // Additive fields (R7.1) — optional
  streakChests?: StreakChestDto[] | null
  /**
   * Monto base REAL de la regla DAY_BONUS del catálogo (sin multiplicador);
   * el que compone `todayPointsMax`. 50 cuando la regla no existe/inactiva;
   * null solo en respuestas previas (R7.1).
   */
  dailyBonusAmount?: number | null
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
  // Additive (vital-signs-tracking): optional nested vitals for the `vitals`
  // task. Null/empty payloads are ignored by the backend (no behaviour change).
  vitals?: VitalsPayload | null
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
  /**
   * 5 dimensiones de la fila persistida del período anterior (la misma que
   * alimenta `previous`); null cuando no hay fila previa o en el primer
   * cómputo. Aditivo — nunca rompe clientes (R7.1).
   */
  dimensions_previous?: HealthScoreDimensionsDto | null
  score?: number
  indicators?: IndicatorDetailDto[] | null
}

export interface TransformationDetailDto {
  baseline: number
  current: number
  unit: string
  delta: number
  /**
   * Wire `delta_pct` (backend IndicatorDetailDto, snake_case): % de cambio
   * vs línea base. La app NO mapea el payload (scores-service pasa el body
   * intacto) → el tipo usa el nombre del WIRE, no una variante camelCase
   * que nunca llega. Aditivo: payloads previos sin él → ausente.
   */
  delta_pct?: number | null
  /**
   * Direccionalidad normalizada por el backend (additivo): true cuando el
   * cambio es FAVORABLE para la métrica (peso baja = favorable; glucosa sube
   * = NO favorable). Sin él (payload previo) no se puede inferir mejora —
   * los consumidores deben tratar el dato como ausente.
   */
  favorable?: boolean | null
  score?: number | null
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

// --- Scores history (Evo tab, GET /api/v1/program/me/scores-history) ---
// Contrato FROZEN: ASC por weekNumber, SOLO semanas persistidas (puede ser
// sparse/corta, ej. 1-2 puntos en la semana 2). Los scores pueden ser null en
// una semana persistida sin cómputo.

export interface ScoresHistoryPointDto {
  weekNumber: number
  periodStart: string | null
  periodEnd: string
  healthScore: number | null
  healthPrevious: number | null
  transformationScore: number | null
  /**
   * Aditivo (R7.1): dimensiones del Health Score de esa semana (wire
   * `dimensions`); null cuando la semana no tiene cómputo o en payloads
   * previos. Alimenta la tarjeta Adherencia del Home (dimensions.adherence).
   */
  dimensions?: HealthScoreDimensionsDto | null
}

export interface ScoresHistoryDto {
  points: ScoresHistoryPointDto[]
}

// --- Metrics history (Home, GET /api/v1/program/me/metrics-history) ---
// Contrato FROZEN (MetricsHistoryDtos.cs): `{ heightCm, metrics: [{ code,
// unit, target: {lo,hi}|null, favorableDirection: 'down'|'up'|null, points:
// [{date,value}] }] }` — SOLO códigos CON filas aparecen; fechas ASC. Puede
// 404 NO_ACTIVE_ENROLLMENT en backends sin desplegar (degradación honesta).

export type FavorableDirection = 'down' | 'up'

export interface MetricTargetDto {
  lo: number | null
  hi: number | null
}

export interface MetricPointDto {
  date: string
  value: number
}

export interface MetricSeriesDto {
  code: string
  unit: string | null
  target: MetricTargetDto | null
  favorableDirection: FavorableDirection | null
  points: MetricPointDto[]
}

export interface MetricsHistoryDto {
  heightCm: number | null
  metrics: MetricSeriesDto[]
}

// --- Nutrition ---

export interface NutritionLogResultDto {
  mealCode: string
  localDate: string
  xpAwarded: number
}

// --- League (LEAGUE v1, camelCase wire) ---

export type LeagueScope = 'state' | 'national'

export interface LeagueCohortDto {
  scope: LeagueScope
  stateCode: string | null
  participants: number
  /** ISO-8601: momento (UTC) en que se computó el cohorte. */
  computedAt: string
}

export interface LeagueMeDto {
  optedIn: boolean
  nickname: string | null
}

export interface LeagueEntryDto {
  position: number
  /** Nickname o código anónimo (2 letras + 4 dígitos, hash determinista). */
  display: string
  isMe: boolean
  value: number
}

export interface LeagueCategoryDto {
  /** Top 10 (+ fila propia real si está fuera del top 10). */
  entries: LeagueEntryDto[]
  /** null = sin valor en la categoría o sin opt-in. */
  myRank: number | null
  myValue: number | null
  totalParticipants: number
}

export interface LeagueCategoriesDto {
  racha: LeagueCategoryDto
  evo: LeagueCategoryDto
  adh: LeagueCategoryDto
  clin: LeagueCategoryDto
}

export interface LeagueResponseDto {
  cohort: LeagueCohortDto
  me: LeagueMeDto
  categories: LeagueCategoriesDto
}

export interface LeaguePreferencesInput {
  nickname: string | null
  optIn: boolean
}

export interface LeaguePreferencesDto {
  optedIn: boolean
  nickname: string | null
}

// --- Enrollment request ---

export interface EnrollRequest {
  patientId: null
  templateId?: string | null
  timezone: string
  startLocalDate?: string | null
}
