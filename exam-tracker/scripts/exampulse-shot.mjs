import { chromium } from 'playwright'
import fs from 'fs'

const out = '/opt/cursor/artifacts/screenshots'
fs.mkdirSync(out, { recursive: true })
const base = 'http://localhost:4173'

const browser = await chromium.launch({
  executablePath: '/usr/local/bin/google-chrome',
  headless: true,
  args: ['--no-sandbox', '--disable-dev-shm-usage'],
})
const page = await browser.newPage({ viewport: { width: 1280, height: 900 } })
await page.goto(`${base}/`, { waitUntil: 'networkidle' })

await page.evaluate(() => {
  localStorage.setItem(
    'exam-prep-app-v2',
    JSON.stringify({
      completed: {},
      studyLog: [],
      mockScores: [],
      reminders: [],
      starred: ['sebi', 'ssccgl', 'ibpsso'],
      deprioritized: [],
      focusExamId: null,
      errorLog: [],
      revision: [],
    }),
  )
})
await page.reload({ waitUntil: 'networkidle' })

await page.goto(`${base}/topics`, { waitUntil: 'networkidle' })
await page.waitForSelector('.topic-card, .master-topics, .topics-toolbar')
const starBtn = page.locator('button.star-filter')
if (await starBtn.count()) await starBtn.click()
await page.waitForTimeout(400)
await page.screenshot({ path: `${out}/topics-cards-starred.png`, fullPage: true })

await page.locator('.topics-toolbar button', { hasText: 'Matrix' }).click()
await page.waitForSelector('.topic-matrix, .empty-inline')
await page.waitForTimeout(300)
await page.screenshot({ path: `${out}/topics-matrix.png`, fullPage: true })

await page.goto(`${base}/roadmap`, { waitUntil: 'networkidle' })
await page.waitForSelector('.roadmap-summary, .roadmap-empty')
await page.waitForTimeout(400)
await page.screenshot({ path: `${out}/roadmap-desktop.png`, fullPage: true })

await page.setViewportSize({ width: 390, height: 844 })
await page.waitForTimeout(300)
await page.screenshot({ path: `${out}/roadmap-mobile.png`, fullPage: true })

await page.goto(`${base}/topics`, { waitUntil: 'networkidle' })
await page.locator('.topics-toolbar button', { hasText: 'Cards' }).click()
await page.waitForTimeout(300)
await page.screenshot({ path: `${out}/topics-mobile.png`, fullPage: true })

await browser.close()
console.log('screenshots ok')
