import { lerpColor } from './Utils.js';

export class SkySystem {
    constructor(options = {}) {
        this.signal = options.signal;
        this.stars = [];
        this.clouds = [];
        this.sunParticles = [];
        
        // --- SISTEMA DE ALINEACIÓN (Magic Mode) ---
        this.magicMode = false;
        this.auroraAlpha = 0; // Opacidad de la aurora
        
        // Definición de la Constelación "LAU"
        // AJUSTE: Coordenadas Y reducidas para subirlo más en el cielo
        this.lauTargets = [
            // L (Izquierda)
            {x: 0.35, y: 0.12}, {x: 0.35, y: 0.17}, {x: 0.35, y: 0.22}, {x: 0.38, y: 0.22}, {x: 0.41, y: 0.22},
            // A (Centro)
            {x: 0.46, y: 0.22}, {x: 0.48, y: 0.17}, {x: 0.50, y: 0.12}, {x: 0.52, y: 0.17}, {x: 0.54, y: 0.22},
            {x: 0.48, y: 0.19}, {x: 0.52, y: 0.19}, // Barra de la A
            // U (Derecha)
            {x: 0.59, y: 0.12}, {x: 0.59, y: 0.19}, {x: 0.61, y: 0.22}, {x: 0.63, y: 0.22}, {x: 0.65, y: 0.19}, {x: 0.65, y: 0.12}
        ];

        this.inputBuffer = []; 
        this.init();
    }

    init() {
        // 1. ESTRELLAS
        for(let i=0; i<120; i++) {
            this.stars.push({
                x: Math.random(), 
                y: Math.random() * 0.8, 
                orgX: Math.random(),
                orgY: Math.random() * 0.8,
                targetX: null,
                targetY: null,
                
                size: Math.random() * 1.5 + 0.5, 
                baseAlpha: Math.random() * 0.8 + 0.2, 
                blinkSpeed: 0.01 + Math.random() * 0.03, 
                blinkOffset: Math.random() * Math.PI * 2,
                moveSpeed: 0.02 + Math.random() * 0.03
            });
        }

        // 2. NUBES
        const numClouds = 8;
        const stepX = window.innerWidth / numClouds;
        for(let i=0; i<numClouds; i++) {
            let puffs = [];
            let numPuffs = 6 + Math.random() * 5; 
            for(let j=0; j<numPuffs; j++) {
                puffs.push({
                    xOff: (Math.random() - 0.5) * 120, yOff: (Math.random() - 0.5) * 40, radius: 25 + Math.random() * 30    
                });
            }
            let posX = (i * stepX) + (Math.random() * stepX * 0.8);
            let posY = window.innerHeight * (0.10 + Math.random() * 0.45);
            this.clouds.push({
                x: posX, y: posY, speed: 0.15 + Math.random() * 0.2, scale: 0.6 + Math.random() * 0.6, puffs: puffs 
            });
        }

        // 3. EVENTOS
        // PC: Escribir "lau"
        window.addEventListener('keydown', (e) => this.checkCode(e.key), { signal: this.signal });
        
        // MÓVIL: Tocar 3 veces rápido (Esquina Superior Izquierda)
        let tapCount = 0;
        window.addEventListener('touchstart', (e) => {
            // Zona de activación: Primeros 200px
            if (e.touches[0].clientY < 200 && e.touches[0].clientX < 200) {
                tapCount++;
                if(tapCount === 3) { 
                    this.activateMagic(); 
                    tapCount = 0; 
                }
                setTimeout(() => tapCount = 0, 800);
            }
        }, {passive: true, signal: this.signal});
    }

    checkCode(key) {
        if (this.magicMode) return;
        this.inputBuffer.push(key.toLowerCase());
        if (this.inputBuffer.length > 3) this.inputBuffer.shift();
        if (this.inputBuffer.join('') === 'lau') this.activateMagic();
    }

