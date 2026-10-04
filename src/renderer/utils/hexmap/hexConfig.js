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
		/** Базовый размер одного кубика течения в пикселях (по умолчанию динамически совпадает с размером пикселей воды) */
		get pixelSize() {
			if (this._pixelSize !== undefined && this._pixelSize !== null) {
				return this._pixelSize
			}
			return WATER_CONFIG.surfaceNoise?.pixelSize ?? WATER_CONFIG.pixelSize ?? 1.0
		},
		set pixelSize(val) {
			this._pixelSize = val !== null && val !== undefined ? Number(val) : undefined
		},
		/** Скорость перемещения кубиков по течению (px/сек) */
		speed: 18.0,
		/** Плотность / детализация кубиков вдоль русла реки */
		density: 1.0,
		/** Число параллельных дорожек кубиков по ширине реки (1-3) */
		lanes: 3,
		/** Использовать исключительно квадратные кубики (не вытянутые полоски) */
		cubeOnly: true,
		/** Светлый тон кубиков (по умолчанию наследует единый цвет блика воды WATER_CONFIG.colors.highlight) */
		get lightTone() {
			if (this._lightTone !== undefined && this._lightTone !== null) {
				return this._lightTone
			}
			return WATER_CONFIG.colors?.highlight || '#7dd3fc'
		},
		set lightTone(val) {
			this._lightTone = val !== null && val !== undefined ? String(val) : undefined
		},
		/** Промежуточный тон кубиков (по умолчанию наследует средний лазурный тон воды WATER_CONFIG.colors.mid) */
		get midTone() {
			if (this._midTone !== undefined && this._midTone !== null) {
				return this._midTone
			}
			return WATER_CONFIG.colors?.mid || '#38bdf8'
		},
		set midTone(val) {
			this._midTone = val !== null && val !== undefined ? String(val) : undefined
		},
		/** Темный тон кубиков (по умолчанию наследует тень глубины воды WATER_CONFIG.colors.shadow) */
		get darkTone() {
			if (this._darkTone !== undefined && this._darkTone !== null) {
				return this._darkTone
			}
			return WATER_CONFIG.colors?.shadow || '#0369a1'
		},
		set darkTone(val) {
			this._darkTone = val !== null && val !== undefined ? String(val) : undefined
		},
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
	/** Базовый размер пикселя волны в экранных px (масштабируется перспективой, по умолчанию 1.0) */
	pixelSize: 2.0,
	/** Общий множитель скорости анимации ряби */
	speed: 1.0,
	/** Число независимых точек ряби на один водный гексагон (1..5) */
	ripplesPerHex: 5,
	/** Плавный дрейф волн с течением/ветром */
	drift: true,
	/** Параметры динамики волн (накат к суше, наклон гребня, дистанция) */
	waves: {
		/** Включить накат волн по направлению к ближайшей суше (true = к берегу, false = свободный дрейф) */
		shoreDrift: true,
		/** Дистанция наката волны за жизненный цикл (в мировых px) */
		driftDistance: 6.0,
		/**
		 * Степень смещения/наклона гребня и тела волны вперед от основания (эффект наката волны):
		 * - 0.0: строго вертикально (без наклона)
		 * - 1.0: естественный накат (гребень смещается вперед на 1..2 px в сторону движения)
		 * - 1.5..2.0: выраженный серф / крутая накатывающаяся волна
		 */
		crestLeaning: 1.0,
		/** Направление движения волн в открытом море при отсутствии берега рядом (угол в радианах) */
		openWaterAngle: 0.4
	},
	/** Удобные геттеры/сеттеры верхнего уровня */
	get shoreDrift() {
		return this.waves.shoreDrift
	},
	set shoreDrift(v) {
		this.waves.shoreDrift = Boolean(v)
	},
	get driftDistance() {
		return this.waves.driftDistance
	},
	set driftDistance(v) {
		this.waves.driftDistance = Math.max(0, Number(v) || 0)
	},
	get crestLeaning() {
		return this.waves.crestLeaning
	},
	set crestLeaning(v) {
		this.waves.crestLeaning = Math.max(0, Number(v) || 0)
	},
	get openWaterAngle() {
		return this.waves.openWaterAngle
	},
	set openWaterAngle(v) {
		this.waves.openWaterAngle = Number(v) || 0.4
	},
	/** Единая цветовая палитра для всей воды (волны, рябь, частицы и реки): 3 градации */
	colors: {
		/** Мягкий небесно-голубой солнечный блик (не слепяще-белый) */
		highlight: 'rgba(78, 166, 207, 0.85)',
		/** Средний лазурный тон водной поверхности */
		mid: 'rgba(42, 149, 196, 0.75)',
		/** Глубокий бирюзово-синий пиксель тени */
		shadow: 'rgba(3, 105, 161, 0.80)'
	},
	/** Алиасы для обратной совместимости со старыми вызовами coast/ocean */
	get coast() {
		return this.colors
	},
	set coast(val) {
		if (val) Object.assign(this.colors, val)
	},
	get ocean() {
		return this.colors
	},
	set ocean(val) {
		if (val) Object.assign(this.colors, val)
	},
	/** Настройки 1-пиксельных частичек мерцания поверхности воды (Water Surface Particles / Noise) */
	surfaceNoise: {
		/** Включить частички поверхности воды */
		enabled: true,
		/** Скорость мерцания частиц */
		speed: 0.2,
		/** Базовый размер частицы в пикселях (по умолчанию динамически совпадает с WATER_CONFIG.pixelSize) */
		get pixelSize() {
			if (this._pixelSize !== undefined && this._pixelSize !== null) {
				return this._pixelSize
			}
			return WATER_CONFIG.pixelSize ?? 1.0
		},
		set pixelSize(val) {
			this._pixelSize = val !== null && val !== undefined ? Number(val) : undefined
		},
		/** Общий множитель плотности/количества частиц на гекс (1.0 = норма, 0.5 = реже, 2.0 = гуще) */
		density: 1.0,
		/** Число точек частиц на гекс в зависимости от дистанции камеры */
		particlesPerHex: {
			min: 20,
			normal: 24,
			max: 32
		},
		/** Прозрачность/интенсивность шума */
		opacity: 0.85,
		/** Единые цвета частиц (наследуют единую палитру WATER_CONFIG.colors) */
		get colors() {
			return WATER_CONFIG.colors
		},
		set colors(val) {
			if (val) Object.assign(WATER_CONFIG.colors, val)
		},
		/** Алиасы для обратной совместимости со старыми вызовами coast/ocean */
		get coast() {
			return this.colors
		},
		set coast(val) {
			if (val) Object.assign(this.colors, val)
		},
		get ocean() {
			return this.colors
		},
		set ocean(val) {
			if (val) Object.assign(this.colors, val)
		}
	}
}

