import { PulseRenderer, PulseState, PulseStateName } from '../types';

const PX = 3;

const COLORS = {
    deskTop: '#6b4423',
    deskFront: '#5a3a1a',
    deskLeg: '#4a3015',
    monitorBezel: '#222',
    monitorStand: '#222',
    keyboard: '#555',
    keyHighlight: '#666',
    floor: '#1a1528',
    mugBody: '#ddd',
    mugCoffee: '#6F4E37',
    mugHandle: '#ddd',
    pot: '#8B4513',
    leaf: '#228B22',
    skin: '#e8b87a',
    hair: '#4a3020',
    eyeWhite: '#fff',
    eyePupil: '#222',
    mouth: '#c4956a',
    shirt: '#4a7aff',
    shirtHighlight: '#5a8aff',
};

interface Particle {
    x: number;
    y: number;
    vx: number;
    vy: number;
    life: number;
    maxLife: number;
    color: string;
    type: 'zzz' | 'steam' | 'spark' | 'paper' | 'sweat';
    text?: string;
}

export class PixelCharacterRenderer implements PulseRenderer {
    private canvas!: HTMLCanvasElement;
    private ctx!: CanvasRenderingContext2D;
    private animationId: number = 0;
    private currentState: PulseStateName = 'idle';
    private intensity: number = 0;
    private activeAgents: number = 0;
    private time: number = 0;
    private lastTimestamp: number = 0;
    private typingTimer: number = 0;
    private typingFrame: number = 0;
    private codeLineLengths: number[] = [8, 5, 10, 3, 7, 11, 6, 9];
    private particles: Particle[] = [];
    private zzzTimer: number = 0;
    private steamTimer: number = 0;
    private sparkTimer: number = 0;
    private sweatTimer: number = 0;
    private previousState: PulseStateName = 'idle';
    private shakeOffsetX: number = 0;
    private shakeOffsetY: number = 0;
    private displayIntensity: number = 0;
    private currentScreenColor: [number, number, number] = [17, 24, 40];
    private targetScreenColor: [number, number, number] = [17, 24, 40];

    init(canvas: HTMLCanvasElement): void {
        this.canvas = canvas;
        this.ctx = canvas.getContext('2d')!;
        this.canvas.width = 38 * PX;  // 190px
        this.canvas.height = 36 * PX; // 180px
        this.canvas.style.width = `${38 * PX}px`;
        this.canvas.style.height = `${36 * PX}px`;
        this.canvas.style.imageRendering = 'pixelated';
        this.ctx.imageSmoothingEnabled = false;
        this.animate(0);
    }

    updateState(state: PulseState): void {
        const prevState = this.currentState;
        this.currentState = state.state;
        this.intensity = state.intensity;
        this.activeAgents = state.active_agents;

        if (prevState !== this.currentState) {
            // Clear particles that no longer apply
            if (prevState === 'idle')
                this.particles = this.particles.filter(p => p.type !== 'zzz');
            if (prevState === 'working' && this.currentState !== 'spawning')
                this.particles = this.particles.filter(p => p.type !== 'steam' && p.type !== 'spark');
            if (prevState === 'spawning' && this.currentState !== 'working')
                this.particles = this.particles.filter(p => p.type !== 'steam' && p.type !== 'spark' && p.type !== 'sweat');

            // Burst papers on error state entry
            if (this.currentState === 'error' && prevState !== 'error') {
                const burstCount = 3 + Math.floor(Math.random() * 2);
                for (let i = 0; i < burstCount; i++)
                    this.spawnPaper();
            }

            // Set target screen color for smooth transition
            this.targetScreenColor = this.getScreenColorRGB();

            this.previousState = prevState;
        }
    }

    destroy(): void {
        cancelAnimationFrame(this.animationId);
    }

    private px(x: number, y: number): void {
        this.ctx.fillRect(x * PX, y * PX, PX, PX);
    }

    private rect(x1: number, y1: number, x2: number, y2: number): void {
        const w = (x2 - x1 + 1) * PX;
        const h = (y2 - y1 + 1) * PX;
        this.ctx.fillRect(x1 * PX, y1 * PX, w, h);
    }

    private drawFloor(): void {
        this.ctx.fillStyle = COLORS.floor;
        this.rect(0, 33, 37, 35);
    }

