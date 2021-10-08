import Binance from "node-binance-api";
import { computeTPSL, getStepAndTickSize, computeActualSize } from "./index";
import { round, precision } from "../helpers";
import hasOpenPosition from "./hasOpenPosition";

export default async ({
    api,
    position,
    size,
    symbol,
    slFactor,
    tpFactor,
}: {
    api: Binance;
    size: number;
    symbol: string;
    slFactor: number;
    tpFactor: number;
    position: "long" | "short";
}) => {
    if (
        await hasOpenPosition({
            api,
            symbol,
        })
    )
        return `Refusing to execute, a ${symbol} position is still running.`;

    const { stepSize, tickSize } = await getStepAndTickSize({
        api: api,
        symbol,
    });
    const finalQty = computeActualSize(size, stepSize);

    if (position === "long") {
        const entry = await api.futuresMarketBuy(symbol, finalQty, {
            newOrderRespType: "RESULT",
        });

        if (!entry?.orderId) throw "Error submitting market order";
        console.info({
            symbol: entry.symbol,
            orderId: entry.orderId,
            ordertype: entry.type,
            price: entry.avgPrice,
        });

        const { executedQty, avgPrice } = entry;

        const { tp, sl } = computeTPSL({
            entry: +avgPrice,
            slFactor,
            tpFactor,
            tickSize,
        });

        const stopLossLimit = await api.futuresSell(symbol, +executedQty, sl, {
            reduceOnly: true,
            type: "STOP",
            stopPrice: sl,
            timeInForce: "GTC",
        });

        if (!stopLossLimit.orderId) throw "Failed to set Stop Loss Limit Order";
        console.info({
            symbol: stopLossLimit.symbol,
            orderId: stopLossLimit.orderId,
            ordertype: stopLossLimit.type,
            price: stopLossLimit.stopPrice,
        });

        const tpLimit = await api.futuresSell(symbol, +executedQty, tp, {
            reduceOnly: true,
            type: "TAKE_PROFIT",
            stopPrice: tp,
            timeInForce: "GTC",
        });

        if (!tpLimit.orderId) throw "Failed to set TP Limit Order";
        console.info({
            symbol: tpLimit.symbol,
            orderId: tpLimit.orderId,
            ordertype: tpLimit.type,
            price: tpLimit.stopPrice,
        });

        // market close incase market scams us

        const sp = round(
            sl - (tickSize === 0 ? 1 : tickSize * 10),
            precision(tickSize)
        );
        const slMarketClose = await api.futuresMarketSell(
            symbol,
            +executedQty,
            {
                reduceOnly: true,
                type: "STOP_MARKET",
                stopPrice: sp,
                timeInForce: "GTC",
            }
        );

        if (!slMarketClose.orderId)
            throw "Failed to set Protection SL Market Close Order";
        console.info({
            symbol: slMarketClose.symbol,
            orderId: slMarketClose.orderId,
            ordertype: slMarketClose.type,
            price: slMarketClose.stopPrice,
        });

        return {
            market: {
                symbol: entry.symbol,
                position,
                marketOrderID: entry.orderId,
                entryPrice: entry.avgPrice,
                executedQty,
            },
            stopLoss: {
                orderId: stopLossLimit.orderId,
                price: stopLossLimit.stopPrice,
            },
            takeProfit: {
                orderId: tpLimit.orderId,
                price: tpLimit.stopPrice,
            },
            stopMarket: {
                orderId: slMarketClose.orderId,
                price: slMarketClose.stopPrice,
            },
        };
    } else if (position === "short") {
        const entry = await api.futuresMarketSell(symbol, finalQty, {
            newOrderRespType: "RESULT",
        });

        if (!entry?.orderId) throw "Error submitting market order";
        console.info({
            symbol: entry.symbol,
            orderId: entry.orderId,
            ordertype: entry.type,
            price: entry.avgPrice,
        });

        const { executedQty, avgPrice } = entry;

        const { tp, sl } = computeTPSL({
            entry: +avgPrice,
            slFactor,
            tpFactor,
            tickSize,
        });

        const stopLossLimit = await api.futuresBuy(symbol, +executedQty, sl, {
            reduceOnly: true,
            type: "STOP",
            stopPrice: sl,
            timeInForce: "GTC",
        });

        if (!stopLossLimit.orderId) throw "Failed to set Stop Loss Limit Order";
        console.info({
            symbol: stopLossLimit.symbol,
            orderId: stopLossLimit.orderId,
            ordertype: stopLossLimit.type,
            price: stopLossLimit.stopPrice,
        });

        const tpLimit = await api.futuresBuy(symbol, +executedQty, tp, {
            reduceOnly: true,
            type: "TAKE_PROFIT",
            stopPrice: tp,
            timeInForce: "GTC",
        });

        if (!tpLimit.orderId) throw "Failed to set TP Limit Order";
        console.info({
            symbol: tpLimit.symbol,
            orderId: tpLimit.orderId,
            ordertype: tpLimit.type,
            price: tpLimit.stopPrice,
        });

        // again market close short incase market scams us

        const sp = round(
            sl + (tickSize === 0 ? 1 : tickSize * 10),
            precision(tickSize)
        );
        const slMarketClose = await api.futuresMarketBuy(symbol, +executedQty, {
            reduceOnly: true,
            type: "STOP_MARKET",
            stopPrice: sp,
            timeInForce: "GTC",
        });

        if (!slMarketClose.orderId)
            throw "Failed to set Protection SL Market Close Order";
        console.info({
            symbol: slMarketClose.symbol,
            orderId: slMarketClose.orderId,
            ordertype: slMarketClose.type,
            price: slMarketClose.stopPrice,
        });

        return {
            market: {
                symbol: entry.symbol,
                position,
                marketOrderID: entry.orderId,
                entryPrice: entry.avgPrice,
                executedQty,
            },
            stopLoss: {
                orderId: stopLossLimit.orderId,
                price: stopLossLimit.stopPrice,
            },
            takeProfit: {
                orderId: tpLimit.orderId,
                price: tpLimit.stopPrice,
            },
            stopMarket: {
                orderId: slMarketClose.orderId,
                price: slMarketClose.stopPrice,
            },
        };
    } else {
        return 0;
    }
};
