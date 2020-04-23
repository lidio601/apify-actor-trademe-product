// This is the main Node.js source code file of your actor.
// It is referenced from the "scripts" section of the package.json file,
// so that it can be started by running "npm start".

// Include Apify SDK. For more information, see https://sdk.apify.com/
const Apify = require("apify");

const {
  utils: { log },
} = Apify;

Apify.main(async () => {
  // Get input of the actor.
  // If you'd like to have your input checked and have Apify display
  // a user interface for it, add INPUT_SCHEMA.json file to your actor.
  // For more information, see https://apify.com/docs/actor/input-schema
  log.debug("reading INPUT.");
  const input = await Apify.getInput();
  console.dir(input);
  if (!input) throw new Error("INPUT cannot be empty!");
  if (!input.listingId) throw new Error("listingId cannot be empty!");
  log.setLevel(log.LEVELS.DEBUG);
  log.info("task input", input);

  const { listingId } = input;

  const url = `https://www.trademe.co.nz/${listingId}`;

  // Open a request queue and add a start URL to it
  const requestQueue = await Apify.openRequestQueue();

  await requestQueue.addRequest(
    new Apify.Request({
      url,
    })
  );

  const data = [];

  // Create a crawler that will use headless Chrome / Puppeteer to extract data
  // from pages and recursively add links to newly-found pages
  // const crawler = new Apify.PuppeteerCrawler({
  const crawler = new Apify.CheerioCrawler({
    requestQueue,

    maxRequestRetries: 2,
    maxRequestsPerCrawl: 100,
    maxConcurrency: 10,

    // This function is called for every page the crawler failed to load
    // or for which the handlePageFunction() throws at least "maxRequestRetries"-times
    handleFailedRequestFunction: async ({ request }) => {
      log.error(`Request ${request.url} failed too many times`);

      await Apify.pushData({
        "#debug": Apify.utils.createRequestDebugInfo(request),
      });

      log.info("crawled data", { count: data.length });
      log.debug("crawled data", data);

      await Apify.pushData({ items: data, count: data.length });

      throw new Error("terminate the execution");
    },

    // This function is called for every page the crawler visits
    // handlePageFunction: async ({ request, page }) => {
    handlePageFunction: async ({
      request,
      response,
      body,
      contentType,
      $,
      session,
    }) => {
      log.debug("request", request);

      const currentBid = $(body).find(".current-bid-details").text();

      data.push({
        id: input.listingId,
        value: currentBid,
        timestamp: new Date().getTime(),
      });
    },
  });

  await crawler.run();

  log.info("crawled data", { count: data.length });
  log.debug("crawled data", data);

  const dataset = await Apify.openDataset(`trademe-${listingId}`);

  await dataset.pushData(data);
});
