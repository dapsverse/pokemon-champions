import axios from 'axios';
import * as cheerio from 'cheerio';
import * as fs from 'fs/promises';
import { existsSync } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const STATS_URL = 'https://game8.co/games/Pokemon-Champions/archives/593888';
const GEN_URLS = [
    'https://game8.co/games/Pokemon-Champions/archives/593719', // Gen 1
    'https://game8.co/games/Pokemon-Champions/archives/593722', // Gen 2
    'https://game8.co/games/Pokemon-Champions/archives/593723', // Gen 3
    'https://game8.co/games/Pokemon-Champions/archives/593724', // Gen 4
    'https://game8.co/games/Pokemon-Champions/archives/593725', // Gen 5
    'https://game8.co/games/Pokemon-Champions/archives/593726', // Gen 6
    'https://game8.co/games/Pokemon-Champions/archives/593727', // Gen 7
    'https://game8.co/games/Pokemon-Champions/archives/593728', // Gen 8
    'https://game8.co/games/Pokemon-Champions/archives/593729'  // Gen 9
];

async function fetchPage(url: string) {
    const { data } = await axios.get(url, {
        headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
        }
    });
    return cheerio.load(data);
}

async function scrapeFullPokedex() {
    try {
        const abilitiesData = JSON.parse(await fs.readFile(path.join(__dirname, '../data/abilities.json'), 'utf-8'));
        const movesData = JSON.parse(await fs.readFile(path.join(__dirname, '../data/moves.json'), 'utf-8'));
        const buildsPath = path.join(__dirname, '../data/pokemon_builds.json');
        const buildsData = existsSync(buildsPath) 
            ? JSON.parse(await fs.readFile(buildsPath, 'utf-8'))
            : [];

        console.log('Fetching base stats...');
        const $stats = await fetchPage(STATS_URL);
        const pokemonMap: Record<string, any> = {};

        // 1. Scrape Stats and Types
        $stats('table tr').each((_, row) => {
            const cols = $stats(row).find('td');
            if (cols.length >= 7) {
                const firstCol = $stats(cols[0]);
                const name = firstCol.find('a').first().text().trim();
                
                if (name && name !== 'Pokemon') {
                    const types: string[] = [];
                    firstCol.find('img').each((i, img) => {
                        const alt = $stats(img).attr('alt') || '';
                        if (alt.includes('Type Icon')) {
                            const type = alt.replace('Pokemon ', '').replace(' Type Icon', '').trim();
                            if (type && !types.includes(type)) {
                                types.push(type);
                            }
                        } else if (alt && !alt.includes(name) && alt.length > 2 && !alt.includes('lazy')) {
                            if (['Normal', 'Fire', 'Water', 'Electric', 'Grass', 'Ice', 'Fighting', 'Poison', 'Ground', 'Flying', 'Psychic', 'Bug', 'Rock', 'Ghost', 'Dragon', 'Steel', 'Dark', 'Fairy'].includes(alt)) {
                                types.push(alt);
                            }
                        }
                    });

                    const stats = {
                        hp: parseInt($stats(cols[1]).text().trim()),
                        atk: parseInt($stats(cols[2]).text().trim()),
                        def: parseInt($stats(cols[3]).text().trim()),
                        spa: parseInt($stats(cols[4]).text().trim()),
                        spd: parseInt($stats(cols[5]).text().trim()),
                        spe: parseInt($stats(cols[6]).text().trim()),
                    };
                    const bst = parseInt($stats(cols[7]).text().trim());
                    
                    pokemonMap[name] = {
                        id: name.toLowerCase().replace(/\s+/g, '-'),
                        name,
                        types,
                        stats,
                        bst,
                        abilities: [],
                        moves: []
                    };
                }
            }
        });

        // 2. Scrape Ability Names from Gen pages
        for (const url of GEN_URLS) {
            console.log(`Fetching ${url}...`);
            const $gen = await fetchPage(url);
            $gen('table tr').each((_, row) => {
                const cells = $gen(row).find('td, th');
                if (cells.length >= 4) {
                    const name = $gen(cells[1]).text().trim();
                    const matchedPokemon = pokemonMap[name];

                    if (matchedPokemon) {
                        const abilityNames: string[] = [];
                        $gen(cells[3]).find('a').each((_, el) => {
                            const ability = $gen(el).text().trim();
                            const isHA = $gen(el).next().text().includes('(HA)') || $gen(el).parent().text().includes(`${ability} (HA)`);
                            if (ability && ability.length > 2 && !isHA && !abilityNames.includes(ability)) {
                                abilityNames.push(ability);
                            }
                        });
                        
                        matchedPokemon.abilities = abilityNames.map(aname => {
                            const found = abilitiesData.find((a: any) => a.name === aname);
                            return { name: aname, description: found ? found.description : "" };
                        });
                    }
                }
            });
        }

        // 3. Clean and merge moves
        const validMoveNames = movesData.map((m: any) => m.name);

        for (const name in pokemonMap) {
            const p = pokemonMap[name];
            
            if (p.abilities.length === 0) {
                let baseName = name;
                if (name.startsWith('Mega ')) baseName = name.replace('Mega ', '');
                else if (name.includes(' (')) baseName = name.split(' (')[0];
                else if (name.includes('Breed')) baseName = "Tauros";
                else if (name.startsWith('Hisuian ')) baseName = name.replace('Hisuian ', '');
                else if (name.startsWith('Galarian ')) baseName = name.replace('Galarian ', '');
                else if (name.startsWith('Alolan ')) baseName = name.replace('Alolan ', '');
                else if (name.startsWith('Paldean ')) baseName = name.replace('Paldean ', '');
                
                if (pokemonMap[baseName] && pokemonMap[baseName].abilities.length > 0) {
                    p.abilities = [...pokemonMap[baseName].abilities];
                }
            }

            const builds = buildsData.filter((b: any) => b.pokemonName === name || (name.includes(b.pokemonName) && b.pokemonName.length > 3));
            if (builds.length > 0) {
                const allMoves = new Set<string>();
                builds.forEach((b: any) => {
                    b.moves.forEach((m: string) => {
                        // Check if move is in valid moves list
                        const cleanMove = m.trim();
                        if (validMoveNames.includes(cleanMove)) {
                            allMoves.add(cleanMove);
                        }
                    });
                });
                p.moves = Array.from(allMoves);
            }
        }

        const finalData = Object.values(pokemonMap);
        console.log(`Total Pokémon scraped: ${finalData.length}`);

        const dataDir = path.join(__dirname, '../data');
        await fs.mkdir(dataDir, { recursive: true });
        await fs.writeFile(
            path.join(dataDir, 'pokemon.json'), 
            JSON.stringify(finalData, null, 2)
        );
        console.log('Saved to data/pokemon.json');

    } catch (error) {
        console.error('Error scraping:', error);
    }
}

scrapeFullPokedex();
