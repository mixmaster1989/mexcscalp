import 'dotenv/config';
export declare class TelegramNotifier {
    private bot;
    private chatIds;
    constructor(token?: string, chatIds?: string[]);
    sendMessage(text: string): Promise<void>;
    sendPNL(symbol: string, qty: number, buyPrice: number, sellPrice: number, feePct?: number): Promise<void>;
}
//# sourceMappingURL=notifier.d.ts.map