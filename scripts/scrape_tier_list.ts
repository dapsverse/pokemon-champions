import axios from 'axios';
import * as cheerio from 'cheerio';
import * as fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const TIER_LIST_URL = 'https://game8.co/games/Pokemon-Champions/archives/592465';

async function scrapeTierList() {
    try {
        console.log('Fetching tier list page...');
        const { data: html } = await axios.get(TIER_LIST_URL, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
            }
        });
        const $ = cheerio.load(html);
        const pokemonList: any[] = [];

        const typeMapping: Record<string, string[]> = {
            "Garchomp": ["Dragon", "Ground"],
            "Primarina": ["Water", "Fairy"],
            "Hippowdon": ["Ground"],
            "Corviknight": ["Steel", "Flying"],
            "Archaludon": ["Steel", "Dragon"],
            "Kingambit": ["Dark", "Steel"],
            "Mimikyu": ["Ghost", "Fairy"],
            "Gengar": ["Ghost", "Poison"],
            "Hydreigon": ["Dark", "Dragon"],
            "Meowscarada": ["Grass", "Dark"],
            "Aegislash": ["Steel", "Ghost"],
            "Wash Rotom": ["Electric", "Water"],
            "Scizor": ["Bug", "Steel"],
            "Dragonite": ["Dragon", "Flying"],
            "Dragapult": ["Dragon", "Ghost"],
            "Incineroar": ["Fire", "Dark"],
            "Sneasler": ["Poison", "Fighting"],
            "Sinistcha": ["Grass", "Ghost"],
            "Whimsicott": ["Grass", "Fairy"],
            "Charizard": ["Fire", "Flying"],
            "Toxapex": ["Poison", "Water"],
            "Garganacl": ["Rock"],
            "Tinkaton": ["Fairy", "Steel"],
            "Palafin": ["Water"]
        };

        $('table tr').each((_, row) => {
            const text = $(row).text().trim();
            const statsMatch = text.match(/(\d+)-(\d+)-(\d+)-(\d+)-(\d+)-(\d+)/);
            if (statsMatch) {
                let name = $(row).find('th, td').first().text().trim() || 
                             $(row).prevAll('h2, h3').first().text().trim();
                
                name = name.replace('Base Stats', '').replace('(Shield Forme)', '').trim();
                
                if (name && name.length > 2 && !pokemonList.find(p => p.name === name)) {
                    pokemonList.push({
                        name,
                        types: typeMapping[name] || ["Normal"],
                        stats: {
                            hp: parseInt(statsMatch[1]),
                            atk: parseInt(statsMatch[2]),
                            def: parseInt(statsMatch[3]),
                            spa: parseInt(statsMatch[4]),
                            spd: parseInt(statsMatch[5]),
                            spe: parseInt(statsMatch[6]),
                        },
                        bst: parseInt(statsMatch[1]) + parseInt(statsMatch[2]) + parseInt(statsMatch[3]) + parseInt(statsMatch[4]) + parseInt(statsMatch[5]) + parseInt(statsMatch[6])
                    });
                }
            }
        });

        console.log(`Found ${pokemonList.length} Pokémon with stats.`);
        
        if (pokemonList.length > 0) {
            const dataDir = path.join(__dirname, '../data');
            await fs.mkdir(dataDir, { recursive: true });
            await fs.writeFile(
                path.join(dataDir, 'pokemon.json'), 
                JSON.stringify(pokemonList, null, 2)
            );
            console.log('Saved to data/pokemon.json');
        }

    } catch (error) {
        console.error('Error scraping tier list:', error);
    }
}

scrapeTierList();
