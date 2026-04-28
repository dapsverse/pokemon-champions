"use client";

import React, { useState, useEffect } from "react";
import { Pokemon, BattlePokemon, Move, Ability, Stats } from "../types/pokemon";
import { Search, Trash2, X, Activity, Loader2, RefreshCw } from "lucide-react";
import { getAIResponse } from "../lib/ai-actions";
import { generateTeamPredictionPrompt } from "../lib/ai-helper";
import { BattleState } from "../types/pokemon";

const typeColors: Record<string, string> = {
  Normal: "bg-gray-400 shadow-[0_0_6px_rgba(156,163,175,0.9)]",
  Fire: "bg-red-500 shadow-[0_0_6px_rgba(239,68,68,0.9)]",
  Water: "bg-blue-500 shadow-[0_0_6px_rgba(59,130,246,0.9)]",
  Electric: "bg-yellow-400 shadow-[0_0_6px_rgba(250,204,21,0.9)]",
  Grass: "bg-green-500 shadow-[0_0_6px_rgba(34,197,94,0.9)]",
  Ice: "bg-cyan-300 shadow-[0_0_6px_rgba(103,232,249,0.9)]",
  Fighting: "bg-red-700 shadow-[0_0_6px_rgba(185,28,28,0.9)]",
  Poison: "bg-purple-500 shadow-[0_0_6px_rgba(168,85,247,0.9)]",
  Ground: "bg-yellow-600 shadow-[0_0_6px_rgba(202,138,4,0.9)]",
  Flying: "bg-indigo-300 shadow-[0_0_6px_rgba(165,180,252,0.9)]",
  Psychic: "bg-pink-500 shadow-[0_0_6px_rgba(236,72,153,0.9)]",
  Bug: "bg-lime-500 shadow-[0_0_6px_rgba(132,204,22,0.9)]",
  Rock: "bg-yellow-700 shadow-[0_0_6px_rgba(161,98,7,0.9)]",
  Ghost: "bg-purple-700 shadow-[0_0_6px_rgba(126,34,206,0.9)]",
  Dragon: "bg-indigo-600 shadow-[0_0_6px_rgba(79,70,229,0.9)]",
  Dark: "bg-gray-800 shadow-[0_0_6px_rgba(31,41,55,0.9)]",
  Steel: "bg-gray-500 shadow-[0_0_6px_rgba(107,114,128,0.9)]",
  Fairy: "bg-pink-300 shadow-[0_0_6px_rgba(249,168,212,0.9)]",
};

