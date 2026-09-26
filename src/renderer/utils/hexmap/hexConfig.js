/**
 * hexConfig.js — Централизованная конфигурация гексагональной карты
 *
 * Все ключевые числовые параметры, пороги LOD, лимиты зума, углы камеры,
 * переключатели органики/упрощения и анимаций собраны здесь с подробными комментариями на русском языке.
 */

// ==============================================================================
// 1. РАЗРЕШЕНИЕ И ПИКСЕЛИЗАЦИЯ (RESOLUTION & RETRO PIXEL-SCALE)
// ==============================================================================

/**
 * Масштаб внутреннего разрешения буфера рендеринга (Pixel-Scale):
 * - 1: Нативное HD-разрешение 1:1 без пикселизации (максимально четкие тонкие векторные линии).
 * - 2: Ретро 2x пиксель-арт (буфер рисуется в 0.5x от экрана и растягивается GPU через Nearest-Neighbor,
 *      каждый логический пиксель превращается в четкий блок 2×2 на мониторе).
 * - 3 и выше: Более крупная ретро-пикселизация (3×3, 4×4 блока).
 */
export let DEFAULT_PIXEL_SCALE = 1

export function setDefaultPixelScale(val) {
	DEFAULT_PIXEL_SCALE = Math.max(1, Number(val) || 1)
}

// ==============================================================================
// 2. КАМЕРА, МАСШТАБИРОВАНИЕ И ЗУМ (CAMERA & ZOOM)
// ==============================================================================

/**
 * Минимальный коэффициент зума (максимальное отдаление карты от игрока).
 * При этом значении карта видна максимально широко, камера переходит в плоский стратегический вид.
 */
export const DEFAULT_HEX_MIN_ZOOM = 0.5

/**
 * Максимальный коэффициент зума (максимальное приближение карты к игроку).
 * Позволяет рассмотреть детали построек, колеи дорог и изгибы рек вблизи.
 */
export const DEFAULT_HEX_MAX_ZOOM = 6

/**
 * Аддитивный шаг зума при прокрутке колесика мыши (скролл вверх = приближение, вниз = отдаление).
 * Значение прибавляется/вычитается из текущего zoom напрямую:
 * - 1.0:  Крупный прыжок (быстрый зум, 1 тик = 1 единица зума).
 * - 0.5:  Умеренный шаг (плавный зум, 2 тика = 1 единица зума).
 * - 0.25: Мелкий шаг (очень плавный зум).
 * Допустимо любое положительное число > 0.
 */
export const HEX_ZOOM_WHEEL_STEP = 0.5

/**
 * Аддитивный шаг приближения при клике по кнопке «➕» в оверлее навигации карты.
 */
export const HEX_ZOOM_BTN_STEP_IN = 1.0

/**
 * Аддитивный шаг отдаления при клике по кнопке «➖» в оверлее навигации карты.
 */
export const HEX_ZOOM_BTN_STEP_OUT = 1.0

/**
 * Минимальный угол наклона камеры (pitch) в градусах при максимальном отдалении (zoom = minZoom).
 * 0° — плоский ортогональный вид сверху вниз (картографический план).
 */
export const DEFAULT_HEX_MIN_PITCH = 0

/**
 * Максимальный угол наклона камеры (pitch) в градусах при максимальном приближении (zoom = maxZoom).
 * 60° — наклонная 2.5D перспектива с выраженным горизонтом и параллаксом горных вершин.
 */
export const DEFAULT_HEX_MAX_PITCH = 60

/**
 * Угол наклона камеры по умолчанию при старте сцены или сбросе камеры (в градусах).
 */
export const DEFAULT_HEX_INITIAL_PITCH = 45

/**
 * Фокусное расстояние перспективной камеры (в виртуальных пикселях).
 * Влияет на интенсивность перспективного схождения лучей к горизонту.
 */
export const DEFAULT_HEX_FOCAL_DISTANCE = 900

// ==============================================================================
// 3. ДЕТАЛИЗАЦИЯ ГРАНИЦ И РЕБЕР (LOD & ORGANIC CURVES)
// ==============================================================================

/**
 * Перманентный переключатель органических составных кривых Безье (Multi-Bend Bezier):
 * - true:  Органические извилистые берега, меандрические реки и гармоничные границы государств
 *          в стиле акварельной/ручной картографии.
 * - false: Перманентная строгая геометрия плоских шестиугольников (прямые грани).
 */
export let ENABLE_ORGANIC_EDGES = true

export function setEnableOrganicEdges(enabled) {
	ENABLE_ORGANIC_EDGES = Boolean(enabled)
}

