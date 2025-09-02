# MEXC Scalp Bot

Скальпер для MEXC Spot с расстановкой лимиток по уровням, maker‑guard, обновлением заявок по TTL/дрейфу и телеграм‑оповещениями. Данные сохраняются в SQLite. Документ в UTF‑8.

## Требования

- Node.js 20+
- Ключи MEXC API (спот)

## Быстрый старт

1) Установка
```
npm install
```

2) Окружение
```
cp env.example .env
```
Заполните `MEXC_API_KEY`, `MEXC_SECRET_KEY`, `TELEGRAM_BOT_TOKEN`.

3) Сборка и инициализация БД
```
npm run build
npm run db:init
```

4) Запуск
```
npm run dev   # разработка (ts-node)
npm start     # прод (из dist)
```

## Важные переменные .env

- `ORDER_NOTIONAL_USD`: целевой номинал заявки в USD (по умолчанию 1.5)
- `MAKER_GUARD_GAP_TICKS`: зазор в тиках от bestBid/bestAsk (по умолчанию 1)
- `TTL_MS`, `DELTA_TICKS`: репрайс по времени и дрейфу
- `CANCEL_RATE_PER_MIN`: лимит отмен в минуту (по умолчанию 30)
- `TICK_SIZE`, `STEP_SIZE`, `MIN_NOTIONAL`, `MIN_QTY`: резервные фильтры; реальные подтягиваются через exchangeInfo

## Что делает бот сейчас

- Выставляет недостающие BUY/SELL уровни вокруг mid
- Maker‑guard: BUY ≤ bestBid − gap; SELL ≥ bestAsk + gap
- Репрайс BUY/SELL по TTL и дрейфу (в тиках)
- Учитывает биржевые фильтры: `tickSize`, `stepSize`, `minNotional`, `minQty`
- Лимитирует отмены (`CANCEL_RATE_PER_MIN`)
- Пишет события в SQLite (`events`) и шлёт статусы в Telegram

## Структура

- `src/main.ts` — основной раннер: постановка/репрайс, guard, лимиты, статусы
- `src/infra/mexcRest.ts` — обёртка SDK (ордера, тикеры, сделки, баланс)
- `src/core/math.ts` — утилиты и индикаторы
- `src/storage/db.ts` — SQLite (events, orders, fills, positions, trades)

## Примечания

- Для точного учёта PnL можно подключить FIFO‑позиции на основе `accountTradeList` и комиссий — по запросу.