    private drawDesk(): void {
        this.ctx.fillStyle = COLORS.deskTop;
        this.rect(2, 25, 33, 26);
        this.ctx.fillStyle = COLORS.deskFront;
        this.rect(2, 27, 33, 27);
        this.ctx.fillStyle = COLORS.deskLeg;
        this.rect(4, 28, 5, 32);
        this.rect(30, 28, 31, 32);
    }

    private drawMonitor(screenColor: string): void {
        this.ctx.fillStyle = COLORS.monitorBezel;
        this.rect(19, 12, 32, 24);
        this.ctx.fillStyle = screenColor;
        this.rect(20, 13, 31, 23);
        this.ctx.fillStyle = COLORS.monitorStand;
        this.px(25, 25);
        this.px(26, 25);
    }

    private drawKeyboard(): void {
        this.ctx.fillStyle = COLORS.keyboard;
        this.rect(17, 24, 24, 25);
        this.ctx.fillStyle = COLORS.keyHighlight;
        for (let x = 18; x <= 23; x += 2)
            this.px(x, 24);
    }

    private drawCoffeeMug(_showSteam: boolean): void {
        this.ctx.fillStyle = COLORS.mugBody;
        this.rect(28, 22, 29, 24);
        this.ctx.fillStyle = COLORS.mugCoffee;
        this.px(28, 23);
        this.px(29, 23);
        this.ctx.fillStyle = COLORS.mugHandle;
        this.px(30, 23);
    }

    private drawPlant(): void {
        this.ctx.fillStyle = COLORS.pot;
        this.rect(5, 24, 7, 25);
        this.ctx.fillStyle = COLORS.leaf;
        this.rect(5, 22, 7, 23);
        this.px(6, 21);
        this.px(7, 21);
    }

    private getScreenColorRGB(): [number, number, number] {
        switch (this.currentState) {
            case 'idle':
                return [17, 24, 40];     // #111828
            case 'thinking':
                return [26, 16, 48];     // #1a1030
            case 'working':
                return [13, 26, 13];     // #0d1a0d
            case 'spawning':
                return [26, 21, 8];      // #1a1508
            case 'error':
                return [42, 8, 8];       // #2a0808
        }
    }

    private getScreenColor(): string {
        const [r, g, b] = this.currentScreenColor;
        const rh = Math.round(r).toString(16).padStart(2, '0');
        const gh = Math.round(g).toString(16).padStart(2, '0');
        const bh = Math.round(b).toString(16).padStart(2, '0');
        return `#${rh}${gh}${bh}`;
    }

    private getTypingFrame(): number {
        return this.typingFrame;
    }

