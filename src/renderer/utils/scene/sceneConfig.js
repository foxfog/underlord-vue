/**
 * sceneConfig.js — Централизованная конфигурация сцен и визуальной новеллы
 *
 * Все ключевые параметры отображения сцен, дефолтный уровень пола (линия стояния/пяток персонажа),
 * отступы холста (bleed), канонические размеры ростомера и параметры масштабирования
 * собраны здесь с подробными комментариями на русском языке.
 *
 * Создан по аналогии с hexConfig.js для гибкого управления сценами и персонажами.
 */

// ==============================================================================
// 1. БАЗОВЫЕ РАЗМЕРЫ И РАЗРЕШЕНИЕ СЦЕНЫ (CANVAS & COORDINATE SYSTEM)
// ==============================================================================

/**
 * Каноническая ширина игрового холста (Game Canvas Width в px).
 * Базовое разрешение экрана игры Underlord-Vue: 1920×1080.
 */
export const CANONICAL_STAGE_WIDTH = 1920

/**
 * Каноническая высота игрового холста (Game Canvas Height в px).
 */
export const CANONICAL_STAGE_HEIGHT = 1080

/**
 * Высота эталонной ростовой шкалы (в сантиметрах).
 * Полный вертикальный диапазон ростомера персонажей составляет 240 см.
 */
export const STAGE_RULER_HEIGHT_CM = 240

/**
 * Эталонный базовый рост человека (в сантиметрах).
 * Базовый рост (175 см) составляет 175 / 240 ≈ 72.917% от шкалы 240 см.
 */
export const BASELINE_CHARACTER_HEIGHT_CM = 175

// ==============================================================================
// 2. УРОВЕНЬ ПОЛА И ЛИНИЯ ПЯТОК ПЕРСОНАЖА (SCENE FLOOR LEVEL & BASELINE)
// ==============================================================================

/**
 * Дефолтный подъем уровня пола (уровня пяток персонажа) в сюжетных сценах (в единицах `em`).
 *
 * В движке риггинга персонаж стоит подошвами/пятками на линии 0 см (ground baseline).
 * При значении 0.0 пятки упираются в самый нижний край экрана (height: 1080px).
 *
 * Значение 3.5em (≈ 56px при базовом размере 16px на 1080p, или ≈ 5.2% от высоты экрана)
 * приподнимает линию стояния персонажа чуть выше нижней границы экрана,
 * предотвращая обрезку обуви рамкой монитора и гармонируя с плашкой диалогов.
 *
 * Может быть переопределено:
 * - Глобально: через setSceneFloorOffsetEm(val) или правку этой переменной.
 * - Для конкретной сцены: поле "floorOffset": "3.5em" (или 4.0, "5%") в scenes.json.
 * - Для конкретного шага/персонажа: step.floorOffset или step.position.floorOffset в intro.json.
 */
export let DEFAULT_SCENE_FLOOR_OFFSET_EM = 3.5

/**
 * Альтернативное дефолтное смещение пола в процентах от высоты сцены (%).
 */
export let DEFAULT_SCENE_FLOOR_OFFSET_PERCENT = 5.2

/**
 * Устанавливает дефолтный подъем уровня пола в сценах (в единицах `em`).
 * @param {number|string} val
 */
export function setSceneFloorOffsetEm(val) {
	DEFAULT_SCENE_FLOOR_OFFSET_EM = Math.max(0, Number(val) || 0)
}

/**
 * Возвращает текущий дефолтный подъем уровня пола в `em`.
 * @returns {number}
 */
export function getSceneFloorOffsetEm() {
	return DEFAULT_SCENE_FLOOR_OFFSET_EM
}

// ==============================================================================
// 3. ОТСТУПЫ СЦЕНЫ И СТУДИИ (SCENE & STUDIO BLEED)
// ==============================================================================

/**
 * Дефолтные отступы сюжетных сцен (Visual Novel Scenes Bleed):
 * - top: 0 (полная высота экрана для шляп, рогов и анимаций прыжка)
 * - bottom: вычисляется из DEFAULT_SCENE_FLOOR_OFFSET_EM (уровень пола)
 * - left: 0
 * - right: 0
 */
export const DEFAULT_SCENE_BLEED_EM = {
	top: 0,
	bottom: 3.5,
	left: 0,
	right: 0
}

/**
 * Дефолтные отступы Студии риггинга (Character Rig Studio Stage Bleed в `em`).
 * В студии используется расширенная рамка со шкалой сантиметров (240 см)
 * и контролами/кнопками внизу, поэтому нижний отступ там увеличен (10.0em).
 */
