export type PulseStateName = 'idle' | 'thinking' | 'working' | 'spawning' | 'error';

export interface PulseState {
    state: PulseStateName;
    intensity: number;
    active_agents: number;
    tool_rate: number;
    current_tool?: string;
    session_id?: string;
    project?: string;
}

export interface PulseRenderer {
    init(canvas: HTMLCanvasElement): void;
    updateState(state: PulseState): void;
    destroy(): void;
}
