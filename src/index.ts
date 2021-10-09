import express from "express";

require("dotenv").config({ path: "./.env" });

const app = express();
const port = process.env.PORT;

import binance from "./broker";
import trade from "./helpers/executeOrder";
import log from "./helpers/logger";

app.use(express.json());

app.get("/check", async (req, res) => {
    const a = await binance.futuresAllOrders();
    return res.json({ a });
});

app.get("/", async (req, res) => {
    const allPositions = await binance.futuresPositionRisk();
    const runningPositions = allPositions.filter(
        ({ positionAmt }: { positionAmt: number }) => +positionAmt !== 0
    );
    // const balance = await binance.futuresBalance();
    const openOrders = await binance.futuresOpenOrders();

    return res.json({
        runningPositions,
        openOrders,
        // balance,
    });
});

app.post("/execute", async (req, res) => {
    const { password, symbol, position, size, tpFactor, slFactor } = req.body;

    try {
        if (password !== process.env.PASSWORD)
            throw "Authentication error, you have no business here.";
        if (!position || !symbol || !size || !tpFactor || !slFactor)
            throw "Please check fields";
        if (position !== "long") {
            if (position !== "short") throw "Please check syntax";
        }

        const ticker = symbol.replace("PERP", "");

        const order = await trade({
            api: binance,
            symbol: ticker,
            position,
            size,
            slFactor,
            tpFactor,
        });

        return res.json({
            status: "Success, welcome my baby",
            order,
        });
    } catch (e) {
        const error = {
            error: "Something went wrong",
            message: e,
        };
        log.error(error);
        return res.json(error);
    }
});

app.listen(port, () => {
    log.info(`Trading bot listening at http://localhost:${port}`);
});