export const DEFAULT_STUDIO_BLEED_EM = {
	top: 3.5,
	bottom: 10.0,
	left: 8.0,
	right: 8.0
}

// ==============================================================================
// 3.1. КАМЕРА И ОВЕРСКАН СЦЕНЫ (SCENE CAMERA & OVERSCAN)
// ==============================================================================

/**
 * Дефолтный коэффициент оверскана (overscan bleed scale) для сцен визуальной новеллы.
 *
 * При значении 1.05 сцены рендерятся на 5% шире и выше экрана (по ~48px слева/справа
 * и ~27px сверху/снизу при каноническом разрешении 1920×1080).
 *
 * Это дополнительное поле (overscan bleed) позволяет камере выполнять кинематографические
 * движения (кивание согласия, покачивание отказа, кашель/чих, тряску при уроне)
 * без оголения краев холста и появления черных полос по бокам экрана.
 */
export let DEFAULT_SCENE_CAMERA_OVERSCAN = 1.05

/**
 * Устанавливает дефолтный коэффициент оверскана камеры сцены.
 * @param {number|string} val
 */
export function setSceneCameraOverscan(val) {
	DEFAULT_SCENE_CAMERA_OVERSCAN = Math.max(1.0, Number(val) || 1.0)
}

/**
 * Возвращает текущий коэффициент оверскана камеры сцены.
 * @returns {number}
 */
export function getSceneCameraOverscan() {
	return DEFAULT_SCENE_CAMERA_OVERSCAN
}

// ==============================================================================
// 4. МАСШТАБИРОВАНИЕ РОСТА И ШКАЛА (CHARACTER HEIGHT & RULER SCALING)
// ==============================================================================

/**
 * Флаг сохранения канонического масштаба персонажа при подъеме уровня пола:
 * - true: Рост персонажа вычисляется от полной канонической высоты холста (1080px),
 *         поэтому подъем уровня пола только смещает пятки вверх, не сжимая и не уменьшая куклу.
 * - false: Рост персонажа масштабируется в оставшемся пространстве (height - bleedBottom),
 *          пропорционально сжимая шкалу.
 *
 * По умолчанию true, чтобы персонаж сохранял естественный пропорциональный рост (size/scale).
 */
export let PRESERVE_CANONICAL_RULER_HEIGHT = true

export function setPreserveCanonicalRulerHeight(val) {
	PRESERVE_CANONICAL_RULER_HEIGHT = Boolean(val)
}

// ==============================================================================
// 5. ВСПОМОГАТЕЛЬНЫЕ ФУНКЦИИ И РАСЧЕТ В ПИКСЕЛЯХ (HELPERS & RESOLVERS)
// ==============================================================================

/**
 * Парсит размерность и возвращает точное значение в пикселях:
 * - число (например 3.5): трактуется как `em` (3.5 * em)
 * - строка с 'em' (например "3.5em"): вычисляется как num * em
 * - строка с '%' (например "5%"): вычисляется как (num / 100) * height
 * - строка с 'px' (например "60px"): парсится напрямую как пиксели
 *
 * @param {number|string|null|undefined} val
 * @param {Object} [context]
 * @param {number} [context.em=16] Пиксельный размер 1em в текущем контейнере
 * @param {number} [context.height=1080] Высота холста/контейнера
 * @param {number} [context.width=1920] Ширина холста/контейнера
 * @returns {number} Значение в пикселях (округленное)
 */
export function parseDimensionToPx(val, { em = 16, height = 1080, width = 1920 } = {}) {
	if (val === undefined || val === null || val === '') return 0
	if (typeof val === 'number') {
		if (isNaN(val)) return 0
		return Math.round(val * em)
	}
	const str = String(val).trim()
	if (str.endsWith('em')) {
		const num = parseFloat(str)
		return isNaN(num) ? 0 : Math.round(num * em)
	}
	if (str.endsWith('%')) {
		const num = parseFloat(str)
		return isNaN(num) ? 0 : Math.round((num / 100) * height)
	}
	if (str.endsWith('px')) {
		const num = parseFloat(str)
		return isNaN(num) ? 0 : Math.round(num)
	}
	const num = parseFloat(str)
	return isNaN(num) ? 0 : Math.round(num * em)
}

