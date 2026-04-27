import axios from 'axios';
import * as cheerio from 'cheerio';
import * as fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const BASE_URL = 'https://game8.co/games/Pokemon-Champions/archives/501889';

async function scrapePokemonList() {
  try {
    console.log('Fetching main page...');
    const { data: html } = await axios.get(BASE_URL, {
        headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
        }
    });
    const $ = cheerio.load(html);

    const pokemonList: any[] = [];

    // Game8 roster pages often use a table with class 'archive-table' or 'a-table'
    // Let's try to find all tables and see which one has the data
    $('table').each((tableIdx, table) => {
        const rows = $(table).find('tr');
        rows.each((rowIdx, row) => {
            const cols = $(row).find('td');
            if (cols.length >= 2) {
                const name = $(cols[0]).text().trim();
                const statsText = $(cols.last()).text().trim(); // Stats are often in the last column
                
                if (name && statsText.includes('HP')) {
                    const hp = statsText.match(/HP(\d+)/)?.[1];
                    const atk = statsText.match(/Atk(\d+)/)?.[1];
                    const def = statsText.match(/Def(\d+)/)?.[1];
                    const spa = statsText.match(/SpA(\d+)/)?.[1];
                    const spd = statsText.match(/SpD(\d+)/)?.[1];
                    const spe = statsText.match(/Spe(\d+)/)?.[1];
                    const bst = statsText.match(/BST(\d+)/)?.[1];

                    // Types are often in the second column or as images
                    const types: string[] = [];
                    $(cols[1]).find('span, a, img').each((_, el) => {
                        const typeText = $(el).text().trim() || $(el).attr('alt')?.trim();
                        if (typeText && !types.includes(typeText)) {
                            types.push(typeText);
                        }
                    });

                    if (hp) {
                        pokemonList.push({
                            name,
                            types: types.filter(t => t.length > 2), // Filter out short junk
                            stats: {
                                hp: parseInt(hp),
                                atk: parseInt(atk || '0'),
                                def: parseInt(def || '0'),
                                spa: parseInt(spa || '0'),
                                spd: parseInt(spd || '0'),
                                spe: parseInt(spe || '0'),
                            },
                            bst: parseInt(bst || '0')
                        });
                    }
                }
            }
        });
    });

    console.log(`Found ${pokemonList.length} Pokémon.`);
    
    if (pokemonList.length > 0) {
        const dataDir = path.join(__dirname, '../data');
        await fs.mkdir(dataDir, { recursive: true });
        await fs.writeFile(
            path.join(dataDir, 'pokemon.json'), 
            JSON.stringify(pokemonList, null, 2)
        );
        console.log('Saved to data/pokemon.json');
    } else {
        console.log('No Pokémon found. HTML might be dynamic or structure is different.');
        // Log a bit of HTML for debugging
        console.log('HTML Preview:', html.substring(0, 500));
    }

  } catch (error) {
    console.error('Error scraping:', error);
  }
}

scrapePokemonList();
