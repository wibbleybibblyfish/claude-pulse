import { PulseRenderer, PulseState, PulseStateName } from '../types';

interface Particle {
    x: number;
    y: number;
    vx: number;
    vy: number;
    radius: number;
    alpha: number;
    life: number;
    maxLife: number;
}

interface StateVisuals {
    color: [number, number, number];
    glowColor: string;
    baseParticles: number;
    baseSpeed: number;
    glowSize: number;
}

const STATE_VISUALS: Record<PulseStateName, StateVisuals> = {
    idle: {
        color: [100, 150, 255],
        glowColor: 'rgba(100, 150, 255, 0.3)',
        baseParticles: 15,
        baseSpeed: 0.3,
        glowSize: 20,
    },
    thinking: {
        color: [180, 100, 255],
        glowColor: 'rgba(180, 100, 255, 0.4)',
        baseParticles: 25,
        baseSpeed: 0.5,
        glowSize: 30,
    },
    working: {
        color: [80, 220, 120],
        glowColor: 'rgba(80, 220, 120, 0.4)',
        baseParticles: 35,
        baseSpeed: 1.0,
        glowSize: 35,
    },
    spawning: {
        color: [255, 180, 50],
        glowColor: 'rgba(255, 180, 50, 0.5)',
        baseParticles: 50,
        baseSpeed: 1.5,
        glowSize: 45,
    },
    error: {
        color: [255, 60, 60],
        glowColor: 'rgba(255, 60, 60, 0.5)',
        baseParticles: 20,
        baseSpeed: 2.0,
        glowSize: 40,
    },
};

export class OrbRenderer implements PulseRenderer {
    private canvas!: HTMLCanvasElement;
    private ctx!: CanvasRenderingContext2D;
    private particles: Particle[] = [];
    private animationId: number = 0;
    private time: number = 0;

    private currentState: PulseStateName = 'idle';
    private intensity: number = 0;
    private activeAgents: number = 0;

    // Smoothly interpolated values for visual transitions
    private currentColor: [number, number, number] = [100, 150, 255];
    private targetColor: [number, number, number] = [100, 150, 255];
    private currentGlow: number = 20;
    private targetGlow: number = 20;
    // Pulse on state change — brief expand/contract then settle
    private pulseAmount: number = 0;  // current pulse offset (decays to 0)
    private lastState: PulseStateName = 'idle';

    init(canvas: HTMLCanvasElement): void {
        this.canvas = canvas;
        this.ctx = canvas.getContext('2d')!;
        this.resize();
        window.addEventListener('resize', () => this.resize());
        this.animate();
    }

    updateState(state: PulseState): void {
        this.currentState = state.state;
        this.intensity = state.intensity;
        this.activeAgents = state.active_agents;

        // Trigger a pulse burst on state change
        if (state.state !== this.lastState) {
            this.pulseAmount = 12;
            this.lastState = state.state;
        }

        const visuals = STATE_VISUALS[state.state];
        this.targetColor = [...visuals.color];

        // Agents boost glow, capped at 5 agents worth
        const agentGlowBoost = Math.min(this.activeAgents * 12, 60);
        this.targetGlow = visuals.glowSize + (state.intensity * 20) + agentGlowBoost;

        // Agents boost particle count, capped at 5 agents worth
        const agentParticleBoost = Math.min(this.activeAgents * 15, 75);
        const targetCount = Math.floor(visuals.baseParticles + (state.intensity * 30) + agentParticleBoost);
        while (this.particles.length < targetCount)
            this.spawnParticle(visuals);

        // Remove excess particles
        while (this.particles.length > targetCount + 10)
            this.particles.pop();
    }

    destroy(): void {
        cancelAnimationFrame(this.animationId);
    }

    private resize(): void {
        const dpr = window.devicePixelRatio || 1;
        this.canvas.width = this.canvas.offsetWidth * dpr;
        this.canvas.height = this.canvas.offsetHeight * dpr;
        this.ctx.scale(dpr, dpr);
    }

    private spawnParticle(visuals: StateVisuals): void {
        const cx = this.canvas.offsetWidth / 2;
        const cy = this.canvas.offsetHeight / 2;
        const angle = Math.random() * Math.PI * 2;
        const dist = Math.random() * 30 + 10;
        const speed = visuals.baseSpeed * (0.5 + Math.random()) * (1 + this.intensity);

        this.particles.push({
            x: cx + Math.cos(angle) * dist,
            y: cy + Math.sin(angle) * dist,
            vx: Math.cos(angle) * speed * (Math.random() - 0.3),
            vy: Math.sin(angle) * speed * (Math.random() - 0.3),
            radius: Math.random() * 3 + 1,
            alpha: Math.random() * 0.6 + 0.2,
            life: 0,
            maxLife: 60 + Math.random() * 120,
        });
    }

    private lerp(a: number, b: number, t: number): number {
        return a + (b - a) * t;
    }

