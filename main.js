// ===============================
// GAME STATE
// ===============================
let gameOver = false;
let animationId;
let difficulty = 0;
let distance = 0;
const WIN_DISTANCE = 1000;
let hasWon = false;
let time = 0;
let gameState = "PLAYING"; 
// PLAYING | WIN | LANDING


// ===============================
// SCENE SETUP
// ===============================
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x000000);

const camera = new THREE.PerspectiveCamera(
    75,
    window.innerWidth / window.innerHeight,
    0.1,
    1000
);
camera.position.z = 5;

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setClearColor(0x000000, 1);
document.getElementById("viewport").appendChild(renderer.domElement);

// ===============================
// HUD: DISTANCE
// ===============================
const scoreHUD = document.createElement("div");
scoreHUD.style.position = "fixed";
scoreHUD.style.top = "20px";
scoreHUD.style.left = "20px";
scoreHUD.style.color = "#00ffee";
scoreHUD.style.fontFamily = "monospace";
scoreHUD.style.fontSize = "16px";
scoreHUD.style.opacity = "0.85";
scoreHUD.style.pointerEvents = "none";
scoreHUD.innerText = "DISTANCE: 0";
document.body.appendChild(scoreHUD);

// ===============================
// LIGHT
// ===============================
const light = new THREE.PointLight(0xffffff, 1.2);
light.position.set(0, 5, 5);
scene.add(light);

// ===============================
// DYNAMIC SUN LIGHT
// ===============================
const sunLight = new THREE.DirectionalLight(0xfff3cc, 0);
sunLight.position.set(10, 10, -10);
scene.add(sunLight);

const sunTarget = new THREE.Object3D();
scene.add(sunTarget);
sunLight.target = sunTarget;

// Sun state
let sunTimer = 0;
let sunActive = false;


// ===============================
// PLAYER STATE
// ===============================
let targetX = 0, targetY = 0;
let camX = 0, camY = 0;
const LIMIT_X = 3;
const LIMIT_Y = 2;

// ===============================
// INPUT
// ===============================
const keys = {};
window.addEventListener("keydown", e => keys[e.key] = true);
window.addEventListener("keyup", e => keys[e.key] = false);

// ===============================
// ASTEROIDS
// ===============================
const asteroids = [];
function createAsteroidGeometry() {
    const geo = new THREE.IcosahedronGeometry(0.6, 1);

    const pos = geo.attributes.position;
    for (let i = 0; i < pos.count; i++) {
        const x = pos.getX(i);
        const y = pos.getY(i);
        const z = pos.getZ(i);

        const offset = (Math.random() - 0.5) * 0.25;
        pos.setXYZ(
            i,
            x + x * offset,
            y + y * offset,
            z + z * offset
        );
    }

    geo.computeVertexNormals();
    return geo;
}

const asteroidMat = new THREE.MeshStandardMaterial({
    color: 0x7a7a7a,
    flatShading: true,
    roughness: 0.9,
    metalness: 0.1
});

function spawnAsteroid() {
    const a = new THREE.Mesh(createAsteroidGeometry(), asteroidMat);
    a.position.set(
        (Math.random() - 0.5) * 8,
        (Math.random() - 0.5) * 5,
        -30
    );
    const scale = 0.6 + Math.random() * 0.9;
a.scale.set(scale, scale * (0.7 + Math.random() * 0.6), scale);

a.rotation.set(
    Math.random() * Math.PI,
    Math.random() * Math.PI,
    Math.random() * Math.PI
);

a.userData.spin = {
    x: (Math.random() - 0.5) * 0.02,
    y: (Math.random() - 0.5) * 0.02,
    z: (Math.random() - 0.5) * 0.02
};

    scene.add(a);
    asteroids.push(a);
}
setInterval(spawnAsteroid, 900);

// ===============================
// STARFIELDS (PARALLAX)
// ===============================
function createStars(count, size, speed) {
    const geo = new THREE.BufferGeometry();
    const pos = [];
    for (let i = 0; i < count; i++) {
        pos.push(
            (Math.random() - 0.5) * 100,
            (Math.random() - 0.5) * 100,
            Math.random() * -200
        );
    }
    geo.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
    const mat = new THREE.PointsMaterial({ color: 0xffffff, size });
    const stars = new THREE.Points(geo, mat);
    stars.userData.speed = speed;
    scene.add(stars);
    return stars;
}

const starsFar = createStars(800, 0.2, 0.15);
const starsMid = createStars(500, 0.35, 0.3);
const starsNear = createStars(200, 0.6, 0.6);

// ===============================
// GYRO HUD (Artificial Horizon)
// ===============================
const hud = new THREE.Group();

// ===============================
// HUD FRAME (FUN COLOR)
// ===============================
const frameMat = new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    depthTest: false,
    uniforms: {
        time: { value: 0 }
    },
    vertexShader: `
        varying vec2 vUv;
        void main() {
            vUv = uv;
            gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0);
        }
    `,
    fragmentShader: `
        varying vec2 vUv;
        uniform float time;

        void main() {
            vec2 uv = vUv - 0.5;
            float r = length(uv);

            float frame = smoothstep(0.46, 0.48, r);

            vec3 funColor = vec3(
                0.6 + 0.4 * sin(time * 2.0),
                0.3 + 0.3 * sin(time * 1.5),
                1.0
            );

            gl_FragColor = vec4(funColor, frame * 0.9);
        }
    `
});

const frame = new THREE.Mesh(
    new THREE.PlaneGeometry(10, 10),
    frameMat
);

frame.position.z = -2;
camera.add(frame);

