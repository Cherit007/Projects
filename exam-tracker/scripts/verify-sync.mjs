import { chromium } from 'playwright'
import { mkdir } from 'node:fs/promises'
import path from 'node:path'

const BASE = process.env.BASE_URL || 'http://127.0.0.1:4173'
const OUT = process.env.ARTIFACT_DIR || '/opt/cursor/artifacts/screenshots'

await mkdir(OUT, { recursive: true })

const browser = await chromium.launch({ headless: true })
const context = await browser.newContext({
  viewport: { width: 1440, height: 900 },
})
const page = await context.newPage()

// Clear any prior progress
await page.goto(BASE)
await page.evaluate(() => localStorage.removeItem('exam-prep-progress-v1'))
await page.reload()
await page.waitForSelector('.exam-card')

await page.screenshot({
  path: path.join(OUT, 'exampulse-dashboard.png'),
  fullPage: false,
})

await page.goto(`${BASE}/exam/ibpsso`)
await page.waitForSelector('h1')
const title = await page.locator('h1').first().textContent()
if (!title?.includes('IBPS SO')) {
  throw new Error(`Unexpected title on ibpsso: ${title}`)
}

const networks = page.locator('input[type="checkbox"][aria-label="Computer Networks"]')
await networks.scrollIntoViewIfNeeded()
await networks.check()
if (!(await networks.isChecked())) {
  throw new Error('Failed to check Computer Networks on IBPS SO')
}

await page.screenshot({
  path: path.join(OUT, 'exampulse-ibpsso-checked.png'),
  fullPage: false,
})

// Verify localStorage
const stored = await page.evaluate(() =>
  JSON.parse(localStorage.getItem('exam-prep-progress-v1') || '{}'),
)
if (!stored['comp-networking']) {
  throw new Error(`Progress not persisted: ${JSON.stringify(stored)}`)
}

await page.goto(`${BASE}/exam/sebi`)
await page.waitForSelector('h1')
const sebiBox = page.locator('input[type="checkbox"][aria-label="Computer Networks"]')
await sebiBox.scrollIntoViewIfNeeded()
if (!(await sebiBox.isChecked())) {
  throw new Error('Computer Networks NOT synced on SEBI page')
}

await page.screenshot({
  path: path.join(OUT, 'exampulse-sebi-synced.png'),
  fullPage: false,
})

await page.goto(`${BASE}/topics`)
await page.waitForSelector('h1')
const topicsBox = page.locator('input[type="checkbox"][aria-label="Computer Networks"]')
await topicsBox.scrollIntoViewIfNeeded()
if (!(await topicsBox.isChecked())) {
  throw new Error('Computer Networks NOT checked on Shared topics page')
}

await page.screenshot({
  path: path.join(OUT, 'exampulse-shared-topics.png'),
  fullPage: false,
})

// Card navigation
await page.goto(BASE)
await page.waitForSelector('.exam-card')
await page.locator('a.exam-card', { hasText: 'IBPS SO IT' }).first().click()
await page.waitForURL('**/exam/ibpsso')
await page.waitForSelector('h1')

console.log(
  JSON.stringify(
    {
      ok: true,
      title,
      persisted: stored['comp-networking'] === true,
      sebiSynced: true,
      topicsSynced: true,
      cardNav: page.url().includes('/exam/ibpsso'),
      screenshots: [
        'exampulse-dashboard.png',
        'exampulse-ibpsso-checked.png',
        'exampulse-sebi-synced.png',
        'exampulse-shared-topics.png',
      ],
    },
    null,
    2,
  ),
)

await browser.close()
