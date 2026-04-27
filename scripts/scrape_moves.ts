import axios from 'axios';
import * as cheerio from 'cheerio';
import * as fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const MOVES_URL = 'https://game8.co/games/Pokemon-Champions/archives/590397';

async function scrapeMoves() {
    try {
        console.log('Fetching moves page...');
        const { data: html } = await axios.get(MOVES_URL, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
            }
        });
        const $ = cheerio.load(html);
        const moves: any[] = [];

        // In Game8's moves table: 
        // cell[0]: name
        // cell[1]: type (often as text or img)
        // cell[2]: category (Physical, Special, Status)
        // cell[3]: power
        // cell[4]: accuracy
        // cell[5]: pp
        // then a row after it or in same row for description
        
        $('table tr').each((i, row) => {
            const cells = $(row).find('td');
            if (cells.length >= 6) {
                const name = $(cells[0]).text().trim();
                const type = $(cells[1]).text().trim() || $(cells[1]).find('img').attr('alt')?.replace(' Type Icon', '') || 'Normal';
                const category = $(cells[2]).text().trim();
                const power = parseInt($(cells[3]).text().trim()) || 0;
                const accuracy = parseInt($(cells[4]).text().trim()) || 0;
                const pp = parseInt($(cells[5]).text().trim()) || 0;
                
                // Description is often in the next row or a specific cell
                const description = $(row).next().find('td').text().trim() || "";
                
                if (name && name !== 'Move') {
                    moves.push({
                        id: name.toLowerCase().replace(/\s+/g, '-'),
                        name,
                        type,
                        category: category.includes('Physical') ? 'Physical' : category.includes('Special') ? 'Special' : 'Status',
                        power,
                        accuracy,
                        pp,
                        description,
                        priority: name === 'Aqua Jet' || name === 'Quick Attack' || name === 'Sucker Punch' || name === 'Fake Out' ? 1 : 0 // Simplified for now
                    });
                }
            }
        });

        console.log(`Found ${moves.length} moves.`);
        
        const dataDir = path.join(__dirname, '../data');
        await fs.mkdir(dataDir, { recursive: true });
        await fs.writeFile(
            path.join(dataDir, 'moves.json'), 
            JSON.stringify(moves, null, 2)
        );
        console.log('Saved to data/moves.json');

    } catch (error) {
        console.error('Error scraping moves:', error);
    }
}

scrapeMoves();
