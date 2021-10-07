import Binance from "node-binance-api";
import { computeTPSL, getStepAndTickSize, computeActualSize } from "./index";
import { round, precision } from "../helpers";

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
    const { stepSize, tickSize } = await getStepAndTickSize({
        api: api,
        symbol,
    });
    const finalQty = computeActualSize(size, stepSize);

    if (position === "long") {
        const entry = await api.futuresMarketBuy(symbol, finalQty, {
            newOrderRespType: "RESULT",
        });

        console.info(entry);

        if (!entry?.orderId) throw "Error submitting market order";

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

        console.info(stopLossLimit);
        if (!stopLossLimit.orderId) throw "Failed to set Stop Loss Limit Order";

        const tpLimit = await api.futuresSell(symbol, +executedQty, tp, {
            reduceOnly: true,
            type: "TAKE_PROFIT",
            stopPrice: tp,
            timeInForce: "GTC",
        });

        console.info(tpLimit);
        if (!tpLimit.orderId) throw "Failed to set TP Limit Order";

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

        console.info(slMarketClose);
        if (!slMarketClose.orderId)
            throw "Failed to set Protection SL Market Close Order";

        return {
            symbol: entry.symbol,
            position,
            marketOrderID: entry.orderId,
            entryPrice: entry.avgPrice,
            tp,
            sl,
            executedQty,
        };
    } else if (position === "short") {
        const entry = await api.futuresMarketSell(symbol, finalQty, {
            newOrderRespType: "RESULT",
        });

        console.info(entry);

        if (!entry?.orderId) throw "Error submitting market order";

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

        console.info(stopLossLimit);
        if (!stopLossLimit.orderId) throw "Failed to set Stop Loss Limit Order";

        const tpLimit = await api.futuresBuy(symbol, +executedQty, tp, {
            reduceOnly: true,
            type: "TAKE_PROFIT",
            stopPrice: tp,
            timeInForce: "GTC",
        });

        console.info(tpLimit);
        if (!tpLimit.orderId) throw "Failed to set TP Limit Order";

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

        console.info(slMarketClose);
        if (!slMarketClose.orderId)
            throw "Failed to set Protection SL Market Close Order";

        return {
            symbol: entry.symbol,
            position,
            marketOrderID: entry.orderId,
            entryPrice: entry.avgPrice,
            tp,
            sl,
            executedQty,
        };
    } else {
        return 0;
    }
};
