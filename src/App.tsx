/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useRef, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Upload, 
  Grid2X2, 
  Grid, 
  Layout, 
  Play, 
  Settings2, 
  Info, 
  Code2, 
  Trash2, 
  RefreshCw,
  FastForward,
  ChevronRight,
  Maximize2
} from 'lucide-react';
import { VisionOperation, PanelState } from './types';
import { OPERATION_DESCRIPTIONS, CODE_SNIPPETS } from './constants';
import { 
  getBinaryData, 
  applyMorphology, 
  skeletonize, 
  skeletonizeStep,
  getConvexHull, 
  getPointsFromBinary, 
  drawHullOnGrid,
  detectCorners
} from './lib/vision-algorithms';

// --- Components ---

const Header = () => (
  <header className="border-b border-white/10 bg-[#111] p-4 flex justify-between items-center shrink-0">
    <div className="flex items-center gap-3">
      <div className="w-8 h-8 bg-yellow-400 flex items-center justify-center rounded">
        <Grid size={18} className="text-black" />
      </div>
      <div>
        <h1 className="text-lg font-black tracking-tighter uppercase italic">MorphoVision Lab</h1>
        <p className="text-[9px] font-bold opacity-60 uppercase tracking-[0.2em]">Structural Intelligence Terminal</p>
      </div>
    </div>
    <div className="flex gap-4">
      <div className="bg-[#222] text-white/50 px-3 py-1 font-mono text-[9px] border border-white/5 rounded">
        BUILD v1.0.5 - OPS_READY
      </div>
    </div>
  </header>
);

const IconButton = ({ icon: Icon, onClick, active = false, label = "", primary = false }: { icon: any, onClick: () => void, active?: boolean, label?: string, primary?: boolean }) => (
  <button 
    onClick={onClick}
    title={label}
    className={`p-2 px-4 font-black uppercase text-[10px] transition-all transform active:scale-95 disabled:opacity-30 flex items-center gap-2
      ${primary ? 'bg-yellow-400 text-black hover:bg-yellow-300' : 
        active ? 'bg-white text-black' : 'bg-[#222] text-white hover:bg-[#333] border border-white/5'}
    `}
  >
    <Icon size={14} />
    {label && <span className="hidden sm:inline">{label}</span>}
  </button>
);

