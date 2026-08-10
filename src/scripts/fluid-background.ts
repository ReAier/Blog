import {
  createFrameGate,
  resolveMotionProfile,
  resolvePageKind,
  type MotionProfile,
} from '../lib/motion';

const VERTEX = `attribute vec2 position;void main(){gl_Position=vec4(position,0.,1.);}`;
const FRAGMENT = `precision mediump float;uniform vec2 resolution,pointer;uniform float time,intensity,darkMode;uniform vec3 accent;float wave(vec2 p){return sin(p.x*2.1+time*.18)+sin(p.y*2.7-time*.14)+sin((p.x+p.y)*1.4+time*.11);}void main(){vec2 uv=(gl_FragCoord.xy-.5*resolution.xy)/min(resolution.x,resolution.y);float field=wave(uv+pointer*.08)*.166;float glow=smoothstep(.72,.05,length(uv-pointer*.22)+field*.12);vec3 paper=mix(vec3(.94,.92,.89),vec3(.055,.06,.075),darkMode);vec3 color=mix(paper,accent,.12+.16*glow+.06*field);gl_FragColor=vec4(color,intensity*(.16+.24*glow));}`;

interface FluidResources {
  program: WebGLProgram;
  buffer: WebGLBuffer;
  position: number;
  resolution: WebGLUniformLocation | null;
  pointer: WebGLUniformLocation | null;
  time: WebGLUniformLocation | null;
  intensity: WebGLUniformLocation | null;
  accent: WebGLUniformLocation | null;
  darkMode: WebGLUniformLocation | null;
}

function compileShader(gl: WebGLRenderingContext, type: number, source: string) {
  const shader = gl.createShader(type);
  if (!shader) throw new Error('Unable to create WebGL shader.');

  gl.shaderSource(shader, source);
  gl.compileShader(shader);
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    const message = gl.getShaderInfoLog(shader) || 'Unable to compile WebGL shader.';
    gl.deleteShader(shader);
    throw new Error(message);
  }

  return shader;
}

function createResources(gl: WebGLRenderingContext): FluidResources {
  const vertex = compileShader(gl, gl.VERTEX_SHADER, VERTEX);
  const fragment = compileShader(gl, gl.FRAGMENT_SHADER, FRAGMENT);
  const program = gl.createProgram();

  if (!program) {
    gl.deleteShader(vertex);
    gl.deleteShader(fragment);
    throw new Error('Unable to create WebGL program.');
  }

  gl.attachShader(program, vertex);
  gl.attachShader(program, fragment);
  gl.linkProgram(program);
  gl.deleteShader(vertex);
  gl.deleteShader(fragment);

  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    const message = gl.getProgramInfoLog(program) || 'Unable to link WebGL program.';
    gl.deleteProgram(program);
    throw new Error(message);
  }

  const buffer = gl.createBuffer();
  if (!buffer) {
    gl.deleteProgram(program);
    throw new Error('Unable to create WebGL buffer.');
  }

  gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
  gl.bufferData(
    gl.ARRAY_BUFFER,
    new Float32Array([-1, -1, 1, -1, -1, 1, -1, 1, 1, -1, 1, 1]),
    gl.STATIC_DRAW,
  );

  return {
    program,
    buffer,
    position: gl.getAttribLocation(program, 'position'),
    resolution: gl.getUniformLocation(program, 'resolution'),
    pointer: gl.getUniformLocation(program, 'pointer'),
    time: gl.getUniformLocation(program, 'time'),
    intensity: gl.getUniformLocation(program, 'intensity'),
    accent: gl.getUniformLocation(program, 'accent'),
    darkMode: gl.getUniformLocation(program, 'darkMode'),
  };
}

function parseAccent() {
  const raw = getComputedStyle(document.documentElement).getPropertyValue('--accent-rgb').trim();
  const channels = raw.split(/[ ,]+/).map(Number);
  if (channels.length < 3 || channels.some((channel) => !Number.isFinite(channel))) {
    return [0.77, 0.2, 0.38] as const;
  }
  return channels.slice(0, 3).map((channel) => Math.min(255, Math.max(0, channel)) / 255) as [
    number,
    number,
    number,
  ];
}

function prefersDark(colorScheme: MediaQueryList) {
  const theme = document.documentElement.dataset.theme;
  return theme === 'dark' || (theme !== 'light' && colorScheme.matches);
}

