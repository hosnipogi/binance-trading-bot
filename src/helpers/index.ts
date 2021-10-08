import Binance from "node-binance-api";

const round = (num: number, places: number) => {
    const multiplier = Math.pow(10, places);
    return Math.round(num * multiplier) / multiplier;
};

const precision = (num: number) => {
    if (!isFinite(num)) return 0;
    var e = 1,
        p = 0;
    while (Math.round(num * e) / e !== num) {
        e *= 10;
        p++;
    }
    return p;
};

const computeTPSL = ({
    entry,
    slFactor,
    tpFactor,
    tickSize,
}: {
    entry: number;
    slFactor: number;
    tpFactor: number;
    tickSize: number;
}) => ({
    sl: round(entry - entry * slFactor, precision(tickSize)),
    tp: round(entry + entry * tpFactor, precision(tickSize)),
});

const getStepAndTickSize = async ({
    api,
    symbol,
}: {
    api: Binance;
    symbol: string;
}) => {
    const { symbols } = await api.futuresExchangeInfo();
    const ticker = symbol.replace('PERP', '')
    const found = symbols.find(
        (coin: { symbol: string }) => coin.symbol === ticker
    );

    if (!found) throw "Not found again";

    const { stepSize } = found.filters.find(
        ({ filterType }: { filterType: string }) => filterType === "LOT_SIZE"
    );

    if (!stepSize) throw "No defined stepsize";

    const { tickSize } = found.filters.find(
        ({ filterType }: { filterType: string }) =>
            filterType === "PRICE_FILTER"
    );

    if (!tickSize) throw "No defined ticksize";

    return {
        tickSize: +tickSize,
        stepSize: +stepSize,
    };
};

const computeActualSize = (size: number, stepSize: number) => {
    return round(size, precision(stepSize));
};

export { round, precision, computeTPSL, getStepAndTickSize, computeActualSize };
