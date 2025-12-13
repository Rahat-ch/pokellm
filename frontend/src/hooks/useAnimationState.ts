import { useState, useEffect, useRef, useCallback } from 'react';

export interface PokemonAnimationState {
  isSwitchingIn: boolean;
  isSwitchingOut: boolean;
  isAttacking: boolean;
  isTakingDamage: boolean;
  isFainting: boolean;
  effectType: 'super-effective' | 'crit' | 'resisted' | null;
}

const initialAnimationState: PokemonAnimationState = {
  isSwitchingIn: false,
  isSwitchingOut: false,
  isAttacking: false,
  isTakingDamage: false,
  isFainting: false,
  effectType: null,
};

interface AnimationEvent {
  target: 'p1' | 'p2';
  type: keyof PokemonAnimationState | 'effect';
  effectType?: 'super-effective' | 'crit' | 'resisted';
  duration: number;
}

// Animation durations in ms (should match CSS)
const ANIMATION_DURATIONS = {
  isSwitchingIn: 500,
  isSwitchingOut: 400,
  isAttacking: 300,
  isTakingDamage: 200,
  isFainting: 800,
  'super-effective': 300,
  crit: 300,
  resisted: 200,
};

/**
 * Parse a battle log line and return an animation event if applicable
 */
function parseAnimationFromLine(line: string): AnimationEvent | null {
  const parts = line.split('|');
  const cmd = parts[1];

  // Helper to extract player from identifier like "p1a: Pikachu"
  const getPlayer = (ident: string): 'p1' | 'p2' | null => {
    if (ident?.startsWith('p1')) return 'p1';
    if (ident?.startsWith('p2')) return 'p2';
    return null;
  };

  switch (cmd) {
    case 'switch':
    case 'drag': {
      // |switch|p1a: Pikachu|Pikachu, L84|100/100
      const player = getPlayer(parts[2]);
      if (player) {
        return {
          target: player,
          type: 'isSwitchingIn',
          duration: ANIMATION_DURATIONS.isSwitchingIn,
        };
      }
      break;
    }

    case 'move': {
      // |move|p1a: Pikachu|Thunderbolt|p2a: Charizard
      const player = getPlayer(parts[2]);
      if (player) {
        return {
          target: player,
          type: 'isAttacking',
          duration: ANIMATION_DURATIONS.isAttacking,
        };
      }
      break;
    }

    case '-damage': {
      // |-damage|p1a: Pikachu|Pokemon|45/100
      const player = getPlayer(parts[2]);
      if (player) {
        return {
          target: player,
          type: 'isTakingDamage',
          duration: ANIMATION_DURATIONS.isTakingDamage,
        };
      }
      break;
    }

    case 'faint': {
      // |faint|p1a: Pikachu
      const player = getPlayer(parts[2]);
      if (player) {
        return {
          target: player,
          type: 'isFainting',
          duration: ANIMATION_DURATIONS.isFainting,
        };
      }
      break;
    }

    case '-supereffective': {
      // |-supereffective|p1a: Pikachu
      const player = getPlayer(parts[2]);
      if (player) {
        return {
          target: player,
          type: 'effect',
          effectType: 'super-effective',
          duration: ANIMATION_DURATIONS['super-effective'],
        };
      }
      break;
    }

    case '-crit': {
      // |-crit|p1a: Pikachu
      const player = getPlayer(parts[2]);
      if (player) {
        return {
          target: player,
          type: 'effect',
          effectType: 'crit',
          duration: ANIMATION_DURATIONS.crit,
        };
      }
      break;
    }

    case '-resisted': {
      // |-resisted|p1a: Pikachu
      const player = getPlayer(parts[2]);
      if (player) {
        return {
          target: player,
          type: 'effect',
          effectType: 'resisted',
          duration: ANIMATION_DURATIONS.resisted,
        };
      }
      break;
    }
  }

  return null;
}

export function useAnimationState(log: string[]) {
  const [p1Animation, setP1Animation] = useState<PokemonAnimationState>(initialAnimationState);
  const [p2Animation, setP2Animation] = useState<PokemonAnimationState>(initialAnimationState);
  const lastProcessedIndex = useRef(0);
  const timeoutsRef = useRef<Map<string, NodeJS.Timeout>>(new Map());

  // Clear a specific animation after its duration
  const clearAnimation = useCallback((target: 'p1' | 'p2', type: keyof PokemonAnimationState) => {
    const setter = target === 'p1' ? setP1Animation : setP2Animation;
    setter((prev) => ({
      ...prev,
      [type]: type === 'effectType' ? null : false,
    }));
  }, []);

  // Trigger an animation
  const triggerAnimation = useCallback(
    (event: AnimationEvent) => {
      const setter = event.target === 'p1' ? setP1Animation : setP2Animation;
      const timeoutKey = `${event.target}-${event.type}`;

      // Clear any existing timeout for this animation
      const existingTimeout = timeoutsRef.current.get(timeoutKey);
      if (existingTimeout) {
        clearTimeout(existingTimeout);
      }

      // Set the animation state
      if (event.type === 'effect') {
        setter((prev) => ({
          ...prev,
          effectType: event.effectType || null,
        }));

        // Clear after duration
        const timeout = setTimeout(() => {
          setter((prev) => ({ ...prev, effectType: null }));
          timeoutsRef.current.delete(timeoutKey);
        }, event.duration);

        timeoutsRef.current.set(timeoutKey, timeout);
      } else {
        setter((prev) => ({
          ...prev,
          [event.type]: true,
        }));

        // Clear after duration
        const timeout = setTimeout(() => {
          clearAnimation(event.target, event.type as keyof PokemonAnimationState);
          timeoutsRef.current.delete(timeoutKey);
        }, event.duration);

        timeoutsRef.current.set(timeoutKey, timeout);
      }
    },
    [clearAnimation]
  );

  // Process new log entries
  useEffect(() => {
    const newEntries = log.slice(lastProcessedIndex.current);
    lastProcessedIndex.current = log.length;

    for (const line of newEntries) {
      const event = parseAnimationFromLine(line);
      if (event) {
        triggerAnimation(event);
      }
    }
  }, [log, triggerAnimation]);

  // Cleanup timeouts on unmount
  useEffect(() => {
    return () => {
      timeoutsRef.current.forEach((timeout) => clearTimeout(timeout));
      timeoutsRef.current.clear();
    };
  }, []);

  return { p1Animation, p2Animation };
}

/**
 * Convert animation state to CSS class names
 */
export function getAnimationClasses(
  animation: PokemonAnimationState,
  side: 'player' | 'opponent'
): string {
  const classes: string[] = [];

  if (animation.isSwitchingIn) classes.push('switching-in');
  if (animation.isSwitchingOut) classes.push('switching-out');
  if (animation.isAttacking) classes.push('attacking', side);
  if (animation.isTakingDamage) classes.push('taking-damage');
  if (animation.isFainting) classes.push('fainting');
  if (animation.effectType) classes.push(animation.effectType);

  return classes.join(' ');
}