    private drawScreenContent(): void {
        // Screen bounds: x 20-31 (12px wide), y 13-23 (11px tall)
        const sx = 20;
        const sy = 13;
        const sw = 12;
        const sh = 11;

        switch (this.currentState) {
            case 'idle': {
                // Bouncing screensaver dot
                const dotX = sx + Math.floor((Math.sin(this.time / 1400) + 1) * 0.5 * (sw - 1));
                const dotY = sy + Math.floor((Math.cos(this.time / 1100) + 1) * 0.5 * (sh - 1));
                this.ctx.fillStyle = '#55aaff';
                this.px(dotX, dotY);
                break;
            }
            case 'thinking': {
                // Blinking cursor
                const cursorOn = Math.floor(this.time / 500) % 2 === 0;
                if (cursorOn) {
                    this.ctx.fillStyle = '#9966cc';
                    this.px(sx + 1, sy + 2);
                }
                // Dim purple partial text lines
                this.ctx.fillStyle = '#3a2255';
                this.rect(sx + 1, sy + 4, sx + 5, sy + 4);
                this.rect(sx + 1, sy + 6, sx + 3, sy + 6);
                break;
            }
            case 'working': {
                // Scrolling green code lines
                const scrollSpeed = 0.003 + this.displayIntensity * 0.012;
                const scrollOffset = (this.time * scrollSpeed) % sh;
                const lineCount = this.codeLineLengths.length;

                for (let i = 0; i < lineCount; i++) {
                    const lineLen = this.codeLineLengths[i];
                    // Each line is spaced ~1.3px apart vertically, wrapping around
                    const rawY = (i * 1.4 - scrollOffset + sh * 2) % sh;
                    const drawY = sy + Math.floor(rawY);

                    if (drawY < sy || drawY > sy + sh - 1)
                        continue;

                    const clampedLen = Math.min(lineLen, sw);
                    this.ctx.fillStyle = '#33cc33';
                    this.rect(sx + 1, drawY, sx + clampedLen, drawY);
                }
                break;
            }
            case 'spawning': {
                // Orange tinted panels with dividers based on agent count
                const agents = this.activeAgents;
                const dividers: number[] = [];

                if (agents >= 3) {
                    dividers.push(sx + 4, sx + 8);
                } else if (agents >= 2) {
                    dividers.push(sx + 6);
                }

                // Draw divider columns (bright orange)
                this.ctx.fillStyle = '#ff8833';
                for (const dx of dividers) {
                    for (let dy = sy; dy <= sy + sh - 1; dy++)
                        this.px(dx, dy);
                }

                // Draw orange text lines in each panel
                this.ctx.fillStyle = '#cc6622';
                if (dividers.length === 0) {
                    // Single panel — full width text
                    this.rect(sx + 1, sy + 2, sx + 7, sy + 2);
                    this.rect(sx + 1, sy + 4, sx + 5, sy + 4);
                } else if (dividers.length === 1) {
                    // Two panels
                    this.rect(sx + 1, sy + 2, dividers[0] - 1, sy + 2);
                    this.rect(sx + 1, sy + 4, dividers[0] - 2, sy + 4);
                    this.rect(dividers[0] + 1, sy + 2, sx + sw - 2, sy + 2);
                    this.rect(dividers[0] + 1, sy + 4, sx + sw - 3, sy + 4);
                } else {
                    // Three panels
                    this.rect(sx + 1, sy + 2, dividers[0] - 1, sy + 2);
                    this.rect(dividers[0] + 1, sy + 2, dividers[1] - 1, sy + 2);
                    this.rect(dividers[0] + 1, sy + 4, dividers[1] - 1, sy + 4);
                    this.rect(dividers[1] + 1, sy + 2, sx + sw - 2, sy + 2);
                }
                break;
            }
            case 'error': {
                // Large red exclamation mark centered on screen
                // Screen center: sx+5 to sx+6 (horizontal), sy area for vertical
                const cx = sx + 5;

                this.ctx.fillStyle = '#ff3333';
                // Vertical bar of ! — 2px wide, 6px tall
                this.rect(cx, sy + 1, cx + 1, sy + 6);
                // Dot below — 2px wide, 1px tall
                this.rect(cx, sy + 8, cx + 1, sy + 8);
                break;
            }
        }
    }

    private drawCharHead(x: number, y: number, wideEyes: boolean = false, mouthOpen: boolean = false): void {
        // Hair
        this.ctx.fillStyle = COLORS.hair;
        this.rect(x, y - 1, x + 5, y);
        this.px(x, y + 1);
        this.px(x, y + 2);
        // Face
        this.ctx.fillStyle = COLORS.skin;
        this.rect(x + 1, y + 1, x + 5, y + 5);
        // Eyes
        this.ctx.fillStyle = COLORS.eyeWhite;
        this.px(x + 3, y + 2);
        this.px(x + 4, y + 2);
        if (wideEyes)
            this.px(x + 5, y + 2);
        this.ctx.fillStyle = COLORS.eyePupil;
        this.px(x + 4, y + 2);
        // Mouth
        if (mouthOpen) {
            this.ctx.fillStyle = COLORS.eyePupil;
            this.px(x + 3, y + 4);
        } else {
            this.ctx.fillStyle = COLORS.mouth;
            this.px(x + 3, y + 4);
        }
    }

    private drawPoseIdle(): void {
        // Breathing bob: slow 1px sinusoidal y-offset, ~3s cycle
        const breathOffset = Math.round(Math.sin(this.time / 3000 * Math.PI * 2) * 0.5);
        const by = breathOffset;

        // Character is slumped forward, head down on desk/keyboard area
        // Body (shirt) - slumped forward in chair
        this.ctx.fillStyle = COLORS.shirt;
        this.rect(9, 19 + by, 13, 24 + by);
        this.ctx.fillStyle = COLORS.shirtHighlight;
        this.px(10, 20 + by);
        this.px(11, 20 + by);

        // Head resting on desk - tilted down, face on arms
        this.ctx.fillStyle = COLORS.hair;
        this.rect(13, 21 + by, 17, 22 + by);
        this.px(13, 23 + by);
        this.ctx.fillStyle = COLORS.skin;
        this.rect(14, 23 + by, 17, 24 + by);

        // Arms draped on desk
        this.ctx.fillStyle = COLORS.skin;
        this.rect(14, 24 + by, 16, 25);
        this.rect(12, 25, 14, 25);

        // Legs
        this.ctx.fillStyle = COLORS.shirt;
        this.rect(10, 25, 11, 27);
        this.rect(12, 25, 13, 27);
    }