export function setWaterConfig(cfg) {
	if (!cfg || typeof cfg !== 'object') return
	if (cfg.enabled !== undefined) WATER_CONFIG.enabled = Boolean(cfg.enabled)
	if (cfg.pixelSize !== undefined)
		WATER_CONFIG.pixelSize = Math.max(0.5, Number(cfg.pixelSize) || 1.0)
	if (cfg.speed !== undefined) WATER_CONFIG.speed = Math.max(0, Number(cfg.speed) || 1.0)
	if (cfg.ripplesPerHex !== undefined)
		WATER_CONFIG.ripplesPerHex = Math.max(1, Math.min(6, Math.round(cfg.ripplesPerHex)))
	if (cfg.drift !== undefined) WATER_CONFIG.drift = Boolean(cfg.drift)
	if (cfg.waves) Object.assign(WATER_CONFIG.waves, cfg.waves)
	if (cfg.shoreDrift !== undefined) WATER_CONFIG.shoreDrift = Boolean(cfg.shoreDrift)
	if (cfg.driftDistance !== undefined)
		WATER_CONFIG.driftDistance = Math.max(0, Number(cfg.driftDistance) || 0)
	if (cfg.crestLeaning !== undefined)
		WATER_CONFIG.crestLeaning = Math.max(0, Number(cfg.crestLeaning) || 0)
	if (cfg.openWaterAngle !== undefined)
		WATER_CONFIG.openWaterAngle = Number(cfg.openWaterAngle) || 0.4
	if (cfg.colors) Object.assign(WATER_CONFIG.colors, cfg.colors)
	if (cfg.coast) Object.assign(WATER_CONFIG.colors, cfg.coast)
	if (cfg.ocean) Object.assign(WATER_CONFIG.colors, cfg.ocean)
	if (cfg.surfaceNoise) {
		const sn = cfg.surfaceNoise
		if (sn.enabled !== undefined) WATER_CONFIG.surfaceNoise.enabled = Boolean(sn.enabled)
		if (sn.speed !== undefined) WATER_CONFIG.surfaceNoise.speed = Number(sn.speed) || 0.85
		if (sn.pixelSize !== undefined) WATER_CONFIG.surfaceNoise.pixelSize = Math.max(0.5, Number(sn.pixelSize) || 1.0)
		if (sn.density !== undefined) WATER_CONFIG.surfaceNoise.density = Math.max(0.1, Number(sn.density) || 1.0)
		if (sn.particlesPerHex) Object.assign(WATER_CONFIG.surfaceNoise.particlesPerHex, sn.particlesPerHex)
		if (sn.colors) Object.assign(WATER_CONFIG.surfaceNoise.colors, sn.colors)
		if (sn.coast) Object.assign(WATER_CONFIG.surfaceNoise.colors, sn.coast)
		if (sn.ocean) Object.assign(WATER_CONFIG.surfaceNoise.colors, sn.ocean)
	}
}

