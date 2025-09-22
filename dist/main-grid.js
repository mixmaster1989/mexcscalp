"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
require("dotenv/config");
const grid_engine_1 = require("./grid/grid-engine");
async function main() {
    const symbol = process.env.SYMBOL || 'ETHUSDC';
    const stepUsd = Number(process.env.GRID_STEP_USD || 3.5);
    const targetNotional = Number(process.env.GRID_TARGET_NOTIONAL_USDC || 3.0);
    const engine = new grid_engine_1.GridEngine({
        symbol,
        stepUsd,
        levelsEachSide: 6,
        targetNotional,
        recenterSec: Number(process.env.GRID_RECENTER_SEC || 180)
    });
    await engine.start();
    process.on('SIGINT', () => process.exit(0));
}
if (require.main === module) {
    main().catch(err => { console.error(err); process.exit(1); });
}
//# sourceMappingURL=main-grid.js.map