    activateMagic() {
        if (this.magicMode) return;
        this.magicMode = true;
        console.log("✨ Universe Aligning ✨");

        // --- LÓGICA RESPONSIVA ---
        // Si la pantalla es estrecha (móvil), separamos más las estrellas horizontalmente
        const isMobile = window.innerWidth < 768;
        const spreadX = isMobile ? 2.2 : 1.0; 
        const centerX = 0.5; // Centro de la constelación

        // Asignar estrellas a los objetivos
        for (let i = 0; i < this.lauTargets.length; i++) {
            if (this.stars[i]) {
                let tx = this.lauTargets[i].x;
                let ty = this.lauTargets[i].y;

                // Expandir horizontalmente si es móvil para que no se vea apretado
                tx = centerX + (tx - centerX) * spreadX;

                // Asignar destino con un poco de "ruido" natural
                this.stars[i].targetX = tx + (Math.random() - 0.5) * 0.015;
                this.stars[i].targetY = ty + (Math.random() - 0.5) * 0.015;
                
                // Hacerlas brillar
                this.stars[i].size = 2.5 + Math.random(); 
                this.stars[i].baseAlpha = 1.0;
            }
        }
    }

    render(ctx, w, h, time, scrollPercent) {
        this.drawBackground(ctx, w, h, time, scrollPercent);
        
        if (this.magicMode) {
            if (this.auroraAlpha < 1) this.auroraAlpha += 0.005;
            this.drawAurora(ctx, w, h, time);
        }

        this.drawSun(ctx, w, h, scrollPercent);
        this.drawClouds(ctx, w, scrollPercent);
    }

    drawBackground(ctx, w, h, time, scrollPercent) {
        let grad = ctx.createLinearGradient(0, 0, 0, h);
        const night = ['#020005', '#1a0505', '#4a0d0d', '#cc4400']; 
        const day = ['#004e92', '#603f83', '#fd5e53', '#ffe066'];

        const c0 = lerpColor(night[0], day[0], scrollPercent);
        const c1 = lerpColor(night[1], day[1], scrollPercent);
        const c2 = lerpColor(night[2], day[2], scrollPercent);
        const c3 = lerpColor(night[3], day[3], scrollPercent);

        grad.addColorStop(0, c0);
        grad.addColorStop(0.5, c1);
        grad.addColorStop(0.75, c2);
        grad.addColorStop(1, c3);
        
        ctx.fillStyle = grad;
        ctx.fillRect(0, 0, w, h);

        const dayFade = Math.max(0, 1 - scrollPercent * 1.5); 
        
        if (dayFade > 0.01) {
            ctx.fillStyle = '#ffffff';
            
            // CONEXIONES DE LA CONSTELACIÓN
            if (this.magicMode) {
                ctx.strokeStyle = 'rgba(255, 255, 255, 0.15)';
                ctx.lineWidth = 1;
                ctx.beginPath();
                this.connectStars(ctx, w, h, 0, 4);   // L
                this.connectStars(ctx, w, h, 5, 11);  // A
                this.connectStars(ctx, w, h, 12, 17); // U
                ctx.stroke();
            }

            this.stars.forEach(s => {
                // MOVIMIENTO HACIA EL DESTINO
                if (this.magicMode && s.targetX !== null) {
                    s.x += (s.targetX - s.x) * 0.03; 
                    s.y += (s.targetY - s.y) * 0.03;
                } 
                
                const flicker = (Math.sin(time * s.blinkSpeed + s.blinkOffset) + 1) / 2;
                const alpha = s.targetX ? 0.8 + flicker * 0.2 : s.baseAlpha * flicker;
                
                ctx.globalAlpha = alpha * dayFade; 
                ctx.beginPath();
                ctx.arc(s.x * w, s.y * h, s.size, 0, Math.PI*2);
                ctx.fill();
            });
            ctx.globalAlpha = 1;
        }
    }

    connectStars(ctx, w, h, startIndex, endIndex) {
        if (this.auroraAlpha < 0.5) return;
        ctx.moveTo(this.stars[startIndex].x * w, this.stars[startIndex].y * h);
        for(let i = startIndex + 1; i <= endIndex; i++) {
            ctx.lineTo(this.stars[i].x * w, this.stars[i].y * h);
        }
    }

