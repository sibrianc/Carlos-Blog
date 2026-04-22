import { lerpColor } from '../Utils.js';

export class RuralScene {
    constructor() {
        this.villageLights = [];
        this.distantVillage = [];
        this.hillSilhouette = [];
        this.foregroundHouses = [];
        this.maquilishuatPetals = [];
    }

    init(w, h, images) {
        this.images = images;
        this.villageLights = [];
        this.distantVillage = [];
        this.hillSilhouette = [];
        this.foregroundHouses = [];
        this.maquilishuatPetals = [];

        const useImages = images.huts.length > 0;

        let step = 4; let baseY = h * 0.55; 
        for (let x = 0; x <= w + step; x += step) {
            let y = baseY - Math.sin(x * 0.003) * 40 - Math.sin(x * 0.01) * 15 + (Math.random() * 5);
            if (x % 20 === 0) this.hillSilhouette.push({ x, y });
            
            if (Math.sin(x * 0.005) > -0.4) { 
                let housesInCluster = Math.floor(Math.random() * 3) + 1; 
                for(let k=0; k<housesInCluster; k++) {
                    let houseX = x + (Math.random() - 0.5) * 20;
                    let houseY = y + (Math.random() * 30) + (k * 5); 
                    let width = 8 + Math.random() * 6;
                    let height = width * 0.8;
                    let imgRef = null;
                    let type = 'rect';

                    if (useImages) {
                        imgRef = images.huts[Math.floor(Math.random() * images.huts.length)];
                        let ratio = imgRef.height / imgRef.width;
                        height = width * ratio;
                        type = 'image';
                    }

                    this.distantVillage.push({
                        x: houseX, y: houseY, w: width, h: height, img: imgRef,
                        type: type, blockColor: Math.random() > 0.5 ? '#1a1a1f' : '#15151a'
                    });

                    if (Math.random() > 0.5) this.villageLights.push({x: houseX, y: houseY + height*0.5, size: 0.8 + Math.random() * 1.2, color: Math.random() > 0.7 ? '#ffcc66' : '#ffaa44', blinkSpeed: 0.005 + Math.random() * 0.02, phase: Math.random() * Math.PI * 2});
                }
            }
        }
        
        const frontY = h * 0.9; const numFrontHouses = Math.floor(w / 30); 
        for(let i=0; i<numFrontHouses; i++) {
            let hy = frontY + Math.random() * 30;
            let width = 20 + Math.random() * 15;
            let height = width * 0.8;
            let imgRef = null;
            let type = 'rect';
            let fallbackColor = Math.random() > 0.5 ? '#1a1a20' : '#22222a'; 

            if (useImages) {
                imgRef = images.huts[Math.floor(Math.random() * images.huts.length)];
                let ratio = imgRef.height / imgRef.width;
                height = width * ratio;
                type = 'image';
            }

            this.foregroundHouses.push({
                x: Math.random() * w, y: hy, w: width, h: height, img: imgRef,
                type: type, color: fallbackColor
            });
        }
        this.foregroundHouses.sort((a, b) => a.y - b.y);

        const numPetals = 40; for(let i=0; i<numPetals; i++) this.maquilishuatPetals.push({x: Math.random() * w, y: Math.random() * h, speedX: (Math.random() - 0.5) * 1.5, speedY: 0.5 + Math.random() * 1.5, size: 2 + Math.random() * 3, rotation: Math.random() * Math.PI, rotationSpeed: (Math.random() - 0.5) * 0.1, color: Math.random() > 0.5 ? '#ffb7c5' : '#ffc0cb'});
    }

