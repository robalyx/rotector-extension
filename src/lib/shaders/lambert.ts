/**
 * Lambert diffuse shader with 3-point lighting for avatar rendering.
 * Converts sRGB textures to linear space for lighting, then back to sRGB for output.
 */

export const vertex = /* glsl */ `
// OGL auto-injects these uniforms based on the camera and mesh transform
attribute vec3 position;
attribute vec3 normal;
attribute vec2 uv;

uniform mat4 modelViewMatrix;
uniform mat4 projectionMatrix;
uniform mat3 normalMatrix;

varying vec3 vNormal;
varying vec2 vUv;

void main() {
    vUv = uv;
    vNormal = normalize(normalMatrix * normal);
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`;

export const fragment = /* glsl */ `
precision highp float;

varying vec3 vNormal;
varying vec2 vUv;

uniform sampler2D tMap;       // Diffuse texture (ignored when uHasTexture is false)
uniform bool uHasTexture;     // Toggle between texture and solid color
uniform vec3 uDiffuseColor;   // Solid diffuse color from MTL Kd (sRGB)
uniform float uBrightness;    // Runtime brightness multiplier [0.0 - 2.0]

// 3-point lighting rig for character presentation:
//   Key  (front-top-right): strong main light, defines form
//   Fill (left):            softer, prevents harsh shadows on the opposite side
//   Rim  (behind):          separates the character from the background
// Directions are pre-normalized since GLSL const doesn't support normalize().
const vec3 KEY_DIR  = vec3(0.333333, 0.666667, 0.666667);  // (5, 10, 10)
const vec3 FILL_DIR = vec3(-0.816497, 0.408248, 0.408248); // (-10, 5, 5)
const vec3 RIM_DIR  = vec3(0.0, 0.447214, -0.894427);      // (0, 5, -10)

const float KEY_INT  = 1.2;
const float FILL_INT = 0.6;
const float RIM_INT  = 0.4;

// Low ambient keeps shadow areas visible without washing out directional detail
const float AMBIENT_INT = 0.4;

// Gamma 2.2 approximation for sRGB <-> linear conversion
vec3 sRGBToLinear(vec3 srgb) {
    return pow(srgb, vec3(2.2));
}
vec3 linearToSRGB(vec3 linear) {
    return pow(linear, vec3(1.0 / 2.2));
}

void main() {
    vec3 N = normalize(vNormal);

    vec3 baseColor = uHasTexture
        ? sRGBToLinear(texture2D(tMap, vUv).rgb)
        : sRGBToLinear(uDiffuseColor);

    float diffuse = max(dot(N, KEY_DIR), 0.0) * KEY_INT
                  + max(dot(N, FILL_DIR), 0.0) * FILL_INT
                  + max(dot(N, RIM_DIR), 0.0) * RIM_INT;

    vec3 color = baseColor * (AMBIENT_INT + diffuse) * uBrightness;

    gl_FragColor = vec4(linearToSRGB(color), 1.0);
}
`;
