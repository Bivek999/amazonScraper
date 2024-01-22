const puppeteer = require("puppeteer");
const fs = require("fs");
const zlib = require("zlib");
async function scrapeAmazon() {
  const browser = await puppeteer.launch({ headless: true });
  const page = await browser.newPage();

  await page.goto("https://www.amazon.in/s?k=laptops", {
    waitUntil: "networkidle2",
  });

  // Extract laptops
  const laptops = await page.evaluate(() => {
    let items = new Map();
    document.querySelectorAll("div.s-result-item").forEach((item) => {
      const title = item.querySelector("span.a-size-medium")?.innerText;
      const deliveryDate= item.querySelector(".a-color-base a-text-bold")?.innerText;
      const url = item.querySelector("a.a-link-normal")?.href;
      if (title && url) {
        items.set(url, { title, url ,deliveryDate});
      }
    });
    return Array.from(items.values());
  });

//   Map categories and subcategories
//   for (const laptop of laptops) {
//       await page.goto(laptop.url, { waitUntil: 'networkidle2' });
//       const categoryDetails = await page.evaluate(() => {
//           let category = document.querySelector('a-price-whole')?.innerText;
//           let subcategory = category<20000;
//           return { category, subcategory };
//       });
//       laptop.category = categoryDetails.category;
//       laptop.subcategory = categoryDetails.subcategory;
//   }

  // Extract delivery fee and estimated delivery time
  for (const laptop of laptops) {
    try {
      // Navigate to the product page
      await page.goto(laptop.url, { waitUntil: "networkidle2" });

      // Add item to cart
      // Note: The selector for the add to cart button needs to be accurate
      await page.click("selector-for-add-to-cart-button");
      await page.waitForNavigation({ waitUntil: "networkidle2" });

      // Navigate to the cart page
      await page.goto("https://www.amazon.in/gp/cart/view.html", {
        waitUntil: "networkidle2",
      });
      await page.click("#glow-ingress-block");
      // Enter a pincode - this will be specific to the structure of Amazon's cart page
      await page.type("#GLUXZipUpdateInput", "110001"); //
      await page.click("a-button-input");
      await page.waitForNavigation({ waitUntil: "networkidle2" });

      // Extract delivery information
      const deliveryInfo = await page.evaluate(() => {
        const deliveryFee = document.querySelector(
          ".a-row.a-spacing-mini .a-span3 .a-text-bold"
        )?.innerText;
        const deliveryTime = document.querySelector(
          ".a-row.a-spacing-mini .a-span9 span.a-text-secondary"
        )?.innerText;
        return { deliveryFee, deliveryTime };
      });

      laptop.deliveryFee = deliveryInfo.deliveryFee;
      laptop.deliveryTime = deliveryInfo.deliveryTime;
    } catch (error) {
      console.error(
        `Failed to extract delivery info for ${laptop.title}: ${error}`
      );
    }
  }

  await browser.close();
  return laptops;
}

scrapeAmazon().then((laptops) => {
  console.log(laptops);
  // Further actions like saving data
});
async function saveToNDJSON(data, filename) {
  const stream = fs.createWriteStream(filename, { flags: "a" });
  data.forEach((item) => {
    stream.write(JSON.stringify(item) + "\n");
  });
  stream.end();
}

async function compressFile(inputFilename, outputFilename) {
  const input = fs.createReadStream(inputFilename);
  const output = fs.createWriteStream(outputFilename);
  const gzip = zlib.createGzip();

  input.pipe(gzip).pipe(output);

  return new Promise((resolve, reject) => {
    output.on("finish", resolve);
    output.on("error", reject);
  });
}
async function runScrapingAndSave() {
  try {
    const laptops = await scrapeAmazon();
    await saveToNDJSON(laptops, "scraped_data.ndjson");
    await compressFile("scraped_data.ndjson", "scraped_data.ndjson.gz");

    console.log(
      "Scraping, saving to NDJSON, and compressing with gzip complete."
    );
  } catch (error) {
    console.error("An error occurred:", error);
  }
}

runScrapingAndSave();