    drawAurora(ctx, w, h, time) {
        ctx.save();
        ctx.globalCompositeOperation = 'screen'; 
        ctx.globalAlpha = this.auroraAlpha * 0.4; 

        // AJUSTE: Amplitud reducida (de 100/150 a 60/80) para que no sean tan altas
        this.drawWave(ctx, w, h, time * 0.01, '#00ffcc', 60, 200);
        this.drawWave(ctx, w, h, time * 0.015 + 2, '#ff00ff', 80, 250);
        
        ctx.restore();
    }

    drawWave(ctx, w, h, offset, color, amp, period) {
        ctx.fillStyle = color;
        ctx.beginPath();
        ctx.moveTo(0, h);
        for (let x = 0; x <= w; x += 20) {
            let y = h * 0.4 + 
                    Math.sin(x / period + offset) * amp + 
                    Math.sin(x / (period * 0.5) - offset) * (amp * 0.5);
            ctx.lineTo(x, y);
        }
        ctx.lineTo(w, h);
        ctx.closePath();
        
        let grad = ctx.createLinearGradient(0, 0, 0, h);
        grad.addColorStop(0, color);
        grad.addColorStop(1, 'transparent');
        ctx.fillStyle = grad;
        ctx.fill();
    }

    drawSun(ctx, w, h, scrollPercent) {
        let sunX = w * 0.9;
        let sunYBase = h * 0.85;
        let sunYTarget = h * 0.25; 
        let sunY = sunYBase - (scrollPercent * (sunYBase - sunYTarget));
        let sunSize = h * 0.28;
        let sunGrad = ctx.createLinearGradient(sunX, sunY-sunSize, sunX, sunY+sunSize);
        sunGrad.addColorStop(0, '#ffcc00');
        sunGrad.addColorStop(0.6, '#ff4400');
        sunGrad.addColorStop(1, '#ff0055');
        ctx.save();
        ctx.fillStyle = sunGrad;
        ctx.beginPath(); ctx.arc(sunX, sunY, sunSize, 0, Math.PI*2); ctx.fill();
        ctx.restore();
        if(Math.random() > 0.8) {
            this.sunParticles.push({
                x: sunX + (Math.random()-0.5)*sunSize, 
                y: sunY + (Math.random()-0.5)*sunSize*0.5, 
                vx: 0, vy: -0.5 - Math.random(), life: 1, color: '#ffcc00'
            });
        }
        this.sunParticles.forEach((p, i) => {
            p.y += p.vy; p.life -= 0.01;
            if(p.life <= 0) this.sunParticles.splice(i, 1);
            ctx.globalAlpha = p.life; ctx.fillStyle = p.color; ctx.fillRect(p.x, p.y, 2, 2);
        });
        ctx.globalAlpha = 1;
    }

    drawClouds(ctx, w, scrollPercent) {
        let cloudAlpha = (scrollPercent - 0.15) * 1.5; 
        cloudAlpha = Math.max(0, Math.min(0.85, cloudAlpha)); 
        if (cloudAlpha <= 0) return;
        this.clouds.forEach(c => {
            c.x += c.speed;
            if (c.x > w + 200) { c.x = -200; c.y = window.innerHeight * (0.10 + Math.random() * 0.45); }
            c.puffs.forEach(puff => {
                const px = c.x + puff.xOff * c.scale;
                const py = c.y + puff.yOff * c.scale;
                const radius = puff.radius * c.scale;
                const grad = ctx.createRadialGradient(px, py, 0, px, py, radius);
                grad.addColorStop(0, `rgba(255, 255, 255, ${cloudAlpha})`); 
                grad.addColorStop(0.4, `rgba(255, 255, 255, ${cloudAlpha * 0.8})`);
                grad.addColorStop(1, `rgba(255, 255, 255, 0)`); 
                ctx.fillStyle = grad;
                ctx.beginPath(); ctx.arc(px, py, radius, 0, Math.PI * 2); ctx.fill();
            });
        });
        ctx.globalAlpha = 1;
    }
}
