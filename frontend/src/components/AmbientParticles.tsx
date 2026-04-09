import React, { useEffect, useRef } from 'react';

export function AmbientParticles() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let particles: Particle[] = [];
    let animationFrameId: number;

    const resize = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    };

    class Particle {
      x: number;
      y: number;
      size: number;
      speedX: number;
      speedY: number;
      opacity: number;
      color: string;

      constructor() {
        this.x = Math.random() * canvas.width;
        this.y = Math.random() * canvas.height;
        this.size = Math.random() * 2 + 0.5;
        this.speedX = (Math.random() - 0.5) * 0.3;
        this.speedY = (Math.random() - 0.5) * 0.3 - 0.2; // Slight upward drift
        this.opacity = Math.random() * 0.5 + 0.1;
        
        // Mix of primary (#71d7cd) and secondary (#e1c198) colors
        const colors = ['113, 215, 205', '225, 193, 152'];
        this.color = colors[Math.floor(Math.random() * colors.length)];
      }

      update() {
        this.x += this.speedX;
        this.y += this.speedY;

        if (this.y < 0) {
          this.y = canvas.height;
          this.x = Math.random() * canvas.width;
        }
        if (this.x < 0) this.x = canvas.width;
        if (this.x > canvas.width) this.x = 0;

        // Twinkle effect
        if (Math.random() < 0.01) {
          this.opacity = Math.random() * 0.8 + 0.2;
        }
      }

      draw() {
        if (!ctx) return;
        
        // Draw main particle
        ctx.fillStyle = `rgba(${this.color}, ${this.opacity})`;
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2);
        ctx.fill();
        
        // Draw fake glow (much faster than shadowBlur)
        ctx.fillStyle = `rgba(${this.color}, ${this.opacity * 0.3})`;
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.size * 2.5, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    const init = () => {
      resize();
      particles = [];
      // Reduce particle count and cap it to a maximum of 80 to save CPU
      const particleCount = Math.min(80, Math.floor((window.innerWidth * window.innerHeight) / 25000));
      for (let i = 0; i < particleCount; i++) {
        particles.push(new Particle());
      }
    };

    const animate = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      for (let i = 0; i < particles.length; i++) {
        particles[i].update();
        particles[i].draw();
      }
      animationFrameId = requestAnimationFrame(animate);
    };

    init();
    animate();

    window.addEventListener('resize', init);

    return () => {
      window.removeEventListener('resize', init);
      cancelAnimationFrame(animationFrameId);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      className="fixed inset-0 pointer-events-none z-0 opacity-60"
    />
  );
}
