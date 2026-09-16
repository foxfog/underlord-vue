/**
 * src/renderer/constants/mobs.js
 * Mob Star Ratings (1★ to 5★), Behavior States, Equipment Tiers, and Phase Filters.
 */

export const MOB_STAR_RATINGS = [
	{
		stars: 1,
		id: 'weak',
		label: 'Слабый',
		badge: '★☆☆☆☆',
		color: '#94a3b8',
		bg: 'rgba(148, 163, 184, 0.15)',
		border: '#64748b',
		hpMult: 0.85,
		atkMult: 0.9,
		defMult: 0.9,
		bonusAp: 0,
		loadoutTier: 'weak',
		expMult: 0.75
	},
	{
		stars: 2,
		id: 'normal',
		label: 'Обычный',
		badge: '★★☆☆☆',
		color: '#f8fafc',
		bg: 'rgba(248, 250, 252, 0.12)',
		border: '#cbd5e1',
		hpMult: 1.0,
		atkMult: 1.0,
		defMult: 1.0,
		bonusAp: 0,
		loadoutTier: 'normal',
		expMult: 1.0
	},
	{
		stars: 3,
		id: 'strong',
		label: 'Сильный',
		badge: '★★★☆☆',
		color: '#60a5fa',
		bg: 'rgba(96, 165, 250, 0.15)',
		border: '#3b82f6',
		hpMult: 1.25,
		atkMult: 1.2,
		defMult: 1.2,
		bonusAp: 0,
		loadoutTier: 'strong',
		expMult: 1.35
	},
	{
		stars: 4,
		id: 'elite',
		label: 'Элитный',
		badge: '★★★★☆',
		color: '#c084fc',
		bg: 'rgba(192, 132, 252, 0.18)',
		border: '#a855f7',
		hpMult: 1.6,
		atkMult: 1.4,
		defMult: 1.4,
		bonusAp: 1,
		loadoutTier: 'elite',
		expMult: 2.0
	},
	{
		stars: 5,
		id: 'legendary',
		label: 'Легендарный',
		badge: '★★★★★',
		color: '#facc15',
		bg: 'rgba(250, 204, 21, 0.22)',
		border: '#eab308',
		hpMult: 2.2,
		atkMult: 1.7,
		defMult: 1.6,
		bonusAp: 1,
		loadoutTier: 'legendary',
		expMult: 3.5
	}
]

export const STAR_RATINGS_MAP = Object.freeze(
	MOB_STAR_RATINGS.reduce((acc, r) => {
		acc[r.stars] = r
		acc[r.id] = r
		return acc
	}, {})
)

/**
 * Default weights when rolling star rating randomly (total 100%)
 */
export const DEFAULT_STAR_WEIGHTS = Object.freeze({
	1: 25, // 25% weak
	2: 50, // 50% normal
	3: 18, // 18% strong
	4: 6,  // 6% elite
	5: 1   // 1% legendary
})

/**
 * Regressive chances for 1-3 custom named items for 5★ (Legendary) mobs:
 * - 1st unique item: 100%
 * - 2nd unique item: 30%
 * - 3rd unique item: 10%
 */
export const LEGENDARY_ITEM_DROP_CHANCES = [1.0, 0.3, 0.1]

/**
 * Mob behaviors on isometric maps
 */
export const MOB_BEHAVIORS = Object.freeze([
	'passive',  // Neutral/passive until attacked
	'guard',    // Stands in place, agros if player enters radius
	'patrol',   // Moves between patrol waypoints, agros in radius
	'hostile',  // Actively pursues player within aggro radius
	'sleeping', // Sleeps at camp; doesn't agro unless stepped next to (distance <= 1)
	'fleeing'   // Runs away from player (e.g. loot creature)
])

export const MOB_STATUS_ICONS = Object.freeze({
	sleeping: '💤',
	guard: '🛡️',
	patrol: '🚶',
	hostile: '⚔️',
	fleeing: '💨',
	leader: '💀'
})

/**
 * Resolves star rating metadata by number (1-5) or string id ('weak', 'normal', etc.).
 * @param {number|string} starOrId
 * @returns {typeof MOB_STAR_RATINGS[0]}
 */
export function getStarRatingMeta(starOrId) {
	if (typeof starOrId === 'number') {
		const clamped = Math.max(1, Math.min(5, Math.round(starOrId)))
		return STAR_RATINGS_MAP[clamped] || MOB_STAR_RATINGS[1]
	}
	if (typeof starOrId === 'string') {
		const parsed = parseInt(starOrId, 10)
		if (!isNaN(parsed) && parsed >= 1 && parsed <= 5) {
			return STAR_RATINGS_MAP[parsed] || MOB_STAR_RATINGS[1]
		}
		const lower = starOrId.trim().toLowerCase()
		return STAR_RATINGS_MAP[lower] || MOB_STAR_RATINGS[1]
	}
	return MOB_STAR_RATINGS[1] // Default normal (2★)
}

/**
 * Rolls star rating based on a fixed value, array range [min, max], or weight distribution object.
 * @param {number|string|Array<number>|Object} starConfig
 * @returns {typeof MOB_STAR_RATINGS[0]}
 */
export function rollStarRating(starConfig) {
	if (starConfig === undefined || starConfig === null) {
		return rollFromWeights(DEFAULT_STAR_WEIGHTS)
	}

	// Direct fixed number e.g. 3 or 'elite'
	if (typeof starConfig === 'number' || (typeof starConfig === 'string' && !starConfig.includes(','))) {
		return getStarRatingMeta(starConfig)
	}

	// Array range e.g. [2, 4]
	if (Array.isArray(starConfig) && starConfig.length >= 2) {
		const min = Math.max(1, Math.min(5, Math.round(starConfig[0])))
		const max = Math.max(min, Math.min(5, Math.round(starConfig[1])))
		const rolled = Math.floor(min + Math.random() * (max - min + 1))
		return getStarRatingMeta(rolled)
	}

	// Object with custom weights e.g. { 1: 10, 2: 40, 3: 40, 4: 10 }
	if (typeof starConfig === 'object') {
		return rollFromWeights(starConfig)
	}

	return MOB_STAR_RATINGS[1]
}

function rollFromWeights(weightsMap) {
	const entries = Object.entries(weightsMap || DEFAULT_STAR_WEIGHTS)
		.map(([k, v]) => [parseInt(k, 10), Number(v) || 0])
		.filter(([k, v]) => k >= 1 && k <= 5 && v > 0)

	if (entries.length === 0) return MOB_STAR_RATINGS[1]

	const totalWeight = entries.reduce((sum, [, w]) => sum + w, 0)
	let rand = Math.random() * totalWeight

	for (const [star, weight] of entries) {
		if (rand <= weight) {
			return getStarRatingMeta(star)
		}
		rand -= weight
	}

	return getStarRatingMeta(entries[0][0])
}

/**
 * Checks if a mob should be active based on current time-of-day phase.
 * @param {Object} mob - Mob or spawn configuration
 * @param {string} currentPhase - 'morning' | 'day' | 'evening' | 'night'
 * @returns {boolean}
 */
export function isMobActiveInPhase(mob, currentPhase) {
	if (!mob) return false
	const activePhases = mob.activePhases || mob.phases
	if (!activePhases || !Array.isArray(activePhases) || activePhases.length === 0) {
		return true // Active in all phases if not specified
	}
	if (!currentPhase) return true
	return activePhases.includes(currentPhase)
}
