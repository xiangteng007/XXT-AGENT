/**
 * LINE Flex Message Builder
 *
 * Creates rich Flex Message cards for the 小秘書 Butler bot.
 * Supports finance summaries, health reports, schedule views,
 * and vehicle status cards.
 *
 * @see https://developers.line.biz/en/docs/messaging-api/flex-message-elements/
 */
export interface FlexMessage {
    type: 'flex';
    altText: string;
    contents: FlexContainer;
}
export interface FlexContainer {
    type: 'bubble' | 'carousel';
    header?: FlexBox;
    hero?: FlexImage;
    body?: FlexBox;
    footer?: FlexBox;
    styles?: FlexBubbleStyles;
    contents?: FlexContainer[];
}
export interface FlexBox {
    type: 'box';
    layout: 'horizontal' | 'vertical' | 'baseline';
    contents: FlexComponent[];
    spacing?: string;
    margin?: string;
    paddingAll?: string;
    backgroundColor?: string;
}
export interface FlexComponent {
    type: 'text' | 'icon' | 'image' | 'button' | 'separator' | 'box' | 'spacer';
    text?: string;
    size?: string;
    weight?: string;
    color?: string;
    wrap?: boolean;
    flex?: number;
    margin?: string;
    align?: string;
    action?: FlexAction;
    url?: string;
    aspectMode?: string;
    aspectRatio?: string;
    layout?: string;
    contents?: FlexComponent[];
    spacing?: string;
    height?: string;
    style?: string;
    paddingAll?: string;
    backgroundColor?: string;
}
export interface FlexAction {
    type: 'postback' | 'uri' | 'message';
    label: string;
    data?: string;
    text?: string;
    uri?: string;
}
export interface FlexImage {
    type: 'image';
    url: string;
    size: string;
    aspectRatio?: string;
    aspectMode?: string;
}
export interface FlexBubbleStyles {
    header?: {
        backgroundColor?: string;
    };
    body?: {
        backgroundColor?: string;
    };
    footer?: {
        backgroundColor?: string;
    };
}
export declare function buildFinanceSummaryCard(data: {
    monthLabel: string;
    totalExpense: number;
    totalIncome: number;
    topCategories: Array<{
        name: string;
        amount: number;
        emoji: string;
    }>;
    trend: 'up' | 'down' | 'flat';
}): FlexMessage;
export declare function buildHealthSummaryCard(data: {
    date: string;
    steps: number;
    stepsGoal: number;
    activeMinutes: number;
    calories: number;
    sleepHours: number;
    heartRate?: number;
    weight?: number;
}): FlexMessage;
export declare function buildVehicleStatusCard(data: {
    make: string;
    model: string;
    variant: string;
    licensePlate: string;
    mileage: number;
    nextServiceMileage: number;
    insuranceExpiry: string;
    inspectionExpiry: string;
    lastFuelEfficiency?: number;
}): FlexMessage;
export declare function buildScheduleCard(data: {
    date: string;
    events: Array<{
        time: string;
        title: string;
        location?: string;
        emoji: string;
    }>;
}): FlexMessage;
export declare function buildQuickReplyButtons(): object;
export type ReplyDomain = 'finance' | 'health' | 'vehicle' | 'schedule' | 'general';
export declare function detectDomain(text: string): ReplyDomain;
//# sourceMappingURL=butler-flex.service.d.ts.map