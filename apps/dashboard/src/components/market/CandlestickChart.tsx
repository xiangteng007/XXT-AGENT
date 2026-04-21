'use client';

import { useEffect, useRef, useState } from 'react';
import { createChart, ColorType, IChartApi, ISeriesApi, CrosshairMode, LineStyle, CandlestickSeries, HistogramSeries, LineSeries, IPriceLine } from 'lightweight-charts';
import { SMA, MACD, RSI, BollingerBands, EMA, Stochastic } from 'technicalindicators';
import { calculateSupportResistance, calculateFibonacciRetracement, detectCandlestickPatterns, OHLCV } from '@/lib/indicators/technical';
import { Bot } from 'lucide-react';
import { Button } from '@/components/ui/button';

export interface CandlestickData {
    time: string;
    open: number;
    high: number;
    low: number;
    close: number;
    volume?: number;
}

export interface ChartIndicators {
    ma: boolean;
    ema: boolean;
    bb: boolean;
    macd: boolean;
    rsi: boolean;
    kd: boolean;
    srLevels?: boolean;
    fibonacci?: boolean;
    patterns?: boolean;
}

interface CandlestickChartProps {
    data: CandlestickData[];
    colors?: {
        backgroundColor?: string;
        textColor?: string;
        upColor?: string;
        downColor?: string;
    };
    indicators?: ChartIndicators;
    className?: string;
    symbol?: string;
    onGetAdvice?: (symbol: string, indicators: ChartIndicators, latestValues: any) => void;
}

interface LegendData {
    time: string;
    open: string;
    high: string;
    low: string;
    close: string;
    volume: string;
    ma5?: string;
    ma20?: string;
    ma60?: string;
    ema12?: string;
    ema26?: string;
    macd?: { macd: string; signal: string; hist: string };
    rsi?: string;
    bb?: { upper: string; middle: string; lower: string };
    kd?: { k: string; d: string };
}

