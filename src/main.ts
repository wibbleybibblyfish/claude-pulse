import { listen } from '@tauri-apps/api/event';
import { getCurrentWindow } from '@tauri-apps/api/window';
import { OrbRenderer } from './renderers/orb/OrbRenderer';
import { PulseState } from './renderers/types';

const canvas = document.getElementById('pulse-canvas') as HTMLCanvasElement;
const renderer = new OrbRenderer();
renderer.init(canvas);

// Set initial idle state
renderer.updateState({
    state: 'idle',
    intensity: 0,
    active_agents: 0,
    tool_rate: 0,
});

// Listen for state updates from the Rust backend via Tauri events
listen<PulseState>('pulse-state', (event) => {
    renderer.updateState(event.payload);
});

// Enable window dragging
const appWindow = getCurrentWindow();
document.addEventListener('mousedown', (e) => {
    if (e.button === 0) {
        e.preventDefault();
        appWindow.startDragging();
    }
});
