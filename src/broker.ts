import Binance from "node-binance-api";

const binance = new Binance().options({
    APIKEY: process.env.APIKEY,
    APISECRET: process.env.APISECRET,
});

export default binance;
