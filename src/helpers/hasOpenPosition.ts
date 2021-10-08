import Binance from "node-binance-api";

export default async ({ api, symbol }: { api: Binance; symbol: string }) => {
    const allPositions = await api.futuresPositionRisk();
    const found = allPositions.find(
        (data: { symbol: string; positionAmt: number }) =>
            data.symbol === symbol
    );

    const hasOpenPosition = +found.positionAmt ? true : false;

    if (!hasOpenPosition) {
        const hasFloatingOrders = await api.futuresOpenOrders(symbol);
        if (hasFloatingOrders.length) await api.futuresCancelAll(symbol);
        return 0;
    }

    console.info(`${symbol} position still open, will not execute trade.`);

    return 1;
};