    draw(ctx, w, h, time, scrollPercent) {
        const waterLineY = h * 0.65; 
        let dayFactor = Math.max(0, Math.min(1, (scrollPercent - 0.1) * 3)); 
        let nightFactor = 1 - dayFactor;

        // 1. SILUETA
        ctx.fillStyle = lerpColor('#030508', '#0e1218', dayFactor); 
        ctx.beginPath(); ctx.moveTo(0, h); 
        this.hillSilhouette.forEach((p, i) => { if(i===0) ctx.lineTo(0, p.y); ctx.lineTo(p.x, p.y); }); 
        ctx.lineTo(w, h); ctx.fill();
        
        // 2. CASAS FONDO
        if (dayFactor > 0.01) { 
            ctx.globalAlpha = dayFactor * 0.8; 
            this.distantVillage.forEach(house => { 
                if (house.y > -10 && house.y < waterLineY && house.y < h) {
                    if (house.type === 'image' && house.img) {
                        ctx.drawImage(house.img, house.x, house.y, house.w, house.h);
                    } else {
                        ctx.fillStyle = house.blockColor; ctx.fillRect(house.x, house.y, house.w, house.h); 
                    }
                }
            }); 
            ctx.globalAlpha = 1.0; 
        }

        // 3. LUCES FONDO
        if (nightFactor > 0.01) { 
            ctx.save(); ctx.globalCompositeOperation = 'lighter'; 
            this.villageLights.forEach(light => { 
                let ly = light.y; 
                if (ly > -10 && ly < waterLineY && ly < h) { 
                    let blink = 0.7 + Math.sin(time * light.blinkSpeed + light.phase) * 0.3; 
                    ctx.globalAlpha = blink * nightFactor; 
                    ctx.fillStyle = light.color; 
                    ctx.beginPath(); ctx.arc(light.x, ly, light.size, 0, Math.PI * 2); ctx.fill(); 
                }
            }); 
            ctx.restore(); 
        }
        
        // 4. LAGO
        const lakeHeight = h - waterLineY; 
        if (lakeHeight > 0) { 
            const lakeGradient = ctx.createLinearGradient(0, waterLineY, 0, h); 
            lakeGradient.addColorStop(0, lerpColor('#050a14', '#0a1020', dayFactor)); 
            lakeGradient.addColorStop(0.5, lerpColor('#0f1928', '#152035', dayFactor)); 
            lakeGradient.addColorStop(1, 'rgba(10, 15, 30, 1)'); 
            ctx.fillStyle = lakeGradient; ctx.fillRect(0, waterLineY, w, lakeHeight); 
        }

        if (lakeHeight > 10 && nightFactor > 0.01) { 
            ctx.save(); ctx.beginPath(); ctx.rect(0, waterLineY, w, lakeHeight); ctx.clip(); 
            ctx.translate(0, waterLineY * 2); ctx.scale(1, -1.2); 
            ctx.globalAlpha = 0.3 * nightFactor; ctx.globalCompositeOperation = 'lighter'; 
            for (let i = 0; i < this.villageLights.length; i += 3) { 
                let light = this.villageLights[i]; 
                let relativeY = waterLineY - light.y; 
                if (relativeY > 0 && relativeY < h * 0.35) { 
                    ctx.fillStyle = light.color; ctx.beginPath(); ctx.ellipse(light.x, waterLineY + relativeY, light.size * 2, light.size * 6, 0, 0, Math.PI*2); ctx.fill(); 
                }
            } 
            ctx.restore(); 
        }
        
        // 5. SUELO
        const groundY = h * 0.85; 
        ctx.fillStyle = '#010101'; 
        ctx.beginPath(); ctx.moveTo(0, h); ctx.lineTo(0, groundY); 
        for(let x=0; x<=w; x+=100) { ctx.lineTo(x, groundY + Math.sin(x*0.02)*10 + 5); } 
        ctx.lineTo(w, groundY + Math.sin(w*0.02)*10 + 5); 
        ctx.lineTo(w, h); ctx.fill();
        
        // 6. CASAS FRENTE
        this.foregroundHouses.forEach((house, index) => { 
            if (house.y > groundY - 20) { 
                if (dayFactor > 0.01) {
                    ctx.save(); ctx.globalAlpha = dayFactor; 
                    if (house.type === 'image' && house.img) {
                        ctx.shadowColor = 'rgba(0,0,0,0.5)'; ctx.shadowBlur = 10;
                        ctx.drawImage(house.img, house.x, house.y - house.h, house.w, house.h);
                    } else { ctx.fillStyle = house.color; ctx.fillRect(house.x, house.y, house.w, house.h); }
                    ctx.restore();
                }
                if (nightFactor > 0.01) {
                    ctx.save(); ctx.globalCompositeOperation = 'lighter'; 
                    let intensity = 1.0; 
                    ctx.globalAlpha = intensity * nightFactor; 
                    ctx.fillStyle = '#ffcc66'; ctx.shadowBlur = 15 * nightFactor; ctx.shadowColor = '#ffaa00';
                    let lightX = house.x + house.w / 2; let lightY = house.y - house.h / 3; let lightSize = 3; 
                    ctx.beginPath(); ctx.arc(lightX, lightY, lightSize, 0, Math.PI * 2); ctx.fill(); 
                    ctx.restore();
                }
            } 
        });

        // 7. PÉTALOS
        if (dayFactor > 0.1) { 
            ctx.save(); ctx.globalAlpha = dayFactor * 0.9; 
            this.maquilishuatPetals.forEach(petal => { 
                petal.y += petal.speedY; 
                petal.x += Math.sin(time * 0.01 + petal.y * 0.01) * 0.5 + petal.speedX * 0.1; 
                petal.rotation += petal.rotationSpeed; 
                if (petal.y > h) { petal.y = -10; petal.x = Math.random() * w; } 
                if (petal.x > w) petal.x = 0; if (petal.x < 0) petal.x = w; 
                ctx.translate(petal.x, petal.y); ctx.rotate(petal.rotation); 
                ctx.fillStyle = petal.color; 
                ctx.beginPath(); ctx.ellipse(0, 0, petal.size, petal.size * 0.6, 0, 0, Math.PI * 2); ctx.fill(); 
                ctx.rotate(-petal.rotation); ctx.translate(-petal.x, -petal.y); 
            }); 
            ctx.restore(); 
        }
    }
}