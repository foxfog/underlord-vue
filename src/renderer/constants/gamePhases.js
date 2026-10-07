/**
 * Game Modes & Lifecycle Phases (Game State Machine / FSM)
 *
 * Defines explicit phases of the main gameplay loop:
 * - STORY_VN: Visual novel story narration, dialogue choices, and background hotspots.
 * - OVERWORLD_HEX: 2.5D hexagonal world map exploration and territory overview.
 * - ISOMETRIC_EXPLORATION: Real-time isometric location exploration and object interactions.
 * - TURN_COMBAT: Tactical turn-based combat encounters.
 * - VR_HUB: Neuro-helmet VR launcher and cybercity dashboard.
 * - VR_INTRO: Yggdrasil cinematic promo video.
 * - VR_AUTH: Yggdrasil login & MMO authentication modal.
 * - VR_CHAR_CREATE: Character customization & race/class selection.
 * - VR_SHUTDOWN: Server shutdown glitch & isekai transfer sequence.
 */

export const GAME_PHASES = {
	STORY_VN: 'STORY_VN',
	OVERWORLD_HEX: 'OVERWORLD_HEX',
	ISOMETRIC_EXPLORATION: 'ISOMETRIC_EXPLORATION',
	TURN_COMBAT: 'TURN_COMBAT',
	VR_HUB: 'VR_HUB',
	VR_INTRO: 'VR_INTRO',
	VR_AUTH: 'VR_AUTH',
	VR_CHAR_CREATE: 'VR_CHAR_CREATE',
	VR_SHUTDOWN: 'VR_SHUTDOWN'
}

/**
 * Checks whether a given phase belongs to the VR / Yggdrasil prologue flow.
 * @param {string} phase
 * @returns {boolean}
 */
export function isVrPhase(phase) {
	return (
		phase === GAME_PHASES.VR_HUB ||
		phase === GAME_PHASES.VR_INTRO ||
		phase === GAME_PHASES.VR_AUTH ||
		phase === GAME_PHASES.VR_CHAR_CREATE ||
		phase === GAME_PHASES.VR_SHUTDOWN
	)
}
