import Binance from "node-binance-api";
import log from "./logger";

export default async ({ api, symbol }: { api: Binance; symbol: string }) => {
    const allPositions = await api.futuresPositionRisk();
    if (!allPositions) throw "Cannot GET allPositions";

    const maxRunningPositions = +process.env.MAXRUNNINGPOSITIONS!;
    const runningPositions: [] = allPositions.filter(
        ({ positionAmt }: { positionAmt: number }) => +positionAmt !== 0
    );

    if (runningPositions.length >= maxRunningPositions)
        throw `Max number of running Positions open max: ${maxRunningPositions}`;

    const found = allPositions.find(
        (data: { symbol: string }) => data.symbol === symbol
    );

    if (!found) throw `Cannot find ${symbol}`;

    const hasOpenPosition =
        +found.positionAmt || +found.entryPrice || +found.liquidationPrice
            ? true
            : false;

    if (!hasOpenPosition) {
        const hasFloatingOrders = await api.futuresOpenOrders(symbol);
        if (hasFloatingOrders.length) await api.futuresCancelAll(symbol);
        return 0;
    }

    log.info(`${symbol} position still open, will not execute trade.`);

    return 1;
};
