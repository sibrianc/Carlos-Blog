import { lerpColor } from '../Utils.js';

export class UrbanScene {
    constructor() {
        this.buildingsBack = [];
        this.buildingsMid = [];
        this.buildings = [];
    }

    init(w, h, images) {
        this.images = images; // Guardamos referencia a las imágenes
        const isMobile = w < 768;
        const countBack = isMobile ? 12 : 40; 
        const countMid = isMobile ? 8 : 25; 
        const countFront = isMobile ? 5 : 12;

        this.buildingsBack = []; 
        for(let i=0; i<countBack; i++) this.buildingsBack.push({xRel: Math.random(), width: 4+Math.random()*6, height: 8+Math.random()*20});
        
        this.buildingsMid = []; 
        for(let i=0; i<countMid; i++) this.buildingsMid.push({xRel: Math.random(), width: 5+Math.random()*10, height: 15+Math.random()*30});
        
        this.buildings = []; 
        for(let i=0; i<countFront; i++) { 
            let posX = Math.random()*0.6; if(Math.random()>0.5) posX+=0.4; if(posX>0.82 && posX<0.98) posX-=0.15;
            let b = {xRel: posX, yBase: Math.random()*0.05, width: 15+Math.random()*20, height: 30+Math.random()*60, floors: [], antenna: Math.random()>0.7};
            let numFloors = Math.floor(b.height/7); for(let f=0; f<numFloors; f++) b.floors.push({yOffset: f*7+5, lights: Math.random()>0.3, blinkSpeed: 0.02+Math.random()*0.05, phase: Math.random()*Math.PI});
            this.buildings.push(b);
        }
    }

    draw(ctx, w, h, time, scrollPercent, menuLight) {
        let horizonY = h * 0.82;
        const nightFactor = Math.max(0, 1 - (scrollPercent * 2.5));

        // 1. EDIFICIOS TRASEROS
        ctx.fillStyle = lerpColor('#050505', '#151515', scrollPercent); 
        this.buildingsBack.forEach(b => { ctx.fillRect(b.xRel*w-b.width/2, horizonY-2-b.height, b.width, b.height); });
        
        ctx.fillStyle = lerpColor('#0a0a0a', '#202025', scrollPercent); 
        this.buildingsMid.forEach(b => { ctx.fillRect(b.xRel*w-b.width/2, horizonY-b.height, b.width, b.height); });
        
        ctx.fillStyle = '#080101'; ctx.fillRect(0, horizonY-2, w, h-horizonY+2); 
        
        // 2. SUELO
        if (nightFactor > 0.01) {
            ctx.save();
            ctx.globalAlpha = nightFactor; 
            ctx.shadowBlur = 10 * nightFactor; 
            ctx.shadowColor = menuLight; 
            ctx.fillStyle = lerpColor('#111', '#333', scrollPercent); 
            ctx.fillRect(0, horizonY, w, 4); 
            ctx.restore();
        } else {
            ctx.fillStyle = lerpColor('#111', '#333', scrollPercent); 
            ctx.fillRect(0, horizonY, w, 4);
        }
        
        const buildingFill = lerpColor('#1a0404', '#2b2b35', scrollPercent);
        this.buildings.forEach(b => {
            let x = b.xRel*w; let y = horizonY+5; 
            
            ctx.shadowBlur = 10 * nightFactor; 
            ctx.shadowColor = menuLight; 

            ctx.fillStyle = buildingFill; 
            ctx.fillRect(x-b.width/2, y-b.height, b.width, b.height);
            
            ctx.shadowBlur = 0; 
            if(b.antenna){ctx.fillStyle='#151515';ctx.fillRect(x-1, y-b.height-10, 2, 10);}
            
            if(nightFactor > 0.01){ 
                ctx.save(); 
                let startX = x - b.width/2 + 4;
                let endX = x + b.width/2 - 4;
                b.floors.forEach(floor => { 
                    for (let wx = startX; wx < endX; wx += 8) { 
                        let randomSeed = Math.sin((wx * 12.9898) + (floor.yOffset * 78.233)) * 43758.5453;
                        let cycle = Math.sin(time * 0.0015 + randomSeed);
                        let val = (cycle + 1) / 2;
                        let color, alpha, blur;
                        if (val > 0.7) { color = '#ffaa00'; alpha = 0.95; blur = 8; } else { color = '#222'; alpha = 0.5; blur = 0; }
                        ctx.shadowBlur = blur * nightFactor;
                        ctx.shadowColor = color;
                        ctx.globalAlpha = alpha * nightFactor; 
                        ctx.fillStyle = color; 
                        ctx.fillRect(wx, y - floor.yOffset - 1, 3, 5); 
                    } 
                }); 
                ctx.restore(); 
                ctx.globalAlpha = 1; 
            }
        });

        // 4. MONUMENTO
        if(this.images && this.images.monument){ 
            let mx=w*0.9; let my=horizonY; 
            let targetHeight=h*0.10; 
            let targetWidth=targetHeight*(this.images.monument.width/this.images.monument.height); 
            ctx.save(); 
            ctx.filter=`brightness(${Math.max(0, 1-nightFactor)})`; 
            if (nightFactor > 0.01) { ctx.shadowBlur = 10 * nightFactor; ctx.shadowColor = menuLight; }
            ctx.drawImage(this.images.monument, mx-targetWidth/2, my-targetHeight, targetWidth, targetHeight); 
            ctx.restore(); 
        }
    }
}