export function CandlestickChart({
    data,
    colors: {
        backgroundColor = 'transparent',
        textColor = '#A1A1AA', // zinc-400
        upColor = '#22C55E', // green-500
        downColor = '#EF4444', // red-500
    } = {},
    indicators = { ma: false, ema: false, bb: false, macd: false, rsi: false, kd: false },
    className = 'w-full h-full min-h-[500px] relative',
    symbol,
    onGetAdvice,
}: CandlestickChartProps) {
    const chartContainerRef = useRef<HTMLDivElement>(null);
    const chartRef = useRef<IChartApi | null>(null);
    const [legendData, setLegendData] = useState<LegendData | null>(null);

    // Refs for series to update them later
    const seriesRefs = useRef<Record<string, any>>({});
    const priceLinesRef = useRef<IPriceLine[]>([]);
    const latestValuesRef = useRef<any>({});

    useEffect(() => {
        if (!chartContainerRef.current) return;

        const handleResize = () => {
            if (chartContainerRef.current && chartRef.current) {
                chartRef.current.applyOptions({
                    width: chartContainerRef.current.clientWidth,
                    height: chartContainerRef.current.clientHeight,
                });
            }
        };

        const chart = createChart(chartContainerRef.current, {
            layout: {
                background: { type: ColorType.Solid, color: backgroundColor },
                textColor,
            },
            width: chartContainerRef.current.clientWidth,
            height: chartContainerRef.current.clientHeight,
            grid: {
                vertLines: { color: 'rgba(255, 255, 255, 0.05)' },
                horzLines: { color: 'rgba(255, 255, 255, 0.05)' },
            },
            crosshair: {
                mode: CrosshairMode.Normal,
            },
            timeScale: {
                timeVisible: true,
                secondsVisible: false,
                borderColor: 'rgba(255, 255, 255, 0.1)',
            },
            rightPriceScale: {
                borderColor: 'rgba(255, 255, 255, 0.1)',
                autoScale: true,
            },
        });

        chartRef.current = chart;

        // Base Candlestick Series
        const candlestickSeries = chart.addSeries(CandlestickSeries, {
            upColor: upColor,
            downColor: downColor,
            borderVisible: false,
            wickUpColor: upColor,
            wickDownColor: downColor,
            priceScaleId: 'right',
        });
        seriesRefs.current.candlestick = candlestickSeries;

        window.addEventListener('resize', handleResize);

        return () => {
            window.removeEventListener('resize', handleResize);
            chart.remove();
        };
    }, [backgroundColor, textColor, upColor, downColor]);

    useEffect(() => {
        if (!chartRef.current || !seriesRefs.current.candlestick || data.length === 0) return;

        const chart = chartRef.current;
        const sortedData = [...data].sort((a, b) => new Date(a.time).getTime() - new Date(b.time).getTime());
        
        const formattedData = sortedData.map(d => ({
            ...d,
            time: d.time.split('T')[0],
        }));

        const closes = formattedData.map(d => d.close);
        const highs = formattedData.map(d => d.high);
        const lows = formattedData.map(d => d.low);

        const ohlcvData: OHLCV[] = formattedData.map(d => ({
            open: d.open,
            high: d.high,
            low: d.low,
            close: d.close,
            volume: d.volume || 0,
            timestamp: new Date(d.time).getTime(),
        }));

        seriesRefs.current.candlestick.setData(formattedData);
        latestValuesRef.current = {};

        // Clear existing price lines
        priceLinesRef.current.forEach(line => {
            seriesRefs.current.candlestick.removePriceLine(line);
        });
        priceLinesRef.current = [];

        // Clear existing markers
        seriesRefs.current.candlestick.setMarkers([]);

        // Manage Volume Pane
        if (!seriesRefs.current.volume) {
            seriesRefs.current.volume = chart.addSeries(HistogramSeries, {
                color: '#26a69a',
                priceFormat: { type: 'volume' },
                priceScaleId: 'volume',
            });
        }
        const volumeData = formattedData.map((d, i) => {
            let color = `${upColor}80`;
            if (i > 0) {
                color = d.close >= formattedData[i-1].close ? `${upColor}80` : `${downColor}80`;
            } else {
                color = d.close >= d.open ? `${upColor}80` : `${downColor}80`;
            }
            return {
                time: d.time,
                value: d.volume || 0,
                color,
            };
        });
        seriesRefs.current.volume.setData(volumeData);

        // Adjust Margins based on active indicators
        let mainBottomMargin = 0.2; // default space for volume
        let volumeTopMargin = 0.8;
        let volumeBottomMargin = 0;

        let activePanes = 0;
        if (indicators.macd) activePanes++;
        if (indicators.rsi) activePanes++;
        if (indicators.kd) activePanes++;

        // Calculate heights dynamically for panes
        if (activePanes === 1) {
            mainBottomMargin = 0.35;
            volumeTopMargin = 0.65;
            volumeBottomMargin = 0.25;
        } else if (activePanes === 2) {
            mainBottomMargin = 0.45;
            volumeTopMargin = 0.55;
            volumeBottomMargin = 0.35;
        } else if (activePanes === 3) {
            mainBottomMargin = 0.55;
            volumeTopMargin = 0.45;
            volumeBottomMargin = 0.45;
        }

        chart.priceScale('right').applyOptions({
            scaleMargins: { top: 0.05, bottom: mainBottomMargin },
        });

        chart.priceScale('volume').applyOptions({
            scaleMargins: { top: volumeTopMargin, bottom: volumeBottomMargin },
        });

        // Add/Remove MA
        const mas = [
            { period: 5, color: '#2962FF', key: 'ma5' },
            { period: 20, color: '#FF6D00', key: 'ma20' },
            { period: 60, color: '#9C27B0', key: 'ma60' }
        ];

        if (indicators.ma) {
            mas.forEach(ma => {
                if (!seriesRefs.current[ma.key]) {
                    seriesRefs.current[ma.key] = chart.addSeries(LineSeries, {
                        color: ma.color,
                        lineWidth: 1,
                        crosshairMarkerVisible: false,
                        priceScaleId: 'right',
                    });
                }
                const smaData = SMA.calculate({ period: ma.period, values: closes });
                const chartData = formattedData.slice(ma.period - 1).map((d, i) => ({
                    time: d.time,
                    value: smaData[i],
                }));
                latestValuesRef.current[`ma${ma.period}`] = smaData[smaData.length - 1];
                seriesRefs.current[ma.key].setData(chartData);
            });
        } else {
            mas.forEach(ma => {
                if (seriesRefs.current[ma.key]) {
                    chart.removeSeries(seriesRefs.current[ma.key]);
                    delete seriesRefs.current[ma.key];
                }
            });
        }

        // Add/Remove EMA
        const emas = [
            { period: 12, color: '#00BCD4', key: 'ema12' },
            { period: 26, color: '#FF5252', key: 'ema26' }
        ];

        if (indicators.ema) {
            emas.forEach(ema => {
                if (!seriesRefs.current[ema.key]) {
                    seriesRefs.current[ema.key] = chart.addSeries(LineSeries, {
                        color: ema.color,
                        lineWidth: 1,
                        crosshairMarkerVisible: false,
                        priceScaleId: 'right',
                    });
                }
                const emaData = EMA.calculate({ period: ema.period, values: closes });
                const chartData = formattedData.slice(ema.period - 1).map((d, i) => ({
                    time: d.time,
                    value: emaData[i],
                }));
                latestValuesRef.current[`ema${ema.period}`] = emaData[emaData.length - 1];
                seriesRefs.current[ema.key].setData(chartData);
            });
        } else {
            emas.forEach(ema => {
                if (seriesRefs.current[ema.key]) {
                    chart.removeSeries(seriesRefs.current[ema.key]);
                    delete seriesRefs.current[ema.key];
                }
            });
        }

        // Add/Remove Bollinger Bands
        if (indicators.bb) {
            if (!seriesRefs.current.bbUpper) {
                seriesRefs.current.bbUpper = chart.addSeries(LineSeries, { color: 'rgba(33, 150, 243, 0.5)', lineWidth: 1, priceScaleId: 'right' });
                seriesRefs.current.bbMiddle = chart.addSeries(LineSeries, { color: 'rgba(33, 150, 243, 0.5)', lineWidth: 1, lineStyle: LineStyle.Dashed, priceScaleId: 'right' });
                seriesRefs.current.bbLower = chart.addSeries(LineSeries, { color: 'rgba(33, 150, 243, 0.5)', lineWidth: 1, priceScaleId: 'right' });
            }
            const bbData = BollingerBands.calculate({ period: 20, stdDev: 2, values: closes });
            const upperData = formattedData.slice(19).map((d, i) => ({ time: d.time, value: bbData[i].upper }));
            const middleData = formattedData.slice(19).map((d, i) => ({ time: d.time, value: bbData[i].middle }));
            const lowerData = formattedData.slice(19).map((d, i) => ({ time: d.time, value: bbData[i].lower }));
            
            if (bbData.length > 0) {
                latestValuesRef.current.bb = bbData[bbData.length - 1];
            }

            seriesRefs.current.bbUpper.setData(upperData);
            seriesRefs.current.bbMiddle.setData(middleData);
            seriesRefs.current.bbLower.setData(lowerData);
        } else {
            ['bbUpper', 'bbMiddle', 'bbLower'].forEach(key => {
                if (seriesRefs.current[key]) {
                    chart.removeSeries(seriesRefs.current[key]);
                    delete seriesRefs.current[key];
                }
            });
        }

        // Add/Remove MACD
        if (indicators.macd) {
            // Find its position index (0 to activePanes - 1)
            let paneIndex = 0;
            const macdMarginTop = 1 - (activePanes - paneIndex) * 0.15 - 0.05;
            const macdMarginBottom = (activePanes - paneIndex - 1) * 0.15;
            
            if (!seriesRefs.current.macdHist) {
                seriesRefs.current.macdHist = chart.addSeries(HistogramSeries, { priceScaleId: 'macd' });
                seriesRefs.current.macdLine = chart.addSeries(LineSeries, { color: '#2962FF', lineWidth: 1, priceScaleId: 'macd' });
                seriesRefs.current.macdSignal = chart.addSeries(LineSeries, { color: '#FF6D00', lineWidth: 1, priceScaleId: 'macd' });
            }

            chart.priceScale('macd').applyOptions({
                scaleMargins: { top: macdMarginTop, bottom: macdMarginBottom },
            });

            const macdInput = {
                values: closes,
                fastPeriod: 12,
                slowPeriod: 26,
                signalPeriod: 9,
                SimpleMAOscillator: false,
                SimpleMASignal: false
            };
            const macdResult = MACD.calculate(macdInput);
            
            // MACD starts 25 bars in
            const offset = 25;
            const histData = formattedData.slice(offset).map((d, i) => ({
                time: d.time,
                value: macdResult[i].histogram || 0,
                color: (macdResult[i].histogram || 0) >= 0 ? 'rgba(38, 166, 154, 0.5)' : 'rgba(239, 83, 80, 0.5)'
            }));
            const lineData = formattedData.slice(offset).map((d, i) => ({ time: d.time, value: macdResult[i].MACD || 0 }));
            const signalData = formattedData.slice(offset).map((d, i) => ({ time: d.time, value: macdResult[i].signal || 0 }));

            if (macdResult.length > 0) {
                latestValuesRef.current.macd = macdResult[macdResult.length - 1];
            }

            seriesRefs.current.macdHist.setData(histData);
            seriesRefs.current.macdLine.setData(lineData);
            seriesRefs.current.macdSignal.setData(signalData);
        } else {
            ['macdHist', 'macdLine', 'macdSignal'].forEach(key => {
                if (seriesRefs.current[key]) {
                    chart.removeSeries(seriesRefs.current[key]);
                    delete seriesRefs.current[key];
                }
            });
        }

        // Add/Remove RSI
        if (indicators.rsi) {
            let paneIndex = indicators.macd ? 1 : 0;
            const rsiMarginTop = 1 - (activePanes - paneIndex) * 0.15 - 0.05;
            const rsiMarginBottom = (activePanes - paneIndex - 1) * 0.15;

            if (!seriesRefs.current.rsiLine) {
                seriesRefs.current.rsiLine = chart.addSeries(LineSeries, { color: '#9C27B0', lineWidth: 1, priceScaleId: 'rsi' });
            }

            chart.priceScale('rsi').applyOptions({
                scaleMargins: { top: rsiMarginTop, bottom: rsiMarginBottom },
            });

            const rsiResult = RSI.calculate({ period: 14, values: closes });
            const rsiData = formattedData.slice(14).map((d, i) => ({ time: d.time, value: rsiResult[i] }));
            if (rsiResult.length > 0) {
                latestValuesRef.current.rsi = rsiResult[rsiResult.length - 1];
            }
            seriesRefs.current.rsiLine.setData(rsiData);
        } else {
            if (seriesRefs.current.rsiLine) {
                chart.removeSeries(seriesRefs.current.rsiLine);
                delete seriesRefs.current.rsiLine;
            }
        }

        // Add/Remove KD (Stochastic)
        if (indicators.kd) {
            let paneIndex = (indicators.macd ? 1 : 0) + (indicators.rsi ? 1 : 0);
            const kdMarginTop = 1 - (activePanes - paneIndex) * 0.15 - 0.05;
            const kdMarginBottom = (activePanes - paneIndex - 1) * 0.15;

            if (!seriesRefs.current.kdKLine) {
                seriesRefs.current.kdKLine = chart.addSeries(LineSeries, { color: '#2962FF', lineWidth: 1, priceScaleId: 'kd' });
                seriesRefs.current.kdDLine = chart.addSeries(LineSeries, { color: '#FF6D00', lineWidth: 1, priceScaleId: 'kd' });
            }

            chart.priceScale('kd').applyOptions({
                scaleMargins: { top: kdMarginTop, bottom: kdMarginBottom },
            });

            const stochResult = Stochastic.calculate({
                high: highs,
                low: lows,
                close: closes,
                period: 9,
                signalPeriod: 3
            });
            
            // Stochastic starts 8 bars in
            const offset = 8;
            const kData = formattedData.slice(offset).map((d, i) => ({ time: d.time, value: stochResult[i]?.k || 0 }));
            const dData = formattedData.slice(offset).map((d, i) => ({ time: d.time, value: stochResult[i]?.d || 0 }));
            
            if (stochResult.length > 0) {
                latestValuesRef.current.kd = stochResult[stochResult.length - 1];
            }

            seriesRefs.current.kdKLine.setData(kData);
            seriesRefs.current.kdDLine.setData(dData);
        } else {
            ['kdKLine', 'kdDLine'].forEach(key => {
                if (seriesRefs.current[key]) {
                    chart.removeSeries(seriesRefs.current[key]);
                    delete seriesRefs.current[key];
                }
            });
        }

        // Add/Remove Support & Resistance
        if (indicators.srLevels) {
            const { supports, resistances } = calculateSupportResistance(ohlcvData);
            
            supports.forEach(level => {
                const line = seriesRefs.current.candlestick.createPriceLine({
                    price: level,
                    color: '#22C55E',
                    lineWidth: 1,
                    lineStyle: LineStyle.Dotted,
                    axisLabelVisible: true,
                    title: 'S',
                });
                priceLinesRef.current.push(line);
            });

            resistances.forEach(level => {
                const line = seriesRefs.current.candlestick.createPriceLine({
                    price: level,
                    color: '#EF4444',
                    lineWidth: 1,
                    lineStyle: LineStyle.Dotted,
                    axisLabelVisible: true,
                    title: 'R',
                });
                priceLinesRef.current.push(line);
            });
        }

        // Add/Remove Fibonacci
        if (indicators.fibonacci) {
            const fibs = calculateFibonacciRetracement(ohlcvData);
            fibs.forEach(fib => {
                const line = seriesRefs.current.candlestick.createPriceLine({
                    price: fib.price,
                    color: '#D946EF',
                    lineWidth: 1,
                    lineStyle: LineStyle.SparseDotted,
                    axisLabelVisible: true,
                    title: `Fib ${fib.level}`,
                });
                priceLinesRef.current.push(line);
            });
        }

        // Add/Remove Patterns
        if (indicators.patterns && ohlcvData.length > 0) {
            // We just calculate patterns for the last candle as per technical.ts
            // and attach a marker to it.
            const patterns = detectCandlestickPatterns(ohlcvData);
            if (patterns.length > 0) {
                const lastCandle = formattedData[formattedData.length - 1];
                seriesRefs.current.candlestick.setMarkers([{
                    time: lastCandle.time,
                    position: 'aboveBar',
                    color: '#F59E0B',
                    shape: 'arrowDown',
                    text: patterns.join(', '),
                }]);
            }
        }

        chart.timeScale().fitContent();

        // Crosshair handler for Legend
        const handleCrosshairMove = (param: any) => {
            if (!param.time || param.point.x < 0 || param.point.x > chartContainerRef.current!.clientWidth || param.point.y < 0 || param.point.y > chartContainerRef.current!.clientHeight) {
                setLegendData(null);
                return;
            }

            const candleData = param.seriesData.get(seriesRefs.current.candlestick) as any;
            if (!candleData) {
                setLegendData(null);
                return;
            }

            const formatValue = (val: number | undefined) => val !== undefined ? val.toFixed(2) : 'N/A';

            const newLegend: LegendData = {
                time: String(param.time),
                open: formatValue(candleData.open),
                high: formatValue(candleData.high),
                low: formatValue(candleData.low),
                close: formatValue(candleData.close),
                volume: param.seriesData.get(seriesRefs.current.volume)?.value?.toLocaleString() || '0',
            };

            if (indicators.ma) {
                newLegend.ma5 = formatValue(param.seriesData.get(seriesRefs.current.ma5)?.value);
                newLegend.ma20 = formatValue(param.seriesData.get(seriesRefs.current.ma20)?.value);
                newLegend.ma60 = formatValue(param.seriesData.get(seriesRefs.current.ma60)?.value);
            }

            if (indicators.ema) {
                newLegend.ema12 = formatValue(param.seriesData.get(seriesRefs.current.ema12)?.value);
                newLegend.ema26 = formatValue(param.seriesData.get(seriesRefs.current.ema26)?.value);
            }

            if (indicators.bb) {
                newLegend.bb = {
                    upper: formatValue(param.seriesData.get(seriesRefs.current.bbUpper)?.value),
                    middle: formatValue(param.seriesData.get(seriesRefs.current.bbMiddle)?.value),
                    lower: formatValue(param.seriesData.get(seriesRefs.current.bbLower)?.value),
                };
            }

            if (indicators.macd) {
                newLegend.macd = {
                    macd: formatValue(param.seriesData.get(seriesRefs.current.macdLine)?.value),
                    signal: formatValue(param.seriesData.get(seriesRefs.current.macdSignal)?.value),
                    hist: formatValue(param.seriesData.get(seriesRefs.current.macdHist)?.value),
                };
            }

            if (indicators.rsi) {
                newLegend.rsi = formatValue(param.seriesData.get(seriesRefs.current.rsiLine)?.value);
            }

            if (indicators.kd) {
                newLegend.kd = {
                    k: formatValue(param.seriesData.get(seriesRefs.current.kdKLine)?.value),
                    d: formatValue(param.seriesData.get(seriesRefs.current.kdDLine)?.value),
                };
            }

            setLegendData(newLegend);
        };

        chart.subscribeCrosshairMove(handleCrosshairMove);

        // Provide initial legend data for the last candle
        if (formattedData.length > 0) {
            const lastCandle = formattedData[formattedData.length - 1];
            setLegendData({
                time: lastCandle.time,
                open: lastCandle.open.toFixed(2),
                high: lastCandle.high.toFixed(2),
                low: lastCandle.low.toFixed(2),
                close: lastCandle.close.toFixed(2),
                volume: lastCandle.volume?.toLocaleString() || '0',
            });
        }

        return () => {
            chart.unsubscribeCrosshairMove(handleCrosshairMove);
        };
    }, [data, indicators, upColor, downColor]);

    return (
        <div ref={chartContainerRef} className={className}>
            {onGetAdvice && symbol && (
                <div className="absolute top-2 right-2 z-20">
                    <Button 
                        size="sm" 
                        className="shadow-lg backdrop-blur-md bg-primary/90 hover:bg-primary"
                        onClick={() => onGetAdvice(symbol, indicators, latestValuesRef.current)}
                    >
                        <Bot className="w-4 h-4 mr-2" />
                        請求 Agent 投資建議
                    </Button>
                </div>
            )}
            {legendData && (
                <div className="absolute top-2 left-2 z-10 pointer-events-none text-xs flex flex-col gap-1 p-2 rounded bg-background/80 backdrop-blur-sm border border-border">
                    <div className="flex gap-2 font-mono text-foreground">
                        <span className="font-semibold">{legendData.time}</span>
                        <span>O:<span className="text-muted-foreground">{legendData.open}</span></span>
                        <span>H:<span className="text-muted-foreground">{legendData.high}</span></span>
                        <span>L:<span className="text-muted-foreground">{legendData.low}</span></span>
                        <span>C:<span className="text-muted-foreground">{legendData.close}</span></span>
                        <span>Vol:<span className="text-muted-foreground">{legendData.volume}</span></span>
                    </div>
                    
                    {indicators.ma && legendData.ma5 && (
                        <div className="flex gap-2 font-mono">
                            <span style={{color: '#2962FF'}}>MA5:{legendData.ma5}</span>
                            <span style={{color: '#FF6D00'}}>MA20:{legendData.ma20}</span>
                            <span style={{color: '#9C27B0'}}>MA60:{legendData.ma60}</span>
                        </div>
                    )}

                    {indicators.ema && legendData.ema12 && (
                        <div className="flex gap-2 font-mono">
                            <span style={{color: '#00BCD4'}}>EMA12:{legendData.ema12}</span>
                            <span style={{color: '#FF5252'}}>EMA26:{legendData.ema26}</span>
                        </div>
                    )}
                    
                    {indicators.bb && legendData.bb && (
                        <div className="flex gap-2 font-mono" style={{color: 'rgba(33, 150, 243, 0.8)'}}>
                            <span>BB Up:{legendData.bb.upper}</span>
                            <span>Mid:{legendData.bb.middle}</span>
                            <span>Low:{legendData.bb.lower}</span>
                        </div>
                    )}

                    {indicators.macd && legendData.macd && (
                        <div className="flex gap-2 font-mono">
                            <span className="font-semibold text-muted-foreground">MACD(12,26,9)</span>
                            <span style={{color: '#2962FF'}}>{legendData.macd.macd}</span>
                            <span style={{color: '#FF6D00'}}>{legendData.macd.signal}</span>
                            <span className={Number(legendData.macd.hist) >= 0 ? 'text-green-500' : 'text-red-500'}>
                                {legendData.macd.hist}
                            </span>
                        </div>
                    )}

                    {indicators.rsi && legendData.rsi && (
                        <div className="flex gap-2 font-mono">
                            <span className="font-semibold text-muted-foreground">RSI(14)</span>
                            <span style={{color: '#9C27B0'}}>{legendData.rsi}</span>
                        </div>
                    )}

                    {indicators.kd && legendData.kd && (
                        <div className="flex gap-2 font-mono">
                            <span className="font-semibold text-muted-foreground">KD(9,3,3)</span>
                            <span style={{color: '#2962FF'}}>K:{legendData.kd.k}</span>
                            <span style={{color: '#FF6D00'}}>D:{legendData.kd.d}</span>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}