    private drawPoseThinking(): void {
        const bx = 9;
        const by = 12;

        // Head - slightly tilted (offset 1px right)
        this.drawCharHead(bx + 1, by);

        // Body (shirt) - upright in chair
        this.ctx.fillStyle = COLORS.shirt;
        this.rect(bx, by + 7, bx + 4, by + 12);
        this.ctx.fillStyle = COLORS.shirtHighlight;
        this.px(bx + 1, by + 8);
        this.px(bx + 2, by + 8);

        // Left arm resting on desk
        this.ctx.fillStyle = COLORS.skin;
        this.rect(bx + 5, by + 10, bx + 7, by + 11);
        this.px(bx + 5, by + 12);

        // Right arm raised to chin (thinking pose)
        this.ctx.fillStyle = COLORS.skin;
        this.px(bx - 1, by + 8);
        this.px(bx - 1, by + 7);
        this.px(bx, by + 5);

        // Legs
        this.ctx.fillStyle = COLORS.shirt;
        this.rect(bx, by + 13, bx + 1, by + 15);
        this.rect(bx + 2, by + 13, bx + 3, by + 15);

        // Thought bubble above head
        const bubbleX = bx + 4;
        const bubbleY = by - 7;

        // Small connector dots leading to bubble
        this.ctx.fillStyle = '#ccc';
        this.px(bx + 3, by - 2);
        this.px(bx + 4, by - 4);

        // Thought cloud (3x2 cluster)
        this.ctx.fillStyle = '#ddd';
        this.rect(bubbleX, bubbleY, bubbleX + 4, bubbleY + 2);
        this.px(bubbleX + 1, bubbleY - 1);
        this.px(bubbleX + 2, bubbleY - 1);
        this.px(bubbleX + 3, bubbleY - 1);

        // Animated dots inside thought bubble (~300ms per dot, then reset)
        const dotCycle = Math.floor(this.time / 300) % 4;
        this.ctx.fillStyle = '#666';
        if (dotCycle >= 1)
            this.px(bubbleX + 1, bubbleY + 1);
        if (dotCycle >= 2)
            this.px(bubbleX + 2, bubbleY + 1);
        if (dotCycle >= 3)
            this.px(bubbleX + 3, bubbleY + 1);
    }

    private drawPoseWorking(armOffset: number): void {
        const bx = 9;
        const by = 13;

        // Head - hunched forward (shifted right toward monitor)
        this.drawCharHead(bx + 2, by);

        // Body (shirt) - hunched forward
        this.ctx.fillStyle = COLORS.shirt;
        this.rect(bx, by + 6, bx + 4, by + 11);
        this.ctx.fillStyle = COLORS.shirtHighlight;
        this.px(bx + 1, by + 7);
        this.px(bx + 2, by + 7);

        // Both arms extend to keyboard
        this.ctx.fillStyle = COLORS.skin;
        // Left arm to keyboard
        this.rect(bx + 5, by + 8, bx + 8, by + 9 - armOffset);
        this.px(bx + 8, by + 9 - armOffset);
        // Right arm to keyboard
        this.rect(bx + 5, by + 10, bx + 8, by + 11);
        this.px(bx + 8, by + 11);

        // Legs
        this.ctx.fillStyle = COLORS.shirt;
        this.rect(bx, by + 12, bx + 1, by + 14);
        this.rect(bx + 2, by + 12, bx + 3, by + 14);
    }

    private drawPoseSpawning(armOffset: number): void {
        // Same as working pose — ghost clones and sweat added in later tasks
        this.drawPoseWorking(armOffset);
    }

    private drawPoseError(): void {
        const bx = 7;
        const by = 12;

        // Head - leaning back, wide eyes, open mouth
        this.drawCharHead(bx, by, true, true);

        // Body (shirt) - leaning back in chair
        this.ctx.fillStyle = COLORS.shirt;
        this.rect(bx, by + 7, bx + 4, by + 12);
        this.ctx.fillStyle = COLORS.shirtHighlight;
        this.px(bx + 1, by + 8);

        // Arms raised above head
        this.ctx.fillStyle = COLORS.skin;
        this.px(bx - 1, by + 1);
        this.px(bx - 1, by);
        this.px(bx - 1, by - 1);
        this.px(bx + 5, by + 1);
        this.px(bx + 5, by);
        this.px(bx + 5, by - 1);

        // Chair tipped back - back legs visible
        this.ctx.fillStyle = COLORS.deskLeg;
        this.px(bx - 1, by + 13);
        this.px(bx - 2, by + 14);

        // Legs
        this.ctx.fillStyle = COLORS.shirt;
        this.rect(bx, by + 13, bx + 1, by + 15);
        this.rect(bx + 2, by + 13, bx + 3, by + 15);
    }