/**
 * Порог перехода LOD 0 → LOD 1 (в экранных пикселях видимого радиуса гекса `screenRadius`):
 * - Если видимый радиус гекса на экране >= 20px (LOD 0):
 *   Включается полная детализация: кривые Безье, случайные UV-смещения текстур для каждой клетки,
 *   анимация волн и полупрозрачная разметка сетки.
 * - Если видимый радиус гекса < 20px (LOD 1):
 *   Кривые Безье автоматически заменяются на строгие прямые шестиугольники, текстуры объединяются
 *   в пакетные CanvasPattern слои (дает прирост скорости в 10–50 раз на больших картах).
 */
export const HEX_LOD_SCREEN_RADIUS_ORGANIC = 20

/**
 * Порог перехода LOD 1 → LOD 2 (ультра-упрощенный стратегический обзор Civilization / Total War):
 * - Если видимый радиус гекса на экране < 12px (LOD 2):
 *   Полностью подавляются линии сетки гексов (устраняется муар и темная рябь),
 *   биомы заливаются чистым сплошным цветом без текстур, спрайты холмов скрываются,
 *   а границы государств и крупные реки рисуются четкими контрастными линиями.
 */
export const HEX_LOD_SCREEN_RADIUS_STRATEGIC = 12

/**
 * Вычисляет текущий уровень детализации (LOD 0, 1 или 2) по экранному радиусу гексагона.
 * @param {number} screenRadius - Проекционный радиус гексагона в пикселях на экране
 * @returns {0|1|2}
 */
export function calculateLodLevel(screenRadius) {
	if (screenRadius < HEX_LOD_SCREEN_RADIUS_STRATEGIC) return 2
	if (screenRadius < HEX_LOD_SCREEN_RADIUS_ORGANIC) return 1
	return 0
}

// ==============================================================================
// 4. АНИМАЦИИ (ВОДА, РЕКИ, ВОЛНЫ)
// ==============================================================================

/**
 * Перманентный переключатель анимаций карты:
 * - true:  Анимации включены (течение рек с шевронами, мерцание и рябь воды океанов/озер).
 * - false: Все анимации остановлены перманентно (нулевая нагрузка на анимационный таймер GPU).
 */
export let ENABLE_HEX_ANIMATIONS = true

export function setEnableHexAnimations(enabled) {
	ENABLE_HEX_ANIMATIONS = Boolean(enabled)
}

/**
 * Доля диапазона отдаления, при превышении которой анимации воды и рек автоматически замирают.
 * Позволяет экономить заряд батареи и FPS при общем взгляде на материк:
 * - 0.0:  Анимации включены ВСЕГДА на любом отдалении.
 * - 1.0:  Анимации работают ТОЛЬКО при максимальном приближении (zoom = maxZoom).
 * - 0.75: Анимации замирают, если карту отдалили дальше чем на 75% диапазона
 *         (при min=0.75 и max=5.0 порог равен ≈ 1.81 зума; при zoom < 1.81 анимации спят).
 */
export let ANIM_DISABLE_ZOOM_FRACTION = 0

export function setAnimDisableZoomFraction(fraction) {
	ANIM_DISABLE_ZOOM_FRACTION = Math.max(0, Math.min(1, Number(fraction) || 0))
}

/**
 * Вычисляет абсолютное пороговое значение зума, ниже которого анимации выключаются.
 * @param {number} [minZoom=DEFAULT_HEX_MIN_ZOOM]
 * @param {number} [maxZoom=DEFAULT_HEX_MAX_ZOOM]
 * @param {number} [fraction=ANIM_DISABLE_ZOOM_FRACTION]
 * @returns {number}
 */
export function calculateAnimZoomThreshold(
	minZoom = DEFAULT_HEX_MIN_ZOOM,
	maxZoom = DEFAULT_HEX_MAX_ZOOM,
	fraction = ANIM_DISABLE_ZOOM_FRACTION
) {
	if (fraction <= 0) return 0
	return minZoom + (1 - fraction) * (maxZoom - minZoom)
}

/**
 * Определяет, должен ли наступить следующий тик анимации воды/рек.
 * Важная логика: при движении камеры анимации временно автоматом замораживаются,
 * чтобы не жечь FPS при панорамировании и зуме; в спокойном idle-режиме анимации продолжаются.
 */
