import axios from 'axios';
import * as cheerio from 'cheerio';
import * as fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const ABILITIES_URL = 'https://game8.co/games/Pokemon-Champions/archives/590403';

async function scrapeAbilities() {
    try {
        console.log('Fetching abilities page...');
        const { data: html } = await axios.get(ABILITIES_URL, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
            }
        });
        const $ = cheerio.load(html);
        const abilities: any[] = [];

        $('table tr').each((_, row) => {
            const cols = $(row).find('td');
            if (cols.length >= 2) {
                const name = $(cols[0]).text().trim();
                const description = $(cols[1]).text().trim();
                if (name && description && name !== 'Ability') {
                    abilities.push({ name, description });
                }
            }
        });

        console.log(`Found ${abilities.length} abilities.`);
        
        const dataDir = path.join(__dirname, '../data');
        await fs.mkdir(dataDir, { recursive: true });
        await fs.writeFile(
            path.join(dataDir, 'abilities.json'), 
            JSON.stringify(abilities, null, 2)
        );
        console.log('Saved to data/abilities.json');

    } catch (error) {
        console.error('Error scraping abilities:', error);
    }
}

scrapeAbilities();
