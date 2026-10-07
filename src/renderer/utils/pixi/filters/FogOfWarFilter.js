/**
 * GLSL Fog of War & Exploration Shroud Filter (PixiJS v8)
 *
 * Implements hardware-accelerated exploration visibility mask:
 * - Unexplored areas shrouded in mystical fog / desaturated dark blue.
 * - Smooth quadratic falloff around player vision radius / settlements.
 */
import { Filter, GlProgram, UniformGroup, defaultFilterVert } from 'pixi.js'

const fogFragmentShader = `
in vec2 vTextureCoord;
in vec4 vColor;

out vec4 finalColor;

uniform sampler2D uTexture;
uniform vec2 uPlayerPos;
uniform float uVisionRadius;
uniform float uSoftRadius;
uniform vec3 uFogColor;
uniform float uFogDensity;

void main(void)
{
    vec4 color = texture(uTexture, vTextureCoord);
    if (color.a <= 0.001) {
        finalColor = color;
        return;
    }

    float dist = length(vTextureCoord - uPlayerPos);
    float visibility = 1.0;

    if (dist > uVisionRadius) {
        float falloff = clamp((dist - uVisionRadius) / max(0.001, (uSoftRadius - uVisionRadius)), 0.0, 1.0);
        visibility = 1.0 - falloff;
    }

    vec3 shrouded = mix(color.rgb, uFogColor, 0.75) * (1.0 - uFogDensity * 0.82);
    vec3 finalRgb = mix(shrouded, color.rgb, visibility);

    finalColor = vec4(finalRgb, color.a);
}
`

export class FogOfWarFilter extends Filter {
	constructor(options = {}) {
		const playerPos = options.playerPos ?? [0.5, 0.5]
		const visionRadius = options.visionRadius ?? 0.22
		const softRadius = options.softRadius ?? 0.38
		const fogColor = options.fogColor ?? [0.08, 0.10, 0.18]
		const fogDensity = options.fogDensity ?? 0.88

		const glProgram = GlProgram.from({
			vertex: defaultFilterVert,
			fragment: fogFragmentShader,
			name: 'fog-of-war-filter'
		})

		const fogUniforms = new UniformGroup({
			uPlayerPos: { value: new Float32Array(playerPos), type: 'vec2<f32>' },
			uVisionRadius: { value: visionRadius, type: 'f32' },
			uSoftRadius: { value: softRadius, type: 'f32' },
			uFogColor: { value: new Float32Array(fogColor), type: 'vec3<f32>' },
			uFogDensity: { value: fogDensity, type: 'f32' }
		})

		super({
			glProgram,
			resources: {
				fogUniforms
			}
		})
	}

	setPlayerVision(x, y, visionRadius = 0.22, softRadius = 0.38) {
		const pos = this.resources.fogUniforms.uniforms.uPlayerPos
		pos[0] = x
		pos[1] = y
		this.resources.fogUniforms.uniforms.uVisionRadius = visionRadius
		this.resources.fogUniforms.uniforms.uSoftRadius = softRadius
	}

	setFogDensity(val) {
		this.resources.fogUniforms.uniforms.uFogDensity = val
	}
}