    private animate = (): void => {
        this.animationId = requestAnimationFrame(this.animate);
        this.time += 1;

        const w = this.canvas.offsetWidth;
        const h = this.canvas.offsetHeight;
        const cx = w / 2;
        const cy = h / 2;

        // Clear with transparency
        this.ctx.clearRect(0, 0, w, h);

        // Smooth color transitions
        const lerpRate = 0.05;
        this.currentColor[0] = this.lerp(this.currentColor[0], this.targetColor[0], lerpRate);
        this.currentColor[1] = this.lerp(this.currentColor[1], this.targetColor[1], lerpRate);
        this.currentColor[2] = this.lerp(this.currentColor[2], this.targetColor[2], lerpRate);
        this.currentGlow = this.lerp(this.currentGlow, this.targetGlow, lerpRate);

        // Decay the state-change pulse
        this.pulseAmount *= 0.92;
        if (Math.abs(this.pulseAmount) < 0.1)
            this.pulseAmount = 0;

        const [r, g, b] = this.currentColor.map(Math.round);

        // Orb grows with agent count — each agent adds 5px, capped at 25px
        const agentRadiusBoost = Math.min(this.activeAgents * 5, 25);
        const baseRadius = 30 + this.intensity * 15 + agentRadiusBoost;
        const orbRadius = baseRadius + this.pulseAmount;

        // Error glitch effect
        let glitchOffset = 0;
        if (this.currentState === 'error') {
            glitchOffset = (Math.random() - 0.5) * 4;
        }

        // Draw outer glow
        const glowGradient = this.ctx.createRadialGradient(
            cx + glitchOffset, cy, orbRadius * 0.5,
            cx + glitchOffset, cy, orbRadius + this.currentGlow
        );
        glowGradient.addColorStop(0, `rgba(${r}, ${g}, ${b}, 0.3)`);
        glowGradient.addColorStop(0.5, `rgba(${r}, ${g}, ${b}, 0.1)`);
        glowGradient.addColorStop(1, `rgba(${r}, ${g}, ${b}, 0)`);

        this.ctx.beginPath();
        this.ctx.arc(cx + glitchOffset, cy, orbRadius + this.currentGlow, 0, Math.PI * 2);
        this.ctx.fillStyle = glowGradient;
        this.ctx.fill();

        // Draw main orb
        const orbGradient = this.ctx.createRadialGradient(
            cx + glitchOffset - orbRadius * 0.2,
            cy - orbRadius * 0.2,
            orbRadius * 0.1,
            cx + glitchOffset,
            cy,
            orbRadius
        );
        orbGradient.addColorStop(0, `rgba(${Math.min(r + 80, 255)}, ${Math.min(g + 80, 255)}, ${Math.min(b + 80, 255)}, 0.9)`);
        orbGradient.addColorStop(0.5, `rgba(${r}, ${g}, ${b}, 0.7)`);
        orbGradient.addColorStop(1, `rgba(${Math.max(r - 40, 0)}, ${Math.max(g - 40, 0)}, ${Math.max(b - 40, 0)}, 0.5)`);

        this.ctx.beginPath();
        this.ctx.arc(cx + glitchOffset, cy, orbRadius, 0, Math.PI * 2);
        this.ctx.fillStyle = orbGradient;
        this.ctx.shadowColor = `rgba(${r}, ${g}, ${b}, 0.6)`;
        this.ctx.shadowBlur = this.currentGlow;
        this.ctx.fill();
        this.ctx.shadowBlur = 0;

        // Update and draw particles
        const visuals = STATE_VISUALS[this.currentState];
        for (let i = this.particles.length - 1; i >= 0; i--) {
            const p = this.particles[i];
            p.life++;

            // Particles orbit around center
            const dx = p.x - cx;
            const dy = p.y - cy;
            const dist = Math.sqrt(dx * dx + dy * dy);
            const angle = Math.atan2(dy, dx);

            // Orbital force + outward drift — agents make particles faster
            const agentSpeedBoost = 1 + this.activeAgents * 0.3;
            const orbitalSpeed = visuals.baseSpeed * 0.02 * (1 + this.intensity) * agentSpeedBoost;
            p.x += Math.cos(angle + Math.PI / 2) * orbitalSpeed * (orbRadius / Math.max(dist, 1)) * 10;
            p.y += Math.sin(angle + Math.PI / 2) * orbitalSpeed * (orbRadius / Math.max(dist, 1)) * 10;
            p.x += p.vx * 0.1;
            p.y += p.vy * 0.1;

            // Pull back toward orb surface
            if (dist > orbRadius + 20) {
                p.x -= dx * 0.01;
                p.y -= dy * 0.01;
            }
            if (dist < orbRadius * 0.5) {
                p.x += dx * 0.02;
                p.y += dy * 0.02;
            }

            // Fade based on life
            const lifeFrac = p.life / p.maxLife;
            const fadeAlpha = lifeFrac < 0.1
                ? lifeFrac * 10 * p.alpha
                : lifeFrac > 0.8
                    ? (1 - lifeFrac) * 5 * p.alpha
                    : p.alpha;

            this.ctx.beginPath();
            this.ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
            this.ctx.fillStyle = `rgba(${Math.min(r + 40, 255)}, ${Math.min(g + 40, 255)}, ${Math.min(b + 40, 255)}, ${fadeAlpha})`;
            this.ctx.fill();

            // Remove dead particles and respawn
            if (p.life >= p.maxLife) {
                this.particles.splice(i, 1);
                if (this.particles.length < visuals.baseParticles + this.intensity * 30)
                    this.spawnParticle(visuals);
            }
        }
    };
}
