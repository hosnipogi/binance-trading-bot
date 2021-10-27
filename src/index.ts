import express from "express";

require("dotenv").config({ path: "./.env" });

const app = express();
const port = process.env.PORT;

import binance from "./broker";
import trade from "./helpers/executeOrder";
import log from "./helpers/logger";

app.use(express.json());

app.get("/trades", async (req, res) => {
    let trades = await binance.futuresUserTrades();

    if (trades.length <= 0) throw "No trades executed";

    const dateFrom = req.query.from as string;
    const dateTo = req.query.to as string;
    const coin = req.query.coin as string;
    const side = req.query.side as string;

    const date = new Date();
    const month = date.getMonth();
    const year = date.getUTCFullYear();

    const arr = [];

    if (dateFrom) {
        const timeFrom = Date.UTC(year, month, +dateFrom, 0, 0);
        trades = trades.filter((a: any) => a.time >= timeFrom);
    }

    if (dateTo) {
        const timeTo = Date.UTC(year, month, +dateTo, 23, 59);
        trades = trades.filter((a: any) => a.time <= timeTo);
    }

    if (coin) {
        let c = coin.toUpperCase();
        c = c.includes("USDT") ? c : `${c}USDT`;
        trades = trades.filter((a: { symbol: string }) => a.symbol === c);
    }

    if (side) {
        const s = side.toUpperCase();
        trades = trades.filter(
            (a: { side: string; realizedPnl: string }) =>
                +a.realizedPnl && a.side === s
        );
    }

    trades = trades.sort((a: any, b: any) => b.time - a.time);

    for (const trade of trades) {
        const obj = {
            date: new Date(trade.time).toUTCString(),
            symbol: trade.symbol,
            price: +trade.price,
            pnl: +trade.realizedPnl,
            fee: +trade.commission,
            side: trade.side,
            size: +trade.qty,
        };

        arr.push(obj);
    }

    const obj = {
        pnl: 0,
        fees: 0,
        net: 0,
        trades: 0,
    };

    for (const a of arr) {
        obj.pnl += a.pnl;
        obj.fees += a.fee;
        obj.net = obj.pnl - obj.fees;
        obj.trades += 1;
    }

    const coinsTraded: {}[] = [];

    for (const t of arr) {
        !coinsTraded.includes(t.symbol) && coinsTraded.push(t.symbol);
    }

    const pnl = arr.slice().sort((a: any, b: any) => b.pnl - a.pnl);
    const winner = pnl[0];
    const loser = pnl[pnl.length - 1];

    trades = {
        obj: { ...obj, coinsTraded: coinsTraded.sort(), winner, loser },
        trades: arr,
    };

    res.json(trades);
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
            message: {
                e,
                referrer: req.get("Referrer"),
                clientIp:
                    req.headers["x-forwarded-for"] || req.socket.remoteAddress,
            },
        };
        log.error(error);
        return res.json(error);
    }
});

app.listen(port, () => {
    log.info(`Trading bot listening at http://localhost:${port}`);
});
