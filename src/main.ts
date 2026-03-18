import { listen } from '@tauri-apps/api/event';
import { getCurrentWindow } from '@tauri-apps/api/window';
import { createRenderer, RendererType } from './renderers/factory';
import { PulseRenderer, PulseState } from './renderers/types';

const canvas = document.getElementById('pulse-canvas') as HTMLCanvasElement;

let renderer: PulseRenderer;
let lastState: PulseState = { state: 'idle', intensity: 0, active_agents: 0, tool_rate: 0 };

function initRenderer(type: RendererType): void {
    if (renderer)
        renderer.destroy();
    renderer = createRenderer(type);
    renderer.init(canvas);
    renderer.updateState(lastState);
}

// Fetch renderer preference from server config, fall back to localStorage
async function getInitialRenderer(): Promise<RendererType> {
    try {
        const res = await fetch('http://localhost:3200/config');
        if (res.ok) {
            const config = await res.json();
            if (config.renderer === 'orb' || config.renderer === 'pixel-character')
                return config.renderer;
        }
    } catch (_) {
        // Server not running — fall back to localStorage
    }
    const stored = localStorage.getItem('pulse-renderer');
    if (stored === 'orb' || stored === 'pixel-character')
        return stored;
    return 'orb';
}

// Init with server config
getInitialRenderer().then((type) => initRenderer(type));

// Listen for state updates from Rust backend
listen<PulseState>('pulse-state', (event) => {
    lastState = event.payload;
    if (renderer)
        renderer.updateState(event.payload);
});

// Listen for renderer switch from SwiftBar / control endpoint
listen<string>('renderer-change', (event) => {
    const type = event.payload as RendererType;
    if (type === 'orb' || type === 'pixel-character')
        initRenderer(type);
});

// Enable window dragging
const appWindow = getCurrentWindow();
document.addEventListener('mousedown', (e) => {
    if (e.button === 0) {
        e.preventDefault();
        appWindow.startDragging();
    }
});
