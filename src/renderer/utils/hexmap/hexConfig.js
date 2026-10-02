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
export let DEFAULT_PIXEL_SCALE = 2

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
 * - Если видимый радиус гекса на экране >= 30px (LOD 0, zoom >= ~0.83 при R=36):
 *   Включается полная детализация: кривые Безье, случайные UV-смещения текстур для каждой клетки,
 *   анимация волн и полупрозрачная разметка сетки.
 * - Если видимый радиус гекса < 30px (LOD 1, zoom < ~0.83):
 *   Кривые Безье автоматически заменяются на строгие прямые шестиугольники, текстуры объединяются
 *   в пакетные CanvasPattern слои (дает прирост скорости в 10–50 раз на больших картах).
 */
export const HEX_LOD_SCREEN_RADIUS_ORGANIC = 30

/**
 * Порог перехода LOD 1 → LOD 2 (ультра-упрощенный стратегический обзор Civilization / Total War):
 * - Если видимый радиус гекса на экране < 19px (LOD 2, zoom < ~0.53 при R=36):
 *   Полностью подавляются линии сетки гексов (устраняется муар и темная рябь),
 *   биомы заливаются чистым сплошным цветом без текстур, спрайты холмов скрываются,
 *   а границы государств и крупные реки рисуются четкими контрастными линиями.
 */
export const HEX_LOD_SCREEN_RADIUS_STRATEGIC = 19

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
	frameBudgetMs = FRAME_BUDGET_MS,
	enableAnimations = ENABLE_HEX_ANIMATIONS,
	hasAnimatedElements = true
}) {
	if (!enableAnimations) return false
	if (!hasAnimatedElements) return false
	if (isCameraMoving) return false
	const timeSinceAnimRender = currentTime - lastAnimRenderTime
	return timeSinceAnimRender >= animFrameIntervalMs
}

// ==============================================================================
// 4.1. ВИЗУАЛИЗАЦИЯ И ТЕЧЕНИЕ РЕК (RIVER CONFIG: DELTA & PIXEL FLOW)
// ==============================================================================

/**
 * Глобальная конфигурация рендеринга рек:
 * 1) Дельта и устье реки (впадение в море/океан с плавным расширением и слиянием)
 * 2) Стилизованная пиксельная анимация течения (светлые и темные тона пикселей вместо пунктира)
 *
 * Все параметры открыты для изменения на лету из кода через объект RIVER_CONFIG
 * или вспомогательную функцию setRiverConfig().
 */
export const RIVER_CONFIG = {
	// --- Основные цвета реки ---
	colors: {
		/** Цвет воды реки (по умолчанию совпадает с цветом тайла побережья #0284c7 для бесшовного слияния) */
		waterColor: '#0284c7',
		/** Наличие темных береговых границ (по умолчанию false: чистая водная лента без темных бордеров) */
		hasBorder: false,
		/** Цвет береговой окантовки (если включена) */
		borderColor: '#0369a1'
	},

	// --- Дельта и устье реки (впадение в море / побережье) ---
	delta: {
		/** Включить плавное расширение устья при впадении в воду */
		enabled: true,
		/** Мягкий коэффициент расширения устья (1.3 .. 1.6 вместо чрезмерного) */
		flareMultiplier: 1.5,
		/** Вылет веера дельты в сторону водного гекса */
		reachRatio: 0.28
	},

	// --- Пиксельная анимация течения реки (кубики вместо полосок) ---
	flow: {
		/** Включить анимацию течения */
		enabled: true,
		/** Базовый размер одного кубика течения в пикселях (px × px) */
		pixelSize: 2.5,
		/** Скорость перемещения кубиков по течению (px/сек) */
		speed: 18.0,
		/** Плотность / детализация кубиков вдоль русла реки */
		density: 1.0,
		/** Число параллельных дорожек кубиков по ширине реки (1-3) */
		lanes: 3,
		/** Использовать исключительно квадратные кубики (не вытянутые полоски) */
		cubeOnly: true,
		/** Светлый тон кубиков (яркие блики на воде) */
		lightTone: '#7dd3fc',
		/** Промежуточный тон кубиков (лазурные переливы) */
		midTone: '#38bdf8',
		/** Темный тон кубиков (тени глубины, завихрения) */
		darkTone: '#0369a1',
		/** Акцентные пенные кубики */
		foamTone: '#ffffff'
	}
}

/**
 * Позволяет в любой момент динамически изменить настройки рек из внешнего кода.
 * @param {Object} options - { colors: { ... }, delta: { ... }, flow: { ... } }
 */
export function setRiverConfig(options = {}) {
	if (options.colors) {
		Object.assign(RIVER_CONFIG.colors, options.colors)
	}
	if (options.delta) {
		Object.assign(RIVER_CONFIG.delta, options.delta)
	}
	if (options.flow) {
		Object.assign(RIVER_CONFIG.flow, options.flow)
	}
}

// ==============================================================================
// 4.2. ПИКСЕЛЬНАЯ АНИМАЦИЯ ВОДНЫХ ГЕКСОВ (WATER CONFIG: PIXEL RIPPLES & SWELLS)
// ==============================================================================

/**
 * Конфигурация пиксельных волн и ряби для водных тайлов (побережье / озера и глубокий океан).
 * Заменяет устаревшие векторные дуги на стилизованные ступенчатые пиксельные волны
 * в стиле классического 16-bit пиксель-арта с трехтоновым объемом (гребень/блик, тело волны, тень впадины).
 */