export function startFluidBackground(canvas: HTMLCanvasElement): () => void {
  const shell = canvas.closest<HTMLElement>('[data-motion-shell]');
  const mobileQuery = matchMedia('(max-width: 720px)');
  const reducedQuery = matchMedia('(prefers-reduced-motion: reduce)');
  const colorSchemeQuery = matchMedia('(prefers-color-scheme: dark)');
  const abort = new AbortController();
  const { signal } = abort;

  let gl: WebGLRenderingContext | null = null;
  let resources: FluidResources | null = null;
  let frame = 0;
  let contextLost = false;
  let disposed = false;
  let profile: MotionProfile = resolveMotionProfile({
    mobile: mobileQuery.matches,
    reduced: reducedQuery.matches,
    pageKind: resolvePageKind(location.pathname),
  });
  let frameGate: ((time: number) => boolean) | null = null;
  let accent = parseAccent();
  let darkMode = prefersDark(colorSchemeQuery) ? 1 : 0;
  let pointerX = 0;
  let pointerY = 0;
  let targetX = 0;
  let targetY = 0;
  let startedAt = performance.now();

  const setFallback = (fallback: boolean) => {
    if (fallback) canvas.setAttribute('data-fluid-fallback', 'true');
    else canvas.removeAttribute('data-fluid-fallback');
  };

  const destroyResources = () => {
    if (!gl || !resources || contextLost) {
      resources = null;
      return;
    }
    gl.deleteBuffer(resources.buffer);
    gl.deleteProgram(resources.program);
    resources = null;
  };

  const initializeContext = () => {
    destroyResources();
    gl = canvas.getContext('webgl', { alpha: true, antialias: false, premultipliedAlpha: true });
    if (!gl) {
      setFallback(true);
      return false;
    }

    try {
      resources = createResources(gl);
      gl.enable(gl.BLEND);
      gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
      setFallback(false);
      return true;
    } catch {
      destroyResources();
      gl = null;
      setFallback(true);
      return false;
    }
  };

  const resize = () => {
    const width = Math.max(1, Math.round(canvas.clientWidth * profile.dpr));
    const height = Math.max(1, Math.round(canvas.clientHeight * profile.dpr));
    if (canvas.width !== width || canvas.height !== height) {
      canvas.width = width;
      canvas.height = height;
    }
    gl?.viewport(0, 0, width, height);
  };

  const syncProfile = () => {
    const pageKind = resolvePageKind(location.pathname);
    profile = resolveMotionProfile({
      mobile: mobileQuery.matches,
      reduced: reducedQuery.matches,
      pageKind,
    });
    frameGate =
      profile.fps === 30 || profile.fps === 60 ? createFrameGate(profile.fps) : null;

    document.body.setAttribute('data-page-kind', pageKind);
    if (shell) {
      shell.setAttribute('data-page-kind', pageKind);
      shell.dataset.motionEnabled = String(profile.enabled);
      shell.dataset.motionFps = String(profile.fps);
      shell.dataset.motionDpr = String(profile.dpr);
      shell.dataset.motionIntensity = String(profile.intensity);
    }
    canvas.dataset.motionProfile = `${profile.fps}/${profile.dpr}/${profile.intensity}`;
    resize();
  };

  const refreshPalette = () => {
    accent = parseAccent();
    darkMode = prefersDark(colorSchemeQuery) ? 1 : 0;
  };

  const shouldAnimate = () =>
    !disposed &&
    !contextLost &&
    profile.enabled &&
    resources !== null &&
    document.visibilityState !== 'hidden';

  const render = (time: number) => {
    frame = 0;
    if (!shouldAnimate() || !gl || !resources) return;

    if (!frameGate || frameGate(time)) {
      pointerX += (targetX - pointerX) * 0.045;
      pointerY += (targetY - pointerY) * 0.045;
      resize();

      gl.useProgram(resources.program);
      gl.bindBuffer(gl.ARRAY_BUFFER, resources.buffer);
      gl.enableVertexAttribArray(resources.position);
      gl.vertexAttribPointer(resources.position, 2, gl.FLOAT, false, 0, 0);
      gl.uniform2f(resources.resolution, canvas.width, canvas.height);
      gl.uniform2f(resources.pointer, pointerX, pointerY);
      gl.uniform1f(resources.time, (time - startedAt) / 1000);
      gl.uniform1f(resources.intensity, profile.intensity);
      gl.uniform3f(resources.accent, accent[0], accent[1], accent[2]);
      gl.uniform1f(resources.darkMode, darkMode);
      gl.clearColor(0, 0, 0, 0);
    gl.clear(gl.COLOR_BUFFER_BIT);
    gl.drawArrays(gl.TRIANGLES, 0, 6);
    }

    frame = requestAnimationFrame(render);
  };

  const stop = () => {
    if (frame) cancelAnimationFrame(frame);
    frame = 0;
  };

  const start = () => {
    stop();
    if (shouldAnimate()) frame = requestAnimationFrame(render);
  };

  const resync = () => {
    syncProfile();
    refreshPalette();
    start();
  };

  const onPointerMove = (event: PointerEvent) => {
    targetX = (event.clientX / Math.max(1, innerWidth) - 0.5) * 2;
    targetY = (0.5 - event.clientY / Math.max(1, innerHeight)) * 2;
  };

  const onVisibilityChange = () => {
    if (document.visibilityState === 'hidden') stop();
    else {
      startedAt = performance.now();
      start();
    }
  };

  const onContextLost = (event: Event) => {
    event.preventDefault();
    contextLost = true;
    stop();
    resources = null;
    setFallback(true);
  };

  const onContextRestored = () => {
    contextLost = false;
    startedAt = performance.now();
    if (initializeContext()) {
      resize();
      start();
    }
  };

  const resizeObserver = new ResizeObserver(resize);
  resizeObserver.observe(canvas);

  window.addEventListener('pointermove', onPointerMove, { passive: true, signal });
  window.visualViewport?.addEventListener('resize', resize, { passive: true, signal });
  document.addEventListener('visibilitychange', onVisibilityChange, { signal });
  document.addEventListener('astro:page-load', resync, { signal });
  window.addEventListener('aier:preference-change', resync, { signal });
  document.addEventListener('aier:preference-change', resync, { signal });
  canvas.addEventListener('webglcontextlost', onContextLost, { signal });
  canvas.addEventListener('webglcontextrestored', onContextRestored, { signal });
  mobileQuery.addEventListener('change', resync, { signal });
  reducedQuery.addEventListener('change', resync, { signal });
  colorSchemeQuery.addEventListener('change', resync, { signal });

  const rootObserver = new MutationObserver(refreshPalette);
  rootObserver.observe(document.documentElement, {
    attributes: true,
    attributeFilter: ['data-theme', 'data-accent'],
  });

  syncProfile();
  refreshPalette();
  if (initializeContext()) {
    resize();
    start();
  }

  return () => {
    disposed = true;
    stop();
    abort.abort();
    resizeObserver.disconnect();
    rootObserver.disconnect();
    destroyResources();
    gl = null;
  };
}
