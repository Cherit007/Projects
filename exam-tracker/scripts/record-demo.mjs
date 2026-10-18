import { chromium } from 'playwright'
import { mkdir, copyFile } from 'node:fs/promises'
import path from 'node:path'

const BASE = process.env.BASE_URL || 'http://127.0.0.1:4173'
const TMP = '/tmp/exampulse-demo'
const OUT = '/opt/cursor/artifacts/exampulse-shared-syllabus-demo.mp4'

await mkdir(TMP, { recursive: true })

const browser = await chromium.launch({ headless: true })
const context = await browser.newContext({
  viewport: { width: 1440, height: 900 },
  recordVideo: { dir: TMP, size: { width: 1440, height: 900 } },
})
const page = await context.newPage()

await page.goto(BASE)
await page.evaluate(() => localStorage.removeItem('exam-prep-progress-v1'))
await page.reload()
await page.waitForSelector('.exam-card')
await page.waitForTimeout(800)

await page.locator('a.exam-card', { hasText: 'IBPS SO IT' }).first().click()
await page.waitForURL('**/exam/ibpsso')
await page.waitForTimeout(600)

const networks = page.locator('input[type="checkbox"][aria-label="Computer Networks"]')
await networks.scrollIntoViewIfNeeded()
await page.waitForTimeout(400)
await networks.check()
await page.waitForTimeout(900)

await page.goto(`${BASE}/exam/sebi`)
await page.waitForSelector('h1')
const sebiBox = page.locator('input[type="checkbox"][aria-label="Computer Networks"]')
await sebiBox.scrollIntoViewIfNeeded()
await page.waitForTimeout(1200)

await page.goto(`${BASE}/topics`)
await page.waitForSelector('h1')
await page.locator('input[type="checkbox"][aria-label="Computer Networks"]').scrollIntoViewIfNeeded()
await page.waitForTimeout(1200)

await page.goto(BASE)
await page.waitForSelector('.exam-card')
await page.waitForTimeout(800)

const video = page.video()
await context.close()
await browser.close()

const videoPath = await video.path()
await copyFile(videoPath, OUT)
console.log(`Saved video to ${OUT}`)