export const WATER_CONFIG = {
	/** Включить пиксельную анимацию воды */
	enabled: true,
	/** Базовый размер пикселя волны в экранных px (масштабируется перспективой) */
	pixelSize: 2.0,
	/** Общий множитель скорости анимации ряби */
	speed: 1.0,
	/** Число независимых точек ряби на один водный гексагон (1..5) */
	ripplesPerHex: 3,
	/** Плавный дрейф волн с течением/ветром */
	drift: true,
	/** Цветовая палитра для мелководья и побережья (water) */
	coast: {
		/** Яркий солнечный блик/пена на гребне волны */
		highlight: '#ffffff',
		/** Основное светлое тело волны (лазурный) */
		mid: '#7dd3fc',
		/** Подчеркивающая нижняя тень впадины волны (глубокий бирюзовый) */
		shadow: '#0369a1'
	},
	/** Цветовая палитра для глубокого океана (ocean) */
	ocean: {
		/** Мягкий ледяной блик на океанской волне */
		highlight: '#93c5fd',
		/** Основное тело океанской волны (королевский синий) */
		mid: '#3b82f6',
		/** Глубокая темная впадина/бездна */
		shadow: '#172554'
	}
}

export function setWaterConfig(cfg) {
	if (!cfg || typeof cfg !== 'object') return
	if (cfg.enabled !== undefined) WATER_CONFIG.enabled = Boolean(cfg.enabled)
	if (cfg.pixelSize !== undefined)
		WATER_CONFIG.pixelSize = Math.max(1, Number(cfg.pixelSize) || 2.0)
	if (cfg.speed !== undefined) WATER_CONFIG.speed = Math.max(0, Number(cfg.speed) || 1.0)
	if (cfg.ripplesPerHex !== undefined)
		WATER_CONFIG.ripplesPerHex = Math.max(1, Math.min(6, Math.round(cfg.ripplesPerHex)))
	if (cfg.drift !== undefined) WATER_CONFIG.drift = Boolean(cfg.drift)
	if (cfg.coast) Object.assign(WATER_CONFIG.coast, cfg.coast)
	if (cfg.ocean) Object.assign(WATER_CONFIG.ocean, cfg.ocean)
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
 * Прозрачность (alpha) линий сетки/бордеров гексагонов (0.0 .. 1.0).
 * По умолчанию 0.4. При 0 линии сетки полностью скрываются.
 */
export let HEX_BORDER_ALPHA = 0

export function setHexBorderAlpha(alpha) {
	HEX_BORDER_ALPHA = Math.max(0, Math.min(1, Number(alpha) ?? 0.4))
}

/**
 * Прозрачность (alpha) внешнего темного канта государственной границы (0.0 .. 1.0).
 */
export let BORDER_CASING_ALPHA = 0.78

export function setBorderCasingAlpha(alpha) {
	BORDER_CASING_ALPHA = Math.max(0, Math.min(1, Number(alpha) ?? 0.78))
}

/**
 * Прозрачность (alpha) внутреннего цветного ореола государственной границы (0.0 .. 1.0).
 */
export let BORDER_CORE_ALPHA = 0.3

export function setBorderCoreAlpha(alpha) {
	BORDER_CORE_ALPHA = Math.max(0, Math.min(1, Number(alpha) ?? 0.3))
}

/**
 * Прозрачность (alpha) фоновой заливки территории государства (0.0 .. 1.0).
 * По умолчанию 0.16 (мягкая тонировка клеток цветом фракции).
 */
export let FACTION_FILL_ALPHA = 0.16

export function setFactionFillAlpha(alpha) {
	FACTION_FILL_ALPHA = Math.max(0, Math.min(1, Number(alpha) ?? 0.16))
}

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
		get hexBorderAlpha() {
			return HEX_BORDER_ALPHA
		},
		set hexBorderAlpha(v) {
			setHexBorderAlpha(v)
		},
		get borderCasingAlpha() {
			return BORDER_CASING_ALPHA
		},
		set borderCasingAlpha(v) {
			setBorderCasingAlpha(v)
		},
		get borderCoreAlpha() {
			return BORDER_CORE_ALPHA
		},
		set borderCoreAlpha(v) {
			setBorderCoreAlpha(v)
		},
		get factionFillAlpha() {
			return FACTION_FILL_ALPHA
		},
		set factionFillAlpha(v) {
			setFactionFillAlpha(v)
		}
	},
	borders: {
		get hexAlpha() {
			return HEX_BORDER_ALPHA
		},
		set hexAlpha(v) {
			setHexBorderAlpha(v)
		},
		get casingAlpha() {
			return BORDER_CASING_ALPHA
		},
		set casingAlpha(v) {
			setBorderCasingAlpha(v)
		},
		get coreAlpha() {
			return BORDER_CORE_ALPHA
		},
		set coreAlpha(v) {
			setBorderCoreAlpha(v)
		},
		get fillAlpha() {
			return FACTION_FILL_ALPHA
		},
		set fillAlpha(v) {
			setFactionFillAlpha(v)
		},
		offsetRatio: BORDER_OFFSET_RATIO
	},
	rivers: RIVER_CONFIG,
	water: WATER_CONFIG
})

export default HEX_CONFIG
