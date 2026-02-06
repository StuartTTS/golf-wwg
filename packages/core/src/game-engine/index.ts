import type {
  GameFormatId,
  GameFormatMetadata,
  IGameFormatEngine,
} from '../types/game-formats';
import { StrokePlayGrossEngine } from './formats/stroke-play-gross';
import { StrokePlayNetEngine } from './formats/stroke-play-net';
import { SkinsEngine } from './formats/skins';
import { NassauEngine } from './formats/nassau';
import { MatchPlayEngine } from './formats/match-play';
import { WolfEngine } from './formats/wolf';
import { ScrambleEngine } from './formats/scramble';
import { ShambleEngine } from './formats/shamble';
import { AlternateShotEngine } from './formats/alternate-shot';
import { ModifiedAlternateShotEngine } from './formats/modified-alternate-shot';
import {
  BestBall2Engine,
  BestBall3Engine,
  BestBall4Engine,
} from './formats/best-ball';

export class GameFormatRegistry {
  private engines: Map<GameFormatId, IGameFormatEngine> = new Map();

  register(engine: IGameFormatEngine): void {
    this.engines.set(engine.formatId, engine);
  }

  getEngine(formatId: GameFormatId): IGameFormatEngine {
    const engine = this.engines.get(formatId);
    if (!engine) {
      throw new Error(`No game engine registered for format: ${formatId}`);
    }
    return engine;
  }

  getAvailableFormats(): GameFormatMetadata[] {
    return Array.from(this.engines.values()).map((e) => e.getMetadata());
  }

  hasFormat(formatId: string): boolean {
    return this.engines.has(formatId as GameFormatId);
  }
}

// Create and export a singleton registry with all built-in formats
export const gameFormatRegistry = new GameFormatRegistry();

// Register all built-in engines
gameFormatRegistry.register(new StrokePlayGrossEngine());
gameFormatRegistry.register(new StrokePlayNetEngine());
gameFormatRegistry.register(new SkinsEngine());
gameFormatRegistry.register(new NassauEngine());
gameFormatRegistry.register(new MatchPlayEngine());
gameFormatRegistry.register(new WolfEngine());
gameFormatRegistry.register(new ScrambleEngine());
gameFormatRegistry.register(new ShambleEngine());
gameFormatRegistry.register(new AlternateShotEngine());
gameFormatRegistry.register(new ModifiedAlternateShotEngine());
gameFormatRegistry.register(new BestBall2Engine());
gameFormatRegistry.register(new BestBall3Engine());
gameFormatRegistry.register(new BestBall4Engine());

// Re-export
export { BaseGameFormatEngine } from './base';
export { StrokePlayGrossEngine } from './formats/stroke-play-gross';
export { StrokePlayNetEngine } from './formats/stroke-play-net';
export { SkinsEngine } from './formats/skins';
export { NassauEngine } from './formats/nassau';
export { MatchPlayEngine } from './formats/match-play';
export { WolfEngine } from './formats/wolf';
export { ScrambleEngine } from './formats/scramble';
export { ShambleEngine } from './formats/shamble';
export { AlternateShotEngine } from './formats/alternate-shot';
export { ModifiedAlternateShotEngine } from './formats/modified-alternate-shot';
export { BestBall2Engine, BestBall3Engine, BestBall4Engine } from './formats/best-ball';
