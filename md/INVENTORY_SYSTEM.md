# Система Инвентаря

## Структура предметов

### Свойство `stackable`

Все предметы могут иметь свойство `stackable`:
- **`stackable` отсутствует или `false`** (по умолчанию) - предмет НЕ стакается, каждый экземпляр занимает отдельный слот
- **`stackable: true`** - предметы этого типа могут стакаться и образовывать группы

### Примеры:

**Экипировка** (`equipment.json`):
```json
{
  "id": "gasmask",
  "part": "head",
  "stats": { ... }
  // stackable отсутствует → по умолчанию false (не стакается)
}
```

**Расходники и валюта** (`other.json`):
```json
{
  "id": "ygdrasil-coin-old",
  "sprite": "/images/sprites/items/other/ygdrasil-coin-old.png",
  "stackable": true  // Явно указано, что стакается
}
```

## Структура инвентаря в values.json

Инвентарь персонажа хранится в поле `inventory`:

```json
{
  "id": "mc",
  "name": "Я",
  "inventory": {
    "items": [
      {
        "itemId": "gasmask"
        // quantity отсутствует → по умолчанию 1
      },
      {
        "itemId": "ygdrasil-coin-old",
        "quantity": 23  // Явно указано количество > 1
      }
    ]
  }
}
```

### Формат элемента инвентаря:

- **`itemId`** - идентификатор предмета (должен существовать в equipment.json или other.json)
- **`quantity`** - количество предметов (ОПЦИОНАЛЬНО, по умолчанию = 1)
  - Для нестакаемых предметов (stackable: false) всегда = 1, не нужно указывать
  - Для стакаемых предметов (stackable: true) указывается только если > 1

## Правила оптимизации JSON:

1. **Если предмет не стакается** → не писать `stackable: false`
2. **Если количество = 1** → не писать `quantity: 1`
3. **Если stackable = true** → обязательно указать
4. **Если quantity > 1** → обязательно указать

## Правила обработки в коде:

1. **Нестакаемые предметы** - каждый предмет учитывается отдельно:
   - `{ "itemId": "gasmask" }` → quantity = 1
   - `{ "itemId": "tshirt" }` → quantity = 1

2. **Стакаемые предметы** - объединяются в группы:
   - `{ "itemId": "ygdrasil-coin-old", "quantity": 23 }` → 23 монеты
   - `{ "itemId": "bread" }` → quantity = 1
   - `{ "itemId": "bread", "quantity": 5 }` → 5 хлебов

3. **Поиск предмета** - достаточно проверить `itemId` и свойство `stackable` в определении

4. **Максимальный стак** - не ограничен (если stackable: true)

## Примеры использования в коде (будут добавлены):

```javascript
// Добавить предмет в инвентарь
addItemToInventory(character, "ygdrasil-coin-old", 10)
// Если stackable и уже есть → увеличит quantity на 10
// Если не stackable → создаст новый слот

// Получить предметы определенного типа
const coins = getInventoryItem(character, "ygdrasil-coin-old")
// Returns: { itemId: "ygdrasil-coin-old", quantity: 23 }
// Или: { itemId: "gasmask" } (если quantity = 1)

// Удалить предмет из инвентаря
removeFromInventory(character, "ygdrasil-coin-old", 5)
// Результат: { itemId: "ygdrasil-coin-old", quantity: 18 }
// Если quantity становится 0 → удалить запись полностью
```

## Файлы предметов:

- `/data/items/equipment.json` - экипировка (одежда, оружие, украшения)
- `/data/items/other.json` - расходники, валюта, материалы, еда
