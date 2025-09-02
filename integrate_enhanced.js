const fs = require('fs');

// Читаем оригинальный файл
let content = fs.readFileSync('src/main.ts', 'utf8');

// Добавляем импорты в начало
const imports = `import { ScalperEnhancer, createDefaultConfig } from './core/scalperEnhancer';
import { MexcRestClient } from './infra/mexcRest';
import { Instrument } from './core/types';
`;

content = content.replace("import 'dotenv/config';", imports + "import 'dotenv/config';");

// Добавляем поля в класс
content = content.replace(
  '  private lastStatusUpdate = 0;',
  `  private lastStatusUpdate = 0;
  
  // Улучшенный скальпер
  private enhancedScalper: ScalperEnhancer;
  private mexcRestClient: MexcRestClient;`
);

// Добавляем инициализацию в конструктор
const constructorInit = `    this.setupTelegramHandlers();
    
    // Создаем улучшенный скальпер
    const config = createDefaultConfig();
    this.mexcRestClient = new MexcRestClient(
      process.env.MEXC_API_KEY!,
      process.env.MEXC_SECRET_KEY!
    );
    
    const instrument: Instrument = {
      symbol: 'ETHUSDC',
      baseAsset: 'ETH',
      quoteAsset: 'USDC',
      tickSize: 0.01,
      stepSize: 0.000001,
      minNotional: 1.0,
      maxNotional: 1000000,
      minQty: 0.000001,
      maxQty: 1000
    };
    
    this.enhancedScalper = new ScalperEnhancer(config, this.mexcRestClient, instrument);`;

content = content.replace('    this.setupTelegramHandlers();', constructorInit);

// Добавляем запуск улучшенного скальпера
content = content.replace(
  '      this.logger.info(\'🚀 Мы запустили MEXC Скальпер\');',
  `      this.logger.info('🚀 Мы запустили MEXC Скальпер с улучшениями');
      
      // Запускаем улучшенный скальпер
      await this.enhancedScalper.start();`
);

// Добавляем вызов улучшенного скальпера в основной цикл
content = content.replace(
  '      this.logger.info(`📊 Статус: ${buyOrders} buy, ${sellOrders} sell ордеров`);',
  `      this.logger.info(\`📊 Статус: \${buyOrders} buy, \${sellOrders} sell ордеров\`);
      
      // Управляем ордерами через улучшенный скальпер
      await this.enhancedScalper.manageOrders(currentOrders);`
);

// Добавляем остановку улучшенного скальпера
content = content.replace(
  '    this.isRunning = false;',
  `    this.isRunning = false;
    
    // Останавливаем улучшенный скальпер
    await this.enhancedScalper.stop();`
);

// Меняем интервал с 30 на 15 секунд
content = content.replace(/30000/g, '15000');

// Записываем обновленный файл
fs.writeFileSync('src/main.ts', content);

console.log('✅ Интеграция завершена успешно!');
