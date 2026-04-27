import axios from 'axios';
import * as cheerio from 'cheerio';
import * as fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const BUILDS_URL = 'https://game8.co/games/Pokemon-Champions/archives/592129';

async function scrapeBuilds() {
    try {
        console.log('Fetching builds page...');
        const { data: html } = await axios.get(BUILDS_URL, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
            }
        });
        const $ = cheerio.load(html);
        const builds: any[] = [];

        const commonPokemonNames = ["Venusaur", "Charizard", "Blastoise", "Clefable", "Ninetales", "Victreebel", "Gengar", "Kangaskhan", "Starmie", "Gyarados", "Dragonite", "Meganium", "Feraligatr", "Azumarill", "Politoed", "Scizor", "Skarmory", "Tyranitar", "Pelipper", "Gardevoir", "Aggron", "Medicham", "Manectric", "Torkoal", "Milotic", "Chimecho", "Empoleon", "Garchomp", "Lucario", "Hippowdon", "Weavile", "Mamoswine", "Gallade", "Froslass", "Rotom", "Excadrill", "Whimsicott", "Zoroark", "Golurk", "Hydreigon", "Volcarona", "Chesnaught", "Delphox", "Greninja", "Vivillon", "Floette", "Meowstic", "Aegislash", "Hawlucha", "Incineroar", "Primarina", "Crabominable", "Toxapex", "Mimikyu", "Corviknight", "Hatterene", "Dragapult", "Basculegion", "Sneasler", "Meowscarada", "Skeledirge", "Garganacl", "Ceruledge", "Scovillain", "Espathra", "Tinkaton", "Palafin", "Orthworm", "Glimmora", "Farigiraf", "Kingambit", "Sinistcha", "Archaludon"];

        $('table tr').each((_, tr) => {
            const firstCell = $(tr).find('td').first();
            const text = firstCell.text().trim();
            
            let pokemonName = "";
            // Find if any common name is in the text
            for (const name of commonPokemonNames) {
                if (text.includes(name)) {
                    pokemonName = name;
                    // Check for Mega
                    if (text.includes('Mega ' + name)) pokemonName = 'Mega ' + name;
                    break;
                }
            }

            if (pokemonName) {
                const moves: string[] = [];
                $(tr).find('a').each((_, el) => {
                    const moveText = $(el).text().trim();
                    // Moves are usually in the last cell or specific links
                    // We only want things that look like moves (not "Build Guide", "Focus Sash", etc.)
                    if (moveText && moveText.length > 2 && 
                        !moveText.includes('Build Guide') && 
                        !moveText.includes('Rating') &&
                        !moveText.includes(pokemonName)) {
                        moves.push(moveText);
                    }
                });
                
                if (moves.length > 0) {
                    builds.push({ pokemonName, moves });
                }
            }
        });

        console.log(`Found ${builds.length} build entries.`);
        
        const dataDir = path.join(__dirname, '../data');
        await fs.mkdir(dataDir, { recursive: true });
        await fs.writeFile(
            path.join(dataDir, 'pokemon_builds.json'), 
            JSON.stringify(builds, null, 2)
        );
        console.log('Saved to data/pokemon_builds.json');

    } catch (error) {
        console.error('Error scraping builds:', error);
    }
}

scrapeBuilds();