    private drawAgentBots(): void {
        const count = Math.min(this.activeAgents, 3);
        if (count === 0)
            return;

        // Each bot scurries back and forth across the floor/desk area
        // Different speed and range per bot so they don't overlap
        const bots = [
            { baseX: 2, range: 12, speed: 1800, y: 31 },   // floor left
            { baseX: 20, range: 10, speed: 1300, y: 31 },   // floor right
            { baseX: 8, range: 8, speed: 2200, y: 31 },     // floor middle
        ];

        for (let i = 0; i < count; i++) {
            const bot = bots[i];
            // Ping-pong motion
            const cycle = (this.time / bot.speed) % 2;
            const t = cycle < 1 ? cycle : 2 - cycle;
            const bx = Math.floor(bot.baseX + t * bot.range);
            this.drawRobot(bx, bot.y, i);
        }
    }

    private drawRobot(x: number, y: number, index: number): void {
        // Tiny 3x3 robot with antenna
        const colors = ['#ffb440', '#40b4ff', '#ff6040'];
        const color = colors[index % 3];

        // Antenna
        this.ctx.fillStyle = color;
        this.px(x + 1, y - 2);

        // Head (3x2 with eye)
        this.ctx.fillStyle = '#888';
        this.rect(x, y - 1, x + 2, y);
        // Eye (glowing)
        this.ctx.fillStyle = color;
        this.px(x + 1, y - 1);

        // Body/legs (wider, 3x1)
        this.ctx.fillStyle = '#666';
        this.px(x, y + 1);
        this.px(x + 2, y + 1);
    }

    private drawScene(): void {
        this.drawFloor();
        this.drawDesk();
        this.drawKeyboard();
        this.drawPlant();

        const screenColor = this.getScreenColor();
        this.drawMonitor(screenColor);
        this.drawScreenContent();
        this.drawCoffeeMug(this.currentState === 'working' || this.currentState === 'spawning');

        switch (this.currentState) {
            case 'idle':
                this.drawPoseIdle();
                break;
            case 'thinking':
                this.drawPoseThinking();
                break;
            case 'working':
                this.drawPoseWorking(this.getTypingFrame());
                break;
            case 'spawning':
                this.drawAgentBots();
                this.drawPoseSpawning(this.getTypingFrame());
                break;
            case 'error':
                this.drawPoseError();
                break;
        }
    }

    private spawnZzz(): void {
        const aliveCount = this.particles.filter(p => p.type === 'zzz').length;
        if (aliveCount >= 3)
            return;

        this.particles.push({
            x: 15 + Math.random() * 2,
            y: 20,
            vx: 1.5 + Math.random() * 0.5,
            vy: -(2 + Math.random() * 0.5),
            life: 0,
            maxLife: 2000,
            color: '#aaccff',
            type: 'zzz',
            text: 'Z',
        });
    }

    private spawnSteam(): void {
        const aliveCount = this.particles.filter(p => p.type === 'steam').length;
        if (aliveCount >= 4)
            return;

        this.particles.push({
            x: 28 + Math.random(),
            y: 21,
            vx: 0,
            vy: -(1.5 + Math.random() * 0.5),
            life: 0,
            maxLife: 1500,
            color: 'rgba(200,200,200,0.6)',
            type: 'steam',
        });
    }

    private spawnSpark(): void {
        this.particles.push({
            x: 17 + Math.random() * 7,
            y: 23 + Math.random(),
            vx: (Math.random() - 0.5) * 8,
            vy: -(Math.random() * 6 + 2),
            life: 0,
            maxLife: 300,
            color: Math.random() > 0.5 ? '#ffff55' : '#ffffff',
            type: 'spark',
        });
    }

    private spawnPaper(): void {
        const goRight = Math.random() > 0.5;
        this.particles.push({
            x: 18,
            y: 24,
            vx: goRight ? (2 + Math.random() * 3) : -(2 + Math.random() * 3),
            vy: -(4 + Math.random() * 3),
            life: 0,
            maxLife: 2000,
            color: '#ffffff',
            type: 'paper',
        });
    }