const horizon = new THREE.Mesh(
    new THREE.PlaneGeometry(6, 0.06),
    new THREE.MeshBasicMaterial({ color: 0x00ffee, transparent: true, opacity: 0.8 })
);

hud.add(horizon);
hud.position.set(0, -1.6, -2.5);
camera.add(hud);

// ===============================
// EDGE GLOW SHADER (PURPLE → RED)
// ===============================
const edgeGlowMat = new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    depthTest: false,
    uniforms: {
        time: { value: 0 },
        danger: { value: 0 }
    },
    vertexShader: `
        varying vec2 vUv;
        void main() {
            vUv = uv;
            gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0);
        }
    `,
    fragmentShader: `
        uniform float time;
        uniform float danger;
        varying vec2 vUv;

        void main() {
            vec2 uv = vUv - 0.5;
            float r = length(uv);

            float edge = smoothstep(0.35, 0.48, r);

            vec3 safe = vec3(0.45, 0.2, 1.0);
            vec3 alert = vec3(1.0, 0.15, 0.2);
            vec3 color = mix(safe, alert, danger);

            float pulse = sin(time * 4.0) * 0.15 + 0.85;

            vec3 finalColor;
            finalColor.r = color.r * edge * (1.2 + danger);
            finalColor.g = color.g * edge;
            finalColor.b = color.b * edge * (1.4 - danger * 0.3);

            gl_FragColor = vec4(finalColor * pulse, edge * 0.85);
        }
    `
});

const edgeGlow = new THREE.Mesh(new THREE.PlaneGeometry(10, 10), edgeGlowMat);
edgeGlow.position.z = -2;
camera.add(edgeGlow);
scene.add(camera);

// ===============================
// ANIMATION LOOP
// ===============================
function animate() {
    animationId = requestAnimationFrame(animate);
    time += 0.016;
    difficulty += 0.0003;

    if (!gameOver && !hasWon) distance++;
    scoreHUD.innerText = `DISTANCE: ${distance}`;

    if (!hasWon && distance >= WIN_DISTANCE) {
        hasWon = true;
        cancelAnimationFrame(animationId);
        setTimeout(showWinScreen, 500);
        return;
    }

    // INPUT
    if (keys["ArrowLeft"] || keys["a"]) targetX -= 0.12;
    if (keys["ArrowRight"] || keys["d"]) targetX += 0.12;
    if (keys["ArrowUp"] || keys["w"]) targetY += 0.1;
    if (keys["ArrowDown"] || keys["s"]) targetY -= 0.1;

    if (!keys["ArrowLeft"] && !keys["a"] && !keys["ArrowRight"] && !keys["d"]) targetX *= 0.9;
    if (!keys["ArrowUp"] && !keys["w"] && !keys["ArrowDown"] && !keys["s"]) targetY *= 0.9;

    targetX = THREE.MathUtils.clamp(targetX, -LIMIT_X, LIMIT_X);
    targetY = THREE.MathUtils.clamp(targetY, -LIMIT_Y, LIMIT_Y);

    camX += (targetX - camX) * 0.08;
    camY += (targetY - camY) * 0.08;

    camera.position.x = camX;
    camera.position.y = camY;
    camera.rotation.z = -camX * 0.08;

    hud.rotation.z = camera.rotation.z * 1.4;
    hud.position.y = -1.6 + camY * 0.15;

    // ASTEROIDS + DANGER
    let nearest = Infinity;
    asteroids.forEach((a, i) => {
        a.rotation.x += a.userData.spin.x;
a.rotation.y += a.userData.spin.y;
a.rotation.z += a.userData.spin.z;

        a.position.z += 0.45 + difficulty;
        a.position.x += (camera.position.x - a.position.x) * 0.015;
        a.position.y += (camera.position.y - a.position.y) * 0.015;

        const d = a.position.distanceTo(camera.position);
        nearest = Math.min(nearest, d);

        if (!gameOver && d < 0.9) {
            gameOver = true;
            cancelAnimationFrame(animationId);
            setTimeout(() => {
                alert("💥 IMPACT");
                window.location.reload();
            }, 400);
        }

        if (a.position.z > 6) {
            scene.remove(a);
            asteroids.splice(i, 1);
        }
    });

    edgeGlowMat.uniforms.danger.value = THREE.MathUtils.clamp(1.5 - nearest * 0.3, 0, 1);
    edgeGlowMat.uniforms.time.value = time;

    [starsFar, starsMid, starsNear].forEach(s => {
        const arr = s.geometry.attributes.position.array;
        for (let i = 2; i < arr.length; i += 3) {
            arr[i] += s.userData.speed;
            if (arr[i] > 5) arr[i] = -200;
        }
        s.geometry.attributes.position.needsUpdate = true;
    });

    renderer.render(scene, camera);
}

animate();

// ===============================
// RESIZE
// ===============================
window.addEventListener("resize", () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
});

// ===============================
// WIN SCREEN
// ===============================
function showWinScreen() {
    const overlay = document.createElement("div");
    overlay.style.position = "fixed";
    overlay.style.inset = "0";
    overlay.style.background = "radial-gradient(circle, #001010, #000000)";
    overlay.style.display = "flex";
    overlay.style.alignItems = "center";
    overlay.style.justifyContent = "center";
    overlay.style.color = "#00ffee";
    overlay.style.fontFamily = "monospace";
    overlay.style.fontSize = "48px";
    overlay.style.opacity = "0";
    overlay.style.transition = "opacity 2s ease";
    overlay.innerText = "YOU WIN";

    document.body.appendChild(overlay);
    requestAnimationFrame(() => overlay.style.opacity = "1");

    setTimeout(() => window.location.reload(), 5000);
}
