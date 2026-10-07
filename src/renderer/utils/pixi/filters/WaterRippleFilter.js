/**
 * GLSL Hardware Water Ripple & Caustics Shader Filter (PixiJS v8)
 *
 * Implements GPU-based dual-frequency sinusoidal wave distortion and dynamic
 * caustics highlights for water bodies, oceans, and rivers.
 */
import { Filter, GlProgram, UniformGroup, defaultFilterVert } from 'pixi.js'

const waterFragmentShader = `
in vec2 vTextureCoord;
in vec4 vColor;

out vec4 finalColor;

uniform sampler2D uTexture;
uniform float uTime;
uniform float uSpeed;
uniform float uFrequency;
uniform float uAmplitude;
uniform vec3 uWaveTint;

void main(void)
{
    vec2 uv = vTextureCoord;

    // Dual-wave spatial ripple distortion
    float wave1 = sin(uv.y * uFrequency + uTime * uSpeed) * cos(uv.x * uFrequency * 0.75 + uTime * uSpeed * 0.65);
    float wave2 = sin((uv.x + uv.y) * uFrequency * 1.35 - uTime * uSpeed * 1.1) * 0.5;
    vec2 offset = vec2(wave1 + wave2, (wave1 - wave2) * 0.6) * uAmplitude;

    vec4 color = texture(uTexture, uv + offset);
    if (color.a <= 0.001) {
        finalColor = color;
        return;
    }

    // Dynamic wave crest shimmer / caustics highlights
    float crest = max(0.0, sin((uv.x * 1.15 + uv.y * 0.85) * uFrequency * 2.2 + uTime * uSpeed * 2.5) - 0.76) * 2.2;
    color.rgb += uWaveTint * crest * color.a;

    finalColor = color;
}
`

export class WaterRippleFilter extends Filter {
	constructor(options = {}) {
		const time = options.time ?? 0
		const speed = options.speed ?? 1.4
		const frequency = options.frequency ?? 28.0
		const amplitude = options.amplitude ?? 0.005
		const waveTint = options.waveTint ?? [0.25, 0.45, 0.75]

		const glProgram = GlProgram.from({
			vertex: defaultFilterVert,
			fragment: waterFragmentShader,
			name: 'water-ripple-filter'
		})

		const waterUniforms = new UniformGroup({
			uTime: { value: time, type: 'f32' },
			uSpeed: { value: speed, type: 'f32' },
			uFrequency: { value: frequency, type: 'f32' },
			uAmplitude: { value: amplitude, type: 'f32' },
			uWaveTint: { value: new Float32Array(waveTint), type: 'vec3<f32>' }
		})

		super({
			glProgram,
			resources: {
				waterUniforms
			}
		})
	}

	get time() {
		return this.resources.waterUniforms.uniforms.uTime
	}
	set time(val) {
		this.resources.waterUniforms.uniforms.uTime = val
	}

	get speed() {
		return this.resources.waterUniforms.uniforms.uSpeed
	}
	set speed(val) {
		this.resources.waterUniforms.uniforms.uSpeed = val
	}

	get frequency() {
		return this.resources.waterUniforms.uniforms.uFrequency
	}
	set frequency(val) {
		this.resources.waterUniforms.uniforms.uFrequency = val
	}

	get amplitude() {
		return this.resources.waterUniforms.uniforms.uAmplitude
	}
	set amplitude(val) {
		this.resources.waterUniforms.uniforms.uAmplitude = val
	}

	setWaveTint(r, g, b) {
		const arr = this.resources.waterUniforms.uniforms.uWaveTint
		arr[0] = r
		arr[1] = g
		arr[2] = b
	}
}
