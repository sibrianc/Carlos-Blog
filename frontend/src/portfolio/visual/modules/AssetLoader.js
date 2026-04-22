export class AssetLoader {
    constructor(basePath = '/app/portfolio-assets') {
        this.basePath = basePath.replace(/\/$/, '');
        this.assetPaths = {
            pyramids: [
                `${this.basePath}/maya-pyramid.png`,
                `${this.basePath}/maya-pyramid2.png`
            ],
            huts: [
                `${this.basePath}/mayan_house.png`,
                `${this.basePath}/mayan_house2.png`
            ],
            monument: `${this.basePath}/salvador_del_mundo.png`
        };
    }

    async loadAll() {
        const loadedImages = {
            pyramids: [],
            huts: [],
            monument: null
        };

        const promises = [];

        // Cargar Pirámides
        this.assetPaths.pyramids.forEach(src => 
            promises.push(this.loadImage(src)
                .then(img => loadedImages.pyramids.push(img))
                .catch(e => console.warn("Falta:", src)))
        );

        // Cargar Chozas
        this.assetPaths.huts.forEach(src => 
            promises.push(this.loadImage(src)
                .then(img => loadedImages.huts.push(img))
                .catch(e => console.warn("Falta:", src)))
        );

        // Cargar Monumento
        promises.push(this.loadImage(this.assetPaths.monument)
            .then(img => loadedImages.monument = img)
            .catch(e => console.warn("Falta monumento"))
        );

        await Promise.allSettled(promises);
        return loadedImages;
    }

    loadImage(src) {
        return new Promise((resolve, reject) => {
            const img = new Image();
            img.onload = () => resolve(img);
            img.onerror = () => reject(src);
            img.src = src;
        });
    }
}
