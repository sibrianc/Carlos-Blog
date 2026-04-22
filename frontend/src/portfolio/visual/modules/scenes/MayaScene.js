export class MayaScene {
    constructor() {
        this.mayanGlyphs = [];
        this.cachedLayers = { mayanBack: null, mayanFront: null };
    }

    init(w, h, images) {
        this.mayanGlyphs = [];
        const horizonY = h * 0.82; 
        const useImages = images.pyramids.length > 0;
        
        // --- DETECCIÓN MÓVIL ---
        const isMobile = w < 768;

        // A. CAPA DE FONDO
        const backCanvas = document.createElement('canvas');
        backCanvas.width = w;
        backCanvas.height = h;
        const bCtx = backCanvas.getContext('2d');

        const densityDivisor = isMobile ? 20 : 5; 
        const numBack = Math.floor(w / densityDivisor); 

        for(let i=0; i<numBack; i++) {
            let minW = isMobile ? 30 : 15;
            let width = minW + Math.random() * 25; 
            let x = Math.random() * w;
            let height;
            bCtx.save();
            bCtx.globalAlpha = 0.5 + Math.random() * 0.3; 
            if (useImages) {
                let imgRef = images.pyramids[Math.floor(Math.random() * images.pyramids.length)];
                let ratio = imgRef.height / imgRef.width;
                height = width * ratio;
                bCtx.filter = 'brightness(0%)'; 
                bCtx.drawImage(imgRef, x - width/2, horizonY + 5 - height, width, height);
            } else {
                height = width * 1.5;
                bCtx.fillStyle = '#080808';
                bCtx.fillRect(x - width/2, horizonY + 5 - height, width, height);
            }
            bCtx.restore();
        }
        this.cachedLayers.mayanBack = backCanvas;

        // B. CAPA FRONTAL (Ciudades)
        const frontCanvas = document.createElement('canvas');
        frontCanvas.width = w;
        frontCanvas.height = h;
        const fCtx = frontCanvas.getContext('2d');
        const numCities = isMobile ? 1 : 3;
        const pyramidsPerCity = isMobile ? 3 : 6;

        for (let c = 0; c < numCities; c++) {
            let citySegment = w / numCities;
            let cityCenterX = (c * citySegment) + (citySegment / 2);
            let citySpread = citySegment * 0.7; 

            for (let p = 0; p < pyramidsPerCity; p++) {
                let baseSize = isMobile ? 92 : 40;
                let width = baseSize + Math.random() * 10; 
                if (Math.random() > 0.7) width *= 1.15;
                let posY = horizonY + 5; 
                let randomOffset = (Math.random() - 0.5) * citySpread;
                let posX = cityCenterX + randomOffset;
                let height;

                if (useImages) {
                    let imgRef = images.pyramids[Math.floor(Math.random() * images.pyramids.length)];
                    let ratio = imgRef.height / imgRef.width;
                    height = width * ratio;
                    fCtx.drawImage(imgRef, posX - width/2, posY - height, width, height);
                } else {
                     height = width * 1.2;
                     fCtx.fillStyle = '#0a0a0e';
                     fCtx.fillRect(posX - width/2, posY - height, width, height);
                }
            }
        }
        this.cachedLayers.mayanFront = frontCanvas;

        // C. Glifos
        const numGlyphs = isMobile ? 8 : 30;
        for(let i=0; i<numGlyphs; i++) {
            this.mayanGlyphs.push({
                x: Math.random() * w,
                y: h * 0.6 + Math.random() * (h * 0.3),
                size: 1 + Math.random() * 2,
                speedY: 0.1 + Math.random() * 0.3,
                opacity: Math.random() * 0.5,
                blinkSpeed: 0.01 + Math.random() * 0.04
            });
        }
    }

    draw(ctx, w, h, time, scrollPercent, menuLight) {
        let horizonY = h * 0.82;
        const mysticalColor = '#00ffcc'; 

        // 1. Fondo
        ctx.fillStyle = '#040405'; 
        ctx.fillRect(0, horizonY - 5, w, h - horizonY + 5);

        // 2. Capas Cacheadas
        if (this.cachedLayers.mayanBack) ctx.drawImage(this.cachedLayers.mayanBack, 0, 0);
        if (this.cachedLayers.mayanFront) ctx.drawImage(this.cachedLayers.mayanFront, 0, 0);

        // --- 3. EFECTO: NIEBLA CON MOVIMIENTO (CORREGIDO) ---
        ctx.save();
        
        // Altura y Posición
        const fogHeight = h * 0.02; 
        const fogBottomY = horizonY + 25;

        // Función para dibujar una capa de niebla
        const drawMistLayer = (speed, amplitude, offsetY, alpha, waveFrequency) => {
            ctx.beginPath();
            ctx.moveTo(0, fogBottomY); 
            
            // Recorremos el ancho
            for(let x = 0; x <= w; x += 10) {
                
                // MOVIMIENTO DE OLAS (Velocidad ajustada):
                // 'time * speed' mueve la onda horizontalmente.
                let wave1 = Math.sin(x * waveFrequency + time * speed) * amplitude;
                
                // Onda secundaria para textura
                let wave2 = Math.cos(x * (waveFrequency * 2.0) - time * (speed * 1.2)) * (amplitude * 0.4);
                
                let mistY = horizonY - fogHeight + wave1 + wave2 + offsetY + 18;
                
                ctx.lineTo(x, mistY);
            }
            
            ctx.lineTo(w, fogBottomY); 
            ctx.lineTo(0, fogBottomY); 
            ctx.closePath();

            // Gradiente
            let grad = ctx.createLinearGradient(0, horizonY - fogHeight - 20, 0, fogBottomY);
            grad.addColorStop(0, 'rgba(0,0,0,0)'); 
            grad.addColorStop(0.5, mysticalColor); 
            grad.addColorStop(1, 'rgba(0,0,0,0.1)'); 

            ctx.fillStyle = grad;
            ctx.globalCompositeOperation = 'screen'; 
            ctx.globalAlpha = alpha * 0.5; 
            ctx.shadowBlur = 20; 
            ctx.shadowColor = mysticalColor;
            ctx.fill();
        };

        // AUMENTÉ LA VELOCIDAD AQUÍ (Antes era 0.0003, ahora 0.002)
        // Capa 1: Niebla de Fondo (Movimiento suave y continuo)
        drawMistLayer(0.002, 6, -5, 0.5, 0.003);
        
        // Capa 2: Niebla Frontal (Un poco más rápida y detallada)
        drawMistLayer(0.004, 9, 0, 0.3, 0.005);

        ctx.restore();

        // 4. Glifos
        ctx.save();
        ctx.globalCompositeOperation = 'lighter';
        ctx.shadowBlur = 10; ctx.shadowColor = mysticalColor;
        this.mayanGlyphs.forEach(g => {
            g.y -= g.speedY; if(g.y < h * 0.4) g.y = h * 0.9; 
            let blink = 0.5 + Math.sin(time * g.blinkSpeed) * 0.5;
            ctx.globalAlpha = g.opacity * blink;
            ctx.fillStyle = mysticalColor;
            ctx.fillRect(g.x, g.y, g.size, g.size); 
        });
        ctx.restore();
    }
}