/**
 * Вычисляет итоговый подъем уровня пола в пикселях для сцены/персонажа.
 *
 * Приоритет разрешения:
 * 1. customOffset (если передан напрямую в вызове)
 * 2. Оверрайд у персонажа или шага (character.floorOffset или character.position.floorOffset)
 * 3. Оверрайд у текущей сцены (scene.floorOffset или scene.floorLevel из scenes.json)
 * 4. Глобальный дефолт DEFAULT_SCENE_FLOOR_OFFSET_EM из этого файла.
 *
 * @param {Object} [params]
 * @param {number} [params.em=16] Пиксельный размер 1em
 * @param {number} [params.height=1080] Высота сцены
 * @param {Object} [params.character] Объект персонажа или шага
 * @param {Object} [params.scene] Объект активной сцены
 * @param {number|string} [params.customOffset] Прямой оверрайд отступа
 * @returns {number} Смещение пола в пикселях (px)
 */
export function resolveSceneFloorOffsetPx({
	em = 16,
	height = 1080,
	character = null,
	scene = null,
	customOffset = null
} = {}) {
	// 1. Прямой оверрайд
	if (customOffset !== null && customOffset !== undefined && customOffset !== '') {
		return parseDimensionToPx(customOffset, { em, height })
	}
	// 2. Оверрайд у персонажа / шага показа
	const charOffset = character?.floorOffset ?? character?.position?.floorOffset
	if (charOffset !== null && charOffset !== undefined && charOffset !== '') {
		return parseDimensionToPx(charOffset, { em, height })
	}
	// 3. Оверрайд у текущей сцены
	const sceneOffset = scene?.floorOffset ?? scene?.floorLevel
	if (sceneOffset !== null && sceneOffset !== undefined && sceneOffset !== '') {
		return parseDimensionToPx(sceneOffset, { em, height })
	}
	// 4. Глобальный дефолт
	return Math.round(DEFAULT_SCENE_FLOOR_OFFSET_EM * em)
}

/**
 * Вычисляет полный объект bleed { top, bottom, left, right } в пикселях для холста CharacterCanvas.
 *
 * @param {Object} [params]
 * @param {Object} [params.bleed] Явный объект bleed (если передан, например, из Студии)
 * @param {Object} [params.character] Объект персонажа
 * @param {Object} [params.scene] Объект сцены
 * @param {number|string} [params.floorOffset] Индивидуальный оверрайд пола
 * @param {number} [params.em=16] Размер 1em в пикселях
 * @param {number} [params.height=1080] Высота холста
 * @returns {{ top: number, bottom: number, left: number, right: number }}
 */
export function resolveSceneBleed({
	bleed = null,
	character = null,
	scene = null,
	floorOffset = null,
	em = 16,
	height = 1080
} = {}) {
	// Если передан полный объект bleed со значениями (например, из Studio с stageBleed)
	if (bleed && typeof bleed === 'object' && (bleed.top || bleed.bottom || bleed.left || bleed.right)) {
		return {
			top: parseDimensionToPx(bleed.top, { em, height }),
			bottom: parseDimensionToPx(bleed.bottom, { em, height }),
			left: parseDimensionToPx(bleed.left, { em, height, width: CANONICAL_STAGE_WIDTH }),
			right: parseDimensionToPx(bleed.right, { em, height, width: CANONICAL_STAGE_WIDTH })
		}
	}

	const bottomPx = resolveSceneFloorOffsetPx({
		em,
		height,
		character,
		scene,
		customOffset: floorOffset
	})

	return {
		top: 0,
		bottom: bottomPx,
		left: 0,
		right: 0
	}
}

// ==============================================================================
// 6. СНИМОК КОНФИГУРАЦИИ (SNAPSHOT ДЛЯ ОТЛАДКИ И ИНСПЕКТОРОВ)
// ==============================================================================

/**
 * Возвращает снимок всех текущих настроек сцен для логирования, дебаггеров и тестов.
 */
export function getSceneConfigSnapshot() {
	return {
		stage: {
			canonicalWidth: CANONICAL_STAGE_WIDTH,
			canonicalHeight: CANONICAL_STAGE_HEIGHT,
			rulerHeightCm: STAGE_RULER_HEIGHT_CM,
			baselineHeightCm: BASELINE_CHARACTER_HEIGHT_CM
		},
		floor: {
			defaultOffsetEm: DEFAULT_SCENE_FLOOR_OFFSET_EM,
			defaultOffsetPercent: DEFAULT_SCENE_FLOOR_OFFSET_PERCENT,
			preserveCanonicalRulerHeight: PRESERVE_CANONICAL_RULER_HEIGHT
		},
		bleed: {
			sceneDefault: { ...DEFAULT_SCENE_BLEED_EM },
			studioDefault: { ...DEFAULT_STUDIO_BLEED_EM }
		},
		camera: {
			defaultOverscan: DEFAULT_SCENE_CAMERA_OVERSCAN
		}
	}
}