// ==============================================================================
// 4.3. ДОРОГИ И ЗАПЕКАЕМАЯ СИСТЕМА ЧАСТИЦ (ROAD CONFIG & GRAVEL PARTICLES)
// ==============================================================================

/**
 * Конфигурация дорог и запекаемой системы частиц гравия / мягких обочин:
 * 1) Отсутствие жестких темных бордеров (чистое естественное полотно)
 * 2) Суженная гравийная проселочная дорога (1.8px вместо 2.5px)
 * 3) Запекаемая в статический оффскрин-холст система частиц (zero-lag):
 *    - Внутренние частицы гравия и камня вдоль полотна
 *    - Прогрессивное рассеивание с боков от частого к редкому (мягкие органические края)
 *    - Плавное смешивание и разброс частиц на перекрёстках и развилках
 */
export const ROAD_CONFIG = {
	/** Наличие темных обводок/бордеров у дорог (false = чистые дороги без жестких контуров) */
	hasBorder: false,
	/** Базовая ширина гравийной просёлочной дороги */
	dirtWidth: 1.5,
	/** Базовая ширина каменной дороги */
	stoneWidth: 3.0,
	/** Прозрачность базовой фоновой векторной линии дороги (0.0 .. 1.0, 0 = линия скрыта, видны только частицы) */
	lineOpacity: 1,
	/** Прозрачность линии гравийной дороги (по умолчанию равна lineOpacity) */
	dirtLineOpacity: 1,
	/** Прозрачность линии каменной дороги (по умолчанию равна lineOpacity) */
	stoneLineOpacity: 1.0,
	/** Цветовая гамма дорог */
	colors: {
		/** Основное полотно гравийной дороги */
		dirt: '#8d6e63',
		/** Цвет фона векторной линии гравийной дороги (подложки) */
		dirtLine: '#8d6e63',
		/** Светлые песчинки и камешки */
		dirtLight: '#bcaaa4',
		/** Темные вкрапления гравия и земли */
		dirtDark: '#6b4f46',
		/** Светлые песчинки и кварцевые блики */
		dirtSand: '#c59a8a',
		/** Основное полотно каменной дороги */
		stone: '#9eaec4',
		/** Цвет фона векторной линии каменной дороги (подложки) */
		stoneLine: '#9eaec4',
		/** Светлые сколы брусчатки */
		stoneLight: '#8194ac',
		/** Темные зазоры и швы между камнями */
		stoneDark: '#747f92'
	},
	/** Настройки запекаемой системы частиц (Gravel & Shoulder Particles) */
	particles: {
		/** Включить систему частиц для дорог */
		enabled: true,
		/** Базовый размер частицы в пикселях */
		pixelSize: 3.0,
		/** Масштабировать размер частиц при отдалении камеры (3px при макс. зуме -> 2px на среднем -> 1px на общем плане) */
		scaleWithZoom: true,
		/** Общая прозрачность частиц дороги (0.0 .. 1.0) */
		opacity: 1.0,
		/** Прозрачность внутренних частиц полотна дороги (0.0 .. 1.0) */
		innerOpacity: 1.0,
		/** Прозрачность внешних частиц обочины/рассеивания (0.0 .. 1.0) */
		outerOpacity: 0.8,

		/** Включение частиц внутри полотна дороги (false = внутренние частицы отключены) */
		innerEnabled: false,
		/** Включение частиц снаружи полотна (обочина/рассеивание) */
		outerEnabled: false,

		/** Раздельное включение внутренних/внешних частиц для гравийной дороги */
		dirtInnerEnabled: false,
		dirtOuterEnabled: true,

		/** Раздельное включение внутренних/внешних частиц для каменной дороги */
		stoneInnerEnabled: false,
		stoneScatterEnabled: true,
		stoneOuterEnabled: true,

		/** Плотность частиц внутри полотна дороги */
		innerDensity: 0.1,
		/** Плотность рассеивания гравия по бокам полотна (мягкие обочины) */
		scatterDensity: 0.1,
		/**
		 * Максимальная ширина разброса частиц в стороны от кромки полотна (в долях от ширины дороги):
		 * создает плавный переход с частого расположения у края к редкому на удалении
		 */
		scatterWidthRatio: 3,
		/** Число ступеней прогрессивного спада частоты частиц от края вглубь биома */
		scatterTiers: 3,

		/** Плотность внешнего рассеивания каменных осколков/брусчатки по бокам полотна */
		stoneScatterDensity: 1,
		/**
		 * Максимальная ширина разброса каменных осколков от кромки полотна (в долях от ширины дороги):
		 * создает переход от ровной каменной кладки к выбитым булыжникам в траве
		 */
		stoneScatterWidthRatio: 1.8,
		/** Число ступеней прогрессивного спада для каменной дороги */
		stoneScatterTiers: 2,
		/** Дополнительное рассеивание частиц на перекрёстках и пересечениях дорог для бесшовного слияния */
		crossroadScatter: true
	}
}

