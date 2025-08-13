class FPSGame {
    constructor() {
        this.scene = new THREE.Scene();
        this.camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
        this.renderer = new THREE.WebGLRenderer({ antialias: true });
        this.clock = new THREE.Clock();
        
        this.velocity = new THREE.Vector3();
        this.direction = new THREE.Vector3();
        this.raycaster = new THREE.Raycaster();
        this.mouse = new THREE.Vector2();
        
        this.keys = {};
        this.canShoot = true;
        this.bullets = [];
        this.targets = [];
        this.score = 0;
        this.ammo = 30;
        this.maxAmmo = 30;
        
        this.moveSpeed = 10;
        this.bulletSpeed = 50;
        this.mouseSensitivity = 0.002;
        
        this.euler = new THREE.Euler(0, 0, 0, 'YXZ');
        
        this.init();
        this.createEnvironment();
        this.createTargets();
        this.setupEventListeners();
        this.animate();
    }
    
    init() {
        this.renderer.setSize(window.innerWidth, window.innerHeight);
        this.renderer.setClearColor(0x87CEEB);
        this.renderer.shadowMap.enabled = true;
        this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
        
        document.getElementById('gameContainer').appendChild(this.renderer.domElement);
        
        this.scene.fog = new THREE.Fog(0x87CEEB, 50, 200);
        
        const ambientLight = new THREE.AmbientLight(0x404040, 0.4);
        this.scene.add(ambientLight);
        
        const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
        directionalLight.position.set(50, 50, 50);
        directionalLight.castShadow = true;
        directionalLight.shadow.mapSize.width = 2048;
        directionalLight.shadow.mapSize.height = 2048;
        directionalLight.shadow.camera.near = 0.5;
        directionalLight.shadow.camera.far = 500;
        directionalLight.shadow.camera.left = -100;
        directionalLight.shadow.camera.right = 100;
        directionalLight.shadow.camera.top = 100;
        directionalLight.shadow.camera.bottom = -100;
        this.scene.add(directionalLight);
        
        this.camera.position.set(0, 1.6, 5);
    }
    
    createEnvironment() {
        const groundGeometry = new THREE.PlaneGeometry(200, 200);
        const groundMaterial = new THREE.MeshLambertMaterial({ color: 0x228B22 });
        const ground = new THREE.Mesh(groundGeometry, groundMaterial);
        ground.rotation.x = -Math.PI / 2;
        ground.receiveShadow = true;
        this.scene.add(ground);
        
        const wallHeight = 10;
        const wallThickness = 1;
        const arenaSize = 50;
        
        const wallMaterial = new THREE.MeshLambertMaterial({ color: 0x8B4513 });
        
        const walls = [
            { pos: [0, wallHeight/2, -arenaSize/2], size: [arenaSize, wallHeight, wallThickness] },
            { pos: [0, wallHeight/2, arenaSize/2], size: [arenaSize, wallHeight, wallThickness] },
            { pos: [-arenaSize/2, wallHeight/2, 0], size: [wallThickness, wallHeight, arenaSize] },
            { pos: [arenaSize/2, wallHeight/2, 0], size: [wallThickness, wallHeight, arenaSize] }
        ];
        
        walls.forEach(wall => {
            const geometry = new THREE.BoxGeometry(...wall.size);
            const mesh = new THREE.Mesh(geometry, wallMaterial);
            mesh.position.set(...wall.pos);
            mesh.castShadow = true;
            mesh.receiveShadow = true;
            this.scene.add(mesh);
        });
        
        for (let i = 0; i < 10; i++) {
            const boxGeometry = new THREE.BoxGeometry(2, 2, 2);
            const boxMaterial = new THREE.MeshLambertMaterial({ color: Math.random() * 0xffffff });
            const box = new THREE.Mesh(boxGeometry, boxMaterial);
            box.position.set(
                (Math.random() - 0.5) * 40,
                1,
                (Math.random() - 0.5) * 40
            );
            box.castShadow = true;
            box.receiveShadow = true;
            this.scene.add(box);
        }
    }
    
    createTargets() {
        for (let i = 0; i < 8; i++) {
            const targetGeometry = new THREE.SphereGeometry(0.5, 16, 16);
            const targetMaterial = new THREE.MeshLambertMaterial({ color: 0xff0000 });
            const target = new THREE.Mesh(targetGeometry, targetMaterial);
            
            target.position.set(
                (Math.random() - 0.5) * 40,
                Math.random() * 5 + 1,
                (Math.random() - 0.5) * 40
            );
            
            target.castShadow = true;
            target.userData = { isTarget: true, originalY: target.position.y };
            this.targets.push(target);
            this.scene.add(target);
        }
    }
    
    setupEventListeners() {
        document.addEventListener('keydown', (e) => {
            e.preventDefault();
            this.keys[e.code] = true;
            
            // Handle reload immediately
            if (e.code === 'KeyR') {
                this.reload();
            }
        });
        
        document.addEventListener('keyup', (e) => {
            e.preventDefault();
            this.keys[e.code] = false;
        });
        
        document.addEventListener('click', (e) => {
            e.preventDefault();
            if (document.pointerLockElement !== this.renderer.domElement) {
                this.renderer.domElement.requestPointerLock();
            } else {
                this.shoot();
            }
        });
        
        document.addEventListener('mousemove', (e) => {
            if (document.pointerLockElement === this.renderer.domElement) {
                this.euler.setFromQuaternion(this.camera.quaternion);
                this.euler.y -= e.movementX * this.mouseSensitivity;
                this.euler.x -= e.movementY * this.mouseSensitivity;
                this.euler.x = Math.max(-Math.PI / 2, Math.min(Math.PI / 2, this.euler.x));
                this.camera.quaternion.setFromEuler(this.euler);
            }
        });
        
        // Handle pointer lock changes
        document.addEventListener('pointerlockchange', () => {
            if (!document.pointerLockElement) {
                // Reset keys when exiting pointer lock
                this.keys = {};
            }
        });
        
        window.addEventListener('resize', () => {
            this.camera.aspect = window.innerWidth / window.innerHeight;
            this.camera.updateProjectionMatrix();
            this.renderer.setSize(window.innerWidth, window.innerHeight);
        });
    }
    
    shoot() {
        if (!this.canShoot || this.ammo <= 0) return;
        
        this.ammo--;
        this.updateUI();
        
        const bulletGeometry = new THREE.SphereGeometry(0.05, 8, 8);
        const bulletMaterial = new THREE.MeshBasicMaterial({ color: 0xffff00 });
        const bullet = new THREE.Mesh(bulletGeometry, bulletMaterial);
        
        bullet.position.copy(this.camera.position);
        
        const direction = new THREE.Vector3(0, 0, -1);
        direction.applyQuaternion(this.camera.quaternion);
        bullet.userData = { direction: direction.clone(), speed: this.bulletSpeed };
        
        this.bullets.push(bullet);
        this.scene.add(bullet);
        
        this.canShoot = false;
        setTimeout(() => this.canShoot = true, 100);
    }
    
    reload() {
        if (this.ammo < this.maxAmmo) {
            this.ammo = this.maxAmmo;
            this.updateUI();
        }
    }
    
    updateBullets(delta) {
        for (let i = this.bullets.length - 1; i >= 0; i--) {
            const bullet = this.bullets[i];
            const direction = bullet.userData.direction;
            const speed = bullet.userData.speed;
            
            bullet.position.add(direction.clone().multiplyScalar(speed * delta));
            
            if (bullet.position.length() > 100) {
                this.scene.remove(bullet);
                this.bullets.splice(i, 1);
                continue;
            }
            
            this.raycaster.set(bullet.position, direction);
            const intersects = this.raycaster.intersectObjects(this.targets);
            
            if (intersects.length > 0) {
                const hit = intersects[0].object;
                if (hit.userData.isTarget) {
                    this.score += 10;
                    this.updateUI();
                    
                    this.scene.remove(hit);
                    const targetIndex = this.targets.indexOf(hit);
                    if (targetIndex > -1) {
                        this.targets.splice(targetIndex, 1);
                    }
                    
                    setTimeout(() => {
                        const newTarget = this.createNewTarget();
                        this.targets.push(newTarget);
                        this.scene.add(newTarget);
                    }, 2000);
                }
                
                this.scene.remove(bullet);
                this.bullets.splice(i, 1);
            }
        }
    }
    
    createNewTarget() {
        const targetGeometry = new THREE.SphereGeometry(0.5, 16, 16);
        const targetMaterial = new THREE.MeshLambertMaterial({ color: 0xff0000 });
        const target = new THREE.Mesh(targetGeometry, targetMaterial);
        
        target.position.set(
            (Math.random() - 0.5) * 40,
            Math.random() * 5 + 1,
            (Math.random() - 0.5) * 40
        );
        
        target.castShadow = true;
        target.userData = { isTarget: true, originalY: target.position.y };
        
        return target;
    }
    
    updateMovement(delta) {
        // Clamp delta to prevent large jumps
        delta = Math.min(delta, 0.1);
        
        // Apply friction
        this.velocity.x -= this.velocity.x * 10.0 * delta;
        this.velocity.z -= this.velocity.z * 10.0 * delta;
        
        // Get input direction
        this.direction.z = Number(this.keys['KeyW'] || false) - Number(this.keys['KeyS'] || false);
        this.direction.x = Number(this.keys['KeyD'] || false) - Number(this.keys['KeyA'] || false);
        
        // Only normalize if there's input
        if (this.direction.length() > 0) {
            this.direction.normalize();
        }
        
        // Apply movement
        if (this.keys['KeyW'] || this.keys['KeyS']) {
            this.velocity.z -= this.direction.z * this.moveSpeed * delta;
        }
        if (this.keys['KeyA'] || this.keys['KeyD']) {
            this.velocity.x -= this.direction.x * this.moveSpeed * delta;
        }
        
        // Get camera-relative directions
        const forward = new THREE.Vector3(0, 0, -1);
        forward.applyQuaternion(this.camera.quaternion);
        forward.y = 0; // Keep movement horizontal
        forward.normalize();
        
        const right = new THREE.Vector3(1, 0, 0);
        right.applyQuaternion(this.camera.quaternion);
        right.y = 0; // Keep movement horizontal
        right.normalize();
        
        // Apply velocity to position
        const movement = new THREE.Vector3();
        movement.add(forward.multiplyScalar(this.velocity.z));
        movement.add(right.multiplyScalar(this.velocity.x));
        
        this.camera.position.add(movement);
        
        // Keep camera at fixed height
        this.camera.position.y = 1.6;
        
        // Boundary check
        const boundary = 20;
        this.camera.position.x = Math.max(-boundary, Math.min(boundary, this.camera.position.x));
        this.camera.position.z = Math.max(-boundary, Math.min(boundary, this.camera.position.z));
    }
    
    updateTargets(delta) {
        this.targets.forEach((target, index) => {
            target.rotation.y += 2 * delta;
            target.position.y = target.userData.originalY + Math.sin(Date.now() * 0.003 + index) * 0.5;
        });
    }
    
    updateUI() {
        document.getElementById('score').textContent = this.score;
        document.getElementById('ammo').textContent = this.ammo;
    }
    
    animate() {
        requestAnimationFrame(() => this.animate());
        
        const delta = this.clock.getDelta();
        
        this.updateMovement(delta);
        this.updateBullets(delta);
        this.updateTargets(delta);
        
        this.renderer.render(this.scene, this.camera);
    }
}

window.addEventListener('load', () => {
    try {
        new FPSGame();
    } catch (error) {
        console.error('Failed to initialize game:', error);
        document.body.innerHTML = '<div style="color: white; text-align: center; margin-top: 50px; font-family: Arial;"><h1>Game Failed to Load</h1><p>Please refresh the page and try again.</p><p>Error: ' + error.message + '</p></div>';
    }
});