#!/usr/bin/env node
/**
 * Semi-automated Gemini WEB UI mockup generation.
 * Opens your Gemini chat, submits each prompt, saves the latest generated image.
 *
 * NOT fully unattended — Google login required, UI selectors may change.
 *
 * Setup (once):
 *   npm run design:mockups:web:login
 *   Log in to Google in the opened browser, then press Enter in the terminal.
 *
 * Generate:
 *   npm run design:mockups:web
 *   npm run design:mockups:web -- --only=03-setup-home-mobile
 *   npm run design:mockups:web -- --interactive   # pause between each screen
 *
 * Env:
 *   GEMINI_CHAT_URL  — default: your chat from mockup-manifest.json
 */
import fs from 'node:fs/promises';
import path from 'node:path';
import readline from 'node:readline';
import { chromium } from '@playwright/test';
import dotenv from 'dotenv';
import {
  buildFullPrompt,
  DEFAULT_GEMINI_CHAT_URL,
  ensureDir,
  fileExists,
  filterMockups,
  loadManifest,
  parseCliArgs,
  resolveOutputDir,
  sleep,
} from './mockupConstants.mjs';

dotenv.config({ path: path.resolve(process.cwd(), '.env') });

const PROFILE_DIR = path.resolve(process.cwd(), '.gemini-playwright-profile');

const waitForEnter = (message) => new Promise((resolve) => {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  rl.question(message, () => {
    rl.close();
    resolve();
  });
});

const INPUT_SELECTORS = [
  'div.ql-editor[contenteditable="true"]',
  'rich-textarea div[contenteditable="true"]',
  '[contenteditable="true"][aria-label]',
  '[contenteditable="true"]',
  'textarea',
];

const SEND_SELECTORS = [
  'button[aria-label*="Send"]',
  'button[mattooltip*="Send"]',
  'button:has-text("Send")',
];

const findPromptInput = async (page) => {
  for (const selector of INPUT_SELECTORS) {
    const locator = page.locator(selector).last();
    if (await locator.count()) {
      return locator;
    }
  }
  return null;
};

const submitPrompt = async (page, prompt) => {
  const input = await findPromptInput(page);
  if (!input) {
    throw new Error('Could not find Gemini prompt input. UI may have changed.');
  }

  await input.click({ timeout: 15000 });
  await input.fill('');
  await input.fill(prompt);

  for (const selector of SEND_SELECTORS) {
    const send = page.locator(selector).last();
    if (await send.count()) {
      await send.click({ timeout: 5000 });
      return;
    }
  }

  await page.keyboard.press('Enter');
};

const downloadLatestChatImage = async (page, outPath) => {
  await page.waitForTimeout(3000);

  const deadline = Date.now() + 120000;
  while (Date.now() < deadline) {
    const images = page.locator('img[src*="googleusercontent"], img[src*="blob:"], img[src*="gg-dl"]');
    const count = await images.count();
    if (count > 0) {
      const img = images.nth(count - 1);
      await img.scrollIntoViewIfNeeded();
      const src = await img.getAttribute('src');
      if (src?.startsWith('blob:')) {
        const buffer = await img.screenshot({ type: 'png' });
        await fs.writeFile(outPath, buffer);
        return 'screenshot-blob';
      }
      if (src?.startsWith('http')) {
        const response = await page.request.get(src);
        if (response.ok()) {
          await fs.writeFile(outPath, Buffer.from(await response.body()));
          return 'download-url';
        }
      }
    }
    await page.waitForTimeout(2000);
  }

  throw new Error('Timed out waiting for generated image in chat.');
};

const run = async () => {
  const args = parseCliArgs(process.argv.slice(2));
  if (!args.priority && args.only.length === 0) {
    args.priority = 1;
  }

  const manifest = await loadManifest();
  const chatUrl = process.env.GEMINI_CHAT_URL || manifest.geminiChatUrl || DEFAULT_GEMINI_CHAT_URL;
  const outputDir = resolveOutputDir(manifest);
  const mockups = filterMockups(manifest.mockups, args);

  await ensureDir(outputDir);
  await ensureDir(PROFILE_DIR);

  if (mockups.length === 0) {
    console.log('No mockups matched filters.');
    return;
  }

  console.log(`Gemini chat: ${chatUrl}`);
  console.log(`Output:      ${outputDir}`);
  console.log(`Mockups:     ${mockups.length}`);

  const context = await chromium.launchPersistentContext(PROFILE_DIR, {
    headless: false,
    viewport: { width: 1280, height: 900 },
    acceptDownloads: true,
  });

  const page = context.pages()[0] || await context.newPage();

  try {
    if (args.login) {
      await page.goto(chatUrl, { waitUntil: 'domcontentloaded', timeout: 120000 });
      console.log('\nLog in to Google/Gemini in the browser window.');
      await waitForEnter('Press Enter here after you are logged in and the chat is ready...\n');
    } else {
      await page.goto(chatUrl, { waitUntil: 'domcontentloaded', timeout: 120000 });
      await sleep(2000);
    }

    let ok = 0;
    let skipped = 0;
    let failed = 0;

    for (const mockup of mockups) {
      const outPath = path.join(outputDir, mockup.filename);
      const fullPrompt = buildFullPrompt(mockup);

      if (!args.force && await fileExists(outPath)) {
        console.log(`skip  ${mockup.filename}`);
        skipped += 1;
        continue;
      }

      console.log(`\n→ ${mockup.filename}`);
      if (args.interactive) {
        console.log(fullPrompt.slice(0, 200) + '...');
        await waitForEnter('Press Enter to submit this prompt (or Ctrl+C to stop)... ');
      }

      try {
        await submitPrompt(page, fullPrompt);
        const method = await downloadLatestChatImage(page, outPath);
        console.log(`  saved (${method})`);
        ok += 1;
      } catch (error) {
        console.error(`  failed: ${error.message}`);
        failed += 1;
        if (args.interactive) {
          await waitForEnter('Fix manually in browser if needed, then Enter to continue... ');
        }
      }

      if (args.delayMs > 0) {
        await sleep(args.delayMs);
      }
    }

    console.log(`\nDone: ${ok} ok, ${skipped} skipped, ${failed} failed`);
    if (failed > 0) process.exitCode = 1;
  } finally {
    await context.close();
  }
};

run().catch((error) => {
  console.error(error);
  process.exit(1);
});