export function shouldTriggerHexAnimTick({
	currentTime,
	lastAnimRenderTime,
	lastRenderDurationMs = 0,
	isCameraMoving = false,
	animFrameIntervalMs = ANIM_FRAME_INTERVAL_MS,
	frameBudgetMs = FRAME_BUDGET_MS
}) {
	if (isCameraMoving) return false
	const timeSinceAnimRender = currentTime - lastAnimRenderTime
	const prevFrameHeavy = lastRenderDurationMs > frameBudgetMs
	return !prevFrameHeavy && timeSinceAnimRender >= animFrameIntervalMs
}

// ==============================================================================
// 5. ТЕКСТУРЫ БИОМОВ И ЗЕМЛИ (BIOME TEXTURES)
// ==============================================================================

/**
 * Перманентный переключатель наложения текстур биомов (трава, равнины, снег, пустыня, тундра):
 * - true:  Текстуры накладываются поверх земли.
 * - false: Используются чистые векторные цвета биомов без фоновых растровых тайлов.
 */
export let ENABLE_BIOME_TEXTURES = true

export function setEnableBiomeTextures(enabled) {
	ENABLE_BIOME_TEXTURES = Boolean(enabled)
}

/**
 * Размер кропа (в тескелях) для поклеточного псевдослучайного UV-сэмплирования текстуры.
 * Оптимизирован под размер тайла 256×256.
 */
export const HEX_TEXTURE_CROP_PX = 128

/**
 * Запас охвата текстуры (Bleed) за пределами габаритов гексагона (1.25 = +25% запаса).
 * Гарантирует, что при любых органических выпираниях кривых Безье текстура не оборвется на краю.
 */
export const HEX_TEXTURE_BLEED = 1.25

// ==============================================================================
// 6. БЕЙДЖИ ПОСЕЛЕНИЙ (SETTLEMENT BADGES)
// ==============================================================================

/**
 * Порог масштаба камеры, ниже которого бейджи городов полностью скрываются из DOM.
 */
export const BADGE_AUTO_FADE_MIN_SCALE = 0.52

/**
 * Порог масштаба камеры, ниже которого начинается плавное затухание прозрачности бейджей (fade-out).
 */
export const BADGE_AUTO_FADE_MAX_SCALE = 0.72

/**
 * Минимальная дистанция по горизонтали (в пикселях экрана) между двумя бейджами
 * для предотвращения их визуального наслоения и наползания друг на друга.
 */
export const BADGE_COLLISION_DISTANCE_X = 72

/**
 * Минимальная дистанция по вертикали (в пикселях экрана) между двумя бейджами.
 */
export const BADGE_COLLISION_DISTANCE_Y = 26

// ==============================================================================
// 7. ПРОИЗВОДИТЕЛЬНОСТЬ И ЧАСТОТА РЕНДЕРА (PERFORMANCE & BUDGET)
// ==============================================================================

/**
 * Интервал обновления водной анимации в миллисекундах (~30 FPS = 33мс).
 * Статичная карта перерисовывается ТОЛЬКО по dirty-флагу (при зуме/пане/ховере),
 * а непрерывные волны воды тикают с частотой 30 кадров/сек, не сжигая GPU на 60-120 FPS.
 */
export const ANIM_FRAME_INTERVAL_MS = 33

/**
 * Бюджет времени одного кадра рендера (в миллисекундах, 14мс ≈ 85% от 16.6мс при 60Гц).
 * Если сложный кадр с органикой занял > 14мс, следующий анимационный тик пропускается
 * во избежание просадок интерфейса (Frame Budget Guard).
 */
export const FRAME_BUDGET_MS = 14

/**
 * Минимальный интервал между кадрами рендера в миллисекундах (глобальный FPS-лимит).
 * - 0:      Без ограничения (рендер на максимальной частоте монитора / rAF).
 * - 16.67:  ~60 FPS.
 * - 33.33:  ~30 FPS.
 * - 8.33:   ~120 FPS.
 * - 6.94:   ~144 FPS.
 * Устанавливается из настроек видео (SettingsVideo). Применяется в renderLoop
 * HexCanvas и IsoCanvas: если с прошлого рендера прошло меньше этого порога,
 * кадр пропускается и reschedule выполняется без отрисовки.
 */
export let FPS_LIMIT_INTERVAL_MS = 0

/**
 * Устанавливает целевой FPS-лимит.
 * @param {number} fps - Целевой FPS (0 = без ограничения)
 */
export function setFpsLimit(fps) {
	const n = Number(fps) || 0
	FPS_LIMIT_INTERVAL_MS = n > 0 ? 1000 / n : 0
}

// ==============================================================================
// 8. БАЗОВАЯ ГЕОМЕТРИЯ СЕТКИ (GRID GEOMETRY)
// ==============================================================================

