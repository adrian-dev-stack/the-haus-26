import {
  Color, Mesh, OrthographicCamera, PlaneGeometry, Scene, ShaderMaterial,
  WebGLRenderer,
} from "three";

const vertexShader = `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = vec4(position.xy, 0.0, 1.0);
  }
`;

const fragmentShader = `
  uniform float uTime;
  uniform float uAspect;
  uniform vec3 uPaper;
  uniform vec3 uWater;
  uniform vec3 uLight;
  varying vec2 vUv;

  float waterLight(vec2 point, float time) {
    point += vec2(
      sin(point.y * 1.14 + time * 0.65),
      cos(point.x * 0.96 - time * 0.58)
    ) * 0.62;
    float surface = sin(point.x * 1.8 + point.y * 0.55 + time)
      + sin(point.y * 1.65 - point.x * 0.35 - time * 0.8)
      + 0.55 * sin(point.x * 1.1 + point.y * 1.45 + time * 0.65);
    float distanceToLight = abs(surface);
    float core = 1.0 - smoothstep(0.025, 0.16, distanceToLight);
    float softEdge = 1.0 - smoothstep(0.10, 0.48, distanceToLight);
    return core * 0.65 + softEdge * 0.35;
  }

  void main() {
    float time = uTime * 0.19;
    vec2 point = vUv * vec2(uAspect, 1.0) * 3.8;
    float firstLight = waterLight(point + vec2(time * 0.14, -time * 0.10), time);
    float secondLight = waterLight(point * 1.12 + vec2(3.1, 1.7), -time * 0.72);
    float caustic = max(firstLight, secondLight * 0.62);
    float mobile = 1.0 - smoothstep(0.7, 1.2, uAspect);
    float horizontalEdge = smoothstep(mix(0.18, 0.31, mobile), 0.49, abs(vUv.x - 0.5));
    float verticalEdge = smoothstep(0.33, 0.5, abs(vUv.y - 0.5));
    float edgeStrength = max(horizontalEdge, verticalEdge * 0.55);
    float wave = 0.5 + 0.5 * sin(point.x * 0.73 + point.y * 0.56 + time * 0.8)
      * cos(point.y * 0.64 - time * 0.6);
    // Bound the aqua tint so muted text stays above 4.5:1 at every frame.
    float tint = mix(0.035, 0.09, wave) + edgeStrength * mix(0.14, 0.24, wave);
    vec3 color = mix(uPaper, uWater, tint);
    float reflection = caustic * mix(0.18, 0.86, edgeStrength);
    color = mix(color, uLight, reflection);
    gl_FragColor = vec4(color, 1.0);
    #include <colorspace_fragment>
  }
`;

export function createWaterBackground(host, canvas, context, { onStateChange, onFailure } = {}) {
  const scene = new Scene();
  const camera = new OrthographicCamera(-1, 1, 1, -1, 0, 1);
  let renderer;
  let geometry;
  let material;
  let observer;
  let disposed = false;
  let failed = false;
  let shaderFailed = false;
  let paused = true;
  let lastFrame = null;
  let elapsedTime = 0;
  let frameInterval = 1000 / 30;

  function dispose() {
    if (disposed) return;
    disposed = true;
    observer?.disconnect();
    canvas.removeEventListener("webglcontextlost", contextLost);
    renderer?.setAnimationLoop(null);
    geometry?.dispose();
    material?.dispose();
    scene.clear();
    renderer?.dispose();
    renderer?.forceContextLoss();
    canvas.remove();
  }

  function fail() {
    if (disposed || failed) return;
    failed = true;
    dispose();
    onFailure?.();
  }

  function draw() {
    if (disposed || failed) return;
    renderer.render(scene, camera);
    if (shaderFailed) throw new Error("The water background could not render.");
  }

  function resize() {
    if (disposed || failed) return;
    const width = Math.max(1, host.clientWidth);
    const height = Math.max(1, host.clientHeight);
    const mobile = width < 640;
    const pixelBudget = mobile ? 280_000 : 650_000;
    const pixelRatio = Math.min(
      window.devicePixelRatio || 1,
      mobile ? 1 : 1.5,
      Math.sqrt(pixelBudget / (width * height)),
    );
    frameInterval = 1000 / (mobile ? 24 : 30);
    material.uniforms.uAspect.value = width / height;
    renderer.setPixelRatio(pixelRatio);
    renderer.setSize(width, height, false);
    draw();
  }

  function frame(now) {
    if (disposed || failed || paused) return;
    if (lastFrame === null) lastFrame = now;
    const elapsed = now - lastFrame;
    if (elapsed < frameInterval) return;
    elapsedTime += Math.min(elapsed, 100) / 1000;
    lastFrame = now;
    material.uniforms.uTime.value = elapsedTime;
    try { draw(); } catch { fail(); }
  }

  function setPaused(value) {
    if (disposed || failed) return;
    paused = Boolean(value);
    lastFrame = null;
    renderer.setAnimationLoop(paused ? null : frame);
    onStateChange?.(paused ? "paused" : "ready");
  }

  function contextLost(event) {
    event.preventDefault();
    fail();
  }

  try {
    renderer = new WebGLRenderer({
      canvas, context, alpha: false, antialias: false, depth: false,
      stencil: false, powerPreference: "low-power",
    });
    renderer.setClearColor("#FAF7F2");
    renderer.debug.onShaderError = () => { shaderFailed = true; };
    geometry = new PlaneGeometry(2, 2);
    material = new ShaderMaterial({
      uniforms: {
        uTime: { value: 0 },
        uAspect: { value: 1 },
        uPaper: { value: new Color("#FAF7F2") },
        uWater: { value: new Color("#81B9B8") },
        uLight: { value: new Color("#FFFDF8") },
      },
      vertexShader,
      fragmentShader,
      depthTest: false,
      depthWrite: false,
    });
    const surface = new Mesh(geometry, material);
    surface.frustumCulled = false;
    scene.add(surface);
    canvas.style.pointerEvents = "none";
    canvas.addEventListener("webglcontextlost", contextLost);
    host.append(canvas);
    resize();
    observer = new ResizeObserver(() => { try { resize(); } catch { fail(); } });
    observer.observe(host);
    return { setPaused, dispose };
  } catch (error) {
    dispose();
    throw error;
  }
}
