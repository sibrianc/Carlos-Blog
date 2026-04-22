/* ==========================================================================
   CITY SYSTEM (MODULAR CONTROLLER)
   ========================================================================== */
import { AssetLoader } from './AssetLoader.js';
import { UrbanScene } from './scenes/UrbanScene.js';
import { RuralScene } from './scenes/RuralScene.js';
import { MayaScene } from './scenes/MayaScene.js';

export class CitySystem {
    constructor(pageType, options = {}) {
        this.pageType = pageType;
        this.assetsLoaded = false;
        this.loader = new AssetLoader(options.assetBasePath);
        this.currentScene = null;
        this.images = null; // Inicialmente null
        this.mountainFacets = []; 

        // Inicializamos
        this.init();
    }

    async init() {
        // 1. Cargar Imágenes
        const images = await this.loader.loadAll();
        
        // --- CORRECCIÓN AQUÍ ---
        // Guardamos las imágenes ANTES de intentar usar resize()
        this.images = images; 
        this.assetsLoaded = true;

        // 2. Instanciar Escena según página
        if (this.pageType === 'home' || this.pageType === 'projects') this.currentScene = new UrbanScene();
        else if (this.pageType === 'about') this.currentScene = new RuralScene();
        else if (this.pageType === 'contact') this.currentScene = new MayaScene();

        // 3. Configuración inicial
        // Ahora sí funcionará porque this.images ya tiene datos
        if (this.currentScene) {
            this.resize(window.innerWidth, window.innerHeight);
        }
    }

    resize(w, h) {
        // Geometría de Montañas (Compartida)
        this.generateLandscapeGeometry(w, h);
        
        // Reiniciar Escena
        // Verifica que tengamos escena y que las imágenes ya estén cargadas
        if (this.currentScene && this.images) {
            this.currentScene.init(w, h, this.images);
        }
    }

    render(ctx, w, h, time, scrollPercent, menuLight) {
        this.renderLayer(ctx, w, h, time, scrollPercent, menuLight, 'mountains');
        this.renderLayer(ctx, w, h, time, scrollPercent, menuLight, 'ground');
    }

    renderLayer(ctx, w, h, time, scrollPercent, menuLight, layer) {
        if (layer === 'mountains') {
            this.drawBackgroundMountains(ctx, w, h, scrollPercent);
            return;
        }

        if (layer !== 'ground') {
            return;
        }

        // Solo dibujamos si assetsLoaded es true y la escena existe
        if (this.currentScene && this.assetsLoaded) {
            this.currentScene.draw(ctx, w, h, time, scrollPercent, menuLight);
        } else {
            // Fallback genérico (Suelo oscuro)
            let horizonY = h * 0.82; 
            ctx.fillStyle = '#080101'; 
            ctx.fillRect(0, horizonY - 2, w, h - horizonY + 2);
        }
    }

    // --- LÓGICA COMPARTIDA DE MONTAÑAS ---
    drawBackgroundMountains(ctx, w, h, scrollPercent) {
        let parallaxY = 0; 
        ctx.save(); ctx.translate(0, parallaxY); 
        ctx.shadowBlur = 0; ctx.shadowColor = 'transparent';
        ctx.lineJoin = 'round'; ctx.lineWidth = 1; 
        this.mountainFacets.forEach(facet => {
            ctx.fillStyle = facet.color; ctx.strokeStyle = facet.color; 
            ctx.beginPath(); ctx.moveTo(facet.points[0].x, facet.points[0].y);
            for(let i=1; i<facet.points.length; i++) ctx.lineTo(facet.points[i].x, facet.points[i].y);
            ctx.closePath(); ctx.fill(); ctx.stroke(); 
        });
        ctx.restore();
    }

    generateLandscapeGeometry(w, h) {
        let horizonY = this.pageType === 'about' ? h * 0.70 : h * 0.82;
        this.mountainFacets = [];
        this.mountainFacets.push(...this.generateSharpGeometricVolcano(w*-0.05, horizonY, w*0.1, w*0.13, horizonY-h*0.25, w*0.25, horizonY, w));
        this.mountainFacets.push(...this.generateSharpGeometricVolcano(w*0.15, horizonY, w*0.42, w*0.48, horizonY-h*0.45, w*0.75, horizonY, w));
        this.mountainFacets.push(...this.generateSharpGeometricVolcano(w*0.65, horizonY, w*0.72, w*0.75, horizonY-h*0.2, w*0.85, horizonY, w));
    }

    generateSharpGeometricVolcano(startX, startY, peakStartX, peakEndX, peakY, endX, endY, w) {
        const facets = [];
        let ridges = [{x: startX, y: startY}, {x: startX+(peakStartX-startX)*0.4, y: startY-(startY-peakY)*0.3}, {x: peakStartX, y: peakY}, {x: peakEndX, y: peakY}, {x: endX-(endX-peakEndX)*0.4, y: startY-(startY-peakY)*0.4}, {x: endX, y: endY}];
        const palette = {shadowDeep: '#050508', shadowSoft: '#0a0a10', midTone: '#151520', lightWarm: '#202030', highlight: '#2a2a40'};
        facets.push({points: [{x: startX, y: startY}, ridges[1], {x: ridges[1].x-(w*0.05), y: startY}], color: palette.shadowDeep});
        facets.push({points: [ridges[1], ridges[2], {x: ridges[1].x+(w*0.08), y: startY}], color: palette.shadowSoft});
        facets.push({points: [ridges[1], {x: ridges[1].x+(w*0.08), y: startY}, {x: ridges[1].x-(w*0.05), y: startY}], color: palette.shadowDeep});
        let baseCenter = {x: (startX+endX)/2, y: startY};
        facets.push({points: [ridges[2], ridges[3], baseCenter], color: palette.midTone});
        facets.push({points: [ridges[2], baseCenter, {x: ridges[1].x+(w*0.08), y: startY}], color: palette.shadowSoft});
        facets.push({points: [ridges[3], ridges[4], baseCenter], color: palette.lightWarm});
        facets.push({points: [ridges[4], {x: endX, y: endY}, {x: baseCenter.x+(w*0.1), y: startY}], color: palette.highlight});
        facets.push({points: [ridges[4], {x: baseCenter.x+(w*0.1), y: startY}, baseCenter], color: palette.lightWarm});
        return facets;
    }
}
