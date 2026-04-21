export interface RichMenuArea {
    bounds: {
        x: number;
        y: number;
        width: number;
        height: number;
    };
    action: {
        type: string;
        text?: string;
        data?: string;
        label?: string;
    };
}
export interface RichMenuConfig {
    size: {
        width: number;
        height: number;
    };
    selected: boolean;
    name: string;
    chatBarText: string;
    areas: RichMenuArea[];
}
export declare function getButlerRichMenuConfig(): RichMenuConfig;
export declare function setupRichMenu(accessToken: string): Promise<string>;
export declare function generateRichMenuImageSVG(): string;
//# sourceMappingURL=rich-menu.config.d.ts.map