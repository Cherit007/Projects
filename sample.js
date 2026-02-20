#!/usr/bin/env node

/**
 * 🚀 SUPER SIMPLE MIGRATION SCRIPT
 * 
 * Just run: node simple-migrate.js
 * 
 * It will:
 * 1. Read badminton-data-2026-02-14.json
 * 2. Read .env for Appwrite config
 * 3. Upload everything to Appwrite
 */

import { Client, Databases, ID } from 'appwrite';
import fs from 'fs';
import dotenv from 'dotenv';

dotenv.config();

// 🎨 Pretty console colors
const green = '\x1b[32m';
const red = '\x1b[31m';
const yellow = '\x1b[33m';
const cyan = '\x1b[36m';
const reset = '\x1b[0m';

console.log(`
${cyan}╔══════════════════════════════════════════════════╗
║  🏸 Badminton Data Migration to Appwrite         ║
╚══════════════════════════════════════════════════╝${reset}
`);

// ✅ Step 1: Load config
console.log(`${cyan}[1/4]${reset} Loading configuration...`);

const config = {
  endpoint: process.env.VITE_APPWRITE_ENDPOINT || 'https://cloud.appwrite.io/v1',
  projectId: process.env.VITE_APPWRITE_PROJECT_ID,
  databaseId: process.env.VITE_APPWRITE_DATABASE_ID,
  collections: {
    tournaments: process.env.VITE_APPWRITE_COLLECTION_TOURNAMENTS,
    players: process.env.VITE_APPWRITE_COLLECTION_PLAYERS,
    ratings: process.env.VITE_APPWRITE_COLLECTION_RATINGS,
  }
};

// Validate
if (!config.projectId || !config.databaseId || !config.collections.tournaments) {
  console.log(`${red}✗ Missing configuration!${reset}`);
  console.log(`${yellow}Please check your .env file has these variables:${reset}`);
  console.log('  - VITE_APPWRITE_PROJECT_ID');
  console.log('  - VITE_APPWRITE_DATABASE_ID');
  console.log('  - VITE_APPWRITE_COLLECTION_TOURNAMENTS');
  console.log('  - VITE_APPWRITE_COLLECTION_PLAYERS');
  console.log('  - VITE_APPWRITE_COLLECTION_RATINGS');
  process.exit(1);
}

console.log(`${green}✓ Configuration loaded${reset}`);

// ✅ Step 2: Load JSON
console.log(`\n${cyan}[2/4]${reset} Loading JSON file...`);

let data;
const filename = 'badminton-data-2026-02-14.json';

try {
  const content = fs.readFileSync(filename, 'utf8');
  data = JSON.parse(content);
  console.log(`${green}✓ Loaded ${filename}${reset}`);
  console.log(`  ${yellow}→ ${data.tournamentHistory?.length || 0} tournaments${reset}`);
  console.log(`  ${yellow}→ ${data.playerDatabase?.length || 0} players${reset}`);
  console.log(`  ${yellow}→ ${Object.keys(data.playerRatings || {}).length} ratings${reset}`);
} catch (error) {
  console.log(`${red}✗ Could not load ${filename}${reset}`);
  console.log(`${yellow}  Make sure the file is in the same directory as this script${reset}`);
  process.exit(1);
}

// ✅ Step 3: Connect to Appwrite
console.log(`\n${cyan}[3/4]${reset} Connecting to Appwrite...`);

const client = new Client()
  .setEndpoint(config.endpoint)
  .setProject(config.projectId);

const databases = new Databases(client);

console.log(`${green}✓ Connected to Appwrite Cloud${reset}`);

// ✅ Step 4: Migrate
console.log(`\n${cyan}[4/4]${reset} Starting migration...`);
console.log(`${yellow}⏳ This will take a few seconds...${reset}\n`);

const results = {
  tournaments: { success: 0, failed: 0 },
  players: { success: 0, failed: 0 },
  ratings: { success: 0, failed: 0 }
};

