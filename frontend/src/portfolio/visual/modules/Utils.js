// static/js/modules/Utils.js

export function lerpColor(hex1, hex2, factor) {
    const r1 = parseInt(hex1.substring(1,3), 16);
    const g1 = parseInt(hex1.substring(3,5), 16);
    const b1 = parseInt(hex1.substring(5,7), 16);

    const r2 = parseInt(hex2.substring(1,3), 16);
    const g2 = parseInt(hex2.substring(3,5), 16);
    const b2 = parseInt(hex2.substring(5,7), 16);

    const r = Math.round(r1 + (r2 - r1) * factor);
    const g = Math.round(g1 + (g2 - g1) * factor);
    const b = Math.round(b1 + (b2 - b1) * factor);

    return `rgb(${r}, ${g}, ${b})`;
}

export function rotateIso(x, y, z, rx, ry) {
    let x1 = x * Math.cos(ry) - z * Math.sin(ry);
    let z1 = x * Math.sin(ry) + z * Math.cos(ry);
    let y1 = y * Math.cos(rx) - z1 * Math.sin(rx);
    let z2 = y * Math.sin(rx) + z1 * Math.cos(rx);
    return {x: x1, y: y1, z: z2};
}