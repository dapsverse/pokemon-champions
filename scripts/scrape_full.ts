import puppeteer from 'puppeteer';
import * as fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const URL = 'https://game8.co/games/Pokemon-Champions/archives/501889';

async function scrapeFull() {
    const browser = await puppeteer.launch({
        headless: true,
        args: ['--no-sandbox', '--disable-setuid-sandbox']
    });
    const page = await browser.newPage();
    
    console.log(`Navigating to ${URL}...`);
    await page.goto(URL, { waitUntil: 'networkidle2' });
    
    console.log('Waiting for content to render...');
    // Wait for the container first
    await page.waitForSelector('#react-pokemon_pokedex-wrapper', { timeout: 15000 });
    
    // Wait for something that indicates data is loaded
    // Often it's a table or a specific entry
    console.log('Waiting for data to load...');
    await page.waitForFunction(() => {
        const el = document.querySelector('#react-pokemon_pokedex-wrapper');
        const text = el?.textContent || '';
        return text.length > 0 && !text.includes('Loading');
    }, { timeout: 30000 });

    // Extra wait for any animations
    await new Promise(r => setTimeout(r, 2000));
    
    // Get the data
    const text = await page.evaluate(() => {
        const container = document.querySelector('#react-pokemon_pokedex-wrapper');
        return (container as HTMLElement)?.innerText || '';
    });

    if (text.length < 100) {
        console.log('Text too short, maybe failed to load.');
    } else {
        console.log(`Got ${text.length} characters of text.`);
        const dataDir = path.join(__dirname, '../data');
        await fs.mkdir(dataDir, { recursive: true });
        await fs.writeFile(path.join(dataDir, 'raw_text.txt'), text);
        console.log('Saved text to data/raw_text.txt');
    }
    
    await browser.close();
    console.log('Done.');
}

scrapeFull().catch(console.error);
