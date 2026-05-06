/**
 * Three.js Hero Background — Floating Petals & Light Particles
 * Monet's Garden themed particle system with water waves
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
  const PETAL_COUNT = 80;
  const PARTICLE_COUNT = 60;

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

  // Mouse tracking with interaction radius
  const mouse = { x: 0, y: 0, targetX: 0, targetY: 0 };

  // Petal colors: soft lavender, rose, sage, gold
  const petalColors = [
    new THREE.Color(0xc4a8d8), // soft lavender
    new THREE.Color(0xd8c0e8), // light purple
    new THREE.Color(0xe8b4d0), // rose
    new THREE.Color(0xead8e4), // soft pink
    new THREE.Color(0xe0d8ec), // lavender white
    new THREE.Color(0xa8c9a0), // sage green (rare)
    new THREE.Color(0xe8d5a3), // monet gold (rare)
  ];

  // Create petals
  const petalGeometry = new THREE.BufferGeometry();
  const petalPositions = new Float32Array(PETAL_COUNT * 3);
  const petalSizes = new Float32Array(PETAL_COUNT);
  const petalColorsArr = new Float32Array(PETAL_COUNT * 3);
  const petalTypes = new Float32Array(PETAL_COUNT); // 0=rose, 1=waterlily, 2=normal
  const petalVelocities = [];
  const petalData = [];

  for (let i = 0; i < PETAL_COUNT; i++) {
    const i3 = i * 3;
    petalPositions[i3] = (Math.random() - 0.5) * 50;
    petalPositions[i3 + 1] = (Math.random() - 0.5) * 40;
    petalPositions[i3 + 2] = (Math.random() - 0.5) * 20 - 5;

    petalSizes[i] = Math.random() * 1.5 + 0.5;
    petalTypes[i] = Math.floor(Math.random() * 3); // 0, 1, or 2

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
  petalGeometry.setAttribute('petalType', new THREE.BufferAttribute(petalTypes, 1));

  // Petal shader material with shaped petals
  const petalMaterial = new THREE.ShaderMaterial({
    uniforms: {
      uTime: { value: 0 },
      uPixelRatio: { value: renderer.getPixelRatio() },
    },
    vertexShader: `
      attribute float size;
      attribute vec3 color;
      attribute float petalType;
      varying vec3 vColor;
      varying float vAlpha;
      varying float vPetalType;
      uniform float uTime;
      uniform float uPixelRatio;

      void main() {
        vColor = color;
        vPetalType = petalType;
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
      varying float vPetalType;

      void main() {
        vec2 center = gl_PointCoord - 0.5;
        float d = length(center);
        if (d > 0.5) discard;

        float alpha = 0.0;
        float angle = atan(center.y, center.x);
        float r = d * 2.0;

        if (vPetalType < 0.5) {
          // Rose petal: 5-lobed heart shape
          float rose = 1.0 - smoothstep(0.3, 0.5, r * (1.0 + 0.3 * cos(5.0 * angle)));
          alpha = rose * vAlpha;
        } else if (vPetalType < 1.5) {
          // Water lily: oval with pointed tip
          float tip = 1.0 - abs(center.x) * 1.5;
          float lily = 1.0 - smoothstep(0.2, 0.45, r) * tip;
          alpha = lily * vAlpha;
        } else {
          // Normal petal: simple soft ellipse
          alpha = smoothstep(0.5, 0.1, d) * vAlpha;
        }

        gl_FragColor = vec4(vColor, alpha);
      }
    `,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  });

  const petals = new THREE.Points(petalGeometry, petalMaterial);
  scene.add(petals);

  // Create light particles (smaller, brighter) with gold and twinkle
  const lightGeometry = new THREE.BufferGeometry();
  const lightPositions = new Float32Array(PARTICLE_COUNT * 3);
  const lightSizes = new Float32Array(PARTICLE_COUNT);
  const lightColors = new Float32Array(PARTICLE_COUNT * 3);
  const lightData = [];

  const goldColor = new THREE.Color(0xe8d5a3);
  const whiteColor = new THREE.Color(0xf0e8f8);

  for (let i = 0; i < PARTICLE_COUNT; i++) {
    const i3 = i * 3;
    lightPositions[i3] = (Math.random() - 0.5) * 60;
    lightPositions[i3 + 1] = (Math.random() - 0.5) * 50;
    lightPositions[i3 + 2] = (Math.random() - 0.5) * 15 - 3;

    lightSizes[i] = Math.random() * 0.8 + 0.2;

    // 30% gold particles
    const isGold = Math.random() < 0.3;
    const c = isGold ? goldColor : whiteColor;
    lightColors[i3] = c.r;
    lightColors[i3 + 1] = c.g;
    lightColors[i3 + 2] = c.b;

    lightData.push({
      phase: Math.random() * Math.PI * 2,
      speed: Math.random() * 0.5 + 0.3,
      baseAlpha: Math.random() * 0.4 + 0.1,
      twinkleSpeed: Math.random() * 2.0 + 1.0,
    });
  }

  lightGeometry.setAttribute('position', new THREE.BufferAttribute(lightPositions, 3));
  lightGeometry.setAttribute('size', new THREE.BufferAttribute(lightSizes, 1));
  lightGeometry.setAttribute('color', new THREE.BufferAttribute(lightColors, 3));

  const lightMaterial = new THREE.ShaderMaterial({
    uniforms: {
      uTime: { value: 0 },
      uPixelRatio: { value: renderer.getPixelRatio() },
    },
    vertexShader: `
      attribute float size;
      attribute vec3 color;
      varying float vAlpha;
      varying vec3 vColor;
      uniform float uTime;
      uniform float uPixelRatio;

      void main() {
        vColor = color;
        vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
        float dist = -mvPosition.z;
        vAlpha = smoothstep(35.0, 8.0, dist) * 0.5;
        gl_PointSize = size * uPixelRatio * (15.0 / dist);
        gl_Position = projectionMatrix * mvPosition;
      }
    `,
    fragmentShader: `
      varying float vAlpha;
      varying vec3 vColor;
      uniform float uTime;

      void main() {
        float d = length(gl_PointCoord - 0.5);
        if (d > 0.5) discard;
        float glow = exp(-d * 6.0) * vAlpha;
        // Twinkle effect
        float twinkle = 0.7 + 0.3 * sin(uTime * 3.0 + gl_PointCoord.x * 10.0);
        gl_FragColor = vec4(vColor, glow * twinkle);
      }
    `,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  });

  const lights = new THREE.Points(lightGeometry, lightMaterial);
  scene.add(lights);

  // Water surface effect at bottom
  const waterGeometry = new THREE.PlaneGeometry(80, 30, 64, 24);
  const waterMaterial = new THREE.ShaderMaterial({
    uniforms: {
      uTime: { value: 0 },
    },
    vertexShader: `
      uniform float uTime;
      varying vec2 vUv;

      void main() {
        vUv = uv;
        vec3 pos = position;
        float wave = sin(pos.x * 0.3 + uTime) * cos(pos.y * 0.2 + uTime * 0.7) * 0.5;
        pos.z += wave;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(pos, 1.0);
      }
    `,
    fragmentShader: `
      uniform float uTime;
      varying vec2 vUv;

      void main() {
        float wave = sin(vUv.x * 10.0 + uTime) * cos(vUv.y * 8.0 + uTime * 0.7) * 0.5;
        vec3 waterColor = vec3(0.494, 0.710, 0.839); // #7eb5d6
        vec3 sunColor = vec3(0.910, 0.835, 0.639);   // #e8d5a3
        float sun = pow(max(0.0, sin(vUv.x * 6.0 + uTime * 0.5) * 0.5 + 0.5), 3.0);
        vec3 finalColor = mix(waterColor, sunColor, sun * 0.25);
        float alpha = 0.12 + wave * 0.03;
        gl_FragColor = vec4(finalColor, alpha);
      }
    `,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    side: THREE.DoubleSide,
  });

  const waterPlane = new THREE.Mesh(waterGeometry, waterMaterial);
  waterPlane.position.y = -22;
  waterPlane.rotation.x = -Math.PI * 0.35;
  scene.add(waterPlane);

  // Background radial gradient atmosphere
  const bgGeometry = new THREE.PlaneGeometry(120, 120);
  const bgMaterial = new THREE.ShaderMaterial({
    uniforms: {},
    vertexShader: `
      varying vec2 vUv;
      void main() {
        vUv = uv;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: `
      varying vec2 vUv;
      void main() {
        vec2 center = vUv - 0.5;
        float d = length(center);
        vec3 centerColor = vec3(0.102, 0.063, 0.145); // #1a1025
        vec3 edgeColor = vec3(0.039, 0.055, 0.090);   // #0a0e17
        vec3 color = mix(centerColor, edgeColor, smoothstep(0.1, 0.6, d));
        gl_FragColor = vec4(color, 0.5);
      }
    `,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  });
  const bgPlane = new THREE.Mesh(bgGeometry, bgMaterial);
  bgPlane.position.z = -20;
  scene.add(bgPlane);

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
    waterMaterial.uniforms.uTime.value = time;

    // Smooth mouse follow
    mouse.x += (mouse.targetX - mouse.x) * 0.05;
    mouse.y += (mouse.targetY - mouse.y) * 0.05;

    // Update petals with mouse repulsion
    const pos = petalGeometry.attributes.position.array;
    for (let i = 0; i < PETAL_COUNT; i++) {
      const i3 = i * 3;
      const data = petalData[i];
      const vel = petalVelocities[i];

      // Mouse repulsion (subtle push away)
      const dx = pos[i3] - mouse.x * 15;
      const dy = pos[i3 + 1] - mouse.y * 10;
      const dist = Math.sqrt(dx * dx + dy * dy);
      const repelRadius = 8.0;
      if (dist < repelRadius && dist > 0.1) {
        const force = (1.0 - dist / repelRadius) * 0.02;
        pos[i3] += (dx / dist) * force;
        pos[i3 + 1] += (dy / dist) * force;
      }

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

    // Update light particles — gentle float with twinkle
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
    waterPlane.material.opacity = fade;
    bgPlane.material.opacity = fade;

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
