import { PulseRenderer } from './types';
import { OrbRenderer } from './orb/OrbRenderer';
import { PixelCharacterRenderer } from './pixel-character/PixelCharacterRenderer';

export type RendererType = 'orb' | 'pixel-character';

export function createRenderer(type: RendererType): PulseRenderer {
    switch (type) {
        case 'pixel-character':
            return new PixelCharacterRenderer();
        case 'orb':
        default:
            return new OrbRenderer();
    }
}