/**
 * Базовый радиус описанной окружности гексагона в мировых координатах (в пикселях).
 * При радиусе 36: ширина ячейки = 72px, расстояние между колонками = 54px.
 */
export const DEFAULT_HEX_RADIUS = 36

/**
 * Вертикальный коэффициент сжатия для плоской 2D-изометрии (Tilt).
 */
export const DEFAULT_HEX_TILT = 0.7

/**
 * Коэффициент случайного смещения (джиттера) вершин сетки при органической деформации (±16% от радиуса).
 */
export const HEX_CORNER_JITTER_RATIO = 0.16

/**
 * Внутренний отступ лент государственных границ от ребер гексагона (0.08 = 8% от радиуса).
 * Создает сопредельные параллельные границы государств в стиле Civilization без взаимного перекрытия.
 */
export const BORDER_OFFSET_RATIO = 0.08

/**
 * Прозрачность (alpha) внешнего темного канта государственной границы (0.0 .. 1.0).
 */
export const BORDER_CASING_ALPHA = 0.78

/**
 * Прозрачность (alpha) внутреннего цветного ореола государственной границы (0.0 .. 1.0).
 */
export const BORDER_CORE_ALPHA = 0.3

// ==============================================================================
// СВОДНЫЙ ОБЪЕКТ КОНФИГУРАЦИИ (HEX_CONFIG)
// ==============================================================================

export const HEX_CONFIG = Object.freeze({
	resolution: {
		get pixelScale() {
			return DEFAULT_PIXEL_SCALE
		},
		set pixelScale(v) {
			setDefaultPixelScale(v)
		}
	},
	zoom: {
		minZoom: DEFAULT_HEX_MIN_ZOOM,
		maxZoom: DEFAULT_HEX_MAX_ZOOM,
		wheelStep: HEX_ZOOM_WHEEL_STEP,
		btnStepIn: HEX_ZOOM_BTN_STEP_IN,
		btnStepOut: HEX_ZOOM_BTN_STEP_OUT
	},
	camera: {
		minPitch: DEFAULT_HEX_MIN_PITCH,
		maxPitch: DEFAULT_HEX_MAX_PITCH,
		initialPitch: DEFAULT_HEX_INITIAL_PITCH,
		focalDistance: DEFAULT_HEX_FOCAL_DISTANCE
	},
	lod: {
		get enableOrganicEdges() {
			return ENABLE_ORGANIC_EDGES
		},
		set enableOrganicEdges(v) {
			setEnableOrganicEdges(v)
		},
		screenRadiusOrganic: HEX_LOD_SCREEN_RADIUS_ORGANIC,
		screenRadiusStrategic: HEX_LOD_SCREEN_RADIUS_STRATEGIC,
		calculateLodLevel
	},
	animation: {
		get enableAnimations() {
			return ENABLE_HEX_ANIMATIONS
		},
		set enableAnimations(v) {
			setEnableHexAnimations(v)
		},
		get disableZoomFraction() {
			return ANIM_DISABLE_ZOOM_FRACTION
		},
		set disableZoomFraction(v) {
			setAnimDisableZoomFraction(v)
		},
		calculateThreshold: calculateAnimZoomThreshold,
		frameIntervalMs: ANIM_FRAME_INTERVAL_MS,
		frameBudgetMs: FRAME_BUDGET_MS,
		get fpsLimitIntervalMs() {
			return FPS_LIMIT_INTERVAL_MS
		},
		set fpsLimitIntervalMs(fps) {
			setFpsLimit(fps)
		}
	},
	textures: {
		get enableTextures() {
			return ENABLE_BIOME_TEXTURES
		},
		set enableTextures(v) {
			setEnableBiomeTextures(v)
		},
		cropPx: HEX_TEXTURE_CROP_PX,
		bleed: HEX_TEXTURE_BLEED
	},
	badges: {
		fadeMinScale: BADGE_AUTO_FADE_MIN_SCALE,
		fadeMaxScale: BADGE_AUTO_FADE_MAX_SCALE,
		collisionDistanceX: BADGE_COLLISION_DISTANCE_X,
		collisionDistanceY: BADGE_COLLISION_DISTANCE_Y
	},
	geometry: {
		defaultRadius: DEFAULT_HEX_RADIUS,
		defaultTilt: DEFAULT_HEX_TILT,
		cornerJitterRatio: HEX_CORNER_JITTER_RATIO,
		borderOffsetRatio: BORDER_OFFSET_RATIO,
		borderCasingAlpha: BORDER_CASING_ALPHA,
		borderCoreAlpha: BORDER_CORE_ALPHA
	}
})

export default HEX_CONFIG
