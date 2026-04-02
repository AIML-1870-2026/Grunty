/* viz.js — 3D Earth + Moon visualization using Three.js */

const Viz = (() => {
  // ── scene objects ──────────────────────────────────────────────────────────
  let scene, camera, renderer;
  let earthMesh, cloudMesh, moonMesh, moonPivot;
  let neoGroup;
  let animId;
  let container;
  let raycaster, ndcMouse;
  let tooltip;
  let isReady = false;
  let neoObjects = [];

  // ── interaction state ──────────────────────────────────────────────────────
  let isDragging   = false;
  let dragMoved    = false;
  let mouseDownPos = { x: 0, y: 0 };
  let prevPos      = { x: 0, y: 0 };
  let velX = 0, velY = 0;
  let hoveredMesh  = null;

  // camera zoom
  let camZ     = 13;
  const CAM_MIN = 5;
  const CAM_MAX = 22;

  // constants
  const EARTH_R  = 1.5;
  const MOON_R   = EARTH_R * 0.2724;   // real Moon/Earth radius ratio
  const MOON_INC = 5.14 * Math.PI / 180; // Moon's ~5° orbital inclination
  // 1 LD in display units — matches where distToR(0.00257 AU) maps to
  const MOON_DIST = 4.45;

  const CDN = 'https://cdn.jsdelivr.net/npm/three@0.128.0/examples/textures/planets/';

  // ── helpers ────────────────────────────────────────────────────────────────
  function distToR(au) {
    const t = Math.max(0, Math.min(1, (isNaN(au) ? 0.025 : au) / 0.05));
    return EARTH_R + 1.5 + Math.pow(t, 0.45) * 5.5;
  }

  function orbitPos(r, angle, inc, lan) {
    const x0 = r * Math.cos(angle);
    const z0 = r * Math.sin(angle);
    const y1 = -z0 * Math.sin(inc);
    const z1 =  z0 * Math.cos(inc);
    return new THREE.Vector3(
      x0 * Math.cos(lan) + z1 * Math.sin(lan),
      y1,
      -x0 * Math.sin(lan) + z1 * Math.cos(lan)
    );
  }

  // ── INIT ───────────────────────────────────────────────────────────────────
  function init(el) {
    container = el;
    const W = container.clientWidth;
    const H = container.clientHeight;

    scene = new THREE.Scene();

    camera = new THREE.PerspectiveCamera(42, W / H, 0.1, 500);
    camera.position.set(0, 2, camZ);
    camera.lookAt(0, 0, 0);

    renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setSize(W, H);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setClearColor(0x000000, 0);
    container.appendChild(renderer.domElement);

    raycaster = new THREE.Raycaster();
    ndcMouse  = new THREE.Vector2(-9, -9);

    tooltip = document.createElement('div');
    tooltip.className = 'viz-tooltip';
    container.appendChild(tooltip);

    // ── Lighting ──
    // Warm sun from upper-right
    scene.add(new THREE.AmbientLight(0x223355, 1.2));
    const sun = new THREE.DirectionalLight(0xfff5e0, 3.0);
    sun.position.set(8, 4, 6);
    scene.add(sun);
    const fill = new THREE.DirectionalLight(0x0a1533, 0.5);
    fill.position.set(-6, -3, -5);
    scene.add(fill);

    createStars();
    createEarth();
    createAtmosphere();
    createMoon();

    neoGroup = new THREE.Group();
    scene.add(neoGroup);

    bindEvents();
    isReady = true;
    animate();
  }

  // ── EARTH ──────────────────────────────────────────────────────────────────
  function createEarth() {
    const loader = new THREE.TextureLoader();

    const mat = new THREE.MeshPhongMaterial({
      color:     0x1a6691,    // ocean blue fallback
      specular:  0x4466aa,
      shininess: 18,
    });

    earthMesh = new THREE.Mesh(new THREE.SphereGeometry(EARTH_R, 64, 64), mat);
    scene.add(earthMesh);

    // Day texture — makes land/ocean visible
    loader.load(CDN + 'earth_atmos_2048.jpg', tex => {
      mat.map = tex;
      mat.color.set(0xffffff);
      mat.needsUpdate = true;
    });

    // Specular map — oceans shine, land is matte
    loader.load(CDN + 'earth_specular_2048.jpg', tex => {
      mat.specularMap = tex;
      mat.needsUpdate = true;
    });

    // Cloud layer — slightly above surface, semi-transparent
    const cloudMat = new THREE.MeshPhongMaterial({
      transparent: true,
      opacity: 0.42,
      depthWrite: false,
    });
    cloudMesh = new THREE.Mesh(new THREE.SphereGeometry(EARTH_R + 0.028, 64, 64), cloudMat);
    scene.add(cloudMesh);
    loader.load(CDN + 'earth_clouds_1024.png', tex => {
      cloudMat.map = tex;
      cloudMat.needsUpdate = true;
    });
  }

  // ── ATMOSPHERE ─────────────────────────────────────────────────────────────
  function createAtmosphere() {
    // Inner haze ring
    scene.add(new THREE.Mesh(
      new THREE.SphereGeometry(EARTH_R + 0.09, 48, 48),
      new THREE.MeshPhongMaterial({
        color: 0x3a80ff, transparent: true, opacity: 0.08, depthWrite: false,
      })
    ));
    // Outer glow (back-face so it only shows around the limb)
    scene.add(new THREE.Mesh(
      new THREE.SphereGeometry(EARTH_R + 0.45, 48, 48),
      new THREE.MeshPhongMaterial({
        color: 0x1144cc, transparent: true, opacity: 0.05,
        depthWrite: false, side: THREE.BackSide,
      })
    ));
  }

  // ── MOON ───────────────────────────────────────────────────────────────────
  function createMoon() {
    const loader = new THREE.TextureLoader();

    // Moon material — grey, low shininess like the real Moon
    const moonMat = new THREE.MeshPhongMaterial({
      color:     0x888888,
      specular:  0x111111,
      shininess: 2,
    });

    moonMesh = new THREE.Mesh(new THREE.SphereGeometry(MOON_R, 32, 32), moonMat);

    // Try to load a Moon texture; fall back to grey procedural if unavailable
    loader.load(CDN + 'moon_1024.jpg',
      tex => { moonMat.map = tex; moonMat.color.set(0xffffff); moonMat.needsUpdate = true; },
      undefined,
      () => {} // grey fallback — already set above
    );

    // Pivot so the Moon orbits around Earth's origin
    moonPivot = new THREE.Group();
    moonPivot.rotation.x = MOON_INC;   // tilt the orbit plane
    moonMesh.position.set(MOON_DIST, 0, 0);
    moonPivot.add(moonMesh);
    scene.add(moonPivot);

    // Faint orbit ring at 1 LD
    const pts = [];
    for (let i = 0; i <= 128; i++) {
      const a = (i / 128) * Math.PI * 2;
      pts.push(new THREE.Vector3(MOON_DIST * Math.cos(a), 0, MOON_DIST * Math.sin(a)));
    }
    const orbitRing = new THREE.Line(
      new THREE.BufferGeometry().setFromPoints(pts),
      new THREE.LineBasicMaterial({ color: 0x556677, transparent: true, opacity: 0.35 })
    );
    moonPivot.add(orbitRing);

    // "1 LD" label sprite
    const canvas = document.createElement('canvas');
    canvas.width = 200; canvas.height = 48;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = 'rgba(0,0,0,0)';
    ctx.fillRect(0, 0, 200, 48);
    ctx.font = 'bold 22px system-ui';
    ctx.fillStyle = '#7a8099';
    ctx.fillText('Moon  ·  1 LD', 8, 32);
    const labelTex = new THREE.CanvasTexture(canvas);
    const labelMat = new THREE.SpriteMaterial({ map: labelTex, transparent: true, depthWrite: false });
    const label = new THREE.Sprite(labelMat);
    label.scale.set(2.2, 0.52, 1);
    label.position.set(MOON_DIST + 0.5, MOON_R + 0.35, 0);
    moonPivot.add(label);
  }

  // ── STARS ──────────────────────────────────────────────────────────────────
  function createStars() {
    const N = 3500;
    const pos = new Float32Array(N * 3);
    for (let i = 0; i < N; i++) {
      const theta = Math.random() * Math.PI * 2;
      const phi   = Math.acos(2 * Math.random() - 1);
      const r     = 90 + Math.random() * 110;
      pos[i*3]   = r * Math.sin(phi) * Math.cos(theta);
      pos[i*3+1] = r * Math.sin(phi) * Math.sin(theta);
      pos[i*3+2] = r * Math.cos(phi);
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    scene.add(new THREE.Points(geo, new THREE.PointsMaterial({
      color: 0xffffff, size: 0.18, sizeAttenuation: true,
    })));
  }

  // ── NEOs ───────────────────────────────────────────────────────────────────
  function updateNEOs(neoData) {
    if (!isReady) return;
    neoObjects.forEach(({ mesh, glowMesh, ring }) => {
      neoGroup.remove(mesh);
      neoGroup.remove(glowMesh);
      if (ring) neoGroup.remove(ring);
    });
    neoObjects = [];

    neoData.slice(0, 60).forEach((neo, idx) => {
      const dist_au = isNaN(neo.dist_au) ? 0.025 : Math.max(0.001, neo.dist_au);
      const r       = distToR(dist_au);
      const seed    = (idx * 2.399963) % (Math.PI * 2);
      const inc     = (((idx * 0.618) % 1) - 0.5) * Math.PI * 0.65;
      const lan     = seed;
      const angle   = seed * 1.3;
      const pos     = orbitPos(r, angle, inc, lan);

      const color = neo.sentry ? 0xff4a4a : neo.is_pha ? 0xf4c542 : 0x4a9eff;

      const mesh = new THREE.Mesh(
        new THREE.SphereGeometry(0.06, 10, 10),
        new THREE.MeshBasicMaterial({ color })
      );
      mesh.position.copy(pos);
      mesh.userData = { neo, idx };
      neoGroup.add(mesh);

      const glowMesh = new THREE.Mesh(
        new THREE.SphereGeometry(0.13, 10, 10),
        new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.25, depthWrite: false })
      );
      glowMesh.position.copy(pos);
      neoGroup.add(glowMesh);

      const pts = [];
      for (let j = 0; j <= 96; j++) pts.push(orbitPos(r, (j / 96) * Math.PI * 2, inc, lan));
      const ring = new THREE.Line(
        new THREE.BufferGeometry().setFromPoints(pts),
        new THREE.LineBasicMaterial({ color, transparent: true, opacity: 0.16 })
      );
      neoGroup.add(ring);

      mesh.userData.orbitR     = r;
      mesh.userData.orbitAngle = angle;
      mesh.userData.inc        = inc;
      mesh.userData.lan        = lan;
      mesh.userData.speed      = 0.00018 + (idx % 7) * 0.000035;
      mesh.userData.glowMesh   = glowMesh;

      neoObjects.push({ mesh, glowMesh, ring });
    });
  }

  // ── ANIMATE ────────────────────────────────────────────────────────────────
  function animate() {
    animId = requestAnimationFrame(animate);

    // Earth rotation + inertia
    if (isDragging) {
      earthMesh.rotation.x += velX;
      earthMesh.rotation.y += velY;
      cloudMesh.rotation.x += velX;
      cloudMesh.rotation.y += velY;
    } else if (Math.abs(velX) > 0.00005 || Math.abs(velY) > 0.00005) {
      earthMesh.rotation.x += velX;
      earthMesh.rotation.y += velY;
      cloudMesh.rotation.x += velX;
      cloudMesh.rotation.y += velY;
      velX *= 0.94;
      velY *= 0.94;
    } else {
      earthMesh.rotation.y += 0.0008;
      cloudMesh.rotation.y  += 0.0011;
    }

    // Moon orbits Earth (~1 revolution per 60 s at 60 fps)
    moonPivot.rotation.y += 0.00175;
    // Moon rotates to keep the same face toward Earth (tidal lock)
    moonMesh.rotation.y = -moonPivot.rotation.y;

    // Smooth zoom
    camera.position.z += (camZ - camera.position.z) * 0.1;

    // Orbit NEOs
    neoObjects.forEach(({ mesh, glowMesh }) => {
      if (!mesh) return;
      mesh.userData.orbitAngle += mesh.userData.speed;
      const p = orbitPos(mesh.userData.orbitR, mesh.userData.orbitAngle, mesh.userData.inc, mesh.userData.lan);
      mesh.position.copy(p);
      if (glowMesh) glowMesh.position.copy(p);
    });

    // Hover
    raycaster.setFromCamera(ndcMouse, camera);
    const hits = raycaster.intersectObjects(neoObjects.map(n => n.mesh).filter(Boolean));
    if (hits.length > 0) {
      const hit = hits[0].object;
      if (hit !== hoveredMesh) {
        if (hoveredMesh) { hoveredMesh.scale.setScalar(1); hoveredMesh.userData.glowMesh?.scale.setScalar(1); }
        hoveredMesh = hit;
        hoveredMesh.scale.setScalar(1.9);
        hoveredMesh.userData.glowMesh?.scale.setScalar(1.9);
      }
      const neo  = hit.userData.neo;
      const dist = isNaN(neo.dist_au) ? '—' : neo.dist_au.toFixed(5) + ' AU';
      const tag  = neo.sentry ? ' 🔴' : neo.is_pha ? ' ⚠' : '';
      tooltip.innerHTML = `<strong>${neo.name}${tag}</strong><br>${dist}`;
      tooltip.classList.add('is-visible');
      setCursor('pointer');
    } else {
      if (hoveredMesh) {
        hoveredMesh.scale.setScalar(1);
        hoveredMesh.userData.glowMesh?.scale.setScalar(1);
        hoveredMesh = null;
      }
      tooltip.classList.remove('is-visible');
      setCursor(isDragging ? 'grabbing' : 'grab');
    }

    renderer.render(scene, camera);
  }

  function setCursor(c) { renderer.domElement.style.cursor = c; }

  // ── EVENTS ─────────────────────────────────────────────────────────────────
  function bindEvents() {
    const el = renderer.domElement;

    function onDown(cx, cy) {
      isDragging = true; dragMoved = false;
      mouseDownPos = { x: cx, y: cy };
      prevPos = { x: cx, y: cy };
      velX = velY = 0;
      setCursor('grabbing');
    }

    function onMove(cx, cy) {
      const rect = el.getBoundingClientRect();
      ndcMouse.x =  ((cx - rect.left) / rect.width)  * 2 - 1;
      ndcMouse.y = -((cy - rect.top)  / rect.height) * 2 + 1;
      tooltip.style.left = (cx - rect.left + 14) + 'px';
      tooltip.style.top  = (cy - rect.top  - 14) + 'px';
      if (!isDragging) return;
      velX = (cy - prevPos.y) * 0.006;
      velY = (cx - prevPos.x) * 0.006;
      prevPos = { x: cx, y: cy };
      if (Math.abs(cx - mouseDownPos.x) > 4 || Math.abs(cy - mouseDownPos.y) > 4) dragMoved = true;
    }

    function onUp() {
      isDragging = false;
      setCursor('grab');
    }

    el.addEventListener('mousedown', e => onDown(e.clientX, e.clientY));
    window.addEventListener('mousemove', e => onMove(e.clientX, e.clientY));
    window.addEventListener('mouseup', onUp);

    el.addEventListener('click', e => {
      if (dragMoved) return;
      raycaster.setFromCamera(ndcMouse, camera);
      const hits = raycaster.intersectObjects(neoObjects.map(n => n.mesh).filter(Boolean));
      if (!hits.length) return;
      const { neo } = hits[0].object.userData;
      if (!neo) return;
      const idx = (typeof state !== 'undefined' && state.merged)
        ? state.merged.findIndex(r => r.id === neo.id && r.date === neo.date)
        : -1;
      if (idx !== -1 && typeof openDetail === 'function') openDetail(idx);
    });

    el.addEventListener('touchstart',  e => { e.preventDefault(); onDown(e.touches[0].clientX, e.touches[0].clientY); }, { passive: false });
    window.addEventListener('touchmove',  e => onMove(e.touches[0].clientX, e.touches[0].clientY));
    window.addEventListener('touchend',   onUp);

    el.addEventListener('wheel', e => {
      e.preventDefault();
      camZ = Math.max(CAM_MIN, Math.min(CAM_MAX, camZ + e.deltaY * 0.02));
    }, { passive: false });

    window.addEventListener('resize', () => {
      if (!container || !renderer) return;
      const W = container.clientWidth, H = container.clientHeight;
      camera.aspect = W / H;
      camera.updateProjectionMatrix();
      renderer.setSize(W, H);
    });
  }

  function destroy() {
    if (animId) cancelAnimationFrame(animId);
    renderer?.dispose();
    isReady = false;
  }

  return { init, updateNEOs, destroy };
})();
