import { create } from 'zustand';

// Define explicit TypeScript types for your state structures
interface AppState {
  // Dimensions and Seeds
  regions: any[];
  countries: any[];
  waves: any[];
  blocks: any[];
  bricks: any[];
  
  // Matrix / Map States
  done: Record<string, boolean>;
  brickExcl: Record<string, boolean>;
  obstacles: any[];
  
  // Active Module Filters
  mod: string;
  m1Wave: string | null;
  
  // Actions (Mutators)
  setMod: (mod: string) => void;
  setM1Wave: (waveId: string) => void;
  toggleDone: (key: string) => void;
  setCountryAllDone: (keys: string[], value: boolean) => void;
  updateObstacle: (id: string, updatedFields: any) => void;
}

export const useStore = create<AppState>((set) => ({
  // Core Data Tables (Initial Seed States)
  regions: [], 
  countries: [],
  waves: [],
  blocks: [],
  bricks: [],
  
  // Heavy Operational Maps
  done: {},
  brickExcl: {},
  obstacles: [],
  
  // Navigation / Filters
  mod: 'm1',
  m1Wave: null,

  // Atomic Actions (No whole-app re-renders when executing)
  setMod: (mod) => set({ mod }),
  
  setM1Wave: (m1Wave) => set({ m1Wave }),
  
  toggleDone: (key) => set((state) => ({
    done: { ...state.done, [key]: !state.done[key] }
  })),

  setCountryAllDone: (keys, value) => set((state) => {
    const nextDone = { ...state.done };
    keys.forEach((k) => { nextDone[k] = value; });
    return { done: nextDone };
  }),

  updateObstacle: (id, updatedFields) => set((state) => ({
    obstacles: state.obstacles.map((o) => o.id === id ? { ...o, ...updatedFields } : o)
  }))
}));