export default function App() {
  const [panels, setPanels] = useState<PanelState[]>([
    { 
      id: '1', 
      image: null, 
      operation: VisionOperation.EROSION, 
      params: { kernelSize: 3, threshold: 128, scales: 3, speed: 50 },
      isPlaying: false,
      isComplete: false
    }
  ]);
  const [layoutMode, setLayoutMode] = useState<1 | 2 | 4>(1);
  const [isSyncMode, setIsSyncMode] = useState(false);

  const addPanel = () => {
    if (panels.length < 4) {
      setPanels([...panels, { 
        id: Math.random().toString(36).substr(2, 9), 
        image: null, 
        operation: VisionOperation.EROSION, 
        params: { ...panels[0].params },
        isPlaying: false,
        isComplete: false
      }]);
    }
  };

  const removePanel = (id: string) => {
    if (panels.length > 1) {
      setPanels(panels.filter(p => p.id !== id));
    }
  };

  const updatePanel = (id: string, updates: { 
    image?: string | null, 
    operation?: VisionOperation, 
    params?: Partial<import('./types').PanelParams>,
    isPlaying?: boolean,
    isComplete?: boolean,
    lastResult?: number[][] | null
  }) => {
    setPanels(current => current.map(p => {
      if (p.id === id) {
        let newPanel = { ...p, ...updates };
        if (updates.params) {
          newPanel.params = { ...p.params, ...updates.params };
        }
        return newPanel as any;
      }
      
      if (isSyncMode) {
        let syncedPanel = { ...p, ...updates };
        if (updates.params) {
          syncedPanel.params = { ...p.params, ...updates.params };
        }
        return { ...syncedPanel, id: p.id, image: p.image } as any;
      }
      
      return p;
    }));
  };

  const syncAllImages = (image: string | null) => {
    if (isSyncMode) {
      setPanels(current => current.map(p => ({ ...p, image, isComplete: false, isPlaying: false })));
    }
  };

  return (
    <div className="min-h-screen bg-neutral-100 font-sans text-black flex flex-col">
      <Header />
      
      <main className="flex-1 p-6 flex flex-col gap-6">
        {/* Global Toolbar */}
        <div className="flex flex-wrap items-center justify-between gap-4 bg-white border-4 border-black p-4 shadow-[8px_8px_0px_0px_rgba(0,0,0,1)]">
          <div className="flex gap-4 items-center">
            <span className="font-bold text-sm uppercase tracking-widest text-zinc-400">Layout</span>
            <IconButton icon={Maximize2} onClick={() => setLayoutMode(1)} active={layoutMode === 1} label="Single" />
            <IconButton icon={Grid2X2} onClick={() => setLayoutMode(2)} active={layoutMode === 2} label="Split" />
            <IconButton icon={Grid} onClick={() => setLayoutMode(4)} active={layoutMode === 4} label="Grid" />
          </div>

          <div className="flex gap-4 items-center">
            <div className="h-8 w-px bg-zinc-200 mx-2" />
            <span className="font-bold text-sm uppercase tracking-widest text-zinc-400">Sync Controls</span>
            <IconButton icon={RefreshCw} onClick={() => setIsSyncMode(!isSyncMode)} active={isSyncMode} label="Toggle Sync Mode" />
            <IconButton icon={Upload} onClick={addPanel} label="Add Analysis Panel" />
          </div>
        </div>

        {/* Panel Grid */}
        <div className={`grid gap-6 flex-1 items-start ${
          layoutMode === 1 ? 'grid-cols-1 max-w-7xl mx-auto w-full' : 
          layoutMode === 2 ? 'grid-cols-1 lg:grid-cols-2' : 
          'grid-cols-1 md:grid-cols-2 xl:grid-cols-2'
        }`}>
          <AnimatePresence mode="popLayout">
            {panels.map((panel) => (
              <motion.div
                key={panel.id}
                layout
                initial={{ opacity: 0, scale: 0.9, y: 20 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.9, y: 20 }}
                transition={{ type: 'spring', damping: 20, stiffness: 300 }}
              >
                <VisionPanel 
                  panel={panel} 
                  onUpdate={(updates) => {
                    updatePanel(panel.id, updates);
                    if (updates.image !== undefined) syncAllImages(updates.image);
                  }}
                  onRemove={() => removePanel(panel.id)}
                  canRemove={panels.length > 1}
                />
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      </main>

      <footer className="p-4 bg-black text-white text-center text-xs font-mono uppercase tracking-[0.2em]">
        Experimental Visualization &copy; 2024 - MorphoVision Structural Lab
      </footer>
    </div>
  );
}

function VisionPanel({ panel, onUpdate, onRemove, canRemove }: { 
  panel: PanelState & { lastResult?: number[][] | null }, 
  onUpdate: (u: { 
    image?: string | null, 
    operation?: VisionOperation, 
    params?: Partial<import('./types').PanelParams>,
    isPlaying?: boolean,
    isComplete?: boolean,
    lastResult?: number[][] | null
  }) => void,
  onRemove: () => void,
  canRemove: boolean
}) {
  const [activeTab, setActiveTab] = useState<'visual' | 'explain' | 'code'>('visual');
  const [showDetails, setShowDetails] = useState(true);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [originalSource, setOriginalSource] = useState<string | null>(panel.image);

  useEffect(() => {
    if (panel.image && !originalSource) {
      setOriginalSource(panel.image);
    }
  }, [panel.image]);

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (ev) => {
        const data = ev.target?.result as string;
        setOriginalSource(data);
        onUpdate({ image: data, isComplete: false, isPlaying: false, lastResult: null });
      };
      reader.readAsDataURL(file);
    }
  };

  const togglePlayback = () => {
    if (panel.isComplete) {
      onUpdate({ isPlaying: true, isComplete: false });
    } else {
      onUpdate({ isPlaying: !panel.isPlaying });
    }
  };

  const resetPanel = () => {
    onUpdate({ isPlaying: false, isComplete: false, lastResult: null });
  };

  const resetToOriginal = () => {
    if (originalSource) {
      onUpdate({ image: originalSource, isComplete: false, isPlaying: false, lastResult: null });
    }
  };

  const handleCommit = (result: number[][]) => {
    const canvas = document.createElement('canvas');
    canvas.width = result[0].length;
    canvas.height = result.length;
    const ctx = canvas.getContext('2d')!;
    const imageData = ctx.createImageData(canvas.width, canvas.height);
    for (let y = 0; y < canvas.height; y++) {
      for (let x = 0; x < canvas.width; x++) {
        const val = result[y][x] === 1 ? 255 : 0;
        const idx = (y * canvas.width + x) * 4;
        imageData.data[idx] = val;
        imageData.data[idx+1] = val;
        imageData.data[idx+2] = val;
        imageData.data[idx+3] = 255;
      }
    }
    ctx.putImageData(imageData, 0, 0);
    onUpdate({ image: canvas.toDataURL(), isComplete: false, isPlaying: false, lastResult: null });
  };

  return (
    <div className="bg-[#111] flex flex-col h-[90vh] min-h-[600px] overflow-hidden rounded-lg border border-white/10 relative shadow-2xl">
      {/* Top Bar */}
      <div className="bg-[#1a1a1a] p-3 flex justify-between items-center shrink-0 border-b border-white/10">
        <div className="flex gap-4 items-center">
          <div className="flex gap-1.5">
            <div className={`w-1.5 h-1.5 rounded-full ${panel.isPlaying ? 'bg-yellow-400 animate-pulse' : 'bg-zinc-600'}`} />
            <div className="w-1.5 h-1.5 rounded-full bg-zinc-800" />
            <div className="w-1.5 h-1.5 rounded-full bg-zinc-800" />
          </div>
          <span className="text-[10px] font-black uppercase text-white tracking-widest flex items-center gap-2">
            Signal Processor <span className="text-zinc-600">|</span> <span className="text-yellow-400/80">{panel.operation}</span>
          </span>
        </div>
        <div className="flex gap-4 items-center">
          <button 
            onClick={() => setShowDetails(!showDetails)} 
            className="flex items-center gap-2 text-[9px] font-black uppercase text-zinc-500 hover:text-white transition-all hover:tracking-widest"
          >
            {showDetails ? 'Minimize HUD' : 'Telemetery'}
          </button>
          {canRemove && (
            <button onClick={onRemove} className="text-zinc-600 hover:text-red-500 transition-colors">
              <Trash2 size={12} />
            </button>
          )}
        </div>
      </div>

      <div className="flex flex-1 overflow-hidden">
        {/* Main Interface */}
        <div className="flex-1 flex flex-col min-w-0">
          <div className="flex-1 workspace group relative overflow-hidden">
            {panel.image ? (
              <VisualizerEngine 
                panel={panel} 
                onComplete={(result) => onUpdate({ isComplete: true, isPlaying: false, lastResult: result })}
              />
            ) : (
              <div 
                className="absolute inset-0 flex flex-col items-center justify-center p-8 cursor-pointer hover:bg-zinc-800 transition-colors"
                onClick={() => fileInputRef.current?.click()}
              >
                <div className="w-16 h-16 border-2 border-dashed border-zinc-700 flex items-center justify-center mb-4 group-hover:border-yellow-400 transition-colors">
                  <Upload size={24} className="text-zinc-700 group-hover:text-yellow-400" />
                </div>
                <p className="text-xs font-black uppercase tracking-widest text-zinc-500 group-hover:text-white text-center">Import Primary Signal</p>
              </div>
            )}
            <input type="file" ref={fileInputRef} hidden onChange={handleImageUpload} accept="image/*" />
          </div>

          <div className="comparison-area bg-[#0a0a0a]">
            {panel.image && (
              <>
                <div className="flex flex-col items-center gap-1">
                  <span className="text-[8px] font-black text-zinc-600 uppercase">Input Buffer</span>
                  <div className="w-40 h-20 bg-black border border-white/5 flex items-center justify-center overflow-hidden rounded">
                    <img src={originalSource || ''} className="max-w-full max-h-full image-render-pixel opacity-50 contrast-125" />
                  </div>
                </div>
                <div className="flex flex-col items-center gap-1">
                  <span className="text-[8px] font-black text-zinc-600 uppercase">Processing State</span>
                  <div className="w-40 h-20 bg-black border border-white/5 flex items-center justify-center overflow-hidden rounded relative">
                    {panel.isComplete ? (
                      <img src={panel.image} className="max-w-full max-h-full image-render-pixel" />
                    ) : (
                      <div className="text-zinc-800 animate-pulse"><Info size={16} /></div>
                    )}
                  </div>
                </div>
              </>
            )}
          </div>

          {/* Controls Bar */}
          <div className="controls-bar">
            <select 
              value={panel.operation}
              onChange={(e) => onUpdate({ operation: e.target.value as VisionOperation, isComplete: false, isPlaying: false })}
              className="bg-[#222] border border-white/10 rounded px-3 py-1.5 font-black text-[10px] uppercase text-white cursor-pointer hover:bg-[#333] transition-colors"
            >
              {Object.values(VisionOperation).map(op => (
                <option key={op} value={op}>{op}</option>
              ))}
            </select>
            
            <div className="flex gap-2">
              <IconButton 
                icon={panel.isPlaying ? (p: any) => <div className="flex gap-1"><div className="w-1 h-3 bg-current" /><div className="w-1 h-3 bg-current" /></div> : Play} 
                onClick={togglePlayback} 
                active={panel.isPlaying} 
                label={panel.isPlaying ? "Pause" : "Play"} 
              />
              <IconButton 
                icon={RefreshCw} 
                onClick={resetPanel} 
                label="Step" 
              />
              <IconButton 
                icon={Trash2} 
                onClick={() => onUpdate({ image: null, lastResult: null, isPlaying: false, isComplete: false })}
                label="Clear"
              />
            </div>

            <div className="flex-1 flex items-center gap-4 max-w-xs px-2">
              <span className="text-[8px] font-black text-zinc-500 uppercase whitespace-nowrap min-w-[50px]">
                Kernel
              </span>
              <input 
                type="range" 
                min="3" 
                max="21"
                step="2"
                value={panel.params.kernelSize}
                onChange={(e) => onUpdate({ params: { kernelSize: parseFloat(e.target.value) }, isComplete: false, isPlaying: false })}
                className="flex-1 accent-yellow-400"
              />
              <span className="text-[10px] font-mono text-zinc-400">{panel.params.kernelSize}px</span>
            </div>

            <div className="flex flex-col gap-0.5 min-w-[80px]">
              <span className="text-[7px] font-black text-zinc-500 uppercase">Process Speed</span>
              <input 
                type="range" min="1" max="100"
                value={panel.params.speed}
                onChange={(e) => onUpdate({ params: { speed: parseInt(e.target.value) } })}
                className="flex-1 accent-yellow-400 h-1"
              />
            </div>

            {panel.isComplete && panel.lastResult && (
              <IconButton 
                icon={ChevronRight} 
                onClick={() => handleCommit(panel.lastResult!)} 
                primary 
                label="Commit → Buffer" 
              />
            )}
            
            <IconButton 
              icon={Layout} 
              onClick={resetToOriginal} 
              label="Source" 
            />
          </div>
        </div>

        {/* Sidebar */}
        {showDetails && (
          <div className="side-panel">
            <div className="p-4 space-y-6 overflow-y-auto scroll-hide">
              <div className="flex gap-1 border-b border-white/10 pb-2">
                <button onClick={() => setActiveTab('visual')} className={`flex-1 text-[9px] font-black uppercase p-2 rounded transition-all ${activeTab === 'visual' ? 'bg-yellow-400 text-black' : 'text-zinc-500'}`}>Stats</button>
                <button onClick={() => setActiveTab('explain')} className={`flex-1 text-[9px] font-black uppercase p-2 rounded transition-all ${activeTab === 'explain' ? 'bg-yellow-400 text-black' : 'text-zinc-500'}`}>Theory</button>
                <button onClick={() => setActiveTab('code')} className={`flex-1 text-[9px] font-black uppercase p-2 rounded transition-all ${activeTab === 'code' ? 'bg-yellow-400 text-black' : 'text-zinc-500'}`}>Logic</button>
              </div>

              {activeTab === 'visual' && (
                <div className="space-y-4">
                  <StatCard label="Pipeline State" value={panel.isPlaying ? "Processing..." : panel.isComplete ? "Sync Complete" : "Idle"} />
                  <StatCard 
                    label="Spatial Neighborhood" 
                    value={`${panel.params.kernelSize}px Window`} 
                  />
                  <StatCard 
                    label="Compute Mode" 
                    value={[VisionOperation.CORNER_DETECTION, VisionOperation.CONVEX_HULL].includes(panel.operation) ? "Feature Analysis" : "Pixel Mutation"} 
                  />

                  <div className="hud-panel !bg-white/5 border-none p-3 space-y-3">
                    <h4 className="hud-label tracking-tighter">Bitmask Analysis</h4>
                    <div className="grid grid-cols-5 gap-1">
                      {Array.from({ length: 25 }).map((_, i) => (
                        <div key={i} className={`aspect-square rounded-sm transition-all duration-700 ${Math.random() > 0.7 ? 'bg-white/20' : 'bg-white/5'}`} />
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {activeTab === 'explain' && (
                <div className="space-y-4">
                  <div className="bg-[#222] p-3 rounded border border-white/5">
                    <p className="text-[10px] leading-relaxed text-zinc-400 italic">
                      {OPERATION_DESCRIPTIONS[panel.operation]}
                    </p>
                  </div>
                  <AlgorithmLogicVisualizer panel={panel} />
                </div>
              )}

              {activeTab === 'code' && (
                <div className="space-y-4">
                   <div className="bg-black p-3 rounded-lg border border-white/5 font-mono">
                    <span className="text-[8px] text-zinc-600 block mb-2">OP_CODE_LOGIC: {panel.operation}</span>
                    <pre className="text-[9px] text-yellow-400/80 whitespace-pre-wrap overflow-x-hidden leading-tight">
                      {CODE_SNIPPETS[panel.operation].js.substring(0, 300)}...
                    </pre>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function StatCard({ label, value }: { label: string, value: string }) {
  return (
    <div className="bg-black/40 border border-white/5 p-3 rounded-lg group transition-colors hover:bg-black/60">
      <span className="text-[9px] font-black text-zinc-500 uppercase block tracking-[0.1em]">{label}</span>
      <span className="text-xs font-bold truncate block text-zinc-200 mt-1">{value}</span>
    </div>
  );
}

function MatrixVisualizer({ panel }: { panel: PanelState }) {
  const isErosion = panel.operation === VisionOperation.EROSION;
  const isDilation = panel.operation === VisionOperation.DILATION;
  
  const matrix = [
    [0, 1, 0],
    [1, 1, 0],
    [0, 0, 0]
  ];

  const res = isErosion 
    ? [[0, 0, 0], [0, 0, 0], [0, 0, 0]] // Shrinks
    : [[1, 1, 1], [1, 1, 1], [1, 1, 0]]; // Expands

  const label = isErosion ? "Intersection" : "Union";
  const opSymbol = isErosion ? "∩" : "∪";
  const color = isErosion ? "text-blue-400" : "text-yellow-400";

  return (
    <div className="space-y-4 pt-4 border-t border-white/10">
      <div className="flex justify-between items-center">
        <h3 className="font-black uppercase text-[9px] text-zinc-500 tracking-widest">{label} Logic</h3>
        <span className={`text-[8px] font-mono ${color} font-black`}>{isErosion ? "MIN(Neighborhood)" : "MAX(Neighborhood)"}</span>
      </div>
      <div className="flex items-center justify-between gap-1 overflow-visible">
        <MatrixBox label="Input" data={matrix} />
        <div className="text-zinc-600 font-black text-xs">{opSymbol}</div>
        <MatrixBox label="Kernel" data={[[1,1,1],[1,1,1],[1,1,1]]} highlighted />
        <div className="text-zinc-600 font-black">→</div>
        <MatrixBox label="Result" data={res} />
      </div>
      <p className="text-[9px] text-zinc-500 italic leading-snug">
        {isErosion 
          ? "Foreground only if the kernel is entirely contained within the object. Result: Shrinks boundaries." 
          : "Foreground if the kernel has any intersection with the object. Result: Expands boundaries."}
      </p>
    </div>
  );
}

function TwoStepMorphologyVisualizer({ panel }: { panel: PanelState }) {
  const isOpening = panel.operation === VisionOperation.OPENING;
  
  return (
    <div className="space-y-4 pt-4 border-t border-white/10">
      <h3 className="font-black uppercase text-[9px] text-zinc-500 tracking-widest">
        {isOpening ? 'Process: Opening (Erode → Dilate)' : 'Process: Closing (Dilate → Erode)'}
      </h3>
      <div className="flex items-center justify-between gap-1 px-2">
        <div className="flex flex-col items-center gap-1">
          <span className="text-[7px] font-black uppercase text-zinc-600">Start</span>
          <div className="w-10 h-10 bg-white/5 border border-white/10 flex items-center justify-center relative">
            <div className="w-4 h-4 bg-yellow-400/80" />
            <div className={`w-1 h-1 bg-yellow-400/80 absolute ${isOpening ? 'top-1 left-1' : 'top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 !bg-zinc-900 rounded-full'}`} />
          </div>
        </div>
        <div className="text-zinc-700">→</div>
        <div className="flex flex-col items-center gap-1">
          <span className="text-[7px] font-black uppercase text-zinc-600">{isOpening ? 'Erode' : 'Dilate'}</span>
          <div className="w-10 h-10 bg-white/5 border border-white/10 flex items-center justify-center">
            <div style={{ width: isOpening ? '4px' : '24px', height: isOpening ? '4px' : '24px' }} className="bg-yellow-400/80" />
          </div>
        </div>
        <div className="text-zinc-700">→</div>
        <div className="flex flex-col items-center gap-1">
          <span className="text-[7px] font-black uppercase text-zinc-600">Finish</span>
          <div className="w-10 h-10 bg-yellow-400/10 border border-yellow-400/30 flex items-center justify-center">
            <div className="w-4 h-4 bg-yellow-400/80" />
          </div>
        </div>
      </div>
      <p className="text-[9px] text-zinc-500 italic leading-snug">
        {isOpening 
          ? "Step 1 removes noise (dots). Step 2 restores the main object to its original size." 
          : "Step 1 bridges small gaps/holes. Step 2 refines the object boundaries."}
      </p>
    </div>
  );
}

function MatrixBox({ label, data, highlighted }: { label: string, data: number[][], highlighted?: boolean }) {
  return (
    <div className="text-center">
      <span className="text-[7px] font-black uppercase mb-1 block text-zinc-600 tracking-tighter">{label}</span>
      <div className={`p-0.5 grid grid-cols-3 gap-0.5 rounded-sm ${highlighted ? 'bg-zinc-800 border border-yellow-400/50' : 'bg-white/5'}`}>
        {data.flat().map((v, i) => (
          <div key={i} className={`w-3 h-3 rounded-[1px] ${v === 1 ? (highlighted ? 'bg-yellow-400' : 'bg-yellow-400/80') : 'bg-transparent'}`} />
        ))}
      </div>
    </div>
  );
}

function AlgorithmLogicVisualizer({ panel }: { panel: PanelState }) {
  // Simple Morphology
  if (panel.operation === VisionOperation.EROSION || panel.operation === VisionOperation.DILATION) {
    return <MatrixVisualizer panel={panel} />;
  }

  // Compound Morphology
  if (panel.operation === VisionOperation.OPENING || panel.operation === VisionOperation.CLOSING) {
    return <TwoStepMorphologyVisualizer panel={panel} />;
  }

  // Skeletonization logic
  if (panel.operation === VisionOperation.SKELETONIZATION) {
    return (
      <div className="p-4 bg-white/5 rounded-lg border border-white/5 space-y-4">
        <h3 className="text-[9px] font-black uppercase text-zinc-500 tracking-widest">Iterative Thinning</h3>
        <div className="flex justify-between items-center px-4">
          <div className="w-10 h-10 bg-zinc-700 rounded-sm" />
          <div className="text-zinc-700">→</div>
          <div className="w-10 h-10 bg-zinc-700 rounded-sm overflow-hidden flex items-center justify-center">
             <div className="w-6 h-6 border-4 border-black" />
          </div>
          <div className="text-zinc-700">→</div>
          <div className="w-10 h-10 flex items-center justify-center">
             <div className="w-4 h-4 border-2 border-yellow-400 bg-yellow-400/20" />
          </div>
        </div>
        <p className="text-[9px] text-zinc-500 italic">Successive erosion layers are removed until only a single-pixel topological branch remains.</p>
      </div>
    );
  }

  // Convex Hull logic
  if (panel.operation === VisionOperation.CONVEX_HULL) {
    return (
      <div className="p-4 bg-white/5 rounded-lg border border-white/5 space-y-4">
        <h3 className="text-[9px] font-black uppercase text-zinc-500 tracking-widest">Set Boundary Construction</h3>
        <div className="relative h-20 w-full flex items-center justify-center">
          <div className="absolute w-24 h-16 border-2 border-yellow-400/50 rounded-[40%] rotate-12" />
          <div className="flex gap-4">
            <div className="w-1.5 h-1.5 bg-yellow-400 rounded-full" />
            <div className="w-1.5 h-1.5 bg-yellow-400 rounded-full" />
            <div className="w-1.5 h-1.5 bg-yellow-400 rounded-full" />
          </div>
        </div>
        <p className="text-[9px] text-zinc-500 italic">A "rubber band" algorithm wraps around the outermost points of the feature set.</p>
      </div>
    );
  }

  // Corner Detection logic
  if (panel.operation === VisionOperation.CORNER_DETECTION) {
    return (
      <div className="p-4 bg-white/5 rounded-lg border border-white/5 space-y-4">
        <h3 className="text-[9px] font-black uppercase text-zinc-500 tracking-widest">Eigenvalue Analysis</h3>
        <div className="flex items-center justify-center p-4 border border-zinc-800 rounded bg-black/40">
           <div className="w-16 h-16 grid grid-cols-2 gap-2">
             <div className="border border-zinc-600 bg-zinc-800" />
             <div className="border border-zinc-600" />
             <div className="border border-zinc-600" />
             <div className="border border-zinc-600 bg-zinc-800" />
           </div>
        </div>
        <p className="text-[9px] text-zinc-500 italic">Finding points where intensity changes significantly in two orthogonal directions (eigenvalues λ1, λ2 are large).</p>
      </div>
    );
  }

  return <MatrixVisualizer panel={panel} />;
}

// --- Animation Engine
function VisualizerEngine({ panel, onComplete }: { panel: PanelState, onComplete: (result: number[][]) => void }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const inputDataRef = useRef<number[][] | null>(null);
  const workingRef = useRef<number[][] | null>(null);
  const featuresRef = useRef<{
    hull?: any[];
    corners?: any[];
  }>({});
  const [zoom, setZoom] = useState(12); 
  const [kernelPos, setKernelPos] = useState({ x: 0, y: 0 });
  const [isFollowMode, setIsFollowMode] = useState(false);
  const [isReady, setIsReady] = useState(false);
  const [frameId, setFrameId] = useState(0); // For forcing re-renders if needed

  const getSimParams = () => {
    const stepSize = Math.max(1, Math.floor(1 + (panel.params.speed / 100) * 80));
    const delay = Math.max(0, 100 - (panel.params.speed / 100) * 100);
    return { stepSize, delay };
  };

  // Initialize Data
  useEffect(() => {
    if (!panel.image) {
      setIsReady(false);
      return;
    }
    
    // Explicitly set not ready while loading new image
    setIsReady(false);
    
    const img = new Image();
    img.src = panel.image;
    img.onload = () => {
      const res = 100; 
      const cvs = document.createElement('canvas');
      const ctx = cvs.getContext('2d')!;
      cvs.width = res;
      cvs.height = res;

      // Draw image centered in the pixel grid
      const scale = Math.min(res / img.width, res / img.height);
      const w = img.width * scale;
      const h = img.height * scale;
      ctx.fillStyle = 'black'; // background
      ctx.fillRect(0, 0, res, res);
      ctx.drawImage(img, (res - w) / 2, (res - h) / 2, w, h);

      const imageData = ctx.getImageData(0, 0, res, res);
      const bin = getBinaryData(imageData.data, res, res, 128);
      
      inputDataRef.current = bin;
      workingRef.current = bin.map(row => [...row]);
      
      // Pre-calculate stable features
      featuresRef.current = {
        hull: getConvexHull(getPointsFromBinary(bin)),
        corners: detectCorners(bin)
      };

      setKernelPos({ x: 0, y: 0 });
      setIsReady(true);
    };
  }, [panel.image]);

  // Simulation Loop
  useEffect(() => {
    if (!panel.isPlaying || !inputDataRef.current || !workingRef.current || panel.isComplete) return;

    let timeoutId: any;
    const { stepSize, delay } = getSimParams();

    const isKernelOp = [
      VisionOperation.EROSION, 
      VisionOperation.DILATION, 
      VisionOperation.OPENING, 
      VisionOperation.CLOSING
    ].includes(panel.operation);

    if (isKernelOp) {
      const applyOp = (x: number, y: number) => {
        const kSize = panel.params.kernelSize;
        const offset = Math.floor(kSize / 2);
        const img = inputDataRef.current!;
        const h = img.length;
        const w = img[0].length;
        
        // Handle Opening/Closing as two-pass but for visualization we do one pass
        let isErosion = (panel.operation === VisionOperation.EROSION || panel.operation === VisionOperation.OPENING);
        let match = isErosion;
        
        for (let ky = -offset; ky <= offset; ky++) {
          for (let kx = -offset; kx <= offset; kx++) {
            const ny = y + ky;
            const nx = x + kx;
            if (ny >= 0 && ny < h && nx >= 0 && nx < w) {
              const val = img[ny][nx];
              if (isErosion) { if (val === 0) match = false; }
              else { if (val === 1) match = true; }
            } else if (isErosion) { match = false; }
          }
        }
        return match ? 1 : 0;
      };

      const step = () => {
        let currentX = kernelPos.x;
        let currentY = kernelPos.y;
        for (let k = 0; k < stepSize; k++) {
          workingRef.current![currentY][currentX] = applyOp(currentX, currentY);
          currentX++;
          if (currentX >= inputDataRef.current![0].length) {
            currentX = 0;
            currentY++;
          }
          if (currentY >= inputDataRef.current!.length) {
            if (panel.operation === VisionOperation.OPENING || panel.operation === VisionOperation.CLOSING) {
              const final = applyMorphology(inputDataRef.current!, panel.operation, panel.params.kernelSize);
              workingRef.current = final;
            }
            onComplete(workingRef.current!);
            return;
          }
        }
        setKernelPos({ x: currentX, y: currentY });
        timeoutId = setTimeout(step, delay);
      };
      timeoutId = setTimeout(step, delay);
    } 
    else if (panel.operation === VisionOperation.SKELETONIZATION) {
      // Iterative thinning simulation
      const step = () => {
        const { grid, changed } = skeletonizeStep(workingRef.current!);
        workingRef.current = grid;
        setFrameId(f => f + 1);
        if (!changed) {
          onComplete(workingRef.current!);
          return;
        }
        timeoutId = setTimeout(step, Math.max(50, 400 - panel.params.speed * 4));
      };
      timeoutId = setTimeout(step, 50);
    }
    else {
      // Feature algorithms (SIFT, Hull, etc)
      const step = () => {
        let currentX = kernelPos.x;
        let currentY = kernelPos.y;
        
        const multiplier = 12; 
        for (let k = 0; k < stepSize * multiplier; k++) {
          currentX++;
          if (currentX >= inputDataRef.current![0].length) {
            currentX = 0;
            currentY++;
          }
          if (currentY >= inputDataRef.current!.length) {
            onComplete(workingRef.current!);
            return;
          }
        }
        setKernelPos({ x: currentX, y: currentY });
        timeoutId = setTimeout(step, delay);
      };
      timeoutId = setTimeout(step, delay);
    }

    return () => clearTimeout(timeoutId);
  }, [panel.isPlaying, panel.isComplete, panel.params.speed, kernelPos, panel.operation, panel.params.kernelSize]);

  // Master Render Engine
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !inputDataRef.current || !workingRef.current || !isReady) return;
    const ctx = canvas.getContext('2d')!;

    // Ensure canvas dimension matches client display area
    canvas.width = canvas.clientWidth;
    canvas.height = canvas.clientHeight;
    
    const w = canvas.width;
    const h = canvas.height;
    if (w === 0 || h === 0) return;

    const gridW = inputDataRef.current[0].length;
    const gridH = inputDataRef.current.length;

    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.imageSmoothingEnabled = false;
    ctx.fillStyle = '#0a0a0a';
    ctx.fillRect(0, 0, w, h);

    if (!panel.image) return;

    // Calculate Offset (Fixed or Following)
    const scaledWidth = gridW * zoom;
    const scaledHeight = gridH * zoom;

    let offsetX = (w - scaledWidth) / 2;
    let offsetY = (h - scaledHeight) / 2;

    if (isFollowMode) {
      offsetX = w / 2 - kernelPos.x * zoom;
      offsetY = h / 2 - kernelPos.y * zoom;
    }

    // Render to Offscreen Buffer for Clean Scaling
    const tempBuffer = document.createElement('canvas');
    tempBuffer.width = gridW;
    tempBuffer.height = gridH;
    const tCtx = tempBuffer.getContext('2d')!;
    const tData = tCtx.createImageData(gridW, gridH);

    for (let y = 0; y < gridH; y++) {
      for (let x = 0; x < gridW; x++) {
        const idx = (y * gridW + x) * 4;
        const outVal = workingRef.current[y][x];
        const inVal = inputDataRef.current[y][x];

        if (outVal === 1) {
          tData.data[idx] = 250;     // Morpho Gold
          tData.data[idx+1] = 204;
          tData.data[idx+2] = 21;
          tData.data[idx+3] = 255;
        } else if (inVal === 1) {
          tData.data[idx] = 100;     // Dark Ghost Frame
          tData.data[idx+1] = 100;
          tData.data[idx+2] = 100;
          tData.data[idx+3] = panel.isComplete ? 30 : 60; 
        } else {
          tData.data[idx+3] = 0;
        }
      }
    }
    tCtx.putImageData(tData, 0, 0);

    // Draw Scanned Image
    ctx.drawImage(tempBuffer, offsetX, offsetY, scaledWidth, scaledHeight);

    // Overlay Grid lines
    if (zoom > 12) {
      ctx.strokeStyle = 'rgba(255,255,255,0.03)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      for (let x = 0; x <= gridW; x++) {
        ctx.moveTo(offsetX + x * zoom, offsetY);
        ctx.lineTo(offsetX + x * zoom, offsetY + gridH * zoom);
      }
      for (let y = 0; y <= gridH; y++) {
        ctx.moveTo(offsetX, offsetY + y * zoom);
        ctx.lineTo(offsetX + gridW * zoom, offsetY + y * zoom);
      }
      ctx.stroke();
    }

    // Highlight Scanning Kernel
    const isKernelOp = [
      VisionOperation.EROSION, 
      VisionOperation.DILATION, 
      VisionOperation.OPENING, 
      VisionOperation.CLOSING
    ].includes(panel.operation);

    if (isKernelOp && !panel.isComplete) {
      const kSize = panel.params.kernelSize;
      const kOffset = Math.floor(kSize / 2);
      
      // Scanner Fill
      ctx.fillStyle = 'rgba(250, 204, 21, 0.15)';
      ctx.fillRect(
        offsetX + (kernelPos.x - kOffset) * zoom, 
        offsetY + (kernelPos.y - kOffset) * zoom, 
        kSize * zoom, 
        kSize * zoom
      );
      
      // Scanner Border
      ctx.strokeStyle = '#facc15';
      ctx.lineWidth = 1;
      ctx.strokeRect(
        offsetX + (kernelPos.x - kOffset) * zoom, 
        offsetY + (kernelPos.y - kOffset) * zoom, 
        kSize * zoom, 
        kSize * zoom
      );
      
      // Precision Crosshair
      ctx.strokeStyle = 'white';
      ctx.beginPath();
      ctx.moveTo(offsetX + kernelPos.x * zoom, offsetY + kernelPos.y * zoom - 10);
      ctx.lineTo(offsetX + kernelPos.x * zoom, offsetY + kernelPos.y * zoom + zoom + 10);
      ctx.moveTo(offsetX + kernelPos.x * zoom - 10, offsetY + kernelPos.y * zoom);
      ctx.lineTo(offsetX + kernelPos.x * zoom + zoom + 10, offsetY + kernelPos.y * zoom);
      ctx.stroke();
    }

    // Global Operation Visualizations
    if (panel.isComplete || !isKernelOp) {
      // Ensure we draw the detected features even during simulation for feature algorithms
      if (panel.operation === VisionOperation.CONVEX_HULL) {
        ctx.strokeStyle = '#facc15';
        ctx.lineWidth = 2;
        const hull = featuresRef.current.hull || [];
        if (hull.length > 2) {
          ctx.beginPath();
          ctx.moveTo(offsetX + hull[0].x * zoom + zoom/2, offsetY + hull[0].y * zoom + zoom/2);
          for(let i=1; i<hull.length; i++) {
            ctx.lineTo(offsetX + hull[i].x * zoom + zoom/2, offsetY + hull[i].y * zoom + zoom/2);
          }
          ctx.closePath();
          ctx.stroke();
          ctx.fillStyle = 'rgba(250, 204, 21, 0.1)';
          ctx.fill();
        }
      } else if (panel.operation === VisionOperation.CORNER_DETECTION) {
        const corners = featuresRef.current.corners || [];
        ctx.fillStyle = '#ef4444';
        for (const c of corners) {
          ctx.beginPath();
          ctx.arc(offsetX + c.x * zoom + zoom/2, offsetY + c.y * zoom + zoom/2, zoom/2, 0, Math.PI * 2);
          ctx.fill();
        }
      }
    }

  }, [kernelPos, zoom, panel.isComplete, panel.params.kernelSize, isFollowMode, isReady, panel.isPlaying, panel.image, panel.operation]);

  return (
    <div className="absolute inset-0 flex flex-col overflow-hidden">
      <canvas ref={canvasRef} className="image-render-pixel w-full h-full" />
      
      {/* Simulation HUDs */}
      <div className="absolute top-4 left-4 flex flex-col gap-2 pointer-events-none">
        <div className="hud-panel !bg-black/80 border-white/5">
          <div className="flex gap-4">
            <div>
              <span className="hud-label">Address</span>
              <span className="hud-value italic">0x{((kernelPos.y * 100) + kernelPos.x).toString(16).toUpperCase()}</span>
            </div>
            <div>
              <span className="hud-label">S-Vector</span>
              <span className="hud-value italic">[{kernelPos.x}, {kernelPos.y}]</span>
            </div>
          </div>
        </div>

        {panel.isPlaying && !panel.isComplete && (
          <motion.div 
            initial={{ x: -10, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            className="hud-panel !bg-yellow-400/20 border-yellow-400/30 flex items-center gap-2 py-1.5 px-3"
          >
            <div className="w-1.5 h-1.5 bg-yellow-400 rounded-full animate-ping" />
            <span className="text-[8px] uppercase font-black tracking-widest text-yellow-100">Live Compute Stream...</span>
          </motion.div>
        )}
      </div>

      <div className="absolute top-4 right-4 flex gap-2 pointer-events-auto">
        <button 
          onClick={() => setIsFollowMode(!isFollowMode)}
          className={`hud-panel py-2 px-3 text-[9px] font-black uppercase tracking-widest flex items-center gap-2 transition-all 
            ${isFollowMode ? 'bg-yellow-400 !text-black border-yellow-500 shadow-yellow-400/20' : 'hover:bg-white/5'}
          `}
        >
          <RefreshCw size={10} className={isFollowMode ? 'animate-spin' : ''} />
          {isFollowMode ? 'Follow Locked' : 'Follow Signal'}
        </button>
      </div>

      <div className="absolute bottom-4 right-4 pointer-events-auto w-48">
        <div className="hud-panel w-full bg-black/90 p-3">
          <div className="flex justify-between items-center mb-2">
            <span className="hud-label mb-0">Engine Mag</span>
            <span className="hud-value tracking-tighter">{zoom.toFixed(1)}x</span>
          </div>
          <input 
            type="range" min="1" max="48" step="0.5"
            value={zoom}
            onChange={(e) => setZoom(parseFloat(e.target.value))}
            className="w-full h-1 bg-white/10 rounded-full accent-yellow-400 cursor-pointer mb-2"
          />
          <div className="flex gap-1">
            <button onClick={() => setZoom(Math.max(1, zoom-2))} className="flex-1 bg-white/5 hover:bg-white/10 text-[9px] py-1 font-bold rounded">OUT</button>
            <button onClick={() => setZoom(Math.min(48, zoom+2))} className="flex-1 bg-white/5 hover:bg-white/10 text-[9px] py-1 font-bold rounded">IN</button>
            <button onClick={() => setZoom(12)} className="bg-white/5 hover:bg-white/10 px-2 text-[9px] font-bold rounded">1:1</button>
          </div>
        </div>
      </div>
    </div>
  );
}

