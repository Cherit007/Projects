import { chromium } from 'playwright'

const base = 'http://127.0.0.1:4180/Projects/exam-tracker/'

async function main() {
  const browser = await chromium.launch({ headless: true })
  const page = await browser.newPage()
  const errors = []
  page.on('pageerror', (e) => errors.push(String(e)))
  page.on('console', (msg) => {
    if (msg.type() === 'error') errors.push(msg.text())
  })

  await page.goto(base, { waitUntil: 'networkidle' })
  await page.waitForTimeout(800)
  const url0 = page.url()
  const h1_0 = await page.locator('h1').first().textContent()
  const scroll0 = await page.evaluate(() => window.scrollY)

  // Click Topics in top nav (force if needed)
  const topics = page.locator('nav.nav a', { hasText: 'Topics' }).first()
  await topics.click({ force: true })
  await page.waitForTimeout(600)
  const url1 = page.url()
  const h1_1 = await page.locator('h1').first().textContent().catch(() => null)
  const body1 = await page.locator('body').innerText()

  await page.locator('nav.nav a', { hasText: 'Roadmap' }).first().click({ force: true })
  await page.waitForTimeout(600)
  const url2 = page.url()
  const h1_2 = await page.locator('h1').first().textContent().catch(() => null)

  // Direct hash
  await page.goto(base + '#/topics', { waitUntil: 'networkidle' })
  await page.waitForTimeout(600)
  const url3 = page.url()
  const h1_3 = await page.locator('h1').first().textContent().catch(() => null)

  console.log(JSON.stringify({
    url0, h1_0, scroll0,
    url1, h1_1, hasTopicsHeading: /Topics/i.test(body1 || ''),
    url2, h1_2,
    url3, h1_3,
    errors,
  }, null, 2))

  await browser.close()
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
