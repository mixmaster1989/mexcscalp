const { MexcRestClient } = require("./dist/infra/mexcRest");
require("dotenv").config();
async function cancelAllOrders() {
  try {
    console.log("🗑️ ОТМЕНА ВСЕХ ОТКРЫТЫХ ОРДЕРОВ");
    const mexcClient = new MexcRestClient(process.env.MEXC_API_KEY, process.env.MEXC_SECRET_KEY);
    const openOrders = await mexcClient.getOpenOrders("ETHUSDC");
    console.log(`📋 Найдено ${openOrders.length} открытых ордеров`);
    for (const order of openOrders) {
