/**
 * Component Logger — Organic Energy Wave Theme Transition Configuration
 * 
 * Central configuration for tuning timing, tendril generation, color palettes,
 * and wave dynamics matching the reference video animation.
 */

export interface ThemeTransitionConfig {
  /** Total animation duration in milliseconds (~5-7 seconds) */
  totalDurationMs: number;
  /** Duration of Stage 1: Initial glowing core & tendril sprout (ms) */
  formationDurationMs: number;
  /** Duration of Stage 2: Branching tendril propagation & cellular wave expansion (ms) */
  expansionDurationMs: number;
  /** Duration of Stage 3: Wave envelopes viewport corners & locks new theme (ms) */
  revealDurationMs: number;
  /** Duration of Stage 4: Residual tendril & electric particle dissipation (ms) */
  dissipationDurationMs: number;
  /** Normalized progress point (0.0 - 1.0) where the underlying DOM theme class flips */
  domThemeSwitchThreshold: number;
  
  /** Visual appearance & color palette */
  colors: {
    /** Core luminous energy spark */
    coreGlow: string;
    /** Primary electric violet/magenta highlights */
    electricMagenta: string;
    electricViolet: string;
    electricPurple: string;
    electricCyan: string;
    electricWhite: string;
    /** Theme surface colors drawn inside the expanding organic boundary */
    darkSurface: string;
    lightSurface: string;
  };

  /** Tendril generation parameters */
  tendrils: {
    /** Number of primary branching tendrils sprouting from the core */
    count: number;
    /** Maximum branch depth (sub-tendrils splitting off) */
    maxBranchDepth: number;
    /** Base width of primary tendril trunks */
    baseWidth: number;
    /** Curvature frequency */
    curvatureFrequency: number;
    /** Tendril reach multiplier relative to current cellular radius */
    reachMultiplier: number;
  };

  /** Wave harmonic deformation parameters */
  waveHarmonics: {
    /** Multi-frequency harmonic counts */
    octaves: number;
    /** Radial noise amplitude */
    noiseAmplitude: number;
  };
}

export const THEME_TRANSITION_CONFIG: ThemeTransitionConfig = {
  // Total 6000ms (6.0 seconds), perfectly in the requested 5–7 second range
  totalDurationMs: 6000,
  formationDurationMs: 800,
  expansionDurationMs: 3400,
  revealDurationMs: 800,
  dissipationDurationMs: 1000,
  domThemeSwitchThreshold: 0.45,

  colors: {
    coreGlow: 'rgba(255, 255, 255, 0.95)',
    electricMagenta: '#d946ef',
    electricViolet: '#a855f7',
    electricPurple: '#7c3aed',
    electricCyan: '#38bdf8',
    electricWhite: '#fdf4ff',
    darkSurface: '#090b0f',
    lightSurface: '#F9FAFB',
  },

  tendrils: {
    count: 32,
    maxBranchDepth: 2,
    baseWidth: 3.5,
    curvatureFrequency: 0.08,
    reachMultiplier: 1.45,
  },

  waveHarmonics: {
    octaves: 5,
    noiseAmplitude: 0.16,
  },
};
