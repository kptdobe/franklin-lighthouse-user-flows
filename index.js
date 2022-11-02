import fs from 'fs';
import open from 'open';
import puppeteer from 'puppeteer';
import { blue, cyan, green, magenta, red, yellow } from 'colorette';
import {
  startFlow
} from 'lighthouse/lighthouse-core/fraggle-rock/api.js';

const DEBUG_LOGS = false;

async function captureReport() {
  const browser = await puppeteer.launch({
    headless: true,
    // args: ['--unlimited-storage', '--force-gpu-mem-available-mb'],
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--ignore-certificate-errors',
      '--proxy-server="direct://"',
      '--proxy-bypass-list=*',
    ],
  });
  const page = await browser.newPage();

  if (DEBUG_LOGS) {
    page
      .on('console', message => {
        const type = message.type().substr(0, 3).toUpperCase()
        const colors = {
          LOG: text => text,
          ERR: red,
          WAR: yellow,
          INF: cyan
        }
        const color = colors[type] || blue
        console.log(color(`${type} ${message.text()}`))
      })
      .on('pageerror', ({ message }) => console.log(red(message)))
      .on('response', response =>
        console.log(green(`${response.status()} ${response.url()}`)))
      .on('requestfailed', request =>
        console.log(magenta(`${request.failure().errorText} ${request.url()}`)))
  }

  await page.setCacheEnabled(false);

  const flow = await startFlow(page, {
    name: 'Single Navigation'
  });

  const navigate = async (url, nb) => {
    for (let i = 0; i < nb; i++) {
      const start = new Date().getTime();
      // console.log(`${i} - Navigating to ${url}`);
      await flow.navigate(url);
      console.log(`${i} - Navigation to ${url} took ${new Date().getTime() - start}ms`);
    }
  };

  const iter = 10;
  await navigate('https://fix-lcp--express-website--adobe.hlx.live/express/?lighthouse=on', iter);
  await navigate('https://main--express-website--adobe.hlx.live/express/?lighthouse=on', iter);
    
  await browser.close();

  const result = await flow.createFlowResult();
  const table = [];
  result.steps.forEach((step, i) => {
    table.push({
      URL: step.lhr.requestedUrl,
      CLS: step.lhr.audits['cumulative-layout-shift'].numericValue,
      TBT: Math.round(step.lhr.audits['total-blocking-time'].numericValue),
      LCP: Math.round(step.lhr.audits['largest-contentful-paint'].numericValue),
      FCP: Math.round(step.lhr.audits['first-contentful-paint'].numericValue),
      SI: Math.round(step.lhr.audits['speed-index'].numericValue),
      TTI: Math.round(step.lhr.audits['interactive'].numericValue),
      Score: step.lhr.categories.performance.score * 100,
    });
  });
  console.table(table, ['URL', 'FCP', 'TTI', 'SI', 'TBT', 'LCP', 'CLS', 'Score']);
  const report = await flow.generateReport();
  fs.writeFileSync('flow.report.html', report);
  open('flow.report.html', {
    wait: false
  });
}

captureReport();