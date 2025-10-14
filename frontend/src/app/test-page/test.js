class LightBeamApp {
    constructor() {
        this.beamCount = 5;
        this.speed = 1;
        this.sphereOpacity = 0.2;
        this.beamColor = '#00ffff';
        this.autoRotate = true;
        this.scene = null;
        this.camera = null;
        this.renderer = null;
        this.sphere = null;
        this.wireframe = null;
        this.beams = [];
        
        this.init();
    }
    
    init() {
        this.initThree();
        this.createSphere();
        this.createBeams();
        this.setupControls();
        this.animate();
    }
    
    initThree() {
        const container = document.getElementById('canvas-container');
        
        // 创建场景
        this.scene = new THREE.Scene();
        this.scene.fog = new THREE.FogExp2(0x000000, 0.02);
        
        // 创建相机
        this.camera = new THREE.PerspectiveCamera(
            75,
            window.innerWidth / window.innerHeight,
            0.1,
            1000
        );
        this.camera.position.z = 15;
        
        // 创建渲染器
        this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
        this.renderer.setSize(window.innerWidth, window.innerHeight);
        this.renderer.setClearColor(0x000000, 0);
        container.appendChild(this.renderer.domElement);
        
        // 添加环境光
        const ambientLight = new THREE.AmbientLight(0x404040, 0.5);
        this.scene.add(ambientLight);
        
        // 窗口大小调整
        window.addEventListener('resize', () => {
            this.camera.aspect = window.innerWidth / window.innerHeight;
            this.camera.updateProjectionMatrix();
            this.renderer.setSize(window.innerWidth, window.innerHeight);
        });
    }
    
    createSphere() {
        const geometry = new THREE.SphereGeometry(5, 64, 64);
        const material = new THREE.MeshPhongMaterial({
            color: 0x1a237e,
            transparent: true,
            opacity: this.sphereOpacity,
            wireframe: false,
            side: THREE.DoubleSide,
            shininess: 100
        });
        
        this.sphere = new THREE.Mesh(geometry, material);
        this.scene.add(this.sphere);
        
        // 添加球体线框
        const wireframeGeometry = new THREE.SphereGeometry(5, 32, 32);
        const wireframeMaterial = new THREE.MeshBasicMaterial({
            color: 0x4fc3f7,
            wireframe: true,
            transparent: true,
            opacity: 0.3
        });
        this.wireframe = new THREE.Mesh(wireframeGeometry, wireframeMaterial);
        this.scene.add(this.wireframe);
    }
    
    createBeams() {
        // 清除现有光束
        this.beams.forEach(beam => {
            this.scene.remove(beam.mesh);
            this.scene.remove(beam.light);
        });
        this.beams = [];
        
        for (let i = 0; i < this.beamCount; i++) {
            this.createSingleBeam();
        }
    }
    
    createSingleBeam() {
        const color = new THREE.Color(this.beamColor);
        
        // 创建光束几何体
        const geometry = new THREE.CylinderGeometry(0.05, 0.05, 2, 8);
        const material = new THREE.MeshBasicMaterial({
            color: color,
            transparent: true,
            opacity: 0.8
        });
        
        const beam = new THREE.Mesh(geometry, material);
        
        // 随机初始位置和方向
        const theta = Math.random() * Math.PI * 2;
        const phi = Math.random() * Math.PI;
        const radius = Math.random() * 3;
        
        beam.position.set(
            radius * Math.sin(phi) * Math.cos(theta),
            radius * Math.sin(phi) * Math.sin(theta),
            radius * Math.cos(phi)
        );
        
        // 添加点光源
        const light = new THREE.PointLight(color, 2, 10);
        light.position.copy(beam.position);
        
        this.scene.add(beam);
        this.scene.add(light);
        
        this.beams.push({
            mesh: beam,
            light: light,
            velocity: new THREE.Vector3(
                (Math.random() - 0.5) * 0.1,
                (Math.random() - 0.5) * 0.1,
                (Math.random() - 0.5) * 0.1
            )
        });
    }
    
    updateBeamColor() {
        const color = new THREE.Color(this.beamColor);
        this.beams.forEach(beam => {
            beam.mesh.material.color = color;
            beam.light.color = color;
        });
    }
    
    randomizeBeams() {
        this.beams.forEach(beam => {
            const theta = Math.random() * Math.PI * 2;
            const phi = Math.random() * Math.PI;
            const radius = Math.random() * 3;
            
            beam.mesh.position.set(
                radius * Math.sin(phi) * Math.cos(theta),
                radius * Math.sin(phi) * Math.sin(theta),
                radius * Math.cos(phi)
            );
            
            beam.velocity.set(
                (Math.random() - 0.5) * 0.1,
                (Math.random() - 0.5) * 0.1,
                (Math.random() - 0.5) * 0.1
            );
        });
    }
    
    setupControls() {
        const beamCountSlider = document.getElementById('beamCount');
        const speedSlider = document.getElementById('speed');
        const opacitySlider = document.getElementById('sphereOpacity');
        const colorPicker = document.getElementById('beamColor');
        const randomBtn = document.getElementById('randomBtn');
        const rotateBtn = document.getElementById('rotateBtn');
        
        beamCountSlider.addEventListener('input', (e) => {
            this.beamCount = parseInt(e.target.value);
            document.getElementById('beamCountDisplay').textContent = this.beamCount;
            this.createBeams();
        });
        
        speedSlider.addEventListener('input', (e) => {
            this.speed = parseFloat(e.target.value);
            document.getElementById('speedDisplay').textContent = this.speed.toFixed(2);
        });
        
        opacitySlider.addEventListener('input', (e) => {
            this.sphereOpacity = parseFloat(e.target.value);
            document.getElementById('opacityDisplay').textContent = this.sphereOpacity.toFixed(2);
            if (this.sphere) {
                this.sphere.material.opacity = this.sphereOpacity;
            }
        });
        
        colorPicker.addEventListener('input', (e) => {
            this.beamColor = e.target.value;
            this.updateBeamColor();
        });
        
        randomBtn.addEventListener('click', () => {
            this.randomizeBeams();
        });
        
        rotateBtn.addEventListener('click', () => {
            this.autoRotate = !this.autoRotate;
            rotateBtn.textContent = this.autoRotate ? '⏸ 停止旋转' : '▶ 自动旋转';
        });
    }
    
    animate() {
        requestAnimationFrame(() => this.animate());
        
        // 更新光束位置
        this.beams.forEach(beam => {
            // 应用速度
            beam.mesh.position.add(
                beam.velocity.clone().multiplyScalar(this.speed)
            );
            
            // 检查碰撞并反弹
            const distance = beam.mesh.position.length();
            if (distance > 4.8) {
                const normal = beam.mesh.position.clone().normalize();
                beam.velocity.reflect(normal);
                beam.mesh.position.normalize().multiplyScalar(4.8);
            }
            
            // 更新光束方向
            const direction = beam.velocity.clone().normalize();
            beam.mesh.quaternion.setFromUnitVectors(
                new THREE.Vector3(0, 1, 0),
                direction
            );
            
            // 更新光源位置
            beam.light.position.copy(beam.mesh.position);
        });
        
        // 自动旋转相机
        if (this.autoRotate) {
            const time = Date.now() * 0.0005;
            this.camera.position.x = Math.cos(time) * 15;
            this.camera.position.z = Math.sin(time) * 15;
            this.camera.lookAt(this.scene.position);
        }
        
        // 旋转球体
        if (this.sphere) {
            this.sphere.rotation.y += 0.001;
        }
        
        this.renderer.render(this.scene, this.camera);
    }
}

// 等待页面加载完成后初始化
window.addEventListener('load', () => {
    new LightBeamApp();
});