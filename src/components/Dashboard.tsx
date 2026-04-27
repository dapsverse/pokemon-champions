'use client';

import React, { useState, useEffect } from 'react';
import { Pokemon, BattlePokemon, BattleState, MoveRecommendation, Move } from '../types/pokemon';
import { Search, Plus, Trash2, Shield, Zap, Flame, Droplets, Leaf, Snowflake, Skull, Mountain, Wind, Brain, Bug, Ghost, ShieldAlert, Swords, BrainCircuit, Activity, Heart, Sword } from 'lucide-react';
import { calculateBestMoves } from '../lib/battle-logic';
import { generateAIPrompt, generateTeamPredictionPrompt } from '../lib/ai-helper';
import { getAIResponse } from '../lib/ai-actions';

type AITextBlock =
  | { type: 'heading'; level: 2 | 3 | 4; text: string }
  | { type: 'paragraph'; text: string }
  | { type: 'ol'; items: string[] }
  | { type: 'ul'; items: string[] }
  | { type: 'hr' };

function parseAIText(text: string): AITextBlock[] {
  const normalized = (text || '').replace(/\r\n/g, '\n').replace(/\r/g, '\n');
  const lines = normalized.split('\n');

  const blocks: AITextBlock[] = [];
  let i = 0;

  const flushParagraph = (paragraphLines: string[]) => {
    const merged = paragraphLines.map(l => l.trim()).filter(Boolean).join(' ');
    if (merged) blocks.push({ type: 'paragraph', text: merged });
  };

  while (i < lines.length) {
    const raw = lines[i] ?? '';
    const line = raw.trim();

    if (!line) {
      i += 1;
      continue;
    }

    if (/^-{3,}$/.test(line)) {
      blocks.push({ type: 'hr' });
      i += 1;
      continue;
    }

    const headingMatch = /^(#{2,4})\s+(.+)$/.exec(line);
    if (headingMatch) {
      const hashes = headingMatch[1].length;
      const level = (hashes === 2 ? 2 : hashes === 3 ? 3 : 4) as 2 | 3 | 4;
      blocks.push({ type: 'heading', level, text: headingMatch[2].trim() });
      i += 1;
      continue;
    }

    if (/^\d+\.\s+/.test(line)) {
      const items: string[] = [];
      while (i < lines.length) {
        const l = (lines[i] ?? '').trim();
        const m = /^(\d+)\.\s+(.+)$/.exec(l);
        if (!m) break;
        items.push(m[2].trim());
        i += 1;
      }
      if (items.length) blocks.push({ type: 'ol', items });
      continue;
    }

    if (/^[-*]\s+/.test(line)) {
      const items: string[] = [];
      while (i < lines.length) {
        const l = (lines[i] ?? '').trim();
        const m = /^[-*]\s+(.+)$/.exec(l);
        if (!m) break;
        items.push(m[1].trim());
        i += 1;
      }
      if (items.length) blocks.push({ type: 'ul', items });
      continue;
    }

    const paragraphLines: string[] = [];
    while (i < lines.length) {
      const lRaw = lines[i] ?? '';
      const l = lRaw.trim();
      if (!l) break;
      if (/^-{3,}$/.test(l)) break;
      if (/^(#{2,4})\s+/.test(l)) break;
      if (/^\d+\.\s+/.test(l)) break;
      if (/^[-*]\s+/.test(l)) break;
      paragraphLines.push(lRaw);
      i += 1;
    }
    flushParagraph(paragraphLines);
  }

  return blocks;
}

function renderInlineBold(text: string): React.ReactNode[] {
  const nodes: React.ReactNode[] = [];
  const re = /\*\*(.+?)\*\*/g;
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = re.exec(text)) !== null) {
    const before = text.slice(lastIndex, match.index);
    if (before) nodes.push(before);
    nodes.push(<strong key={`${match.index}-${match[1]}`}>{match[1]}</strong>);
    lastIndex = match.index + match[0].length;
  }

  const after = text.slice(lastIndex);
  if (after) nodes.push(after);
  return nodes;
}

function FormattedAIText({ text }: { text: string }) {
  const blocks = parseAIText(text);
  return (
    <div className="space-y-5 text-slate-200 leading-relaxed">
      {blocks.map((b, idx) => {
        if (b.type === 'hr') return <hr key={idx} className="border-slate-800" />;
        if (b.type === 'heading') {
          if (b.level === 2) return <h2 key={idx} className="text-2xl font-bold text-white">{renderInlineBold(b.text)}</h2>;
          if (b.level === 3) return <h3 key={idx} className="text-xl font-bold text-white">{renderInlineBold(b.text)}</h3>;
          return <h4 key={idx} className="text-base font-bold text-white">{renderInlineBold(b.text)}</h4>;
        }
        if (b.type === 'ol') {
          return (
            <ol key={idx} className="list-decimal list-inside space-y-2 text-slate-200">
              {b.items.map((it, j) => (
                <li key={j} className="pl-1">{renderInlineBold(it)}</li>
              ))}
            </ol>
          );
        }
        if (b.type === 'ul') {
          return (
            <ul key={idx} className="list-disc list-inside space-y-2 text-slate-200">
              {b.items.map((it, j) => (
                <li key={j} className="pl-1">{renderInlineBold(it)}</li>
              ))}
            </ul>
          );
        }
        return <p key={idx} className="text-slate-200">{renderInlineBold(b.text)}</p>;
      })}
    </div>
  );
}

type SavedTeam = {
  id: string;
  name: string;
  team: BattlePokemon[];
  broughtIds?: string[];
  leadIds?: string[];
  updatedAt: number;
};

type DiscussionMessage = { role: 'user' | 'ai'; text: string };

function safeParseJSON<T>(value: string | null): T | null {
  if (!value) return null;
  try {
    return JSON.parse(value) as T;
  } catch {
    return null;
  }
}

function createId(): string {
  const cryptoObj = (globalThis as any).crypto as Crypto | undefined;
  if (cryptoObj?.randomUUID) return cryptoObj.randomUUID();
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function normalizeText(value: string): string {
  return (value || '').toLowerCase().replace(/[^a-z0-9]/g, '');
}

export default function Dashboard() {
  const [activeTab, setActiveTab] = useState<'team' | 'predictor' | 'assistant' | 'pre-battle'>('team');
  const [allPokemon, setAllPokemon] = useState<Pokemon[]>([]);
  const [myTeam, setMyTeam] = useState<BattlePokemon[]>([]);
  const [myBroughtIds, setMyBroughtIds] = useState<string[]>([]);
  const [myLeadIds, setMyLeadIds] = useState<string[]>([]);
  const [oppTeam, setOppTeam] = useState<BattlePokemon[]>([]);
  const [searchTerm, setSearch] = useState('');
  const [filteredPokemon, setFiltered] = useState<Pokemon[]>([]);
  const [allMoves, setAllMoves] = useState<Record<string, Move>>({});
  const [allMovesList, setAllMovesList] = useState<Move[]>([]);
  
  // Battle State
  const [battleState, setBattleState] = useState<BattleState | null>(null);
  const [recommendations, setRecommendations] = useState<MoveRecommendation[]>([]);

  // Selection/Edit State
  const [editingPokemon, setEditingPokemon] = useState<{ team: 'my' | 'opp', index: number } | null>(null);
  const [items, setItems] = useState<string[]>([]);
  const [moveSearch, setMoveSearch] = useState('');
  const [teamNameInput, setTeamNameInput] = useState('');
  const [savedMyTeams, setSavedMyTeams] = useState<SavedTeam[]>([]);
  const [selectedSavedTeamId, setSelectedSavedTeamId] = useState('');

  // AI State
  const [aiPrediction, setAiPrediction] = useState<string | null>(null);
  const [aiPreBattle, setAiPreBattle] = useState<string | null>(null);
  const [aiStrategy, setAiStrategy] = useState<string | null>(null);
  const [aiDiscussionInput, setAiDiscussionInput] = useState('');
  const [aiDiscussionHistory, setAiDiscussionHistory] = useState<DiscussionMessage[]>([]);
  const [isLoadingAI, setIsLoadingAI] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);

  const editingTeam = editingPokemon ? (editingPokemon.team === 'my' ? myTeam : oppTeam) : null;
  const editingP = editingPokemon && editingTeam ? editingTeam[editingPokemon.index] : null;

  useEffect(() => {
    fetch('/data/pokemon.json')
      .then(res => res.json())
      .then(data => {
        setAllPokemon(data);
        setFiltered(data.slice(0, 20));
      })
      .catch(err => console.error("Failed to load pokemon data", err));

    fetch('/data/moves.json')
      .then(res => res.json())
      .then(data => {
        const moveMap: Record<string, Move> = {};
        const list: Move[] = [];
        const seen = new Set<string>();

        (data as any[]).forEach((m: any) => {
          if (!m) return;
          const id = typeof m.id === 'string' ? m.id : '';
          const name = typeof m.name === 'string' ? m.name : '';
          if (name) moveMap[name] = m;
          if (id) moveMap[id] = m;

          const key = id || name;
          if (key && !seen.has(key)) {
            seen.add(key);
            list.push(m);
          }
        });

        setAllMoves(moveMap);
        setAllMovesList(list);
      })
      .catch(err => console.error("Failed to load moves data", err));

    // Common competitive items
    setItems([
      'Assault Vest',
      'Ability Shield',
      'Air Balloon',
      'Big Root',
      'Black Glasses',
      'Booster Energy',
      'Bright Powder',
      'Choice Band',
      'Choice Scarf',
      'Choice Specs',
      'Clear Amulet',
      'Covert Cloak',
      'Eject Button',
      'Eject Pack',
      'Expert Belt',
      'Focus Band',
      'Focus Sash',
      'Heavy-Duty Boots',
      'Leftovers',
      'Life Orb',
      'Light Clay',
      'Lum Berry',
      'Chople Berry',
      'Mental Herb',
      'Mirror Herb',
      'Protective Pads',
      'Red Card',
      'Rocky Helmet',
      'Room Service',
      'Safety Goggles',
      'Scope Lens',
      'Sitrus Berry',
      'Throat Spray',
      'Weakness Policy',
      'White Herb',
      'Wide Lens',
      'Wise Glasses',

      'Charcoal',
      'Magnet',
      'Miracle Seed',
      'Mystic Water',
      'Never-Melt Ice',
      'Poison Barb',
      'Sharp Beak',
      'Soft Sand',
      'Spell Tag',
      'Twisted Spoon',

      'Electric Seed',
      'Grassy Seed',
      'Misty Seed',
      'Psychic Seed',

      'Damp Rock',
      'Heat Rock',
      'Icy Rock',
      'Smooth Rock',
      'Terrain Extender'
    ]);
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const saved = safeParseJSON<SavedTeam[]>(window.localStorage.getItem('pca:savedMyTeams'));
    if (Array.isArray(saved)) {
      setSavedMyTeams(saved.filter(t => t && typeof t.id === 'string' && typeof t.name === 'string' && Array.isArray(t.team)));
    }

    const last = safeParseJSON<{ team: BattlePokemon[]; broughtIds?: string[]; leadIds?: string[] }>(window.localStorage.getItem('pca:lastMyTeam'));
    if (Array.isArray(last?.team)) {
      setMyTeam(last!.team);
      if (Array.isArray(last?.broughtIds)) setMyBroughtIds(last!.broughtIds);
      if (Array.isArray(last?.leadIds)) setMyLeadIds(last!.leadIds);
    }
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    window.localStorage.setItem('pca:lastMyTeam', JSON.stringify({ team: myTeam, broughtIds: myBroughtIds, leadIds: myLeadIds }));
  }, [myBroughtIds, myLeadIds, myTeam]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    window.localStorage.setItem('pca:savedMyTeams', JSON.stringify(savedMyTeams));
  }, [savedMyTeams]);

  useEffect(() => {
    if (!editingPokemon) setMoveSearch('');
  }, [editingPokemon]);

  useEffect(() => {
    if (searchTerm.length > 1) {
      setFiltered(allPokemon.filter(p => p.name.toLowerCase().includes(searchTerm.toLowerCase())));
    } else {
      setFiltered(allPokemon.slice(0, 20));
    }
  }, [searchTerm, allPokemon]);

  const addToTeam = (p: Pokemon, isOpponent: boolean = false) => {
    const team = isOpponent ? oppTeam : myTeam;
    const setTeam = isOpponent ? setOppTeam : setMyTeam;
    
    if (team.length >= 6) return;
    const newMember: BattlePokemon = {
      ...p,
      currentHp: p.stats.hp,
      selectedMoves: [], // Simplified for now
      status: 'None',
      toxicCounter: 0,
      statStages: { atk: 0, def: 0, spa: 0, spd: 0, spe: 0 }
    };
    setTeam([...team, newMember]);
  };

  const saveMyTeamByName = () => {
    const name = teamNameInput.trim();
    if (!name) return;
    if (myTeam.length === 0) return;

    setSavedMyTeams(prev => {
      const now = Date.now();
      const existingIndex = prev.findIndex(t => t.name.toLowerCase() === name.toLowerCase());
      if (existingIndex >= 0) {
        const next = [...prev];
        next[existingIndex] = { ...next[existingIndex], name, team: myTeam, broughtIds: myBroughtIds, leadIds: myLeadIds, updatedAt: now };
        return next;
      }
      return [{ id: createId(), name, team: myTeam, broughtIds: myBroughtIds, leadIds: myLeadIds, updatedAt: now }, ...prev];
    });
  };

  const loadMySavedTeam = () => {
    if (!selectedSavedTeamId) return;
    const found = savedMyTeams.find(t => t.id === selectedSavedTeamId);
    if (!found) return;
    setMyTeam(found.team);
    setMyBroughtIds(Array.isArray(found.broughtIds) ? found.broughtIds : []);
    setMyLeadIds(Array.isArray(found.leadIds) ? found.leadIds : []);
  };

  const deleteMySavedTeam = () => {
    if (!selectedSavedTeamId) return;
    setSavedMyTeams(prev => prev.filter(t => t.id !== selectedSavedTeamId));
    setSelectedSavedTeamId('');
  };

  useEffect(() => {
    const ids = new Set(myTeam.map(p => p.id));
    setMyBroughtIds(prev => prev.filter(id => ids.has(id)).slice(0, 4));
    setMyLeadIds(prev => prev.filter(id => ids.has(id)).slice(0, 2));
  }, [myTeam]);

  useEffect(() => {
    setMyLeadIds(prev => prev.filter(id => myBroughtIds.includes(id)).slice(0, 2));
  }, [myBroughtIds]);

  const toggleBrought = (id: string) => {
    const removing = myBroughtIds.includes(id);
    if (removing) setMyLeadIds(prev => prev.filter(x => x !== id));
    setMyBroughtIds(prev => {
      if (prev.includes(id)) return prev.filter(x => x !== id);
      if (prev.length >= 4) return prev;
      return [...prev, id];
    });
  };

  const toggleLead = (id: string) => {
    const canAutoBring = myBroughtIds.includes(id) || myBroughtIds.length < 4;
    if (!canAutoBring) return;
    if (!myBroughtIds.includes(id)) setMyBroughtIds(prev => (prev.includes(id) ? prev : [...prev, id]).slice(0, 4));
    setMyLeadIds(prev => {
      const next = prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id];
      return next.slice(0, 2);
    });
  };

  const updateEditingPokemonData = (updater: (p: BattlePokemon) => void) => {
    if (!editingPokemon) return;
    const team = editingPokemon.team === 'my' ? [...myTeam] : [...oppTeam];
    updater(team[editingPokemon.index]);
    editingPokemon.team === 'my' ? setMyTeam(team) : setOppTeam(team);
  };

  const removeFromTeam = (index: number, isOpponent: boolean = false) => {
    const team = isOpponent ? oppTeam : myTeam;
    const setTeam = isOpponent ? setOppTeam : setMyTeam;
    const newTeam = [...team];
    newTeam.splice(index, 1);
    setTeam(newTeam);
  };

  const startBattle = async () => {
    if (myTeam.length < 2 || oppTeam.length < 2) return;
    
    setActiveTab('pre-battle');
    setIsLoadingAI(true);
    setAiError(null);
    
    try {
      const prompt = generateTeamPredictionPrompt({
        format: 'Double',
        myTeam,
        opponentTeam: oppTeam,
        myActiveIndices: [0, 1],
        opponentActiveIndices: [0, 1],
        weather: 'None',
        turn: 0
      });
      const result = await getAIResponse(prompt);
      setAiPreBattle(result);
    } catch (err: any) {
      console.error('Pre-Battle Error:', err);
      setAiError(err.message || 'Failed to get Pre-Battle analysis.');
    } finally {
      setIsLoadingAI(false);
    }
  };

  const confirmBattleStart = () => {
    const broughtTeam = (myBroughtIds.length > 0 ? myTeam.filter(p => myBroughtIds.includes(p.id)) : myTeam.slice(0, 4)).slice(0, 4);
    const leadIds = myLeadIds.filter(id => broughtTeam.some(p => p.id === id));
    const picked = leadIds.map(id => broughtTeam.findIndex(p => p.id === id)).filter(i => i >= 0);
    const unique: number[] = [];
    picked.forEach(i => { if (!unique.includes(i)) unique.push(i); });
    for (let i = 0; i < broughtTeam.length && unique.length < 2; i++) {
      if (!unique.includes(i)) unique.push(i);
    }
    const finalLeadIndices = broughtTeam.length >= 2 ? [unique[0] ?? 0, unique[1] ?? 1] : [0, 1];

    const initialState: BattleState = {
      format: 'Double',
      myActiveIndices: finalLeadIndices,
      opponentActiveIndices: [0, 1],
      myTeam: [...broughtTeam],
      opponentTeam: [...oppTeam],
      weather: 'None',
      turn: 1
    };
    setBattleState(initialState);
    setRecommendations([]);
    setAiStrategy(null);
    setAiDiscussionInput('');
    setAiDiscussionHistory([]);
    setAiError(null);
    setActiveTab('assistant');
  };

  const updateHp = (team: 'my' | 'opp', index: number, hp: number) => {
    if (!battleState) return;
    const newState = { ...battleState };
    if (team === 'my') {
      newState.myTeam[index].currentHp = Math.max(0, Math.min(newState.myTeam[index].stats.hp, hp));
    } else {
      newState.opponentTeam[index].currentHp = Math.max(0, Math.min(newState.opponentTeam[index].stats.hp, hp));
    }
    setBattleState(newState);
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      {/* Sidebar */}
      <nav className="fixed left-0 top-0 bottom-0 w-20 bg-slate-900 border-r border-slate-800 flex flex-col items-center py-8 gap-8 z-50">
        <div className="w-12 h-12 bg-blue-600 rounded-2xl flex items-center justify-center shadow-lg shadow-blue-900/20">
          <Shield className="w-6 h-6 text-white" />
        </div>
        
        <div className="flex flex-col gap-4">
          <button onClick={() => setActiveTab('team')} className={`p-4 rounded-2xl transition-all ${activeTab === 'team' ? 'bg-slate-800 text-blue-400' : 'text-slate-500 hover:bg-slate-800/50'}`}><Swords className="w-6 h-6" /></button>
          <button onClick={() => setActiveTab('predictor')} className={`p-4 rounded-2xl transition-all ${activeTab === 'predictor' ? 'bg-slate-800 text-blue-400' : 'text-slate-500 hover:bg-slate-800/50'}`}><BrainCircuit className="w-6 h-6" /></button>
          <button onClick={() => setActiveTab('assistant')} className={`p-4 rounded-2xl transition-all ${activeTab === 'assistant' ? 'bg-slate-800 text-blue-400' : 'text-slate-500 hover:bg-slate-800/50'}`}><Activity className="w-6 h-6" /></button>
        </div>
      </nav>

      {/* Main Content */}
      <div className="pl-20">
        <div className="p-8 max-w-[1600px] mx-auto">
          {activeTab === 'team' && (
            <div className="space-y-8">
              <div className="flex flex-col md:flex-row gap-6 items-start md:items-center justify-between">
                <div className="flex-1 w-full max-w-xl">
                  <h2 className="text-3xl font-bold mb-2">Team Builder</h2>
                  <div className="relative">
                    <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500 w-5 h-5" />
                    <input
                      type="text"
                      placeholder="Search Pokémon to add..."
                      className="w-full bg-slate-900 border border-slate-800 rounded-2xl py-4 pl-12 pr-4 focus:outline-none focus:ring-2 focus:ring-blue-500 shadow-xl"
                      value={searchTerm}
                      onChange={(e) => setSearch(e.target.value)}
                    />
                    {searchTerm && (
                      <div className="absolute top-full left-0 right-0 mt-2 bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl z-50 max-h-96 overflow-y-auto divide-y divide-slate-800">
                        {filteredPokemon.map(p => (
                          <div key={p.id} className="p-4 hover:bg-slate-800/50 flex items-center justify-between group">
                            <div className="flex items-center gap-4">
                              <div className="w-10 h-10 rounded-xl bg-slate-800 flex items-center justify-center font-bold text-blue-400">
                                {p.name.substring(0, 2)}
                              </div>
                              <div>
                                <div className="font-bold">{p.name}</div>
                                <div className="flex gap-1 mt-1">
                                  {p.types.map(t => <span key={t} className="text-[10px] px-2 py-0.5 rounded-full bg-slate-800 border border-slate-700">{t}</span>)}
                                </div>
                              </div>
                            </div>
                            <div className="flex gap-2">
                              <button onClick={() => { addToTeam(p, false); setSearch(''); }} className="px-4 py-2 bg-blue-600 hover:bg-blue-500 rounded-xl text-xs font-bold uppercase tracking-tight transition-all">My Team</button>
                              <button onClick={() => { addToTeam(p, true); setSearch(''); }} className="px-4 py-2 bg-red-600 hover:bg-red-500 rounded-xl text-xs font-bold uppercase tracking-tight transition-all">Opponent</button>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
                
                <button 
                  onClick={startBattle}
                  disabled={myTeam.length < 2 || oppTeam.length < 2}
                  className="w-full md:w-auto px-8 py-4 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 disabled:from-slate-800 disabled:to-slate-800 disabled:text-slate-600 rounded-2xl font-bold text-lg shadow-lg shadow-blue-900/20 transition-all flex items-center justify-center gap-3"
                >
                  <Swords className="w-6 h-6" />
                  Start Battle Assistant
                </button>
              </div>

              <div className="overflow-x-auto" style={{ overflowX: 'auto' }}>
                <div
                  className="min-w-[1100px]"
                  style={{
                    display: 'grid',
                    gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 1fr)',
                    gap: 32
                  }}
                >
                {/* My Team Section */}
                <section className="bg-slate-900/50 rounded-3xl border border-slate-800 p-8 space-y-6">
                  <div className="flex justify-between items-center">
                    <div>
                      <h3 className="text-2xl font-bold flex items-center gap-3">
                        <div className="w-8 h-8 rounded-lg bg-blue-600/20 flex items-center justify-center">
                          <Shield className="w-5 h-5 text-blue-400" />
                        </div>
                        My Team 
                        <span className="text-slate-500 text-sm font-normal ml-2">({myTeam.length}/6)</span>
                      </h3>
                    </div>
                    {myTeam.length > 0 && (
                      <button onClick={() => setMyTeam([])} className="text-xs text-slate-500 hover:text-red-400 flex items-center gap-1 transition-all">
                        <Trash2 className="w-3 h-3" /> Clear
                      </button>
                    )}
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                    <input
                      type="text"
                      placeholder="Team name (e.g. Sun Room)"
                      className="w-full bg-slate-900 border border-slate-800 rounded-xl py-3 px-4 focus:outline-none focus:ring-2 focus:ring-blue-500"
                      value={teamNameInput}
                      onChange={(e) => setTeamNameInput(e.target.value)}
                    />
                    <select
                      className="w-full bg-slate-900 border border-slate-800 rounded-xl py-3 px-4 focus:outline-none focus:ring-2 focus:ring-blue-500 text-slate-200"
                      value={selectedSavedTeamId}
                      onChange={(e) => setSelectedSavedTeamId(e.target.value)}
                    >
                      <option value="">Saved Teams</option>
                      {savedMyTeams.map(t => (
                        <option key={t.id} value={t.id}>{t.name}</option>
                      ))}
                    </select>
                    <div className="flex gap-2">
                      <button
                        onClick={saveMyTeamByName}
                        disabled={!teamNameInput.trim() || myTeam.length === 0}
                        className="flex-1 py-3 px-4 rounded-xl bg-blue-600 hover:bg-blue-500 disabled:bg-slate-800 disabled:text-slate-600 font-bold text-sm transition-all"
                      >
                        Save
                      </button>
                      <button
                        onClick={loadMySavedTeam}
                        disabled={!selectedSavedTeamId}
                        className="flex-1 py-3 px-4 rounded-xl bg-slate-800 hover:bg-slate-700 disabled:bg-slate-800 disabled:text-slate-600 font-bold text-sm transition-all"
                      >
                        Load
                      </button>
                      <button
                        onClick={deleteMySavedTeam}
                        disabled={!selectedSavedTeamId}
                        className="py-3 px-4 rounded-xl bg-red-600/20 hover:bg-red-600/30 disabled:bg-slate-800 disabled:text-slate-600 font-bold text-sm transition-all text-red-300 border border-red-900/30"
                      >
                        Del
                      </button>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {Array.from({ length: 6 }).map((_, i) => (
                      <PokemonSlot 
                        key={i} 
                        pokemon={myTeam[i]} 
                        onRemove={() => removeFromTeam(i, false)} 
                        onClick={() => myTeam[i] && setEditingPokemon({ team: 'my', index: i })}
                      />
                    ))}
                  </div>

                  {editingPokemon?.team === 'my' && myTeam[editingPokemon.index] && (
                    <div className="mt-6 bg-slate-950/40 border border-slate-800 rounded-3xl p-6 space-y-6">
                      <div className="flex items-start justify-between gap-4">
                        <div>
                          <div className="text-sm font-bold text-white">Konfigurasi: {myTeam[editingPokemon.index].name}</div>
                          <div className="text-xs text-slate-500">Set held item and up to 4 moves here (My Team only).</div>
                        </div>
                        <button
                          onClick={() => setEditingPokemon(null)}
                          className="px-3 py-2 rounded-xl bg-slate-900 border border-slate-800 text-slate-300 text-xs font-bold hover:bg-slate-800 transition-all"
                        >
                          Close
                        </button>
                      </div>

                      <section className="space-y-4">
                        <h4 className="text-sm font-bold text-slate-400 uppercase tracking-widest flex items-center gap-2">
                          <Shield className="w-4 h-4" /> Held Item
                        </h4>
                        <div className="relative">
                          <input 
                            type="text" 
                            placeholder="Search or enter item name..."
                            className="w-full bg-slate-950 border border-slate-800 rounded-xl py-3 px-4 focus:ring-2 focus:ring-blue-500 outline-none transition-all"
                            value={editingP?.item || ''}
                            onChange={(e) => {
                              const team = editingPokemon.team === 'my' ? [...myTeam] : [...oppTeam];
                              team[editingPokemon.index].item = e.target.value;
                              editingPokemon.team === 'my' ? setMyTeam(team) : setOppTeam(team);
                            }}
                          />
                          <div className="mt-3 flex flex-wrap gap-2">
                            {items.filter(item => 
                              !editingP?.item || item.toLowerCase().includes((editingP.item || '').toLowerCase())
                            ).slice(0, 10).map(item => (
                              <button
                                key={item}
                                onClick={() => {
                                  const team = editingPokemon.team === 'my' ? [...myTeam] : [...oppTeam];
                                  team[editingPokemon.index].item = item;
                                  editingPokemon.team === 'my' ? setMyTeam(team) : setOppTeam(team);
                                }}
                                className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-all ${editingP?.item === item ? 'bg-blue-600 border-blue-500 text-white' : 'bg-slate-800 border-slate-700 text-slate-400 hover:border-slate-600'}`}
                              >
                                {item}
                              </button>
                            ))}
                          </div>
                        </div>
                      </section>

                      <section className="space-y-4">
                        <h4 className="text-sm font-bold text-slate-400 uppercase tracking-widest flex items-center gap-2">
                          <Swords className="w-4 h-4" /> Moves (Max 4)
                        </h4>
                        {editingP && (
                          <div className="space-y-4">
                            <div className="flex flex-wrap gap-2">
                              {editingP.selectedMoves.length > 0 ? (
                                editingP.selectedMoves.map(m => (
                                  <button
                                    key={m.id}
                                    onClick={() => {
                                      const team = editingPokemon.team === 'my' ? [...myTeam] : [...oppTeam];
                                      team[editingPokemon.index].selectedMoves = team[editingPokemon.index].selectedMoves.filter(sm => sm.name !== m.name);
                                      editingPokemon.team === 'my' ? setMyTeam(team) : setOppTeam(team);
                                    }}
                                    className="px-3 py-2 rounded-xl bg-blue-600/15 border border-blue-500/25 text-blue-200 text-xs font-bold hover:bg-blue-600/25 transition-all"
                                    title="Click to remove"
                                  >
                                    {m.name}
                                  </button>
                                ))
                              ) : (
                                <div className="text-xs text-slate-500 italic">No moves selected yet.</div>
                              )}
                              {editingP.selectedMoves.length > 0 && (
                                <button
                                  onClick={() => {
                                    const team = editingPokemon.team === 'my' ? [...myTeam] : [...oppTeam];
                                    team[editingPokemon.index].selectedMoves = [];
                                    editingPokemon.team === 'my' ? setMyTeam(team) : setOppTeam(team);
                                  }}
                                  className="px-3 py-2 rounded-xl bg-slate-800 border border-slate-700 text-slate-300 text-xs font-bold hover:bg-slate-700 transition-all"
                                >
                                  Clear Moves
                                </button>
                              )}
                            </div>

                            <input
                              type="text"
                              placeholder="Search moves (e.g. Protect, Fake Out, Eruption)"
                              className="w-full bg-slate-950 border border-slate-800 rounded-xl py-3 px-4 focus:ring-2 focus:ring-blue-500 outline-none transition-all"
                              value={moveSearch}
                              onChange={(e) => setMoveSearch(e.target.value)}
                            />

                            <div className="grid grid-cols-2 gap-3">
                              {(() => {
                                const q = moveSearch.trim();
                                const qn = normalizeText(q);
                                const moveNames = q
                                  ? allMovesList
                                      .filter(m => {
                                        const name = typeof (m as any).name === 'string' ? (m as any).name : '';
                                        const id = typeof (m as any).id === 'string' ? (m as any).id : '';
                                        return normalizeText(name).includes(qn) || normalizeText(id).includes(qn);
                                      })
                                      .slice(0, 24)
                                      .map(m => (m as any).name as string)
                                  : editingP.moves.slice(0, 24);

                                return moveNames.map(moveName => {
                                  const moveData = allMoves[moveName];
                                const isSelected = editingP.selectedMoves.some(m => m.name === moveName);
                                const isFull = !isSelected && editingP.selectedMoves.length >= 4;

                                return (
                                  <button
                                    key={moveName}
                                    disabled={isFull}
                                    onClick={() => {
                                      const team = editingPokemon.team === 'my' ? [...myTeam] : [...oppTeam];
                                      const p = team[editingPokemon.index];
                                      const alreadySelected = p.selectedMoves.some(m => m.name === moveName);
                                      if (alreadySelected) {
                                        p.selectedMoves = p.selectedMoves.filter(m => m.name !== moveName);
                                      } else if (p.selectedMoves.length < 4) {
                                        if (moveData) {
                                          p.selectedMoves = [...p.selectedMoves, moveData];
                                        } else {
                                          p.selectedMoves = [
                                            ...p.selectedMoves,
                                            {
                                              id: moveName.toLowerCase().replace(/ /g, '-'),
                                              name: moveName,
                                              type: 'Normal',
                                              category: 'Physical',
                                              pp: 20,
                                              description: '',
                                              priority: 0
                                            }
                                          ];
                                        }
                                      }
                                      editingPokemon.team === 'my' ? setMyTeam(team) : setOppTeam(team);
                                    }}
                                    className={`p-3 rounded-xl border text-left transition-all ${
                                      isSelected
                                        ? 'bg-blue-600/20 border-blue-500 text-blue-100'
                                        : isFull
                                          ? 'bg-slate-950 border-slate-900 text-slate-700 cursor-not-allowed'
                                          : 'bg-slate-950 border-slate-800 text-slate-500 hover:border-slate-700'
                                    }`}
                                  >
                                    <div className="text-sm font-bold">{moveName}</div>
                                    {moveData && <div className="text-[10px] opacity-60">{moveData.type} • {moveData.category}</div>}
                                  </button>
                                );
                                });
                              })()}
                            </div>
                          </div>
                        )}
                      </section>
                    </div>
                  )}
                </section>

                {/* Opponent Team Section */}
                <section className="bg-slate-900/50 rounded-3xl border border-slate-800 p-8 space-y-6">
                  <div className="flex justify-between items-center">
                    <div>
                      <h3 className="text-2xl font-bold flex items-center gap-3 text-red-400">
                        <div className="w-8 h-8 rounded-lg bg-red-600/20 flex items-center justify-center">
                          <Swords className="w-5 h-5 text-red-400" />
                        </div>
                        Opponent Team 
                        <span className="text-slate-500 text-sm font-normal ml-2">({oppTeam.length}/6)</span>
                      </h3>
                    </div>
                    {oppTeam.length > 0 && (
                      <button onClick={() => setOppTeam([])} className="text-xs text-slate-500 hover:text-red-400 flex items-center gap-1 transition-all">
                        <Trash2 className="w-3 h-3" /> Clear
                      </button>
                    )}
                  </div>
                  
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {Array.from({ length: 6 }).map((_, i) => (
                      <PokemonSlot 
                        key={i} 
                        pokemon={oppTeam[i]} 
                        onRemove={() => removeFromTeam(i, true)} 
                        variant="opponent" 
                        onClick={() => {}}
                      />
                    ))}
                  </div>
                </section>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'pre-battle' && (
            <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
              <div className="flex justify-between items-center">
                <h2 className="text-3xl font-bold">Pre-Battle Analysis</h2>
                <button 
                  onClick={() => setActiveTab('team')}
                  className="text-slate-500 hover:text-white transition-colors"
                >
                  Cancel & Back to Team
                </button>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                {/* AI Analysis Section */}
                <div className="lg:col-span-2 space-y-6">
                  <div className="bg-slate-900 rounded-3xl border border-slate-800 p-8">
                    <div className="flex items-center gap-4 mb-8">
                      <div className="p-3 bg-blue-600 rounded-2xl shadow-lg shadow-blue-900/40">
                        <BrainCircuit className="w-6 h-6" />
                      </div>
                      <div>
                        <h3 className="text-xl font-bold">Selection Strategy</h3>
                        <p className="text-slate-500 text-sm italic">Deep analysis of team matchup & meta</p>
                      </div>
                    </div>

                    {isLoadingAI ? (
                      <div className="py-20 flex flex-col items-center justify-center space-y-4">
                        <div className="w-12 h-12 border-4 border-blue-600/20 border-t-blue-600 rounded-full animate-spin" />
                        <p className="text-slate-400 font-medium animate-pulse">Consulting the Meta-game database...</p>
                      </div>
                    ) : aiError ? (
                      <div className="p-6 bg-red-900/20 border border-red-900/50 rounded-2xl text-red-400">
                        <div className="flex items-start gap-3">
                          <ShieldAlert className="w-5 h-5 mt-0.5 flex-shrink-0" />
                          <div>
                            <p className="font-bold mb-1">Analysis Failed</p>
                            <p className="text-sm opacity-90 leading-relaxed">{aiError}</p>
                            {aiError.includes('disabled') && (
                              <div className="mt-4 p-4 bg-red-950/40 rounded-xl border border-red-800/50">
                                <p className="text-xs font-bold uppercase tracking-wider mb-2 text-red-300">Action Required:</p>
                                <p className="text-xs leading-relaxed text-red-200">
                                  Gemini API is not enabled in your Google Cloud Project. Please click the link below to enable it:
                                </p>
                                <a 
                                  href="https://console.developers.google.com/apis/api/generativelanguage.googleapis.com/overview" 
                                  target="_blank" 
                                  className="inline-block mt-3 px-4 py-2 bg-red-600 text-white text-xs font-bold rounded-lg hover:bg-red-500 transition-colors"
                                >
                                  Enable Gemini API
                                </a>
                              </div>
                            )}
                          </div>
                        </div>
                        <button onClick={startBattle} className="block mt-4 text-sm font-bold underline hover:text-red-300 transition-colors">Try Again</button>
                      </div>
                    ) : (
                      <div className="space-y-6">
                        {aiPreBattle ? (
                          <div className="bg-slate-950/40 border border-slate-800 rounded-2xl p-6">
                            <FormattedAIText text={aiPreBattle} />
                          </div>
                        ) : (
                          <div className="text-slate-500 text-sm">No analysis yet.</div>
                        )}
                        
                        <div className="pt-8 border-t border-slate-800">
                          <button 
                            onClick={confirmBattleStart}
                            className="w-full py-5 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 rounded-2xl font-bold text-xl shadow-xl shadow-blue-900/20 transition-all flex items-center justify-center gap-3 group"
                          >
                            Enter Battle Assistant
                            <Swords className="w-6 h-6 group-hover:rotate-12 transition-transform" />
                          </button>
                          <p className="text-center mt-4 text-xs text-slate-500 uppercase tracking-widest font-bold">
                            Select your 4 Pokémon and starting leads in the right panel before entering the battle assistant
                          </p>
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                {/* Team Recap Section */}
                <div className="space-y-6">
                  {myTeam.length > 0 && (
                    <div className="bg-slate-900/50 rounded-3xl border border-slate-800 p-6">
                      <div className="flex items-center justify-between gap-4">
                      <h4 className="text-xs font-bold text-slate-500 uppercase tracking-widest">Pick 4 & Leads</h4>
                        <div className="text-xs text-slate-500">Bring {myBroughtIds.length}/4 · Leads {myLeadIds.length}/2</div>
                      </div>
                      <div className="mt-4 space-y-2">
                        {myTeam.map(p => {
                          const isBrought = myBroughtIds.includes(p.id);
                          const isLead = myLeadIds.includes(p.id);
                          const broughtFull = !isBrought && myBroughtIds.length >= 4;
                          return (
                            <div key={p.id} className="flex items-center justify-between gap-3 bg-slate-950/40 border border-slate-800 rounded-xl px-3 py-2">
                              <div className="min-w-0">
                                <div className="text-sm font-semibold truncate">{p.name}</div>
                              </div>
                              <div className="flex items-center gap-2 shrink-0">
                                <button
                                  disabled={broughtFull}
                                  onClick={() => toggleBrought(p.id)}
                                  className={`px-3 py-1.5 rounded-lg text-[11px] font-bold border transition-all ${isBrought ? 'bg-blue-600 border-blue-500 text-white' : 'bg-slate-800 border-slate-700 text-slate-300 hover:border-slate-600'} disabled:opacity-40 disabled:cursor-not-allowed`}
                                >
                                  Bring
                                </button>
                                <button
                                  disabled={!isBrought && broughtFull}
                                  onClick={() => toggleLead(p.id)}
                                  className={`px-3 py-1.5 rounded-lg text-[11px] font-bold border transition-all ${isLead ? 'bg-purple-600 border-purple-500 text-white' : 'bg-slate-800 border-slate-700 text-slate-300 hover:border-slate-600'} disabled:opacity-40 disabled:cursor-not-allowed`}
                                >
                                  Lead
                                </button>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                      <div className="mt-4 text-[11px] text-slate-500 leading-relaxed">
                        If you haven't selected anything, the app will default to the first 4 Pokémon and the first 2 leads.
                      </div>
                    </div>
                  )}
                  <div className="bg-slate-900/50 rounded-3xl border border-slate-800 p-6">
                    <h4 className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-4">Matchup Recap</h4>
                    <div className="space-y-6">
                      <div className="space-y-3">
                        <div className="text-[10px] font-bold text-blue-400 uppercase">My Full Team</div>
                        <div className="grid grid-cols-3 gap-2">
                          {myTeam.map(p => (
                            <div key={p.id} className="p-2 bg-slate-900 border border-slate-800 rounded-xl text-center">
                              <div className="text-[10px] font-bold truncate">{p.name}</div>
                            </div>
                          ))}
                        </div>
                      </div>
                      <div className="space-y-3">
                        <div className="text-[10px] font-bold text-red-400 uppercase">Opponent's 6</div>
                        <div className="grid grid-cols-3 gap-2">
                          {oppTeam.map(p => (
                            <div key={p.id} className="p-2 bg-slate-900 border border-red-900/10 rounded-xl text-center">
                              <div className="text-[10px] font-bold truncate">{p.name}</div>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="p-6 bg-blue-600/10 border border-blue-500/20 rounded-3xl">
                    <h4 className="text-sm font-bold text-blue-400 mb-2 flex items-center gap-2">
                      <Zap className="w-4 h-4" /> Pro Tip
                    </h4>
                    <p className="text-xs text-slate-400 leading-relaxed">
                      In VGC (Double Battles), the lead determines the momentum of the entire game. Pay close attention to speed tiers and weather setters.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'predictor' && (
            <div className="space-y-8">
              <div className="flex justify-between items-center">
                <h2 className="text-3xl font-bold">Battle Predictor</h2>
                <div className="bg-blue-600/10 text-blue-400 px-4 py-2 rounded-full border border-blue-500/20 text-sm font-bold uppercase tracking-widest">
                  Double Battle Mode
                </div>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                {/* Prediction Control */}
                <div className="bg-slate-900 rounded-3xl border border-slate-800 p-8 space-y-6">
                  <div className="flex items-center gap-4 mb-4">
                    <div className="p-3 bg-purple-600 rounded-2xl">
                      <BrainCircuit className="w-6 h-6" />
                    </div>
                    <div>
                      <h3 className="text-xl font-bold">AI Team Analysis</h3>
                      <p className="text-slate-500 text-sm">Predicting opponent's 4 core Pokémon & leads</p>
                    </div>
                  </div>

                  {myTeam.length === 6 && oppTeam.length === 6 ? (
                    <div className="space-y-4">
                      <button 
                        disabled={isLoadingAI}
                        onClick={async () => {
                          setIsLoadingAI(true);
                          setAiError(null);
                          try {
                            const prompt = generateTeamPredictionPrompt({
                              format: 'Double',
                              myTeam,
                              opponentTeam: oppTeam,
                              myActiveIndices: [0, 1],
                              opponentActiveIndices: [0, 1],
                              weather: 'None',
                              turn: 0
                            });
                            const result = await getAIResponse(prompt);
                            setAiPrediction(result);
                          } catch (err) {
                            setAiError('Failed to get AI prediction. Please check your API key.');
                          } finally {
                            setIsLoadingAI(false);
                          }
                        }}
                        className="w-full py-4 bg-purple-600 hover:bg-purple-500 disabled:bg-slate-800 rounded-2xl font-bold transition-all flex items-center justify-center gap-2"
                      >
                        {isLoadingAI ? (
                          <div className="flex items-center gap-2">
                            <div className="w-4 h-4 border-2 border-white/20 border-t-white rounded-full animate-spin" />
                            Analyzing Meta...
                          </div>
                        ) : (
                          <>Analyze Team Matchup</>
                        )}
                      </button>

                      {aiError && (
                        <div className="p-4 bg-red-900/20 border border-red-900/50 rounded-xl text-red-400 text-sm">
                          {aiError}
                        </div>
                      )}

                      {aiPrediction && (
                        <div className="p-6 bg-slate-950 border border-slate-800 rounded-2xl text-slate-300 text-sm leading-relaxed whitespace-pre-wrap">
                          {aiPrediction}
                        </div>
                      )}

                      {!aiPrediction && !aiError && (
                        <div className="p-6 bg-slate-950 border border-slate-800 rounded-2xl text-slate-400 text-sm leading-relaxed">
                          <p className="mb-4 font-bold text-slate-200">How it works:</p>
                          <ul className="list-disc list-inside space-y-2">
                            <li>AI analyzes your 6 Pokémon vs Opponent's 6.</li>
                            <li>Predicts the <span className="text-blue-400 font-bold">Top 4</span> Pokémon they will bring.</li>
                            <li>Identifies the <span className="text-red-400 font-bold">Lead Pair</span>.</li>
                            <li>Suggests your best counter-leads.</li>
                          </ul>
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="p-12 border-2 border-dashed border-slate-800 rounded-3xl text-center">
                      <ShieldAlert className="w-12 h-12 mx-auto mb-4 text-slate-700" />
                      <p className="text-slate-500 font-medium">Both teams must have 6 Pokémon selected in the Team Builder tab.</p>
                      <button onClick={() => setActiveTab('team')} className="mt-6 text-blue-500 font-bold hover:underline">Go to Team Builder</button>
                    </div>
                  )}
                </div>

                {/* Team Comparison Quick Look */}
                <div className="space-y-6">
                  <div className="bg-slate-900 rounded-3xl border border-slate-800 p-8">
                    <h3 className="text-lg font-bold mb-6 flex items-center gap-2 text-slate-400 uppercase tracking-widest text-xs">Comparison Overview</h3>
                    <div className="grid grid-cols-2 gap-8">
                       <div className="space-y-4">
                         <div className="text-xs font-bold text-blue-500 uppercase">Your Team</div>
                         <div className="flex flex-wrap gap-2">
                           {myTeam.map(p => (
                             <div key={p.id} className="w-10 h-10 rounded-xl bg-slate-800 border border-slate-700 flex items-center justify-center text-[10px] font-bold" title={p.name}>
                               {p.name.substring(0, 2)}
                             </div>
                           ))}
                         </div>
                       </div>
                       <div className="space-y-4">
                         <div className="text-xs font-bold text-red-500 uppercase">Opponent Team</div>
                         <div className="flex flex-wrap gap-2">
                           {oppTeam.map(p => (
                             <div key={p.id} className="w-10 h-10 rounded-xl bg-red-950/20 border border-red-900/20 flex items-center justify-center text-[10px] font-bold" title={p.name}>
                               {p.name.substring(0, 2)}
                             </div>
                           ))}
                         </div>
                       </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'assistant' && battleState && (
            <div className="grid grid-cols-1 xl:grid-cols-3 gap-8">
              {/* Field View */}
              <div className="xl:col-span-2 space-y-8">
                <div className="flex justify-between items-center bg-slate-900 p-4 rounded-2xl border border-slate-800">
                   <h2 className="text-xl font-bold">Turn {battleState.turn} - Double Battle</h2>
                   <div className="flex gap-2">
                     {['Rain', 'Harsh Sunlight', 'Sandstorm', 'Snow', 'None'].map(w => (
                       <button 
                        key={w}
                        onClick={() => setBattleState({...battleState, weather: w as any})}
                        className={`px-3 py-1 rounded-full text-xs font-bold border transition-all ${battleState.weather === w ? 'bg-blue-600 border-blue-500' : 'bg-slate-800 border-slate-700 text-slate-500'}`}
                       >
                         {w.toUpperCase()}
                       </button>
                     ))}
                   </div>
                </div>

                <div className="grid grid-cols-2 gap-8">
                  {/* Opponent Field */}
                  <div className="space-y-4">
                    <h3 className="text-xs font-bold text-red-500 uppercase tracking-widest text-center">Opponent Field</h3>
                    <div className="flex flex-col gap-4">
                      {battleState.opponentActiveIndices.map((idx, activePos) => (
                        <div key={activePos} className="space-y-2">
                          <select 
                            className="w-full bg-slate-900 border border-slate-800 text-[10px] p-1 rounded-lg"
                            value={idx}
                            onChange={(e) => {
                              const newIndices = [...battleState.opponentActiveIndices];
                              newIndices[activePos] = parseInt(e.target.value);
                              setBattleState({...battleState, opponentActiveIndices: newIndices});
                            }}
                          >
                            {battleState.opponentTeam.map((p, i) => (
                              <option key={i} value={i}>{p.name} {p.currentHp <= 0 ? '(Fainted)' : ''}</option>
                            ))}
                          </select>
                          <ActivePokemon pokemon={battleState.opponentTeam[idx]} onHpChange={(hp) => updateHp('opp', idx, hp)} variant="opponent" />
                        </div>
                      ))}
                    </div>
                  </div>
                  {/* My Field */}
                  <div className="space-y-4">
                    <h3 className="text-xs font-bold text-blue-500 uppercase tracking-widest text-center">Your Field</h3>
                    <div className="flex flex-col gap-4">
                      {battleState.myActiveIndices.map((idx, activePos) => (
                        <div key={activePos} className="space-y-2">
                          <select 
                            className="w-full bg-slate-900 border border-slate-800 text-[10px] p-1 rounded-lg"
                            value={idx}
                            onChange={(e) => {
                              const newIndices = [...battleState.myActiveIndices];
                              newIndices[activePos] = parseInt(e.target.value);
                              setBattleState({...battleState, myActiveIndices: newIndices});
                            }}
                          >
                            {battleState.myTeam.map((p, i) => (
                              <option key={i} value={i}>{p.name} {p.currentHp <= 0 ? '(Fainted)' : ''}</option>
                            ))}
                          </select>
                          <ActivePokemon pokemon={battleState.myTeam[idx]} onHpChange={(hp) => updateHp('my', idx, hp)} />
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>

              {/* Recommendation View */}
              <div className="xl:col-span-1 space-y-6">
                <div className="bg-slate-900 rounded-3xl border border-slate-800 p-8 h-full">
                  <h3 className="text-xl font-bold mb-6 flex items-center gap-2"><Brain className="text-purple-500" /> Strategic Analysis</h3>
                  
                  <div className="space-y-6">
                    <button 
                      onClick={() => setRecommendations(calculateBestMoves(battleState))}
                      className="w-full py-4 bg-purple-600 hover:bg-purple-500 rounded-2xl font-bold transition-all flex items-center justify-center gap-2"
                    >
                      <Zap className="w-5 h-5" /> Calculate Best Moves
                    </button>

                    {recommendations.length > 0 ? (
                      <div className="space-y-4">
                        {recommendations.map((rec, i) => (
                          <div key={i} className="p-4 bg-slate-950 border-l-4 border-purple-500 rounded-r-xl">
                            <div className="text-xs font-bold text-purple-400 uppercase mb-1">Recommendation {i + 1}</div>
                            <div className="text-lg font-bold">{rec.type}: {rec.name}</div>
                            <div className="text-sm text-slate-300 mt-3">
                              <FormattedAIText text={rec.reason} />
                            </div>
                          </div>
                        ))}
                        <button 
                          disabled={isLoadingAI}
                          onClick={async () => {
                            setIsLoadingAI(true);
                            setAiError(null);
                            try {
                              const prompt = generateAIPrompt(battleState, recommendations);
                              const result = await getAIResponse(prompt);
                              setAiStrategy(result);
                              setAiDiscussionHistory(prev => (prev.length > 0 ? prev : [{ role: 'ai', text: result }]));
                            } catch (err) {
                              setAiError('Failed to get AI strategy.');
                            } finally {
                              setIsLoadingAI(false);
                            }
                          }}
                          className="w-full p-4 bg-slate-800/30 hover:bg-slate-800/50 rounded-xl text-xs text-slate-500 italic text-left transition-all flex items-center justify-between group"
                        >
                          <span>{isLoadingAI ? 'Consulting AI Expert...' : 'Get deep AI meta-strategy for this turn...'}</span>
                          {!isLoadingAI && <Brain className="w-4 h-4 opacity-0 group-hover:opacity-100 transition-opacity" />}
                        </button>

                        {aiStrategy && (
                          <div className="p-6 bg-purple-900/10 border border-purple-500/20 rounded-2xl text-slate-300 text-sm leading-relaxed">
                            <div className="flex items-center gap-2 mb-2 text-purple-400 font-bold uppercase text-[10px]">
                              <Brain className="w-3 h-3" /> AI Expert Insight
                            </div>
                            <FormattedAIText text={aiStrategy} />
                          </div>
                        )}
                      </div>
                    ) : (
                      <div className="p-12 border-2 border-dashed border-slate-800 rounded-3xl text-center text-slate-600">
                        Select "Calculate" to see best moves
                      </div>
                    )}
                  </div>
                </div>
              </div>

              <div className="xl:col-span-3" style={{ display: 'flex', justifyContent: 'center' }}>
                <div
                  className="p-8 bg-slate-900 rounded-3xl border border-slate-800"
                  style={{ width: 'min(1280px, 100%)' }}
                >
                  <div className="flex items-center justify-between gap-4">
                    <div className="text-sm font-bold text-slate-200">Next Turn Discussion</div>
                    <div className="text-xs text-slate-500">Turn {battleState.turn + 1}+</div>
                  </div>

                  {aiDiscussionHistory.length > 0 && (
                    <div className="mt-5 space-y-3">
                      {aiDiscussionHistory.slice(-6).map((m, idx) => (
                        <div key={idx} className={`p-5 rounded-2xl border ${m.role === 'user' ? 'bg-blue-900/10 border-blue-500/20' : 'bg-purple-900/10 border-purple-500/20'}`}>
                          <div className={`text-[11px] font-bold uppercase tracking-widest mb-2 ${m.role === 'user' ? 'text-blue-400' : 'text-purple-400'}`}>
                            {m.role === 'user' ? 'You' : 'AI'}
                          </div>
                          <FormattedAIText text={m.text} />
                        </div>
                      ))}
                    </div>
                  )}

                  <textarea
                    value={aiDiscussionInput}
                    onChange={(e) => setAiDiscussionInput(e.target.value)}
                    placeholder="Write real-state updates (HP/status/opponent switches), or questions for Turn 2+..."
                    className="mt-5 w-full bg-slate-950 border border-slate-800 rounded-2xl p-5 text-sm text-slate-200 focus:outline-none focus:ring-2 focus:ring-purple-500"
                    style={{ minWidth: 'calc(100vh - 280px)' }}
                  />

                  <div className="mt-4 flex justify-center">
                    <button
                      disabled={isLoadingAI || !aiDiscussionInput.trim()}
                      onClick={async () => {
                        setIsLoadingAI(true);
                        setAiError(null);
                        const userMsg = aiDiscussionInput.trim();
                        const nextHistory: DiscussionMessage[] = [...aiDiscussionHistory, { role: 'user', text: userMsg }];
                        setAiDiscussionInput('');
                        setAiDiscussionHistory(nextHistory);
                        try {
                          const prompt = generateAIPrompt(battleState, recommendations, userMsg, nextHistory);
                          const result = await getAIResponse(prompt);
                          setAiStrategy(result);
                          setAiDiscussionHistory(prev => [...prev, { role: 'ai' as const, text: result }]);
                        } catch (err) {
                          setAiError('Failed to get AI follow-up.');
                        } finally {
                          setIsLoadingAI(false);
                        }
                      }}
                      className="w-full max-w-2xl py-4 bg-purple-600 hover:bg-purple-500 disabled:bg-slate-800 disabled:text-slate-600 rounded-2xl font-bold transition-all flex items-center justify-center gap-2"
                    >
                      <Brain className="w-5 h-5" /> Ask AI (Turn 2+)
                    </button>
                  </div>

                  {aiError && (
                    <div className="mt-4 p-4 bg-red-900/20 border border-red-900/50 rounded-2xl text-red-300 text-sm">
                      {aiError}
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

    </div>
  );
}

function PokemonSlot({ pokemon, onRemove, onClick, variant = 'my' }: { pokemon?: BattlePokemon, onRemove: () => void, onClick: () => void, variant?: 'my' | 'opponent' }) {
  if (!pokemon) return <div className="h-32 bg-slate-900/30 border-2 border-dashed border-slate-800 rounded-2xl flex items-center justify-center text-slate-700"><Plus className="w-6 h-6" /></div>;
  return (
    <div 
      onClick={onClick}
      className={`h-32 rounded-2xl border ${variant === 'my' ? 'bg-slate-900 border-slate-800 hover:border-blue-500/50' : 'bg-red-950/10 border-red-900/20 hover:border-red-500/50'} p-4 flex flex-col group cursor-pointer transition-all relative overflow-hidden`}
    >
      <div className="flex justify-between items-start z-10">
        <div>
          <div className="flex items-center gap-2">
            <div className="font-bold">{pokemon.name}</div>
            {pokemon.item && (
              <div className="flex items-center gap-1 text-[9px] bg-slate-800 text-slate-300 px-2 py-0.5 rounded border border-slate-700">
                <Shield className="w-2.5 h-2.5" /> {pokemon.item}
              </div>
            )}
          </div>
          <div className="flex gap-1 mt-1">
            {pokemon.types.map(t => <span key={t} className="text-[8px] px-2 py-0.5 rounded-full bg-slate-800 border border-slate-700 text-slate-400">{t}</span>)}
          </div>
        </div>
        <button 
          onClick={(e) => {
            e.stopPropagation();
            onRemove();
          }} 
          className="text-slate-500 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-all p-1"
        >
          <Trash2 className="w-4 h-4" />
        </button>
      </div>
      
      <div className="mt-2 flex flex-wrap gap-1 z-10">
        {pokemon.selectedMoves.length > 0 ? (
          pokemon.selectedMoves.map(m => (
            <span key={m.id} className="text-[7px] px-1.5 py-0.5 rounded bg-blue-900/20 text-blue-400 border border-blue-500/20 uppercase font-bold">{m.name}</span>
          ))
        ) : (
          <span className="text-[8px] text-slate-600 italic">No moves selected</span>
        )}
      </div>

      <div className="mt-auto flex justify-between text-[10px] text-slate-500 uppercase font-bold tracking-tighter z-10">
        <span>HP: {pokemon.stats.hp}</span>
        <span>SPE: {pokemon.stats.spe}</span>
      </div>
    </div>
  );
}

function ActivePokemon({ pokemon, onHpChange, variant = 'my' }: { pokemon: BattlePokemon, onHpChange: (hp: number) => void, variant?: 'my' | 'opponent' }) {
  const hpPercentage = (pokemon.currentHp / pokemon.stats.hp) * 100;
  const hpColor = hpPercentage > 50 ? 'bg-green-500' : hpPercentage > 20 ? 'bg-yellow-500' : 'bg-red-500';

  return (
    <div className={`w-full max-w-[200px] p-4 rounded-3xl border ${variant === 'my' ? 'bg-slate-900 border-slate-700' : 'bg-slate-900 border-red-900/30'} space-y-4`}>
      <div className="text-center">
        <div className="font-bold text-lg">{pokemon.name}</div>
        <div className="flex justify-center gap-1 mt-1">
          {pokemon.types.map(t => <span key={t} className="text-[8px] px-1.5 py-0.5 rounded-full bg-slate-800 border border-slate-700">{t}</span>)}
        </div>
      </div>
      
      <div className="space-y-1">
        <div className="flex justify-between text-[10px] font-bold text-slate-400 uppercase tracking-widest">
          <span>HP</span>
          <span>{Math.round(pokemon.currentHp)}/{pokemon.stats.hp}</span>
        </div>
        <div className="h-2 bg-slate-800 rounded-full overflow-hidden">
          <div className={`h-full ${hpColor} transition-all duration-500`} style={{ width: `${hpPercentage}%` }} />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <button onClick={() => onHpChange(pokemon.currentHp - 20)} className="py-1 bg-slate-800 hover:bg-slate-700 rounded-lg text-[10px] font-bold">-20 HP</button>
        <button onClick={() => onHpChange(pokemon.currentHp + 20)} className="py-1 bg-slate-800 hover:bg-slate-700 rounded-lg text-[10px] font-bold">+20 HP</button>
      </div>
    </div>
  );
}
