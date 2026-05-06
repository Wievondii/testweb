/**
 * Three.js Hero Background — Floating Petals & Light Particles
 * Monet's Garden themed particle system
 */
(() => {
  const canvas = document.getElementById('threeCanvas');
  if (!canvas || typeof THREE === 'undefined') return;

  // Respect reduced motion preference
  const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (prefersReducedMotion) {
    canvas.style.display = 'none';
    return;
  }

  const hero = document.getElementById('home');
  const PETAL_COUNT = 60;
  const PARTICLE_COUNT = 40;

  // Scene setup
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 100);
  camera.position.z = 30;

  const renderer = new THREE.WebGLRenderer({
    canvas,
    alpha: true,
    antialias: false,
  });
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setClearColor(0x000000, 0);

  // Mouse tracking
  const mouse = { x: 0, y: 0, targetX: 0, targetY: 0 };

  // Petal colors: soft lavender, rose, sage
  const petalColors = [
    new THREE.Color(0xc4a8d8), // soft lavender
    new THREE.Color(0xd8c0e8), // light purple
    new THREE.Color(0xdeb0c4), // rose
    new THREE.Color(0xead8e4), // soft pink
    new THREE.Color(0xe0d8ec), // lavender white
    new THREE.Color(0x9ab8a0), // sage green (rare)
  ];

  // Create petals
  const petalGeometry = new THREE.BufferGeometry();
  const petalPositions = new Float32Array(PETAL_COUNT * 3);
  const petalSizes = new Float32Array(PETAL_COUNT);
  const petalColorsArr = new Float32Array(PETAL_COUNT * 3);
  const petalVelocities = [];
  const petalData = [];

  for (let i = 0; i < PETAL_COUNT; i++) {
    const i3 = i * 3;
    petalPositions[i3] = (Math.random() - 0.5) * 50;
    petalPositions[i3 + 1] = (Math.random() - 0.5) * 40;
    petalPositions[i3 + 2] = (Math.random() - 0.5) * 20 - 5;

    petalSizes[i] = Math.random() * 1.5 + 0.5;

    const color = petalColors[Math.floor(Math.random() * petalColors.length)];
    petalColorsArr[i3] = color.r;
    petalColorsArr[i3 + 1] = color.g;
    petalColorsArr[i3 + 2] = color.b;

    petalVelocities.push({
      x: (Math.random() - 0.5) * 0.01,
      y: -(Math.random() * 0.015 + 0.005),
      rotSpeed: (Math.random() - 0.5) * 0.02,
    });

    petalData.push({
      phase: Math.random() * Math.PI * 2,
      speed: Math.random() * 0.3 + 0.2,
      wobble: Math.random() * 0.5 + 0.3,
    });
  }

  petalGeometry.setAttribute('position', new THREE.BufferAttribute(petalPositions, 3));
  petalGeometry.setAttribute('size', new THREE.BufferAttribute(petalSizes, 1));
  petalGeometry.setAttribute('color', new THREE.BufferAttribute(petalColorsArr, 3));

  // Petal shader material
  const petalMaterial = new THREE.ShaderMaterial({
    uniforms: {
      uTime: { value: 0 },
      uPixelRatio: { value: renderer.getPixelRatio() },
    },
    vertexShader: `
      attribute float size;
      attribute vec3 color;
      varying vec3 vColor;
      varying float vAlpha;
      uniform float uTime;
      uniform float uPixelRatio;

      void main() {
        vColor = color;
        vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
        float dist = -mvPosition.z;
        vAlpha = smoothstep(40.0, 10.0, dist) * 0.7;
        gl_PointSize = size * uPixelRatio * (20.0 / dist);
        gl_Position = projectionMatrix * mvPosition;
      }
    `,
    fragmentShader: `
      varying vec3 vColor;
      varying float vAlpha;

      void main() {
        vec2 center = gl_PointCoord - 0.5;
        float d = length(center);
        if (d > 0.5) discard;

        // Soft petal shape with glow
        float alpha = smoothstep(0.5, 0.1, d) * vAlpha;
        gl_FragColor = vec4(vColor, alpha);
      }
    `,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  });

  const petals = new THREE.Points(petalGeometry, petalMaterial);
  scene.add(petals);

  // Create light particles (smaller, brighter)
  const lightGeometry = new THREE.BufferGeometry();
  const lightPositions = new Float32Array(PARTICLE_COUNT * 3);
  const lightSizes = new Float32Array(PARTICLE_COUNT);
  const lightData = [];

  for (let i = 0; i < PARTICLE_COUNT; i++) {
    const i3 = i * 3;
    lightPositions[i3] = (Math.random() - 0.5) * 60;
    lightPositions[i3 + 1] = (Math.random() - 0.5) * 50;
    lightPositions[i3 + 2] = (Math.random() - 0.5) * 15 - 3;

    lightSizes[i] = Math.random() * 0.8 + 0.2;

    lightData.push({
      phase: Math.random() * Math.PI * 2,
      speed: Math.random() * 0.5 + 0.3,
      baseAlpha: Math.random() * 0.4 + 0.1,
    });
  }

  lightGeometry.setAttribute('position', new THREE.BufferAttribute(lightPositions, 3));
  lightGeometry.setAttribute('size', new THREE.BufferAttribute(lightSizes, 1));

  const lightMaterial = new THREE.ShaderMaterial({
    uniforms: {
      uTime: { value: 0 },
      uPixelRatio: { value: renderer.getPixelRatio() },
    },
    vertexShader: `
      attribute float size;
      varying float vAlpha;
      uniform float uTime;
      uniform float uPixelRatio;

      void main() {
        vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
        float dist = -mvPosition.z;
        vAlpha = smoothstep(35.0, 8.0, dist) * 0.5;
        gl_PointSize = size * uPixelRatio * (15.0 / dist);
        gl_Position = projectionMatrix * mvPosition;
      }
    `,
    fragmentShader: `
      varying float vAlpha;

      void main() {
        float d = length(gl_PointCoord - 0.5);
        if (d > 0.5) discard;
        float glow = exp(-d * 6.0) * vAlpha;
        vec3 color = vec3(0.88, 0.82, 0.96);
        gl_FragColor = vec4(color, glow);
      }
    `,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  });

  const lights = new THREE.Points(lightGeometry, lightMaterial);
  scene.add(lights);

  // Animation loop
  let time = 0;
  let scrollProgress = 0;
  let isVisible = true;

  function animate() {
    if (!isVisible) {
      requestAnimationFrame(animate);
      return;
    }

    time += 0.016;
    petalMaterial.uniforms.uTime.value = time;
    lightMaterial.uniforms.uTime.value = time;

    // Smooth mouse follow
    mouse.x += (mouse.targetX - mouse.x) * 0.05;
    mouse.y += (mouse.targetY - mouse.y) * 0.05;

    // Update petals
    const pos = petalGeometry.attributes.position.array;
    for (let i = 0; i < PETAL_COUNT; i++) {
      const i3 = i * 3;
      const data = petalData[i];
      const vel = petalVelocities[i];

      pos[i3] += vel.x + Math.sin(time * data.speed + data.phase) * data.wobble * 0.02;
      pos[i3 + 1] += vel.y;
      pos[i3 + 2] += Math.cos(time * data.speed * 0.7 + data.phase) * 0.005;

      // Reset when fallen below
      if (pos[i3 + 1] < -25) {
        pos[i3] = (Math.random() - 0.5) * 50;
        pos[i3 + 1] = 22 + Math.random() * 5;
        pos[i3 + 2] = (Math.random() - 0.5) * 20 - 5;
      }
    }

    // Apply mouse offset to petals
    camera.position.x = mouse.x * 2;
    camera.position.y = -mouse.y * 1.5 + scrollProgress * 5;
    camera.lookAt(0, -scrollProgress * 3, 0);

    // Update light particles — gentle float
    const lpos = lightGeometry.attributes.position.array;
    for (let i = 0; i < PARTICLE_COUNT; i++) {
      const i3 = i * 3;
      const data = lightData[i];
      lpos[i3 + 1] += Math.sin(time * data.speed + data.phase) * 0.003;
      lpos[i3] += Math.cos(time * data.speed * 0.5 + data.phase) * 0.002;
    }
    lightGeometry.attributes.position.needsUpdate = true;
    petalGeometry.attributes.position.needsUpdate = true;

    // Fade based on scroll
    const fade = Math.max(0, 1 - scrollProgress * 2);
    scene.visible = fade > 0.01;
    petals.material.opacity = fade;
    lights.material.opacity = fade;

    renderer.render(scene, camera);
    requestAnimationFrame(animate);
  }

  // Events
  window.addEventListener('mousemove', (e) => {
    mouse.targetX = (e.clientX / window.innerWidth - 0.5) * 2;
    mouse.targetY = (e.clientY / window.innerHeight - 0.5) * 2;
  });

  window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    petalMaterial.uniforms.uPixelRatio.value = renderer.getPixelRatio();
    lightMaterial.uniforms.uPixelRatio.value = renderer.getPixelRatio();
  });

  window.addEventListener('scroll', () => {
    scrollProgress = window.scrollY / window.innerHeight;
  }, { passive: true });

  // Visibility optimization
  const observer = new IntersectionObserver(([entry]) => {
    isVisible = entry.isIntersecting;
  }, { threshold: 0 });
  observer.observe(hero);

  animate();
})();
