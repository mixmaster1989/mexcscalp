#!/usr/bin/env node
require('dotenv').config();
const fs = require('fs');
const path = require('path');

console.log('🔄 ПЕРЕКЛЮЧАТЕЛЬ РЕЖИМОВ СКАЛЬПЕРА\n');

class ModeSwitcher {
  constructor() {
    this.configPath = './scalper_config.json';
  }

  loadConfig() {
    try {
      const configData = fs.readFileSync(this.configPath, 'utf8');
      return JSON.parse(configData);
    } catch (error) {
      console.error('❌ Ошибка загрузки конфига:', error.message);
      return null;
    }
  }

  saveConfig(config) {
    try {
      fs.writeFileSync(this.configPath, JSON.stringify(config, null, 2));
      console.log('✅ Конфиг сохранен');
    } catch (error) {
      console.error('❌ Ошибка сохранения конфига:', error.message);
    }
  }

  showCurrentConfig() {
    const config = this.loadConfig();
    if (!config) return;

    console.log('📊 ТЕКУЩАЯ КОНФИГУРАЦИЯ:');
    console.log('═'.repeat(50));
    console.log(`Пара: ${config.symbol}`);
    console.log(`Депозит: ${config.deposit_usd} USDC`);
    console.log(`Режим: ${config.mode === 'ladder' ? 'Лесенка' : 'Ёршики'}`);
    
    if (config.mode === 'ladder') {
      console.log('\n📈 ПАРАМЕТРЫ ЛЕСЕНКИ:');
      console.log(`  Уровней: ${config.ladder.levels}`);
      console.log(`  Шаг (k_step): ${config.ladder.k_step}`);
      console.log(`  TP: ${config.ladder.tp_pct}%`);
      console.log(`  Геометрия (r): ${config.ladder.geometry_r}`);
      console.log(`  Z_max: ${config.ladder.z_max}`);
    } else {
      console.log('\n🟢 ПАРАМЕТРЫ ЁРШИКОВ:');
      console.log(`  Уровней: ${config.hedgehog.levels}`);
      console.log(`  Отступ (offset_k): ${config.hedgehog.offset_k}`);
      console.log(`  Шаг (step_k): ${config.hedgehog.step_k}`);
      console.log(`  TP: ${config.hedgehog.tp_pct}%`);
      console.log(`  Макс. инвентарь: ${config.hedgehog.max_inventory_pct}%`);
    }
    
    console.log('\n⚠️ РИСК-МЕНЕДЖМЕНТ:');
    console.log(`  Макс. по инструменту: ${config.risk.max_notional_per_symbol}%`);
    console.log(`  Макс. просадка: ${config.risk.max_drawdown_pct}%`);
    console.log(`  Макс. убытков подряд: ${config.risk.max_consecutive_losses}`);
  }

  showPresets() {
    const config = this.loadConfig();
    if (!config) return;

    console.log('\n🎯 ДОСТУПНЫЕ ПРЕСЕТЫ:');
    console.log('═'.repeat(50));
    
    Object.keys(config.presets).forEach((presetName, index) => {
      const preset = config.presets[presetName];
      console.log(`${index + 1}. ${presetName.toUpperCase()}`);
      console.log(`   Режим: ${preset.mode === 'ladder' ? 'Лесенка' : 'Ёршики'}`);
      console.log(`   ${preset.description}`);
      console.log('');
    });
  }

  applyPreset(presetName) {
    const config = this.loadConfig();
    if (!config) return;

    const preset = config.presets[presetName];
    if (!preset) {
      console.error(`❌ Пресет "${presetName}" не найден`);
      return;
    }

    // Применяем пресет
    config.mode = preset.mode;
    
    if (preset.ladder) {
      config.ladder = { ...config.ladder, ...preset.ladder };
    }
    
    if (preset.hedgehog) {
      config.hedgehog = { ...config.hedgehog, ...preset.hedgehog };
    }

    this.saveConfig(config);
    
    console.log(`✅ Применен пресет: ${presetName.toUpperCase()}`);
    console.log(`📊 Режим: ${preset.mode === 'ladder' ? 'Лесенка' : 'Ёршики'}`);
    console.log(`📝 ${preset.description}`);
  }

  switchMode(mode) {
    const config = this.loadConfig();
    if (!config) return;

    if (mode !== 'ladder' && mode !== 'hedgehog') {
      console.error('❌ Неверный режим. Используйте: ladder или hedgehog');
      return;
    }

    config.mode = mode;
    this.saveConfig(config);
    
    console.log(`✅ Режим изменен на: ${mode === 'ladder' ? 'Лесенка' : 'Ёршики'}`);
  }

  updateParameter(section, param, value) {
    const config = this.loadConfig();
    if (!config) return;

    if (!config[section]) {
      console.error(`❌ Секция "${section}" не найдена`);
      return;
    }

    if (config[section][param] === undefined) {
      console.error(`❌ Параметр "${param}" не найден в секции "${section}"`);
      return;
    }

    const oldValue = config[section][param];
    config[section][param] = parseFloat(value);
    this.saveConfig(config);
    
    console.log(`✅ ${section}.${param}: ${oldValue} → ${value}`);
  }

  showHelp() {
    console.log('📖 КОМАНДЫ:');
    console.log('═'.repeat(50));
    console.log('node switch_mode.js status          - Показать текущую конфигурацию');
    console.log('node switch_mode.js presets         - Показать доступные пресеты');
    console.log('node switch_mode.js preset <name>   - Применить пресет');
    console.log('node switch_mode.js mode <type>     - Переключить режим (ladder/hedgehog)');
    console.log('node switch_mode.js set <section> <param> <value> - Изменить параметр');
    console.log('');
    console.log('📝 ПРИМЕРЫ:');
    console.log('node switch_mode.js preset eth_conservative');
    console.log('node switch_mode.js mode hedgehog');
    console.log('node switch_mode.js set hedgehog tp_pct 0.12');
    console.log('node switch_mode.js set ladder levels 9');
  }
}

// Обработка аргументов командной строки
const args = process.argv.slice(2);
const switcher = new ModeSwitcher();

if (args.length === 0) {
  switcher.showHelp();
} else {
  const command = args[0];
  
  switch (command) {
    case 'status':
      switcher.showCurrentConfig();
      break;
      
    case 'presets':
      switcher.showPresets();
      break;
      
    case 'preset':
      if (args[1]) {
        switcher.applyPreset(args[1]);
      } else {
        console.error('❌ Укажите название пресета');
      }
      break;
      
    case 'mode':
      if (args[1]) {
        switcher.switchMode(args[1]);
      } else {
        console.error('❌ Укажите режим: ladder или hedgehog');
      }
      break;
      
    case 'set':
      if (args.length === 4) {
        switcher.updateParameter(args[1], args[2], args[3]);
      } else {
        console.error('❌ Использование: set <section> <param> <value>');
      }
      break;
      
    default:
      console.error(`❌ Неизвестная команда: ${command}`);
      switcher.showHelp();
  }
}


