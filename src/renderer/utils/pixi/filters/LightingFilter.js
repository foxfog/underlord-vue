/**
 * GLSL Dynamic Lighting & Day/Night Cycle Filter (PixiJS v8)
 *
 * Implements:
 * - Ambient day/night cycle color grading (morning golden, day, evening sunset, night blue).
 * - Dynamic torch and point lights with natural flame flicker and smooth quadratic attenuation.
 */
import { Filter, GlProgram, UniformGroup, defaultFilterVert } from 'pixi.js'

const lightingFragmentShader = `
in vec2 vTextureCoord;
in vec4 vColor;

out vec4 finalColor;

uniform sampler2D uTexture;
uniform vec3 uAmbientColor;
uniform float uTime;
uniform vec2 uLightPos;
uniform vec3 uLightColor;
uniform float uLightRadius;
uniform float uLightIntensity;
uniform float uTorchFlicker;

void main(void)
{
    vec4 color = texture(uTexture, vTextureCoord);
    if (color.a <= 0.001) {
        finalColor = color;
        return;
    }

    // Base ambient color grading
    vec3 lit = color.rgb * uAmbientColor;

    // Dynamic torch / point light with natural sinusoidal flame flicker
    float flicker = 1.0;
    if (uTorchFlicker > 0.0) {
        flicker = 1.0 + 0.08 * sin(uTime * 8.5) * cos(uTime * 13.7 + 1.25);
    }

    vec2 diff = vTextureCoord - uLightPos;
    float dist = length(diff);

    if (dist < uLightRadius && uLightRadius > 0.001) {
        float normDist = dist / uLightRadius;
        // Smoothstep attenuation curve (1.0 at center, 0.0 at radius edge)
        float atten = clamp(1.0 - normDist, 0.0, 1.0);
        atten = atten * atten * (3.0 - 2.0 * atten);

        vec3 lightRgb = color.rgb * uLightColor * (atten * uLightIntensity * flicker);
        lit += lightRgb;
    }

    finalColor = vec4(lit, color.a);
}
`

export class LightingFilter extends Filter {
	constructor(options = {}) {
		const ambientColor = options.ambientColor ?? [1.0, 1.0, 1.0]
		const time = options.time ?? 0
		const lightPos = options.lightPos ?? [0.5, 0.5]
		const lightColor = options.lightColor ?? [1.0, 0.72, 0.38]
		const lightRadius = options.lightRadius ?? 0.25
		const lightIntensity = options.lightIntensity ?? 1.2
		const torchFlicker = options.torchFlicker ?? 1.0

		const glProgram = GlProgram.from({
			vertex: defaultFilterVert,
			fragment: lightingFragmentShader,
			name: 'lighting-filter'
		})

		const lightingUniforms = new UniformGroup({
			uAmbientColor: { value: new Float32Array(ambientColor), type: 'vec3<f32>' },
			uTime: { value: time, type: 'f32' },
			uLightPos: { value: new Float32Array(lightPos), type: 'vec2<f32>' },
			uLightColor: { value: new Float32Array(lightColor), type: 'vec3<f32>' },
			uLightRadius: { value: lightRadius, type: 'f32' },
			uLightIntensity: { value: lightIntensity, type: 'f32' },
			uTorchFlicker: { value: torchFlicker, type: 'f32' }
		})

		super({
			glProgram,
			resources: {
				lightingUniforms
			}
		})
	}

	get time() {
		return this.resources.lightingUniforms.uniforms.uTime
	}
	set time(val) {
		this.resources.lightingUniforms.uniforms.uTime = val
	}

	setAmbientColor(r, g, b) {
		const arr = this.resources.lightingUniforms.uniforms.uAmbientColor
		arr[0] = r
		arr[1] = g
		arr[2] = b
	}

	setTimeOfDay(timeOfDay = 'day') {
		switch (timeOfDay) {
			case 'morning':
				this.setAmbientColor(0.96, 0.90, 0.82)
				break
			case 'evening':
				this.setAmbientColor(0.92, 0.65, 0.48)
				break
			case 'night':
				this.setAmbientColor(0.38, 0.44, 0.62)
				break
			case 'day':
			default:
				this.setAmbientColor(1.0, 1.0, 1.0)
				break
		}
	}

	setLight(x, y, radius, intensity, r = 1.0, g = 0.72, b = 0.38) {
		const pos = this.resources.lightingUniforms.uniforms.uLightPos
		pos[0] = x
		pos[1] = y
		this.resources.lightingUniforms.uniforms.uLightRadius = radius
		this.resources.lightingUniforms.uniforms.uLightIntensity = intensity
		const col = this.resources.lightingUniforms.uniforms.uLightColor
		col[0] = r
		col[1] = g
		col[2] = b
	}
}