export default function Dashboard() {
  const [allPokemon, setAllPokemon] = useState<Pokemon[]>([]);
  const [filteredPokemon, setFilteredPokemon] = useState<Pokemon[]>([]);
  const [allMoves, setAllMoves] = useState<Record<string, Move>>({});
  const [allMovesList, setAllMovesList] = useState<Move[]>([]);
  const [isRefreshingPokemon, setIsRefreshingPokemon] = useState(false);
  const [loadError, setLoadError] = useState<Record<string, boolean>>({});

  // Teams
  const [myTeam, setMyTeam] = useState<(BattlePokemon | null)[]>(
    Array(6).fill(null),
  );
  const [oppTeam, setOppTeam] = useState<(BattlePokemon | null)[]>(
    Array(6).fill(null),
  );

  // Team Management
  const [teamNameInput, setTeamNameInput] = useState("");
  const [savedMyTeams, setSavedMyTeams] = useState<
    { id: string; name: string; team: (BattlePokemon | null)[] }[]
  >([]);

  // Modal State
  const [editingSlot, setEditingSlot] = useState<{
    team: "my" | "opp";
    index: number;
  } | null>(null);
  const [modalSearch, setModalSearch] = useState("");
  const [modalSelectedPokemon, setModalSelectedPokemon] =
    useState<Pokemon | null>(null);
  const [modalSelectedMoves, setModalSelectedMoves] = useState<Move[]>([]);
  const [modalSelectedItem, setModalSelectedItem] = useState<string>("");
  const [modalSelectedAbility, setModalSelectedAbility] =
    useState<Ability | null>(null);
  const [modalSelectedNature, setModalSelectedNature] = useState<string>("");
  const [modalEvs, setModalEvs] = useState<Stats>({
    hp: 0,
    atk: 0,
    def: 0,
    spa: 0,
    spd: 0,
    spe: 0,
  });
  const [modalMoveSearch, setModalMoveSearch] = useState("");

  // AI State
  const [aiPrediction, setAiPrediction] = useState<string | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [battleHistory, setBattleHistory] = useState<string>("");
  const [battleUpdate, setBattleUpdate] = useState<string>("");

  const [pokedexNumberByBaseId, setPokedexNumberByBaseId] = useState<
    Record<string, number>
  >({});
  const [pokemonStatsByName, setPokemonStatsByName] = useState<
    Record<string, { stats: Stats; bst?: number }>
  >({});

  const [items, setItems] = useState<string[]>([]);
  const [baseItems, setBaseItems] = useState<string[]>([]);

  const natures = [
    "Hardy",
    "Lonely",
    "Brave",
    "Adamant",
    "Naughty",
    "Bold",
    "Docile",
    "Relaxed",
    "Impish",
    "Lax",
    "Timid",
    "Hasty",
    "Serious",
    "Jolly",
    "Naive",
    "Modest",
    "Mild",
    "Quiet",
    "Bashful",
    "Rash",
    "Calm",
    "Gentle",
    "Sassy",
    "Careful",
    "Quirky",
  ];

  const applyPokemonData = (data: Pokemon[]) => {
    setAllPokemon(data);
    if (modalSearch.length > 1) {
      setFilteredPokemon(
        data.filter((p) =>
          p.name.toLowerCase().includes(modalSearch.toLowerCase()),
        ),
      );
    } else {
      setFilteredPokemon(data.slice(0, 20));
    }
  };

  const refreshPokemonData = async () => {
    setIsRefreshingPokemon(true);
    setLoadError((prev) => ({ ...prev, pokemon: false }));
    try {
      const res = await fetch(`/data/pokemon.json?t=${Date.now()}`, {
        cache: "no-store",
      });
      if (!res.ok)
        throw new Error(`Failed to fetch pokemon.json: ${res.status}`);
      const data = await res.json();
      applyPokemonData(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error("Error refreshing pokemon data:", err);
      setLoadError((prev) => ({ ...prev, pokemon: true }));
    } finally {
      setIsRefreshingPokemon(false);
    }
  };

  const loadInitialData = async () => {
    setLoadError({ moves: false, stats: false, items: false });

    // Fetch Moves
    try {
      const movesRes = await fetch(`/data/moves.json?t=${Date.now()}`);
      if (movesRes.ok) {
        const movesData = await movesRes.json();
        if (Array.isArray(movesData)) {
          const moveMap: Record<string, Move> = {};
          const list: Move[] = [];
          movesData.forEach((m: Move) => {
            if (m && m.name) {
              moveMap[m.name] = m;
              moveMap[m.id] = m;
              list.push(m);
            }
          });
          setAllMoves(moveMap);
          setAllMovesList(list);
        } else {
          throw new Error("Moves data is not an array");
        }
      } else {
        throw new Error(`Failed to load moves: ${movesRes.status}`);
      }
    } catch (err) {
      console.error("Error loading moves:", err);
      setLoadError((prev) => ({ ...prev, moves: true }));
    }

    // Fetch Stats
    try {
      const statsRes = await fetch(`/data/pokemon_stats.json?t=${Date.now()}`);
      if (statsRes.ok) {
        const statsData = await statsRes.json();
        const map: Record<string, { stats: Stats; bst?: number }> = {};
        (Array.isArray(statsData) ? statsData : []).forEach((entry: any) => {
          if (!entry?.name || !entry?.stats) return;
          map[entry.name.toLowerCase()] = {
            stats: entry.stats,
            bst: entry.bst,
          };
        });
        setPokemonStatsByName(map);
      } else {
        throw new Error(`Failed to load stats: ${statsRes.status}`);
      }
    } catch (err) {
      console.error("Error loading stats:", err);
      setLoadError((prev) => ({ ...prev, stats: true }));
    }

    // Fetch Items
    try {
      const itemsRes = await fetch(`/data/items.json?t=${Date.now()}`);
      if (itemsRes.ok) {
        const itemsData = await itemsRes.json();
        if (Array.isArray(itemsData)) {
            // Remove duplicates from itemsData based on name
            const uniqueItems = itemsData.filter((item, index, self) =>
              index === self.findIndex((t) => t.name === item.name)
            );
            const itemNames = uniqueItems.map((i: any) => i.name);
            setBaseItems(itemNames);
          const megaStonesList = [
            "Abomasite",
            "Absolite",
            "Aerodactylite",
            "Aggronite",
            "Alakazite",
            "Altarianite",
            "Ampharosite",
            "Audinite",
            "Banettite",
            "Beedrillite",
            "Blastoisinite",
            "Blazikenite",
            "Cameruptite",
            "Charizardite X",
            "Charizardite Y",
            "Diancite",
            "Galladite",
            "Garchompite",
            "Gardevoirite",
            "Gengarite",
            "Glalitite",
            "Gyaradosite",
            "Heracronite",
            "Houndoominite",
            "Kangaskhanite",
            "Latiasite",
            "Latiosite",
            "Lopunnite",
            "Lucarionite",
            "Manectite",
            "Mawilite",
            "Medichamite",
            "Metagrossite",
            "Mewtwonite X",
            "Mewtwonite Y",
            "Pidgeotite",
            "Pinsirite",
            "Sablenite",
            "Salamencite",
            "Sceptilite",
            "Scizorite",
            "Sharpedonite",
            "Slowbronite",
            "Steelixite",
            "Swampertite",
            "Tyranitarite",
            "Venusaurite",
          ];
          setItems([...itemNames, ...megaStonesList]);
        } else {
          throw new Error("Items data is not an array");
        }
      } else {
        throw new Error(`Failed to load items: ${itemsRes.status}`);
      }
    } catch (err) {
      console.error("Error loading items:", err);
      setLoadError((prev) => ({ ...prev, items: true }));
    }
  };

  useEffect(() => {
    refreshPokemonData();
    loadInitialData();
  }, []);

  useEffect(() => {
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem("pca:savedMyTeams");
      if (saved) setSavedMyTeams(JSON.parse(saved));
      const lastTeam = localStorage.getItem("pca:lastMyTeam");
      if (lastTeam) setMyTeam(JSON.parse(lastTeam));
    }
  }, []);

  useEffect(() => {
    if (typeof window !== "undefined") {
      localStorage.setItem("pca:lastMyTeam", JSON.stringify(myTeam));
      localStorage.setItem("pca:savedMyTeams", JSON.stringify(savedMyTeams));
    }
  }, [myTeam, savedMyTeams]);

  useEffect(() => {
    if (modalSearch.length > 1) {
      setFilteredPokemon(
        allPokemon.filter((p) =>
          p.name.toLowerCase().includes(modalSearch.toLowerCase()),
        ),
      );
    } else {
      setFilteredPokemon(allPokemon.slice(0, 20));
    }
  }, [modalSearch, allPokemon]);

  useEffect(() => {
    const candidates: Pokemon[] = [];
    candidates.push(...filteredPokemon.slice(0, 40));
    if (modalSelectedPokemon) candidates.push(modalSelectedPokemon);
    candidates.push(...myTeam.filter((p): p is BattlePokemon => p !== null));
    candidates.push(...oppTeam.filter((p): p is BattlePokemon => p !== null));

    const getBaseId = (p: Pokemon) => {
      let id = (p.id || "").toLowerCase();
      if (!id)
        id = p.name
          .toLowerCase()
          .replace(/[^\w]+/g, "-")
          .replace(/(^-|-$)/g, "");
      
      // Fix regional forms for PokeAPI
      if (id === "alolan-raichu") return "raichu-alola";
      if (id === "alolan-exeggutor") return "exeggutor-alola";
      if (id === "alolan-marowak") return "marowak-alola";
      if (id === "galarian-weezing") return "weezing-galar";
      if (id.includes("alolan-")) id = id.replace("alolan-", "") + "-alola";
      if (id.includes("galarian-")) id = id.replace("galarian-", "") + "-galar";
      if (id.includes("hisuian-")) id = id.replace("hisuian-", "") + "-hisui";

      if (id.startsWith("mega-")) id = id.slice(5);
      if (id.endsWith("-x") || id.endsWith("-y")) id = id.slice(0, -2);
      return id;
    };

    const toFetch: string[] = [];
    for (const p of candidates) {
      const dexMatch = p.id.match(/\d+/);
      const explicitDex =
        p.pokedexNumber || (dexMatch ? parseInt(dexMatch[0]) : null);
      if (explicitDex) continue;
      const baseId = getBaseId(p);
      if (!baseId) continue;
      const cached = pokedexNumberByBaseId[baseId];
      if (typeof cached === "number") continue;
      toFetch.push(baseId);
    }

    const uniqueToFetch = Array.from(new Set(toFetch)).slice(0, 30);
    if (uniqueToFetch.length === 0) return;

    setPokedexNumberByBaseId((prev) => {
      const next = { ...prev };
      for (const baseId of uniqueToFetch) next[baseId] = -1;
      return next;
    });

    uniqueToFetch.forEach(async (baseId) => {
      try {
        const res = await fetch(`https://pokeapi.co/api/v2/pokemon/${baseId}`);
        if (!res.ok) throw new Error(`Failed to resolve ${baseId}`);
        const data = await res.json();
        const dex = typeof data?.id === "number" ? data.id : null;
        if (!dex) throw new Error(`Invalid dex id for ${baseId}`);
        setPokedexNumberByBaseId((prev) => ({ ...prev, [baseId]: dex }));
      } catch {
        setPokedexNumberByBaseId((prev) => ({ ...prev, [baseId]: 0 }));
      }
    });
  }, [
    filteredPokemon,
    modalSelectedPokemon,
    myTeam,
    oppTeam,
    pokedexNumberByBaseId,
  ]);

  const getBaseId = (p: Pokemon) => {
    let id = (p.id || "").toLowerCase();
    if (!id)
      id = p.name
        .toLowerCase()
        .replace(/[^\w]+/g, "-")
        .replace(/(^-|-$)/g, "");
    
    // Fix regional forms for PokeAPI
    if (id === "alolan-raichu") return "raichu-alola";
    if (id === "alolan-exeggutor") return "exeggutor-alola";
    if (id === "alolan-marowak") return "marowak-alola";
    if (id === "galarian-weezing") return "weezing-galar";
    if (id.includes("alolan-")) id = id.replace("alolan-", "") + "-alola";
    if (id.includes("galarian-")) id = id.replace("galarian-", "") + "-galar";
    if (id.includes("hisuian-")) id = id.replace("hisuian-", "") + "-hisui";

    if (id.startsWith("mega-")) id = id.slice(5);
    if (id.endsWith("-x") || id.endsWith("-y")) id = id.slice(0, -2);
    return id;
  };

  const getPokedexNumber = (p: Pokemon) => {
    const dexMatch = p.id.match(/\d+/);
    const explicit =
      p.pokedexNumber || (dexMatch ? parseInt(dexMatch[0]) : null);
    if (explicit) return explicit;
    const baseId = getBaseId(p);
    const cached = pokedexNumberByBaseId[baseId];
    if (typeof cached === "number" && cached > 0) return cached;
    return null;
  };

  const openModal = (
    team: "my" | "opp",
    index: number,
    existing?: BattlePokemon | null,
  ) => {
    setEditingSlot({ team, index });
    setModalSearch(existing?.name || "");
    setModalMoveSearch("");

    if (existing) {
      setModalSelectedPokemon(existing);
      setModalSelectedMoves(existing.selectedMoves || []);
      setModalSelectedItem(existing.item || "");
      setModalSelectedAbility(
        existing.activeAbility || existing.abilities?.[0] || null,
      );
      setModalSelectedNature(existing.nature || "Hardy");
      setModalEvs({
        hp: existing.evs?.hp ?? 0,
        atk: existing.evs?.atk ?? 0,
        def: existing.evs?.def ?? 0,
        spa: existing.evs?.spa ?? 0,
        spd: existing.evs?.spd ?? 0,
        spe: existing.evs?.spe ?? 0,
      });
      return;
    }

    setModalSelectedPokemon(null);
    setModalSelectedMoves([]);
    setModalSelectedItem("");
    setModalSelectedAbility(null);
    setModalSelectedNature("");
    setModalEvs({ hp: 0, atk: 0, def: 0, spa: 0, spd: 0, spe: 0 });
  };

  const closeModal = () => {
    setEditingSlot(null);
  };

  const selectPokemonForModal = (p: Pokemon) => {
    const changed = modalSelectedPokemon?.id !== p.id;
    setModalSelectedPokemon(p);
    if (!changed) return;
    setModalSelectedMoves([]);
    setModalSelectedItem("");
    if (editingSlot?.team === "my") {
      setModalSelectedAbility(p.abilities?.[0] || null);
      setModalSelectedNature("Hardy");
      setModalEvs({ hp: 0, atk: 0, def: 0, spa: 0, spd: 0, spe: 0 });
    } else {
      setModalSelectedAbility(null);
      setModalSelectedNature("");
      setModalEvs({ hp: 0, atk: 0, def: 0, spa: 0, spd: 0, spe: 0 });
    }
  };

  useEffect(() => {
    if (!editingSlot || !modalSelectedPokemon) return;
    if (editingSlot.team !== "my") return;
    const abilities = modalSelectedPokemon.abilities || [];
    const currentAbilityOk =
      modalSelectedAbility &&
      abilities.some((a) => a.name === modalSelectedAbility.name);
    if (!currentAbilityOk) setModalSelectedAbility(abilities[0] || null);
    setModalSelectedNature((prev) => (prev ? prev : "Hardy"));
  }, [editingSlot, modalSelectedPokemon]);

  const handleSaveToSlot = () => {
    if (!editingSlot || !modalSelectedPokemon) return;

    let finalMoves = modalSelectedMoves;
    let finalItem = modalSelectedItem;

    if (editingSlot.team === "opp") {
      if (
        finalMoves.length === 0 &&
        modalSelectedPokemon.moves &&
        modalSelectedPokemon.moves.length > 0
      ) {
        const availableMoves = modalSelectedPokemon.moves
          .map((m) => allMoves[m])
          .filter(Boolean);
        finalMoves = availableMoves.slice(0, 4);
      }
      if (!finalItem) {
        const pool = baseItems.length > 0 ? baseItems : items;
        if (pool.length > 0) {
          finalItem = pool[Math.floor(Math.random() * pool.length)];
        } else {
          finalItem = ""; // No items available to randomize
        }
      }
    }

    const natureToUse =
      editingSlot.team === "my" ? modalSelectedNature || "Hardy" : "Hardy";
    const evsToUse =
      editingSlot.team === "my"
        ? modalEvs
        : { hp: 0, atk: 0, def: 0, spa: 0, spd: 0, spe: 0 };
    const finalStats = calculateFinalStats(
      modalSelectedPokemon,
      natureToUse,
      evsToUse,
    );
    const newMember: BattlePokemon = {
      ...modalSelectedPokemon,
      pokedexNumber: getPokedexNumber(modalSelectedPokemon) || undefined,
      stats: finalStats,
      bst:
        finalStats.hp +
        finalStats.atk +
        finalStats.def +
        finalStats.spa +
        finalStats.spd +
        finalStats.spe,
      currentHp: finalStats.hp,
      selectedMoves: finalMoves,
      activeAbility:
        editingSlot.team === "my"
          ? modalSelectedAbility || undefined
          : undefined,
      nature: editingSlot.team === "my" ? natureToUse || undefined : undefined,
      evs: editingSlot.team === "my" ? evsToUse : undefined,
      item: finalItem,
      status: "None",
      toxicCounter: 0,
      statStages: { atk: 0, def: 0, spa: 0, spd: 0, spe: 0 },
    };

    if (editingSlot.team === "my") {
      const newTeam = [...myTeam];
      newTeam[editingSlot.index] = newMember;
      setMyTeam(newTeam);
    } else {
      const newTeam = [...oppTeam];
      newTeam[editingSlot.index] = newMember;
      setOppTeam(newTeam);
    }
    closeModal();
  };

  const saveTeam = () => {
    if (!teamNameInput) return alert("Please enter a team name");
    setSavedMyTeams([
      ...savedMyTeams,
      { id: Date.now().toString(), name: teamNameInput, team: myTeam },
    ]);
    setTeamNameInput("");
    alert("Team saved!");
  };

  const loadTeam = () => {
    if (savedMyTeams.length === 0) return alert("No saved teams");
    const teamToLoad = savedMyTeams[savedMyTeams.length - 1]; // Simply loading the last saved team for now
    setMyTeam(teamToLoad.team);
  };

  const clearTeams = () => {
    setMyTeam(Array(6).fill(null));
    setOppTeam(Array(6).fill(null));
    setAiPrediction(null);
  };

  const handleAnalyze = async () => {
    const validMyTeam = myTeam.filter((p): p is BattlePokemon => p !== null);
    const validOppTeam = oppTeam.filter((p): p is BattlePokemon => p !== null);

    if (validMyTeam.length === 0 || validOppTeam.length === 0) {
      alert("Please add at least one Pokémon to both teams.");
      return;
    }

    if (items.length === 0 && !loadError.items) {
      alert("Loading data... please wait a moment.");
      return;
    }

    // Update history with latest progress if provided
    let updatedHistory = battleHistory;
    if (battleUpdate.trim()) {
      updatedHistory = battleHistory
        ? `${battleHistory}\n- ${battleUpdate.trim()}`
        : `- ${battleUpdate.trim()}`;
      setBattleHistory(updatedHistory);
      setBattleUpdate("");
    }

    setIsAnalyzing(true);
    try {
      const mockState: BattleState = {
        format: "Double",
        myTeam: validMyTeam,
        opponentTeam: validOppTeam,
        myActiveIndices: [],
        opponentActiveIndices: [],
        weather: "None",
        turn: 0,
      };

      const prompt = generateTeamPredictionPrompt(
        mockState,
        updatedHistory,
        baseItems,
      );
      const result = await getAIResponse(prompt);
      setAiPrediction(result);
    } catch (err) {
      console.error(err);
      alert("Failed to analyze battle. Check console or API key.");
    } finally {
      setIsAnalyzing(false);
    }
  };

  const toggleMove = (move: Move) => {
    if (modalSelectedMoves.find((m) => m.id === move.id)) {
      setModalSelectedMoves(modalSelectedMoves.filter((m) => m.id !== move.id));
    } else {
      if (modalSelectedMoves.length < 4) {
        setModalSelectedMoves([...modalSelectedMoves, move]);
      }
    }
  };

  const getSpriteUrl = (p: Pokemon) => {
    const num = getPokedexNumber(p);
    if (num)
      return `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/${num}.png`;
    return "https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/0.png";
  };

  const getDisplayStats = (p: Pokemon) => {
    const entry = pokemonStatsByName[p.name.toLowerCase()];
    if (entry?.stats) {
      return { stats: entry.stats, bst: entry.bst ?? p.bst };
    }
    return { stats: p.stats, bst: p.bst };
  };

  const natureEffects: Record<
    string,
    { up?: keyof Stats; down?: keyof Stats }
  > = {
    Hardy: {},
    Lonely: { up: "atk", down: "def" },
    Brave: { up: "atk", down: "spe" },
    Adamant: { up: "atk", down: "spa" },
    Naughty: { up: "atk", down: "spd" },
    Bold: { up: "def", down: "atk" },
    Docile: {},
    Relaxed: { up: "def", down: "spe" },
    Impish: { up: "def", down: "spa" },
    Lax: { up: "def", down: "spd" },
    Timid: { up: "spe", down: "atk" },
    Hasty: { up: "spe", down: "def" },
    Serious: {},
    Jolly: { up: "spe", down: "spa" },
    Naive: { up: "spe", down: "spd" },
    Modest: { up: "spa", down: "atk" },
    Mild: { up: "spa", down: "def" },
    Quiet: { up: "spa", down: "spe" },
    Bashful: {},
    Rash: { up: "spa", down: "spd" },
    Calm: { up: "spd", down: "atk" },
    Gentle: { up: "spd", down: "def" },
    Sassy: { up: "spd", down: "spe" },
    Careful: { up: "spd", down: "spa" },
    Quirky: {},
  };

  const calculateEvGain = (
    points: number,
    natureMod: "up" | "down" | "neutral",
  ) => {
    const p = Math.max(0, Math.min(32, Math.floor(points)));
    if (natureMod === "up") {
      const extra = Math.floor(Math.min(p, 30) / 10);
      return p + extra;
    }
    if (natureMod === "down") {
      const skipped = [6, 16, 26].filter((t) => t <= p).length;
      return Math.max(0, p - skipped);
    }
    return p;
  };

  const calculateFinalStats = (
    p: Pokemon,
    nature: string,
    evs: Stats,
  ): Stats => {
    const base = getDisplayStats(p).stats;
    const eff = natureEffects[nature] || {};
    const modOf = (stat: keyof Stats): "up" | "down" | "neutral" => {
      if (stat === "hp") return "neutral";
      if (eff.up === stat) return "up";
      if (eff.down === stat) return "down";
      return "neutral";
    };
    return {
      hp: base.hp + calculateEvGain(evs.hp, "neutral"),
      atk: base.atk + calculateEvGain(evs.atk, modOf("atk")),
      def: base.def + calculateEvGain(evs.def, modOf("def")),
      spa: base.spa + calculateEvGain(evs.spa, modOf("spa")),
      spd: base.spd + calculateEvGain(evs.spd, modOf("spd")),
      spe: base.spe + calculateEvGain(evs.spe, modOf("spe")),
    };
  };

  const totalEvs =
    modalEvs.hp +
    modalEvs.atk +
    modalEvs.def +
    modalEvs.spa +
    modalEvs.spd +
    modalEvs.spe;
  const remainingEvs = 66 - totalEvs;

  const setEv = (key: keyof Stats, value: number) => {
    const nextRaw = Number.isFinite(value) ? Math.floor(value) : 0;
    const clamped = Math.max(0, Math.min(32, nextRaw));
    const otherTotal = totalEvs - modalEvs[key];
    const allowedMax = Math.max(0, Math.min(32, 66 - otherTotal));
    const finalVal = Math.min(clamped, allowedMax);
    setModalEvs((prev) => ({ ...prev, [key]: finalVal }));
  };

  const bumpEv = (key: keyof Stats, delta: number) => {
    setEv(key, (modalEvs[key] || 0) + delta);
  };

  const renderSelectedPokemonStats = (p: Pokemon) => {
    const isMy = editingSlot?.team === "my";
    const nature = isMy ? modalSelectedNature || "Hardy" : "Hardy";
    const evs = isMy
      ? modalEvs
      : { hp: 0, atk: 0, def: 0, spa: 0, spd: 0, spe: 0 };
    const stats = calculateFinalStats(p, nature, evs);
    const bst =
      stats.hp + stats.atk + stats.def + stats.spa + stats.spd + stats.spe;
    const cells: Array<[string, number | undefined]> = [
      ["HP", stats?.hp],
      ["ATK", stats?.atk],
      ["DEF", stats?.def],
      ["SPA", stats?.spa],
      ["SPD", stats?.spd],
      ["SPE", stats?.spe],
    ];

    return (
      <div className="rounded-xl border border-slate-800 bg-slate-950/40 p-3">
        <div className="grid grid-cols-3 gap-2">
          {cells.map(([label, value]) => (
            <div
              key={label}
              className="rounded-lg border border-slate-800 bg-slate-900/40 px-2 py-1.5"
            >
              <div className="text-[10px] font-semibold tracking-wide text-slate-400">
                {label}
              </div>
              <div className="text-sm font-bold text-slate-100">
                {typeof value === "number" ? value : "-"}
              </div>
            </div>
          ))}
          <div className="rounded-lg border border-slate-800 bg-slate-900/40 px-2 py-1.5">
            <div className="text-[10px] font-semibold tracking-wide text-slate-400">
              BST
            </div>
            <div className="text-sm font-bold text-slate-100">
              {typeof bst === "number" ? bst : "-"}
            </div>
          </div>
        </div>
      </div>
    );
  };

  const myCount = myTeam.filter(Boolean).length;
  const oppCount = oppTeam.filter(Boolean).length;

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      {/* Background Glows */}
      <div className="pointer-events-none fixed inset-0">
        <div className="absolute left-0 top-0 h-96 w-96 -translate-x-1/3 -translate-y-1/3 rounded-full bg-cyan-500/10 blur-3xl" />
        <div className="absolute right-0 top-32 h-96 w-96 translate-x-1/3 rounded-full bg-orange-500/10 blur-3xl" />
      </div>

      <div className="relative mx-auto w-full max-w-6xl px-6 py-8">
        <div className="mb-6 flex items-end justify-between">
          <div>
            <h1 className="text-3xl font-semibold text-cyan-200">
              Team Builder
            </h1>
            {/* Data Loading Status */}
            <div className="flex gap-2 mt-2">
              {Object.entries(loadError).map(([key, error]) => (
                <div
                  key={key}
                  title={
                    error
                      ? `Error loading ${key}`
                      : `${key} loaded successfully`
                  }
                  className={`flex items-center gap-1 px-1.5 py-0.5 rounded border text-[9px] font-bold uppercase ${error ? "bg-red-500/10 text-red-400 border-red-500/30" : "bg-green-500/10 text-green-400 border-green-500/30"}`}
                >
                  <div
                    className={`h-1 w-1 rounded-full ${error ? "bg-red-500 animate-pulse" : "bg-green-500"}`}
                  />
                  {key}
                </div>
              ))}
              {Object.keys(loadError).length === 0 && (
                <div className="flex items-center gap-1 px-1.5 py-0.5 rounded border text-[9px] font-bold uppercase bg-blue-500/10 text-blue-400 border-blue-500/30">
                  <Loader2 className="h-2 w-2 animate-spin" />
                  Loading Data
                </div>
              )}
            </div>
          </div>

          <button
            className="flex items-center gap-2 rounded-full bg-linear-to-r from-purple-600 to-blue-600 px-6 py-3 font-bold text-white shadow-[0_0_20px_rgba(99,102,241,0.6)] transition hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed"
            onClick={handleAnalyze}
            disabled={isAnalyzing}
          >
            {isAnalyzing ? (
              <Loader2 className="h-5 w-5 animate-spin" />
            ) : (
              <Activity className="h-5 w-5" />
            )}
            {isAnalyzing ? "Analyzing..." : "Analyze Battle"}
          </button>
        </div>

        <div className="grid gap-12 lg:grid-cols-[1fr_auto_1fr]">
          {/* MY TEAM */}
          <section className="space-y-4">
            <div className="flex items-center gap-2 text-lg font-semibold text-cyan-200">
              <span className="inline-flex h-2.5 w-2.5 rounded-full bg-cyan-400 shadow-[0_0_10px_rgba(34,211,238,0.9)]" />
              My Team ({myCount}/6)
            </div>

            <div className="flex gap-2 mb-4">
              <input
                className="flex-1 rounded border border-cyan-400/50 bg-slate-900/60 px-3 py-1.5 text-sm text-slate-200 placeholder:text-slate-500 outline-none"
                placeholder="Team name..."
                value={teamNameInput}
                onChange={(e) => setTeamNameInput(e.target.value)}
              />
              <button
                onClick={saveTeam}
                className="rounded bg-cyan-600/30 border border-cyan-400/50 px-3 py-1.5 text-sm font-semibold text-cyan-200 hover:bg-cyan-500/40 transition"
              >
                Save
              </button>
              <button
                onClick={loadTeam}
                className="rounded bg-slate-800/80 border border-slate-600 px-3 py-1.5 text-sm font-semibold text-slate-300 hover:bg-slate-700 transition"
              >
                Load
              </button>
            </div>

            <div className="grid grid-cols-3 gap-4">
              {myTeam.map((member, idx) => (
                <div
                  key={`my-${idx}`}
                  onClick={() => openModal("my", idx, member)}
                  className="group relative h-44 cursor-pointer rounded-2xl border border-cyan-400/70 bg-slate-900/60 p-3 shadow-[0_0_22px_rgba(34,211,238,0.25)] transition hover:border-cyan-300 hover:shadow-[0_0_30px_rgba(34,211,238,0.4)]"
                >
                  <div className="absolute inset-0 rounded-2xl bg-[radial-gradient(circle_at_top,rgba(15,23,42,0.6),rgba(2,6,23,0.95))]" />
                  <div className="absolute inset-0 rounded-2xl border border-cyan-400/40" />

                  {member ? (
                    <div className="relative z-10 flex h-full flex-col">
                      <div className="absolute left-2 top-1 text-xs text-cyan-100/80">
                        {idx + 1}
                      </div>
                      <button
                        className="absolute right-1 top-1 text-slate-400 hover:text-red-400"
                        onClick={(e) => {
                          e.stopPropagation();
                          const newTeam = [...myTeam];
                          newTeam[idx] = null;
                          setMyTeam(newTeam);
                        }}
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                      <div className="mt-4 flex items-start gap-2">
                        <img
                          className="h-10 w-10 drop-shadow-[0_0_10px_rgba(34,211,238,0.6)]"
                          alt={member.name}
                          src={getSpriteUrl(member)}
                        />
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center justify-between gap-2">
                            <div className="truncate text-xs font-semibold text-slate-100">
                              {member.name}
                            </div>
                            <div className="shrink-0 rounded bg-slate-800/80 px-1.5 py-0.5 text-[10px] font-semibold text-slate-200">
                              {member.nature || "Hardy"}
                            </div>
                          </div>
                          <div className="mt-1 grid grid-cols-3 gap-1">
                            {(
                              [
                                ["HP", member.stats.hp],
                                ["ATK", member.stats.atk],
                                ["DEF", member.stats.def],
                                ["SPA", member.stats.spa],
                                ["SPD", member.stats.spd],
                                ["SPE", member.stats.spe],
                              ] as Array<[string, number]>
                            ).map(([label, value]) => (
                              <div
                                key={label}
                                className="rounded border border-slate-800 bg-slate-900/40 px-1 py-0.5 text-[10px]"
                              >
                                <span className="text-slate-400">{label}</span>{" "}
                                <span className="font-semibold text-slate-100">
                                  {value}
                                </span>
                              </div>
                            ))}
                          </div>
                        </div>
                      </div>
                      <div className="mt-2 grid grid-cols-2 gap-x-2 gap-y-1 overflow-hidden text-[10px] leading-tight text-slate-300">
                        {(member.selectedMoves || []).slice(0, 4).map((m) => (
                          <div key={m.id} className="truncate">
                            {m.name}
                          </div>
                        ))}
                      </div>
                    </div>
                  ) : (
                    <div className="relative z-10 flex h-full items-center justify-center text-3xl text-cyan-200/30 group-hover:text-cyan-200/70 transition">
                      +
                    </div>
                  )}
                </div>
              ))}
            </div>
          </section>

          <div className="flex items-center justify-center">
            <div className="text-4xl font-bold text-cyan-200/90 drop-shadow-[0_0_22px_rgba(34,211,238,0.9)]">
              VS
            </div>
          </div>

          {/* OPPONENT TEAM */}
          <section className="space-y-4">
            <div className="flex items-center gap-2 text-lg font-semibold text-orange-200">
              <span className="inline-flex h-2.5 w-2.5 rounded-full bg-orange-400 shadow-[0_0_10px_rgba(251,146,60,0.9)]" />
              Opponent Team ({oppCount}/6)
            </div>
            <div className="flex gap-2 mb-4 h-9">
              <button
                onClick={clearTeams}
                className="rounded bg-red-900/40 border border-red-500/50 px-4 py-1.5 text-sm font-semibold text-red-300 hover:bg-red-800/60 transition ml-auto"
              >
                Clear All
              </button>
            </div>

            <div className="grid grid-cols-3 gap-4">
              {oppTeam.map((member, idx) => (
                <div
                  key={`opp-${idx}`}
                  onClick={() => openModal("opp", idx, member)}
                  className="group relative h-44 cursor-pointer rounded-2xl border border-orange-400/70 bg-slate-900/60 p-3 shadow-[0_0_22px_rgba(251,146,60,0.25)] transition hover:border-orange-300 hover:shadow-[0_0_30px_rgba(251,146,60,0.4)]"
                >
                  <div className="absolute inset-0 rounded-2xl bg-[radial-gradient(circle_at_top,rgba(15,23,42,0.6),rgba(2,6,23,0.95))]" />
                  <div className="absolute inset-0 rounded-2xl border border-orange-400/40" />

                  {member ? (
                    <div className="relative z-10 flex h-full flex-col">
                      <div className="absolute left-2 top-1 text-xs text-orange-100/80">
                        {idx + 1}
                      </div>
                      <button
                        className="absolute right-1 top-1 text-slate-400 hover:text-red-400"
                        onClick={(e) => {
                          e.stopPropagation();
                          const newTeam = [...oppTeam];
                          newTeam[idx] = null;
                          setOppTeam(newTeam);
                        }}
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                      <div className="mt-4 flex items-start gap-2">
                        <img
                          className="h-10 w-10 drop-shadow-[0_0_10px_rgba(251,146,60,0.6)]"
                          alt={member.name}
                          src={getSpriteUrl(member)}
                        />
                        <div className="min-w-0 flex-1">
                          <div className="truncate text-xs font-semibold text-slate-100">
                            {member.name}
                          </div>
                          <div className="mt-1 grid grid-cols-3 gap-1">
                            {(
                              [
                                ["HP", member.stats.hp],
                                ["ATK", member.stats.atk],
                                ["DEF", member.stats.def],
                                ["SPA", member.stats.spa],
                                ["SPD", member.stats.spd],
                                ["SPE", member.stats.spe],
                              ] as Array<[string, number]>
                            ).map(([label, value]) => (
                              <div
                                key={label}
                                className="rounded border border-slate-800 bg-slate-900/40 px-1 py-0.5 text-[10px]"
                              >
                                <span className="text-slate-400">{label}</span>{" "}
                                <span className="font-semibold text-slate-100">
                                  {value}
                                </span>
                              </div>
                            ))}
                          </div>
                        </div>
                      </div>
                      <div className="mt-2 grid grid-cols-2 gap-x-2 gap-y-1 overflow-hidden text-[10px] leading-tight text-slate-300">
                        {(member.selectedMoves || []).slice(0, 4).map((m) => (
                          <div key={m.id} className="truncate">
                            {m.name}
                          </div>
                        ))}
                      </div>
                    </div>
                  ) : (
                    <div className="relative z-10 flex h-full items-center justify-center text-3xl text-orange-200/30 group-hover:text-orange-200/70 transition">
                      +
                    </div>
                  )}
                </div>
              ))}
            </div>
          </section>
        </div>

        {/* AI Prediction Result */}
        {aiPrediction && (
          <div className="mt-8 space-y-6">
            <div className="rounded-2xl border border-purple-500/50 bg-slate-900/80 p-6 shadow-[0_0_30px_rgba(168,85,247,0.2)]">
              <h2 className="mb-4 text-2xl font-bold text-purple-300 flex items-center gap-2">
                <Activity className="h-6 w-6" /> Pre-Battle Analysis
              </h2>
              <div className="prose prose-invert max-w-none text-slate-300">
                <pre className="whitespace-pre-wrap font-sans text-sm">
                  {aiPrediction}
                </pre>
              </div>
            </div>

            <div className="rounded-2xl border border-cyan-500/50 bg-slate-900/80 p-6 shadow-[0_0_30px_rgba(34,211,238,0.1)]">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-xl font-bold text-cyan-300">
                  Battle Progress
                </h2>
                {battleHistory && (
                  <button
                    onClick={() => setBattleHistory("")}
                    className="text-xs text-slate-400 hover:text-red-400 underline"
                  >
                    Clear History
                  </button>
                )}
              </div>

              {battleHistory && (
                <div className="mb-4 rounded-lg bg-slate-950/50 p-3 text-xs text-slate-400 border border-slate-800">
                  <div className="font-semibold mb-1 text-slate-500">
                    History:
                  </div>
                  <pre className="whitespace-pre-wrap font-sans">
                    {battleHistory}
                  </pre>
                </div>
              )}

              <div className="space-y-3">
                <p className="text-sm text-slate-400">
                  Apa yang terjadi di turn ini? (Contoh: "Mega Delphox menyerang
                  Kingambit dengan Flamethrower, Kingambit selamat dengan 10%
                  HP")
                </p>
                <textarea
                  value={battleUpdate}
                  onChange={(e) => setBattleUpdate(e.target.value)}
                  className="w-full h-24 rounded-lg border border-slate-700 bg-slate-800 p-3 text-slate-200 text-sm outline-none focus:border-cyan-500 transition"
                  placeholder="Ceritakan langkah yang sebenarnya terjadi..."
                />
                <button
                  onClick={handleAnalyze}
                  disabled={isAnalyzing || !battleUpdate.trim()}
                  className="flex items-center gap-2 rounded-lg bg-cyan-600 px-6 py-2.5 font-bold text-white shadow-lg transition hover:bg-cyan-500 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isAnalyzing ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Activity className="h-4 w-4" />
                  )}
                  Update & Re-Analyze
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* SELECTION MODAL */}
      {editingSlot && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div
            className={`w-full max-w-4xl overflow-hidden rounded-2xl border ${editingSlot.team === "my" ? "border-cyan-500/50 shadow-[0_0_40px_rgba(34,211,238,0.2)]" : "border-orange-500/50 shadow-[0_0_40px_rgba(251,146,60,0.2)]"} bg-slate-900 flex flex-col max-h-[90vh]`}
          >
            {/* Modal Header */}
            <div className="flex items-center justify-between border-b border-slate-800 p-4 bg-slate-950">
              <h2 className="text-xl font-bold text-slate-100">
                {editingSlot.team === "my"
                  ? "Add to My Team"
                  : "Add to Opponent Team"}{" "}
                - Slot {editingSlot.index + 1}
              </h2>
              <button
                onClick={closeModal}
                className="text-slate-400 hover:text-white"
              >
                <X />
              </button>
            </div>

            <div className="flex flex-1 overflow-hidden">
              {/* Left Panel - Pokemon List */}
              <div className="w-1/3 border-r border-slate-800 flex flex-col bg-slate-900/50">
                <div className="p-4 border-b border-slate-800">
                  <div className="flex items-center gap-2 rounded-lg bg-slate-800 px-3 py-2">
                    <Search className="h-4 w-4 text-slate-400" />
                    <input
                      autoFocus
                      className="w-full bg-transparent text-sm text-slate-200 outline-none"
                      placeholder="Search Pokémon..."
                      value={modalSearch}
                      onChange={(e) => setModalSearch(e.target.value)}
                    />
                  </div>
                </div>
                <div className="flex-1 overflow-y-auto p-2 space-y-1">
                  {filteredPokemon.map((p) => (
                    <div
                      key={p.id}
                      onClick={() => selectPokemonForModal(p)}
                      className={`flex cursor-pointer items-center gap-3 rounded-lg p-2 transition ${modalSelectedPokemon?.id === p.id ? (editingSlot.team === "my" ? "bg-cyan-900/40 border border-cyan-500/50" : "bg-orange-900/40 border border-orange-500/50") : "hover:bg-slate-800"}`}
                    >
                      <img src={getSpriteUrl(p)} className="h-10 w-10" alt="" />
                      <div>
                        <div className="font-semibold text-slate-200">
                          {p.name}
                        </div>
                        <div className="flex gap-1 mt-1">
                          {p.types.map((t) => (
                            <span
                              key={t}
                              className={`h-2 w-2 rounded-full ${typeColors[t] || "bg-slate-500"}`}
                            />
                          ))}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Right Panel - Configuration */}
              <div className="w-2/3 p-6 overflow-y-auto bg-[radial-gradient(ellipse_at_top_right,rgba(30,41,59,0.5),transparent)]">
                {modalSelectedPokemon ? (
                  <div className="space-y-6">
                    <div className="flex items-center gap-6">
                      <img
                        src={getSpriteUrl(modalSelectedPokemon)}
                        className="h-24 w-24 drop-shadow-[0_0_15px_rgba(255,255,255,0.2)]"
                        alt=""
                      />
                      <div>
                        <h3 className="text-2xl font-bold text-white">
                          {modalSelectedPokemon.name}
                        </h3>
                        <div className="flex gap-2 mt-2">
                          {modalSelectedPokemon.types.map((t) => (
                            <span
                              key={t}
                              className={`px-2 py-0.5 rounded text-xs font-semibold text-white ${typeColors[t] || "bg-slate-500"}`}
                            >
                              {t}
                            </span>
                          ))}
                        </div>
                      </div>
                    </div>

                    {renderSelectedPokemonStats(modalSelectedPokemon)}

                    {/* Configuration Section */}
                    <div className="space-y-4">
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <h4 className="text-sm font-semibold text-slate-400 mb-2">
                            Ability
                          </h4>
                          <select
                            value={modalSelectedAbility?.name || ""}
                            onChange={(e) => {
                              const next =
                                (modalSelectedPokemon.abilities || []).find(
                                  (a) => a.name === e.target.value,
                                ) || null;
                              setModalSelectedAbility(next);
                            }}
                            className={`w-full rounded-lg border border-slate-700 bg-slate-800 p-2.5 text-slate-200 outline-none focus:border-${editingSlot.team === "my" ? "cyan" : "orange"}-500`}
                          >
                            <option value="">Select Ability</option>
                            {(modalSelectedPokemon.abilities || []).map((a) => (
                              <option key={a.name} value={a.name}>
                                {a.name}
                              </option>
                            ))}
                          </select>
                        </div>

                        <div>
                          <h4 className="text-sm font-semibold text-slate-400 mb-2">
                            Nature
                          </h4>
                          <select
                            value={modalSelectedNature}
                            onChange={(e) =>
                              setModalSelectedNature(e.target.value)
                            }
                            className={`w-full rounded-lg border border-slate-700 bg-slate-800 p-2.5 text-slate-200 outline-none focus:border-${editingSlot.team === "my" ? "cyan" : "orange"}-500`}
                          >
                            <option value="">Select Nature</option>
                            {natures.map((n) => (
                              <option key={n} value={n}>
                                {n}
                              </option>
                            ))}
                          </select>
                        </div>
                      </div>

                      {editingSlot.team === "my" && (
                        <div className="rounded-xl border border-slate-800 bg-slate-950/40 p-3">
                          <div className="mb-2 flex items-center justify-between">
                            <h4 className="text-sm font-semibold text-slate-300">
                              EVs
                            </h4>
                            <div
                              className={`text-xs font-semibold ${remainingEvs < 0 ? "text-red-400" : "text-slate-400"}`}
                            >
                              Remaining: {remainingEvs}/66
                            </div>
                          </div>
                          <div className="grid grid-cols-2 gap-3">
                            {(
                              [
                                { key: "hp", label: "HP" },
                                { key: "atk", label: "ATK" },
                                { key: "def", label: "DEF" },
                                { key: "spa", label: "SPA" },
                                { key: "spd", label: "SPD" },
                                { key: "spe", label: "SPE" },
                              ] as Array<{ key: keyof Stats; label: string }>
                            ).map(({ key, label }) => (
                              <div
                                key={key}
                                className="flex items-center justify-between rounded-lg border border-slate-800 bg-slate-900/40 px-2 py-2"
                              >
                                <div className="text-xs font-semibold text-slate-300">
                                  {label}
                                </div>
                                <div className="flex items-center gap-2">
                                  <button
                                    type="button"
                                    onClick={() => bumpEv(key, -1)}
                                    className="h-7 w-7 rounded border border-slate-700 bg-slate-800 text-slate-200 hover:bg-slate-700 disabled:opacity-40"
                                    disabled={modalEvs[key] <= 0}
                                  >
                                    -
                                  </button>
                                  <input
                                    inputMode="numeric"
                                    value={modalEvs[key]}
                                    onChange={(e) =>
                                      setEv(key, Number(e.target.value))
                                    }
                                    className="w-14 rounded border border-slate-700 bg-slate-800 px-2 py-1 text-center text-sm text-slate-100 outline-none"
                                  />
                                  <button
                                    type="button"
                                    onClick={() => bumpEv(key, 1)}
                                    className="h-7 w-7 rounded border border-slate-700 bg-slate-800 text-slate-200 hover:bg-slate-700 disabled:opacity-40"
                                    disabled={
                                      modalEvs[key] >= 32 || remainingEvs <= 0
                                    }
                                  >
                                    +
                                  </button>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      <div>
                        <h4 className="text-sm font-semibold text-slate-400 mb-2">
                          Held Item
                        </h4>
                        <select
                          value={modalSelectedItem}
                          onChange={(e) => setModalSelectedItem(e.target.value)}
                          className={`w-full rounded-lg border border-slate-700 bg-slate-800 p-2.5 text-slate-200 outline-none focus:border-${editingSlot.team === "my" ? "cyan" : "orange"}-500`}
                        >
                          <option value="">
                            {editingSlot.team === "opp"
                              ? "Random / Auto"
                              : "No Item"}
                          </option>
                          {items.length > 0 ? (
                            items.map((item) => (
                              <option key={item} value={item}>
                                {item}
                              </option>
                            ))
                          ) : (
                            <option disabled>
                              {loadError.items
                                ? "Error loading items"
                                : "Loading items..."}
                            </option>
                          )}
                        </select>
                        {loadError.items && (
                          <p className="mt-1 text-[10px] text-red-400">
                            Failed to load items. Please refresh or check data
                            files.
                          </p>
                        )}
                      </div>

                      <div>
                        <div className="flex items-center justify-between mb-2">
                          <h4 className="text-sm font-semibold text-slate-400">
                            Moves ({modalSelectedMoves.length}/4)
                          </h4>
                          <input
                            placeholder="Filter moves..."
                            className="bg-slate-800 border border-slate-700 rounded px-2 py-1 text-xs text-white"
                            value={modalMoveSearch}
                            onChange={(e) => setModalMoveSearch(e.target.value)}
                          />
                        </div>

                        <div className="flex flex-wrap gap-2 mb-3">
                          {modalSelectedMoves.map((m) => (
                            <span
                              key={m.id}
                              className={`flex items-center gap-1 rounded ${editingSlot.team === "my" ? "bg-cyan-900/40 border-cyan-700" : "bg-orange-900/40 border-orange-700"} px-2 py-1 text-sm text-slate-200 border`}
                            >
                              {m.name}
                              <button
                                onClick={() => toggleMove(m)}
                                className="ml-1 text-slate-400 hover:text-red-400"
                              >
                                <X className="h-3 w-3" />
                              </button>
                            </span>
                          ))}
                          {modalSelectedMoves.length === 0 &&
                            editingSlot.team === "opp" && (
                              <span className="text-xs text-slate-500 italic">
                                Will be randomized if left empty
                              </span>
                            )}
                        </div>

                        <div className="grid grid-cols-2 gap-2 max-h-48 overflow-y-auto pr-2">
                          {(() => {
                            const query = modalMoveSearch.trim().toLowerCase();
                            const candidateMoves: Move[] = query
                              ? allMovesList
                                  .filter((m) =>
                                    m?.name?.toLowerCase().includes(query),
                                  )
                                  .slice(0, 80)
                              : (modalSelectedPokemon.moves || [])
                                  .map((name) => allMoves[name])
                                  .filter((m): m is Move => Boolean(m));

                            if (
                              candidateMoves.length === 0 &&
                              allMovesList.length === 0
                            ) {
                              return (
                                <div className="col-span-2 rounded border border-slate-700 bg-slate-800/60 p-3 text-xs text-slate-300 flex items-center gap-2">
                                  {loadError.moves ? (
                                    <>
                                      <X className="h-3 w-3 text-red-400" />
                                      <span className="text-red-400">
                                        Error loading moves. Check moves.json.
                                      </span>
                                    </>
                                  ) : (
                                    <>
                                      <Loader2 className="h-3 w-3 animate-spin" />
                                      <span>Loading moves...</span>
                                    </>
                                  )}
                                </div>
                              );
                            }

                            if (candidateMoves.length === 0) {
                              return (
                                <div className="col-span-2 rounded border border-slate-700 bg-slate-800/60 p-3 text-xs text-slate-300">
                                  No moves found.
                                </div>
                              );
                            }

                            return candidateMoves.map((moveData) => {
                              const isSelected = modalSelectedMoves.some(
                                (m) => m.id === moveData.id,
                              );
                              const themeColor =
                                editingSlot.team === "my" ? "cyan" : "orange";
                              return (
                                <button
                                  key={moveData.id}
                                  onClick={() => toggleMove(moveData)}
                                  className={`flex justify-between rounded p-2 text-left text-sm transition ${isSelected ? `bg-${themeColor}-900/50 border border-${themeColor}-500/50 text-${themeColor}-100` : "bg-slate-800 border border-slate-700 text-slate-300 hover:bg-slate-700"}`}
                                >
                                  <span>{moveData.name}</span>
                                  <span
                                    className={`h-3 w-3 rounded-full mt-1 ${typeColors[moveData.type] || "bg-slate-500"}`}
                                  />
                                </button>
                              );
                            });
                          })()}
                        </div>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="flex h-full items-center justify-center text-slate-500">
                    Select a Pokémon from the list to configure
                  </div>
                )}
              </div>
            </div>

            {/* Modal Footer */}
            <div className="flex items-center justify-end gap-3 border-t border-slate-800 p-4 bg-slate-950">
              <button
                onClick={closeModal}
                className="rounded-lg px-4 py-2 text-sm font-semibold text-slate-300 hover:bg-slate-800"
              >
                Cancel
              </button>
              <button
                onClick={handleSaveToSlot}
                disabled={!modalSelectedPokemon}
                className={`rounded-lg px-6 py-2 text-sm font-semibold text-white shadow-lg transition ${modalSelectedPokemon ? (editingSlot.team === "my" ? "bg-cyan-600 hover:bg-cyan-500 shadow-cyan-500/30" : "bg-orange-600 hover:bg-orange-500 shadow-orange-500/30") : "bg-slate-700 text-slate-400 cursor-not-allowed"}`}
              >
                Save to Slot
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