    private spawnSweat(): void {
        const aliveCount = this.particles.filter(p => p.type === 'sweat').length;
        if (aliveCount >= 1)
            return;

        this.particles.push({
            x: 15,
            y: 8,
            vx: 0,
            vy: 4,
            life: 0,
            maxLife: 600,
            color: '#88ccff',
            type: 'sweat',
        });
    }

    private updateParticles(dt: number): void {
        for (const p of this.particles) {
            p.life += dt;
            p.x += p.vx * dt / 1000;
            p.y += p.vy * dt / 1000;

            if (p.type === 'paper' || p.type === 'sweat')
                p.vy += 15 * dt / 1000;

            if (p.type === 'steam' || p.type === 'zzz')
                p.x += Math.sin(p.life / 300) * 0.02;
        }

        this.particles = this.particles.filter(p => p.life < p.maxLife);
    }

    private drawParticles(): void {
        for (const p of this.particles) {
            this.ctx.fillStyle = p.color;
            const gx = Math.floor(p.x);
            const gy = Math.floor(p.y);

            if (p.type === 'zzz') {
                // Draw "Z" as a 3x3 pixel pattern
                this.px(gx, gy);
                this.px(gx + 1, gy);
                this.px(gx + 2, gy);
                this.px(gx + 2, gy + 1);
                this.px(gx, gy + 2);
                this.px(gx + 1, gy + 2);
                this.px(gx + 2, gy + 2);
            } else if (p.type === 'paper') {
                this.px(gx, gy);
                this.px(gx + 1, gy);
            } else {
                this.px(gx, gy);
            }
        }
    }

    private spawnStateParticles(dt: number): void {
        switch (this.currentState) {
            case 'idle':
                this.zzzTimer += dt;
                if (this.zzzTimer >= 800) {
                    this.zzzTimer = 0;
                    this.spawnZzz();
                }
                break;
            case 'working':
            case 'spawning': {
                const steamInterval = Math.max(150, 400 - this.displayIntensity * 300);
                this.steamTimer += dt;
                if (this.steamTimer >= steamInterval) {
                    this.steamTimer = 0;
                    this.spawnSteam();
                }

                if (this.displayIntensity > 0.7) {
                    this.sparkTimer += dt;
                    if (this.sparkTimer >= 200) {
                        this.sparkTimer = 0;
                        this.spawnSpark();
                    }
                }

                if (this.currentState === 'spawning' && this.displayIntensity > 0.7) {
                    this.sweatTimer += dt;
                    if (this.sweatTimer >= 600) {
                        this.sweatTimer = 0;
                        this.spawnSweat();
                    }
                }
                break;
            }
            default:
                // Reset spawn timers for inactive states
                this.zzzTimer = 0;
                this.steamTimer = 0;
                this.sparkTimer = 0;
                this.sweatTimer = 0;
                break;
        }
    }

    private animate = (timestamp: number): void => {
        this.animationId = requestAnimationFrame(this.animate);
        const dt = timestamp - this.lastTimestamp;
        this.lastTimestamp = timestamp;
        this.time += dt;

        // Smooth intensity transition
        this.displayIntensity += (this.intensity - this.displayIntensity) * 0.05;

        // Smooth screen color transition
        for (let i = 0; i < 3; i++)
            this.currentScreenColor[i] += (this.targetScreenColor[i] - this.currentScreenColor[i]) * 0.05;

        // Screen shake for error state
        if (this.currentState === 'error') {
            this.shakeOffsetX = Math.round((Math.random() - 0.5) * 4);
            this.shakeOffsetY = Math.round((Math.random() - 0.5) * 2);
        } else {
            this.shakeOffsetX = 0;
            this.shakeOffsetY = 0;
        }

        // Update typing animation for working/spawning states
        if (this.currentState === 'working' || this.currentState === 'spawning') {
            const keystrokeInterval = 400 - (this.displayIntensity * 320);
            this.typingTimer += dt;
            if (this.typingTimer > keystrokeInterval) {
                this.typingTimer = 0;
                this.typingFrame = this.typingFrame === 0 ? 1 : 0;
            }
        } else {
            this.typingTimer = 0;
            this.typingFrame = 0;
        }

        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

        // Apply screen shake offset
        this.ctx.save();
        this.ctx.translate(this.shakeOffsetX * PX, this.shakeOffsetY * PX);
        this.drawScene();
        this.ctx.restore();

        this.updateParticles(dt);
        this.drawParticles();
        this.spawnStateParticles(dt);
    };
}