/**
 * Динамическое изменение настроек дорог из внешнего кода.
 */
export function setRoadConfig(options = {}) {
	if (!options || typeof options !== 'object') return
	if (options.hasBorder !== undefined) ROAD_CONFIG.hasBorder = Boolean(options.hasBorder)
	if (options.dirtWidth !== undefined)
		ROAD_CONFIG.dirtWidth = Math.max(0.5, Number(options.dirtWidth) || 1.8)
	if (options.stoneWidth !== undefined)
		ROAD_CONFIG.stoneWidth = Math.max(0.5, Number(options.stoneWidth) || 3.0)
	if (options.lineOpacity !== undefined)
		ROAD_CONFIG.lineOpacity = Math.max(0, Math.min(1, Number(options.lineOpacity) || 0))
	if (options.dirtLineOpacity !== undefined)
		ROAD_CONFIG.dirtLineOpacity = Math.max(0, Math.min(1, Number(options.dirtLineOpacity) || 0))
	if (options.stoneLineOpacity !== undefined)
		ROAD_CONFIG.stoneLineOpacity = Math.max(0, Math.min(1, Number(options.stoneLineOpacity) || 0))
	if (options.line) {
		if (options.line.opacity !== undefined)
			ROAD_CONFIG.lineOpacity = Math.max(0, Math.min(1, Number(options.line.opacity) || 0))
		if (options.line.dirtOpacity !== undefined)
			ROAD_CONFIG.dirtLineOpacity = Math.max(0, Math.min(1, Number(options.line.dirtOpacity) || 0))
		if (options.line.stoneOpacity !== undefined)
			ROAD_CONFIG.stoneLineOpacity = Math.max(0, Math.min(1, Number(options.line.stoneOpacity) || 0))
		if (options.line.dirtColor) ROAD_CONFIG.colors.dirtLine = options.line.dirtColor
		if (options.line.stoneColor) ROAD_CONFIG.colors.stoneLine = options.line.stoneColor
	}
	if (options.colors) Object.assign(ROAD_CONFIG.colors, options.colors)
	if (options.particles) {
		Object.assign(ROAD_CONFIG.particles, options.particles)
		if (options.particles.dirt) {
			ROAD_CONFIG.particles.dirt = Object.assign(ROAD_CONFIG.particles.dirt || {}, options.particles.dirt)
		}
		if (options.particles.stone) {
			ROAD_CONFIG.particles.stone = Object.assign(ROAD_CONFIG.particles.stone || {}, options.particles.stone)
		}
		if (options.particles.inner) {
			ROAD_CONFIG.particles.inner = Object.assign(ROAD_CONFIG.particles.inner || {}, options.particles.inner)
		}
		if (options.particles.outer) {
			ROAD_CONFIG.particles.outer = Object.assign(ROAD_CONFIG.particles.outer || {}, options.particles.outer)
		}
	}
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
 * Целевая частота обновления анимаций поверхности гексагональной карты (вода, реки, будущие спецэффекты).
 * Даже если в настройках видео общий FPS задан 60, 120 или 144 FPS, симуляция поверхности квантуется
 * этим значением (по умолчанию 30 FPS), существенно снижая нагрузку на CPU/GPU.
 */
export let HEX_SURFACE_ANIMATION_FPS = 30

export function setHexSurfaceAnimationFps(fps) {
	const n = Math.max(1, Math.min(120, Number(fps) || 30))
	HEX_SURFACE_ANIMATION_FPS = n
	ANIM_FRAME_INTERVAL_MS = Math.round(1000 / n)
}

/**
 * Интервал обновления водной и речной анимации в миллисекундах (~30 FPS = 33.3мс).
 */
export let ANIM_FRAME_INTERVAL_MS = Math.round(1000 / HEX_SURFACE_ANIMATION_FPS)

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

/**
 * Показывать ли государственные границы по умолчанию (до нажатия кнопки-переключателя на карте).
 * false = границы скрыты, включаются только кнопкой.
 */
export const DEFAULT_SHOW_STATE_BORDERS = false

/**
 * Типы записей из `fractions.json`, которые считаются государствами и могут иметь границы.
 * Прочие фракции (гильдии, кланы, религиозные ордена, поселения, внутренние фракции) границ не имеют.
 * Явный флаг `isState: true/false` в записи фракции имеет приоритет над типом и тегами.
 */
export const BORDER_STATE_TYPES = Object.freeze(['nation', 'state'])

/**
 * Теги, при наличии которых фракция считается государством (если тип не из BORDER_STATE_TYPES).
 */
export const BORDER_STATE_TAGS = Object.freeze(['nation', 'state'])

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
		get surfaceAnimationFps() {
			return HEX_SURFACE_ANIMATION_FPS
		},
		set surfaceAnimationFps(v) {
			setHexSurfaceAnimationFps(v)
		},
		get frameIntervalMs() {
			return ANIM_FRAME_INTERVAL_MS
		},
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
	water: WATER_CONFIG,
	roads: ROAD_CONFIG
})

export default HEX_CONFIG