async function migrate() {
  // Migrate tournaments
  if (data.tournamentHistory?.length > 0) {
    console.log(`${cyan}📊 Migrating tournaments...${reset}`);
    
    for (let i = 0; i < data.tournamentHistory.length; i++) {
      const tournament = data.tournamentHistory[i];
      
      try {
        await databases.createDocument(
          config.databaseId,
          config.collections.tournaments,
          ID.unique(),
          {
            name: tournament.name || 'Tournament',
            date: tournament.date || new Date().toLocaleDateString(),
            teams: JSON.stringify(tournament.teams || []),
            fixtures: JSON.stringify(tournament.fixtures || []),
            bracket: tournament.bracket ? JSON.stringify(tournament.bracket) : null,
            finalMatch: tournament.finalMatch ? JSON.stringify(tournament.finalMatch) : null,
            champion: tournament.champion ? JSON.stringify(tournament.champion) : null,
            format: tournament.format || '1',
            gameMode: tournament.gameMode || 'doubles',
            tournamentFormat: tournament.tournamentFormat || 'league',
            status: tournament.champion ? 'completed' : 'active',
            createdAt: tournament.date || new Date().toISOString()
          }
        );
        
        results.tournaments.success++;
        process.stdout.write(`${green}  ✓ ${i + 1}/${data.tournamentHistory.length}${reset}\r`);
      } catch (error) {
        results.tournaments.failed++;
        console.log(`${red}  ✗ Tournament ${i + 1}: ${error.message}${reset}`);
      }
    }
    
    console.log(`\n${green}  ✓ Completed: ${results.tournaments.success} tournaments${reset}`);
    if (results.tournaments.failed > 0) {
      console.log(`${red}  ✗ Failed: ${results.tournaments.failed}${reset}`);
    }
  }

  // Migrate players
  if (data.playerDatabase?.length > 0) {
    console.log(`\n${cyan}👥 Migrating player database...${reset}`);
    
    try {
      await databases.createDocument(
        config.databaseId,
        config.collections.players,
        ID.unique(),
        {
          players: JSON.stringify(data.playerDatabase),
          updatedAt: new Date().toISOString()
        }
      );
      
      results.players.success++;
      console.log(`${green}  ✓ Migrated ${data.playerDatabase.length} players${reset}`);
    } catch (error) {
      results.players.failed++;
      console.log(`${red}  ✗ Failed: ${error.message}${reset}`);
    }
  }

  // Migrate ratings
  if (data.playerRatings && Object.keys(data.playerRatings).length > 0) {
    console.log(`\n${cyan}⭐ Migrating player ratings...${reset}`);
    
    try {
      await databases.createDocument(
        config.databaseId,
        config.collections.ratings,
        ID.unique(),
        {
          ratings: JSON.stringify(data.playerRatings),
          updatedAt: new Date().toISOString()
        }
      );
      
      results.ratings.success++;
      console.log(`${green}  ✓ Migrated ${Object.keys(data.playerRatings).length} player ratings${reset}`);
    } catch (error) {
      results.ratings.failed++;
      console.log(`${red}  ✗ Failed: ${error.message}${reset}`);
    }
  }

  // Summary
  const total = results.tournaments.success + results.players.success + results.ratings.success;
  const failed = results.tournaments.failed + results.players.failed + results.ratings.failed;

  console.log(`
${cyan}╔══════════════════════════════════════════════════╗
║  ✨ Migration Complete!                           ║
╚══════════════════════════════════════════════════╝${reset}

${green}✅ Successfully migrated: ${total} items${reset}
${failed > 0 ? `${red}❌ Failed: ${failed} items${reset}` : ''}

${yellow}💡 Next steps:${reset}
   1. Visit Appwrite Console to verify data
   2. Refresh your app to load from cloud
   3. Keep JSON file as backup

${green}🎉 Your data is now in the cloud!${reset}
  `);
}

// Run migration
migrate()
  .then(() => process.exit(0))
  .catch(error => {
    console.log(`\n${red}❌ Fatal error: ${error.message}${reset}`);
    console.error(error);
    process.exit(1);
  });