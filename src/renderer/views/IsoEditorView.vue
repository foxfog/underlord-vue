<template>
	<div class="iso-editor-view">
		<!-- Header Toolbar -->
		<header class="editor-header">
			<div class="header-left">
				<button class="editor-btn editor-btn-back" @click="returnToHome">
					<span class="btn-icon">‹</span>
					<span>Меню</span>
				</button>

				<!-- Location Loader Selector -->
				<div class="header-selector-box">
					<span class="selector-icon">📂</span>
					<label class="selector-label">Карта:</label>
					<select
						v-model="selectedMapId"
						class="editor-select"
						@change="onLoadSelectedMap"
					>
						<option
							v-for="loc in availableMaps"
							:key="loc.id"
							:value="loc.id"
						>
							{{ loc.name }} ({{ loc.folder || 'tests' }})
						</option>
					</select>
				</div>

				<button class="editor-btn editor-btn-action" @click="openNewMapModal">
					<span>➕ Новая карта</span>
				</button>
			</div>

			<div class="header-center">
				<div class="map-title-badge" title="Нажмите, чтобы изменить размер сетки карты" @click="openResizeModal">
					<span class="map-name">{{ mapData.name || 'Без названия' }}</span>
					<span class="map-size">📐 Сетка: {{ mapData.gridWidth || 11 }}×{{ mapData.gridHeight || 11 }} (X: [{{ currentMapBounds.minX }}..{{ currentMapBounds.maxX }}], Y: [{{ currentMapBounds.minY }}..{{ currentMapBounds.maxY }}]) — Изменить</span>
				</div>
			</div>

			<div class="header-right">
				<button class="editor-btn editor-btn-secondary" @click="openExportModal">
					<span>💾 Экспорт JSON</span>
				</button>
				<button class="editor-btn editor-btn-primary" @click="testCurrentMap">
					<span>▶️ Тестировать</span>
				</button>
			</div>
		</header>

		<!-- Main Workspace -->
		<div class="editor-workspace">
			<!-- Left Tools Palette -->
			<aside class="editor-sidebar">
				<div class="tool-section">
					<div class="section-title">Инструмент</div>
					<div class="tool-tabs">
						<button
							class="tool-tab"
							:class="{ __active: activeTool === 'select' }"
							@click="activeTool = 'select'"
						>
							🔍 Инспектор
						</button>
						<button
							class="tool-tab"
							:class="{ __active: activeTool === 'tile' }"
							@click="activeTool = 'tile'"
						>
							🖌️ Тайлы
						</button>
						<button
							class="tool-tab"
							:class="{ __active: activeTool === 'elevation' }"
							@click="activeTool = 'elevation'"
						>
							⛰️ Высота Z
						</button>
						<button
							class="tool-tab"
							:class="{ __active: activeTool === 'object' }"
							@click="activeTool = 'object'"
						>
							📦 Объекты
						</button>
						<button
							class="tool-tab"
							:class="{ __active: activeTool === 'wall' }"
							@click="activeTool = 'wall'"
						>
							🧱 Стены
						</button>
						<button
							class="tool-tab"
							:class="{ __active: activeTool === 'spawn' }"
							@click="activeTool = 'spawn'"
						>
							🧙 Спавн
						</button>
						<button
							class="tool-tab"
							:class="{ __active: activeTool === 'eraser' }"
							@click="activeTool = 'eraser'"
						>
							🧹 Ластик
						</button>
					</div>

					<button class="editor-btn editor-btn-action resize-quick-btn" @click="openResizeModal">
						<span>📐 Размер сетки ({{ mapData.gridWidth || 11 }}×{{ mapData.gridHeight || 11 }})</span>
					</button>
				</div>

				<!-- Tool Options: Inspector Mode Info -->
				<div v-if="activeTool === 'select'" class="tool-section">
					<div class="section-title">Режим инспектора</div>
					<p class="section-desc">
						Кликните по любой клетке на холсте, чтобы открыть подробную структуру ее слоев, стен и дерева объектов в правой панели.
					</p>
					<div v-if="selectedTileCoord" class="selected-tile-indicator">
						<span>Выбрана клетка:</span>
						<strong>[X: {{ selectedTileCoord.x }}, Y: {{ selectedTileCoord.y }}]</strong>
					</div>
				</div>

				<!-- Tool Options: Brush Settings (for tile / elevation / eraser) -->
				<div v-if="['tile', 'elevation', 'eraser'].includes(activeTool)" class="tool-section">
					<div class="section-title flex-between">
						<span>Параметры кисти</span>
						<span class="brush-size-badge">{{ brushShape === 'round' ? '⏺️ Круг' : '⏹️ Квадрат' }} {{ brushSize }}×{{ brushSize }}</span>
					</div>

					<div class="brush-shape-toggle">
						<button
							class="brush-shape-btn"
							:class="{ __active: brushShape === 'square' }"
							title="Квадратная кисть"
							@click="brushShape = 'square'"
						>
							⏹️ Квадрат
						</button>
						<button
							class="brush-shape-btn"
							:class="{ __active: brushShape === 'round' }"
							title="Круглая кисть"
							@click="brushShape = 'round'"
						>
							⏺️ Круг
						</button>
					</div>

					<div class="brush-slider-row">
						<div class="brush-slider-header">
							<span class="form-sublabel">Размер:</span>
							<strong class="brush-size-number">{{ brushSize }} {{ brushSize === 1 ? '(1 клетка)' : `(${brushSize}×${brushSize})` }}</strong>
						</div>
						<input
							v-model.number="brushSize"
							type="range"
							min="1"
							max="11"
							step="1"
							class="brush-range-input"
						/>
					</div>

					<div class="brush-quick-sizes">
						<button
							v-for="s in [1, 2, 3, 5, 7, 9, 11]"
							:key="s"
							class="size-quick-btn"
							:class="{ __active: brushSize === s }"
							@click="brushSize = s"
						>
							{{ s }}
						</button>
					</div>

					<div class="brush-hint-box">
						<span class="hint-line">🖌️ Зажмите ЛКМ и ведите для закрашивания</span>
						<span class="hint-line">⌨️ Клавиши [ и ] — размер кисти</span>
						<span class="hint-line">🖱️ Пробел + ЛКМ или Колесико — сдвиг камеры</span>
					</div>
				</div>

				<!-- Tool Options: Tile Palette -->
				<div v-if="activeTool === 'tile'" class="tool-section">
					<div class="section-title">Тип тайла</div>
					<div class="palette-grid">
						<button
							v-for="t in tileTypes"
							:key="t.id"
							class="palette-btn"
							:class="{ __active: selectedTileType === t.id }"
							@click="selectedTileType = t.id"
						>
							<span
								class="palette-preview"
								:class="{ '__is-void': t.isVoid }"
								:style="{ backgroundColor: t.color }"
							/>
							<span class="palette-name">{{ t.name }}</span>
						</button>
					</div>
				</div>

				<!-- Tool Options: Elevation Mode -->
				<div v-if="activeTool === 'elevation'" class="tool-section">
					<div class="section-title">Режим высоты</div>
					<div class="elevation-controls">
						<button
							class="palette-btn"
							:class="{ __active: elevationMode === 'raise' }"
							@click="elevationMode = 'raise'"
						>
							<span>▲ Поднять (+1)</span>
						</button>
						<button
							class="palette-btn"
							:class="{ __active: elevationMode === 'lower' }"
							@click="elevationMode = 'lower'"
						>
							<span>▼ Опустить (-1)</span>
						</button>
						<button
							class="palette-btn"
							:class="{ __active: elevationMode === 'set' }"
							@click="elevationMode = 'set'"
						>
							<span>Задать точный Z</span>
						</button>
					</div>

					<div v-if="elevationMode === 'set'" class="z-picker">
						<label class="z-label">Уровень Z:</label>
						<div class="z-buttons">
							<button
								v-for="zVal in [-1, 0, 1, 2, 3, 4]"
								:key="zVal"
								class="z-btn"
								:class="{ __active: exactZ === zVal }"
								@click="setExactZ(zVal)"
							>
								{{ zVal }}
							</button>
						</div>
					</div>
				</div>

				<!-- Tool Options: Objects Palette -->
				<div v-if="activeTool === 'object'" class="tool-section">
					<div class="section-title">Объекты и пропы</div>
					<div class="palette-grid">
						<button
							v-for="o in availableObjects"
							:key="o.id"
							class="palette-btn"
							:class="{ __active: selectedObjectType === o.id }"
							@click="selectedObjectType = o.id"
						>
							<span class="palette-icon">{{ o.icon }}</span>
							<span class="palette-name">{{ o.name }}</span>
						</button>
					</div>

					<div class="sub-label" style="margin-top: 0.8em;">Ориентация:</div>
					<div class="facing-buttons">
						<button
							v-for="dir in ['SE', 'SW', 'NE', 'NW']"
							:key="dir"
							class="facing-btn"
							:class="{ __active: selectedObjectFacing === dir }"
							@click="selectedObjectFacing = dir"
						>
							{{ dir }}
						</button>
					</div>
				</div>

				<!-- Tool Options: Wall Layer -->
				<div v-if="activeTool === 'wall'" class="tool-section">
					<div class="section-title">Стены и двери</div>
					<div class="sub-label">Ребро клетки:</div>
					<div class="edge-selector-grid">
						<button
							v-for="edge in ['NW', 'NE', 'SW', 'SE']"
							:key="edge"
							class="edge-btn"
							:class="{ __active: selectedWallEdge === edge }"
							@click="selectedWallEdge = edge"
						>
							{{ edge }}
						</button>
					</div>

					<div class="sub-label" style="margin-top: 0.6em;">Тип стены / прохода:</div>
					<div class="palette-grid">
						<button
							v-for="w in wallTypes"
							:key="w.id"
							class="palette-btn"
							:class="{ __active: selectedWallType === w.id }"
							@click="selectedWallType = w.id"
						>
							<span class="palette-icon">{{ w.icon }}</span>
							<span class="palette-name">{{ w.name }}</span>
						</button>
					</div>

					<div class="sub-label" style="margin-top: 0.6em;">Высота стены:</div>
					<div class="z-buttons">
						<button
							v-for="h in [1.0, 1.5, 2.0]"
							:key="h"
							class="z-btn"
							:class="{ __active: selectedWallHeight === h }"
							@click="selectedWallHeight = h"
						>
							{{ h }}x
						</button>
					</div>
				</div>

				<!-- Tool Options: Spawn Point -->
				<div v-if="activeTool === 'spawn'" class="tool-section">
					<div class="section-title">Точка спавна героя</div>
					<p class="section-desc">
						Кликните на любую клетку, чтобы установить точку появления персонажа.
					</p>
					<div class="spawn-info">
						<span>Текущий спавн:</span>
						<strong>({{ mapData.defaultSpawn?.x }}, {{ mapData.defaultSpawn?.y }}, Z: {{ mapData.defaultSpawn?.z || 0 }})</strong>
					</div>
				</div>

				<!-- Tool Options: Eraser -->
				<div v-if="activeTool === 'eraser'" class="tool-section">
					<div class="section-title">Режим ластика</div>
					<p class="section-desc">
						Клик по объекту удалит его. Клик по клетке со стенами удалит стены. Клик по приподнятой плитке сбросит Z. Клик по базовой плитке удалит ее, превратив в пропасть. (ПКМ также работает как быстрый ластик).
					</p>
				</div>
			</aside>

			<!-- Center Canvas -->
			<main class="editor-canvas-wrap">
				<IsoCanvas
					ref="canvasRef"
					:location-data="mapData"
					:show-grid="true"
					:show-coords="true"
					:show-heights="showHeights"
					:show-player="true"
					:show-center-marker="true"
					:selected-tile="selectedTileCoord"
					:editor-tool="activeTool"
					:brush-size="brushSize"
					:brush-shape="brushShape"
					mode="editor"
					@editor-brush-apply="handleBrushApply"
					@editor-tile-click="handleTileClick"
					@editor-tile-right-click="handleTileRightClick"
				/>

				<!-- Bottom Status Bar -->
				<div class="editor-statusbar">
					<div class="status-cell">
						<span>Клетка: </span>
						<strong>{{ hoveredInfo.x !== null ? `[X: ${hoveredInfo.x}, Y: ${hoveredInfo.y}, Z: ${hoveredInfo.z}]` : '—' }}</strong>
					</div>
					<div class="status-cell">
						<span>Тайлов: </span>
						<strong>{{ mapData.tiles?.length || 0 }}</strong>
					</div>
					<div class="status-cell">
						<span>Объектов: </span>
						<strong>{{ mapData.objects?.length || 0 }}</strong>
					</div>
					<div class="status-toggles">
						<button
							class="status-toggle-btn"
							:class="{ __active: showHeights }"
							@click="showHeights = !showHeights"
						>
							Высоты
						</button>
						<button class="status-toggle-btn" @click="resetCamera">
							Центр (0,0)
						</button>
					</div>
				</div>
			</main>

			<!-- Right Side Inspector Drawer (when tile or void is selected) -->
			<aside v-if="selectedTileCoord" class="editor-inspector-drawer">
				<!-- Drawer Header -->
				<div class="inspector-header">
					<div class="inspector-title-box">
						<span class="inspector-icon">🔍</span>
						<div>
							<h3 class="inspector-title">Инспектор клетки</h3>
							<div class="inspector-coords">
								<template v-if="selectedTileData">
									[ X: <strong>{{ selectedTileCoord.x }}</strong>, Y: <strong>{{ selectedTileCoord.y }}</strong>, Z: <strong>{{ selectedTileData.z || 0 }}</strong> ]
								</template>
								<template v-else>
									[ X: <strong>{{ selectedTileCoord.x }}</strong>, Y: <strong>{{ selectedTileCoord.y }}</strong> ] • 🌌 Пропасть
								</template>
							</div>
						</div>
					</div>
					<button class="inspector-close-btn" title="Закрыть инспектор" @click="closeInspector">
						✕
					</button>
				</div>

				<!-- If cell is void / chasm -->
				<div v-if="!selectedTileData" class="inspector-section inspector-void-section">
					<span class="void-banner-icon">🌌</span>
					<h4 class="void-banner-title">Клетка-пропасть (Void)</h4>
					<p class="void-banner-desc">
						В этой клетке сетки нет тайла пола. Персонажи не могут наступать в пропасть при поиске пути.
					</p>
					<button class="editor-btn editor-btn-primary" style="width: 100%; margin-top: 0.8em;" @click="createTileAtSelectedVoid">
						<span>➕ Создать тайл здесь</span>
					</button>
				</div>

				<!-- Section 1: Floor Layer (if tile exists) -->
				<div v-if="selectedTileData" class="inspector-section">
					<div class="inspector-sec-header">
						<span class="sec-icon">🌱</span>
						<span>Слой пола (Floor)</span>
					</div>
					<div class="inspector-field-row">
						<label class="field-label">Покрытие:</label>
						<select v-model="selectedTileData.type" class="inspector-select">
							<option v-for="t in tileTypes.filter(item => !item.isVoid)" :key="t.id" :value="t.id">
								{{ t.name }}
							</option>
						</select>
					</div>
					<div class="inspector-field-row">
						<label class="field-label">Высота Z:</label>
						<div class="z-buttons">
							<button
								v-for="zVal in [-1, 0, 1, 2, 3]"
								:key="zVal"
								class="z-btn"
								:class="{ __active: (selectedTileData.z || 0) === zVal }"
								@click="selectedTileData.z = zVal"
							>
								{{ zVal }}
							</button>
						</div>
					</div>
					<div class="inspector-field-row">
						<label class="field-checkbox-label">
							<input
								type="checkbox"
								:checked="selectedTileData.walkable !== false"
								@change="selectedTileData.walkable = $event.target.checked"
							/>
							<span>Проходимая клетка (Walkable)</span>
						</label>
					</div>
					<div class="inspector-field-row" style="margin-top: 0.6em;">
						<button
							class="editor-btn editor-btn-danger"
							style="width: 100%;"
							title="Удалить тайл пола и превратить клетку в бездну"
							@click="turnCurrentTileToVoid"
						>
							<span>🗑️ Сделать пропастью (удалить тайл)</span>
						</button>
					</div>
				</div>

				<!-- Section 2: Walls Layer -->
				<div v-if="selectedTileData" class="inspector-section">
					<div class="inspector-sec-header">
						<span class="sec-icon">🧱</span>
						<span>Стены и двери (Walls)</span>
					</div>
					<div class="walls-edges-list">
						<div v-for="edge in ['NW', 'NE', 'SW', 'SE']" :key="edge" class="wall-edge-card">
							<div class="wall-card-header">
								<span class="wall-edge-tag">{{ edge }}</span>
								<span v-if="selectedTileData.walls && selectedTileData.walls[edge]" class="wall-type-tag">
									{{ getWallBadgeText(selectedTileData.walls[edge]) }}
								</span>
								<span v-else class="wall-none-tag">Нет стены</span>

								<div class="wall-card-btn-box">
									<button
										v-if="selectedTileData.walls && selectedTileData.walls[edge]"
										class="wall-card-del-btn"
										title="Удалить стену"
										@click="removeWallFromEdge(edge)"
									>
										✕
									</button>
									<button
										v-else
										class="wall-card-add-btn"
										title="Добавить стену"
										@click="addWallToEdge(edge)"
									>
										➕
									</button>
								</div>
							</div>

							<!-- Wall details if present -->
							<div v-if="selectedTileData.walls && selectedTileData.walls[edge]" class="wall-card-body">
								<div class="wall-body-row">
									<label class="field-label-sm">Тип:</label>
									<select
										:value="selectedTileData.walls[edge].door ? 'door' : selectedTileData.walls[edge].type"
										class="inspector-select-sm"
										@change="onWallTypeChange(edge, $event.target.value)"
									>
										<option value="stone_wall">Каменная стена</option>
										<option value="wood_wall">Деревянная стена</option>
										<option value="door">Дверь (проход)</option>
										<option value="fence">Забор / Плетень</option>
									</select>
								</div>
								<div v-if="selectedTileData.walls[edge].door" class="wall-body-row">
									<label class="field-checkbox-label-sm">
										<input type="checkbox" v-model="selectedTileData.walls[edge].open" />
										<span>Дверь открыта</span>
									</label>
								</div>
							</div>
						</div>
					</div>
				</div>

				<!-- Section 3: Object Hierarchy Tree -->
				<div class="inspector-section">
					<div class="inspector-sec-header">
						<span class="sec-icon">📦</span>
						<span>Дерево объектов</span>
						<button class="inspector-btn-action-sm" @click="openAddObjectModal(null)">
							➕ В корень
						</button>
					</div>

					<div v-if="currentTileObjects.length === 0" class="empty-objects-box">
						<span class="empty-msg">На этой клетке пока нет объектов</span>
						<button class="empty-add-btn" @click="openAddObjectModal(null)">
							➕ Поставить объект
						</button>
					</div>

					<div v-else class="object-tree-container">
						<IsoObjectTreeNode
							v-for="rootObj in currentTileObjects"
							:key="rootObj.id"
							:node="rootObj"
							:selected-id="selectedNodeId"
							:depth="0"
							@select="onSelectObjectNode"
							@add-child="openAddObjectModal"
							@delete="onDeleteObjectNode"
						/>
					</div>
				</div>

				<!-- Section 4: Selected Node Properties Editor -->
				<div v-if="selectedNode" class="inspector-section inspector-node-editor">
					<div class="inspector-sec-header">
						<span class="sec-icon">{{ selectedNode.icon || '📦' }}</span>
						<span class="sec-title-truncate">Свойства: {{ selectedNode.name || selectedNode.type }}</span>
					</div>

					<div class="inspector-field-row">
						<label class="field-label">Имя:</label>
						<input v-model="selectedNode.name" class="inspector-input" />
					</div>

					<div class="inspector-field-row">
						<label class="field-label">Ориентация:</label>
						<div class="z-buttons">
							<button
								v-for="f in ['SE', 'SW', 'NE', 'NW']"
								:key="f"
								class="z-btn"
								:class="{ __active: (selectedNode.facing || 'SE') === f }"
								@click="selectedNode.facing = f"
							>
								{{ f }}
							</button>
						</div>
					</div>

					<!-- Percentage X Offset Slider (-100%..+100%) -->
					<div class="inspector-slider-box">
						<div class="slider-header">
							<span class="slider-label">Смещение X (от центра):</span>
							<span class="slider-val">{{ selectedNodePercentX }}% ({{ selectedNode.offsetX || 0 }}px)</span>
						</div>
						<input
							type="range"
							min="-100"
							max="100"
							step="2"
							:value="selectedNodePercentX"
							class="inspector-range"
							@input="updateNodePercentX(Number($event.target.value))"
						/>
					</div>

					<!-- Percentage Y Offset Slider (-100%..+100%) -->
					<div class="inspector-slider-box">
						<div class="slider-header">
							<span class="slider-label">Смещение Y (от центра):</span>
							<span class="slider-val">{{ selectedNodePercentY }}% ({{ selectedNode.offsetY || 0 }}px)</span>
						</div>
						<input
							type="range"
							min="-100"
							max="100"
							step="2"
							:value="selectedNodePercentY"
							class="inspector-range"
							@input="updateNodePercentY(Number($event.target.value))"
						/>
					</div>

					<!-- Height offsetZ -->
					<div class="inspector-field-row">
						<label class="field-label">Высота offsetZ:</label>
						<input
							type="number"
							min="0"
							max="64"
							step="1"
							:value="selectedNode.offsetZ || 0"
							class="inspector-input-sm"
							@input="selectedNode.offsetZ = Number($event.target.value)"
						/>
					</div>

					<!-- Layer zIndex -->
					<div class="inspector-field-row">
						<label class="field-label">Слой zIndex:</label>
						<input
							type="number"
							min="1"
							max="10"
							step="1"
							:value="selectedNode.zIndex || 1"
							class="inspector-input-sm"
							@input="selectedNode.zIndex = Number($event.target.value)"
						/>
					</div>

					<div class="inspector-field-row">
						<label class="field-checkbox-label-sm">
							<input type="checkbox" v-model="selectedNode.solid" />
							<span>Непроходимый</span>
						</label>
						<label class="field-checkbox-label-sm">
							<input type="checkbox" v-model="selectedNode.interactive" />
							<span>Интерактивный</span>
						</label>
					</div>

					<div class="inspector-node-btn-row">
						<button class="node-btn-add-child" @click="openAddObjectModal(selectedNode)">
							➕ Вложить объект
						</button>
						<button class="node-btn-remove" @click="onDeleteObjectNode(selectedNode)">
							🗑️ Удалить
						</button>
					</div>
				</div>
			</aside>
		</div>

		<!-- Modal: Add Object (Root or Child) -->
		<div v-if="showAddObjectModal" class="editor-modal-overlay" @click.self="showAddObjectModal = false">
			<div class="editor-modal">
				<h2 class="modal-title">
					{{ addObjectParentTarget ? `Добавить вложенный объект к «${addObjectParentTarget.name || addObjectParentTarget.type}»` : 'Поставить объект на клетку' }}
				</h2>

				<div class="modal-form">
					<div class="form-group">
						<label class="form-label">Выберите тип объекта:</label>
						<div class="preset-object-grid">
							<button
								v-for="preset in addPresets"
								:key="preset.id"
								class="preset-item-btn"
								:class="{ __active: selectedAddPresetId === preset.id }"
								@click="selectedAddPresetId = preset.id"
							>
								<span class="preset-icon">{{ preset.icon }}</span>
								<span class="preset-name">{{ preset.name }}</span>
							</button>
						</div>
					</div>

					<div class="form-group">
						<label class="form-label">Название объекта:</label>
						<input v-model="addObjectForm.name" class="form-input" placeholder="Например: Глиняная тарелка" />
					</div>

					<div class="form-group">
						<label class="form-label">Иконка (эмодзи или символ):</label>
						<input v-model="addObjectForm.icon" class="form-input" placeholder="🍽️" />
					</div>
				</div>

				<div class="modal-buttons">
					<button class="editor-btn editor-btn-primary" @click="confirmAddObject">
						Добавить
					</button>
					<button class="editor-btn editor-btn-secondary" @click="showAddObjectModal = false">
						Отмена
					</button>
				</div>
			</div>
		</div>

		<!-- Modal: Create New Map -->
		<div v-if="showNewModal" class="editor-modal-overlay">
			<div class="editor-modal">
				<h2 class="modal-title">Создание новой локации</h2>
				<div class="modal-form">
					<div class="form-group">
						<label class="form-label">ID локации:</label>
						<input v-model="newMapForm.id" class="form-input" placeholder="my_new_location" />
					</div>
					<div class="form-group">
						<label class="form-label">Название:</label>
						<input v-model="newMapForm.name" class="form-input" placeholder="Название локации" />
					</div>
					<div class="form-group">
						<label class="form-label">Папка назначения:</label>
						<select v-model="newMapForm.folder" class="form-select">
							<option value="tests">tests/ (Тестовые карты)</option>
							<option value="carne">carne/ (Деревня Карн)</option>
							<option value="cybercity">cybercity/ (Кибергород 2138)</option>
						</select>
					</div>
					<div class="form-group">
						<label class="form-label">Размер сетки (клеток):</label>
						<div class="form-row-two">
							<div class="form-col">
								<label class="form-sublabel">Ширина (X):</label>
								<input
									v-model.number="newMapForm.gridWidth"
									type="number"
									min="1"
									max="2000"
									class="form-input"
									@change="validateNewMapDim('gridWidth')"
								/>
								<span class="form-hint">
									X: {{ -Math.floor(newMapForm.gridWidth / 2) }}..+{{ newMapForm.gridWidth % 2 === 0 ? Math.floor(newMapForm.gridWidth / 2) - 1 : Math.floor(newMapForm.gridWidth / 2) }}
								</span>
							</div>
							<div class="form-col">
								<label class="form-sublabel">Высота (Y):</label>
								<input
									v-model.number="newMapForm.gridHeight"
									type="number"
									min="1"
									max="2000"
									class="form-input"
									@change="validateNewMapDim('gridHeight')"
								/>
								<span class="form-hint">
									Y: {{ -Math.floor(newMapForm.gridHeight / 2) }}..+{{ newMapForm.gridHeight % 2 === 0 ? Math.floor(newMapForm.gridHeight / 2) - 1 : Math.floor(newMapForm.gridHeight / 2) }}
								</span>
							</div>
						</div>
					</div>
					<div class="form-group">
						<label class="form-label">Базовое покрытие:</label>
						<select v-model="newMapForm.baseType" class="form-select">
							<option value="void">🌌 Пустота / Пропасть (пустая карта без тайлов)</option>
							<option value="grass">🌿 Трава (grass)</option>
							<option value="soil">🟫 Грунт / Грядка (soil)</option>
							<option value="stone_terrace">🧱 Каменная плитка (stone_terrace)</option>
							<option value="wood_planks">🪵 Деревянный настил (wood_planks)</option>
							<option value="slab">⬜ Серая плита (slab)</option>
						</select>
					</div>
					<div v-if="newMapForm.baseType === 'void'" class="form-group">
						<label class="field-checkbox-label">
							<input type="checkbox" v-model="newMapForm.spawnPlatform" />
							<span>Создать стартовую плитку в центре (0, 0) для спавна</span>
						</label>
					</div>
				</div>
				<div class="modal-buttons">
					<button class="editor-btn editor-btn-primary" @click="confirmCreateNewMap">
						Создать
					</button>
					<button class="editor-btn editor-btn-secondary" @click="showNewModal = false">
						Отмена
					</button>
				</div>
			</div>
		</div>

		<!-- Modal: Resize Current Map -->
		<div v-if="showResizeModal" class="editor-modal-overlay">
			<div class="editor-modal editor-modal-wide">
				<h2 class="modal-title">📐 Изменение размера сетки карты</h2>
				<p class="modal-subtitle">
					Координаты существующих тайлов и точка (0, 0) сохраняются. Выберите способ расширения:
				</p>
				<div class="modal-form">
					<!-- Mode Switcher Tabs -->
					<div class="resize-mode-tabs">
						<button
							class="resize-mode-tab"
							:class="{ __active: resizeForm.mode === 'sides' }"
							@click="resizeForm.mode = 'sides'"
						>
							🧭 По 4 сторонам (Север / Юг / Запад / Восток)
						</button>
						<button
							class="resize-mode-tab"
							:class="{ __active: resizeForm.mode === 'anchor' }"
							@click="resizeForm.mode = 'anchor'"
						>
							⚓ Размер и Якорь (3×3)
						</button>
					</div>

					<!-- Current vs New Bounds Comparison Card -->
					<div class="resize-comparison-card">
						<div class="resize-comp-row">
							<span class="resize-comp-label">Текущие границы:</span>
							<strong class="resize-comp-val">
								{{ currentMapBounds.maxX - currentMapBounds.minX + 1 }} × {{ currentMapBounds.maxY - currentMapBounds.minY + 1 }}
								<span class="resize-comp-coords">
									(X: [{{ currentMapBounds.minX }}..{{ currentMapBounds.maxX }}], Y: [{{ currentMapBounds.minY }}..{{ currentMapBounds.maxY }}])
								</span>
							</strong>
						</div>
						<div class="resize-comp-row">
							<span class="resize-comp-label">Новые границы:</span>
							<strong class="resize-comp-val __new">
								{{ previewResizeBounds.gridWidth }} × {{ previewResizeBounds.gridHeight }}
								<span class="resize-comp-coords">
									(X: [{{ previewResizeBounds.minX }}..{{ previewResizeBounds.maxX }}], Y: [{{ previewResizeBounds.minY }}..{{ previewResizeBounds.maxY }}])
								</span>
							</strong>
						</div>
						<div class="resize-comp-hint">
							🎯 Мировой ноль (0, 0) остаётся неизменным. Все существующие тайлы сохранят свои координаты.
						</div>
					</div>

					<!-- Mode: Sides (4 Directions) -->
					<div v-if="resizeForm.mode === 'sides'" class="resize-sides-container">
						<div class="resize-sides-grid">
							<!-- North (-Y) -->
							<div class="resize-side-card resize-side-north">
								<div class="resize-side-header">
									<span class="resize-side-icon">⬆️</span>
									<span class="resize-side-title">Север (-Y, ряды сверху)</span>
									<span class="resize-side-delta" :class="{ __plus: resizeForm.north > 0, __minus: resizeForm.north < 0 }">
										{{ resizeForm.north > 0 ? `+${resizeForm.north}` : resizeForm.north }}
									</span>
								</div>
								<div class="resize-side-controls">
									<div class="resize-delta-buttons">
										<button class="side-step-btn" @click="stepSideDelta('north', -5)">-5</button>
										<button class="side-step-btn" @click="stepSideDelta('north', -1)">-1</button>
										<input v-model.number="resizeForm.north" type="number" class="side-num-input" />
										<button class="side-step-btn" @click="stepSideDelta('north', +1)">+1</button>
										<button class="side-step-btn" @click="stepSideDelta('north', +5)">+5</button>
									</div>
								</div>
							</div>

							<!-- West (-X) and East (+X) in middle row -->
							<div class="resize-sides-mid-row">
								<!-- West (-X) -->
								<div class="resize-side-card resize-side-west">
									<div class="resize-side-header">
										<span class="resize-side-icon">⬅️</span>
										<span class="resize-side-title">Запад (-X, колонки слева)</span>
										<span class="resize-side-delta" :class="{ __plus: resizeForm.west > 0, __minus: resizeForm.west < 0 }">
											{{ resizeForm.west > 0 ? `+${resizeForm.west}` : resizeForm.west }}
										</span>
									</div>
									<div class="resize-side-controls">
										<div class="resize-delta-buttons">
											<button class="side-step-btn" @click="stepSideDelta('west', -5)">-5</button>
											<button class="side-step-btn" @click="stepSideDelta('west', -1)">-1</button>
											<input v-model.number="resizeForm.west" type="number" class="side-num-input" />
											<button class="side-step-btn" @click="stepSideDelta('west', +1)">+1</button>
											<button class="side-step-btn" @click="stepSideDelta('west', +5)">+5</button>
										</div>
									</div>
								</div>

								<!-- Center mini-map representation -->
								<div class="resize-center-preview">
									<span class="center-origin-badge">(0,0)</span>
									<button class="editor-btn editor-btn-secondary center-reset-btn" @click="resetSideDeltas" title="Сбросить все смещения">
										🔄 Сброс
									</button>
								</div>

								<!-- East (+X) -->
								<div class="resize-side-card resize-side-east">
									<div class="resize-side-header">
										<span class="resize-side-icon">➡️</span>
										<span class="resize-side-title">Восток (+X, колонки справа)</span>
										<span class="resize-side-delta" :class="{ __plus: resizeForm.east > 0, __minus: resizeForm.east < 0 }">
											{{ resizeForm.east > 0 ? `+${resizeForm.east}` : resizeForm.east }}
										</span>
									</div>
									<div class="resize-side-controls">
										<div class="resize-delta-buttons">
											<button class="side-step-btn" @click="stepSideDelta('east', -5)">-5</button>
											<button class="side-step-btn" @click="stepSideDelta('east', -1)">-1</button>
											<input v-model.number="resizeForm.east" type="number" class="side-num-input" />
											<button class="side-step-btn" @click="stepSideDelta('east', +1)">+1</button>
											<button class="side-step-btn" @click="stepSideDelta('east', +5)">+5</button>
										</div>
									</div>
								</div>
							</div>

							<!-- South (+Y) -->
							<div class="resize-side-card resize-side-south">
								<div class="resize-side-header">
									<span class="resize-side-icon">⬇️</span>
									<span class="resize-side-title">Юг (+Y, ряды снизу)</span>
									<span class="resize-side-delta" :class="{ __plus: resizeForm.south > 0, __minus: resizeForm.south < 0 }">
										{{ resizeForm.south > 0 ? `+${resizeForm.south}` : resizeForm.south }}
									</span>
								</div>
								<div class="resize-side-controls">
									<div class="resize-delta-buttons">
										<button class="side-step-btn" @click="stepSideDelta('south', -5)">-5</button>
										<button class="side-step-btn" @click="stepSideDelta('south', -1)">-1</button>
										<input v-model.number="resizeForm.south" type="number" class="side-num-input" />
										<button class="side-step-btn" @click="stepSideDelta('south', +1)">+1</button>
										<button class="side-step-btn" @click="stepSideDelta('south', +5)">+5</button>
									</div>
								</div>
							</div>
						</div>
					</div>

					<!-- Mode: Anchor (Target dimensions & 3x3 grid) -->
					<div v-if="resizeForm.mode === 'anchor'" class="resize-anchor-container">
						<div class="form-row-two">
							<div class="form-col">
								<label class="form-sublabel">Ширина (X):</label>
								<input
									v-model.number="resizeForm.gridWidth"
									type="number"
									min="1"
									max="2000"
									class="form-input"
								/>
							</div>
							<div class="form-col">
								<label class="form-sublabel">Высота (Y):</label>
								<input
									v-model.number="resizeForm.gridHeight"
									type="number"
									min="1"
									max="2000"
									class="form-input"
								/>
							</div>
						</div>

						<!-- Presets & Step -->
						<div class="form-group">
							<label class="form-sublabel">Быстрый шаг:</label>
							<div class="resize-step-buttons">
								<button class="editor-btn editor-btn-secondary" @click="stepResize(-2)">
									➖ -2 по краям
								</button>
								<button class="editor-btn editor-btn-secondary" @click="stepResize(+2)">
									➕ +2 по краям
								</button>
							</div>
						</div>

						<div class="form-group">
							<label class="form-sublabel">Пресеты размеров:</label>
							<div class="resize-presets-grid">
								<button
									v-for="s in [11, 21, 31, 51, 101, 201]"
									:key="s"
									class="preset-btn"
									:class="{ __active: resizeForm.gridWidth === s && resizeForm.gridHeight === s }"
									@click="setResizePreset(s)"
								>
									{{ s }}×{{ s }}
								</button>
							</div>
						</div>

						<!-- 3x3 Anchor Matrix -->
						<div class="form-group">
							<label class="form-sublabel">Точка привязки (Якорь 3×3):</label>
							<div class="anchor-grid-matrix">
								<button
									v-for="anc in [
										{ id: 'top-left', label: '↖️' },
										{ id: 'top', label: '⬆️' },
										{ id: 'top-right', label: '↗️' },
										{ id: 'left', label: '⬅️' },
										{ id: 'center', label: '⏺️' },
										{ id: 'right', label: '➡️' },
										{ id: 'bottom-left', label: '↙️' },
										{ id: 'bottom', label: '⬇️' },
										{ id: 'bottom-right', label: '↘️' }
									]"
									:key="anc.id"
									class="anchor-btn"
									:class="{ __active: resizeForm.anchor === anc.id }"
									:title="anc.id"
									@click="resizeForm.anchor = anc.id"
								>
									{{ anc.label }}
								</button>
							</div>
						</div>
					</div>

					<!-- Fill Options -->
					<div class="form-group">
						<label class="form-label">При расширении сетки заполнить новые клетки:</label>
						<select v-model="resizeForm.fillType" class="form-select">
							<option value="void">🌌 Пустотой / Пропастью (без тайлов — отлично для лабиринтов)</option>
							<option value="tile">🧱 Плиткой / Тайлом пола</option>
						</select>
					</div>

					<div v-if="resizeForm.fillType === 'tile'" class="form-group">
						<label class="form-sublabel">Тип тайла для заполнения:</label>
						<select v-model="resizeForm.customFillTile" class="form-select">
							<option v-for="t in tileTypes.filter(item => !item.isVoid)" :key="t.id" :value="t.id">
								{{ t.name }}
							</option>
						</select>
					</div>

					<!-- Warning when shrinking -->
					<div
						v-if="prunedTilesCount > 0 || prunedObjectsCount > 0"
						class="resize-shrink-warning"
					>
						⚠️ Внимание: при уменьшении сетки будут безвозвратно удалены:
						<strong>{{ prunedTilesCount }} тайлов</strong> и <strong>{{ prunedObjectsCount }} объектов</strong>, выходящих за новые границы!
					</div>
				</div>
				<div class="modal-buttons">
					<button class="editor-btn editor-btn-primary" @click="confirmResizeMap">
						Применить размер
					</button>
					<button class="editor-btn editor-btn-secondary" @click="showResizeModal = false">
						Отмена
					</button>
				</div>
			</div>
		</div>

		<!-- Modal: Export JSON -->
		<div v-if="showExportModal" class="editor-modal-overlay" @click.self="showExportModal = false">
			<div class="editor-modal editor-modal-wide">
				<div class="export-modal-top">
					<div class="export-modal-titles">
						<h2 class="modal-title">Экспорт JSON карты</h2>
						<p class="modal-subtitle">
							Скопируйте полученный JSON или скачайте файл в папку <code>public/data/isometric/</code>.
						</p>
					</div>

					<!-- Format Switcher -->
					<div class="export-format-selector">
						<button
							class="format-tab-btn"
							:class="{ __active: exportFormat === 'hybrid' }"
							@click="exportFormat = 'hybrid'"
						>
							⚡ Гибридный RLE (Компактный)
						</button>
						<button
							class="format-tab-btn"
							:class="{ __active: exportFormat === 'full' }"
							@click="exportFormat = 'full'"
						>
							📜 Полный JSON (Все тайлы)
						</button>
					</div>
				</div>

				<div class="export-stats-banner">
					<span class="stats-item">💾 Размер: <strong>{{ exportSizeKb }} КБ</strong></span>
					<span v-if="exportFormat === 'hybrid' && savingsPercent > 0" class="stats-savings">
						🔥 Сжатие: -{{ savingsPercent }}% (полный вес: {{ fullSizeKb }} КБ)
					</span>
					<span v-else class="stats-info">
						Формат с полным описанием каждого тайла сетки
					</span>
				</div>

				<textarea
					:value="exportedJsonText"
					class="json-export-textarea"
					readonly
				/>
				<div class="modal-buttons">
					<button class="editor-btn editor-btn-primary" @click="copyJsonToClipboard">
						{{ copyStatusText }}
					</button>
					<button class="editor-btn editor-btn-action" @click="downloadJsonFile">
						💾 Скачать .json
					</button>
					<button class="editor-btn editor-btn-secondary" @click="showExportModal = false">
						Закрыть
					</button>
				</div>
			</div>
		</div>
	</div>
</template>

<script setup>
import { ref, computed, watch, onMounted, onUnmounted } from 'vue'
import { useRouter } from 'vue-router'
import IsoCanvas from '@/components/game/isometric/IsoCanvas.vue'
import IsoObjectTreeNode from '@/components/game/isometric/IsoObjectTreeNode.vue'
import {
	createCenteredGrid,
	percentToSubTile,
	subTileToPercent,
	calculateDirectionalBounds,
	calculateAnchorBounds
} from '@/utils/isometric/isoCoords'
import {
	loadCatalogs,
	normalizeLocationData,
	packRleTerrain,
	compactObjectForExport
} from '@/utils/isometric/isoLoader.js'
import defaultGardenJson from '@/data/isometric/tests/carne_chief_garden.json'
import cliffsJson from '@/data/isometric/tests/height_cliffs_test.json'
import arenaJson from '@/data/isometric/tests/arena_combat_test.json'
import mcApartmentJson from '@/data/isometric/cybercity/mc_apartment.json'

const router = useRouter()
const canvasRef = ref(null)

// Current editing map state
const mapData = ref(normalizeLocationData(JSON.parse(JSON.stringify(defaultGardenJson))))
const selectedMapId = ref('carne_chief_garden')

const availableMaps = ref([
	{ id: 'carne_chief_garden', name: 'Огород старосты', folder: 'tests' },
	{ id: 'height_cliffs_test', name: 'Многоуровневые террасы', folder: 'tests' },
	{ id: 'arena_combat_test', name: 'Тактическая арена', folder: 'tests' },
	{ id: 'mc_apartment', name: 'Квартира ГГ', folder: 'cybercity' }
])

const mapCache = {
	carne_chief_garden: defaultGardenJson,
	height_cliffs_test: cliffsJson,
	arena_combat_test: arenaJson,
	mc_apartment: mcApartmentJson
}

// Active tools
const activeTool = ref('select') // 'select' | 'tile' | 'elevation' | 'object' | 'wall' | 'spawn' | 'eraser'
const selectedTileType = ref('stone_terrace')
const elevationMode = ref('raise')
const exactZ = ref(1)
const selectedObjectType = ref('weed')
const selectedObjectFacing = ref('SE')
const selectedWallEdge = ref('NW')
const selectedWallType = ref('stone_wall')
const selectedWallHeight = ref(1.5)
const showHeights = ref(false)

// Brush settings for tile, elevation, eraser
const brushSize = ref(1)
const brushShape = ref('square') // 'square' | 'round'

const hoveredInfo = ref({ x: null, y: null, z: null })

// Inspector State
const selectedTileCoord = ref({ x: 0, y: 0 })
const selectedNodeId = ref(null)

// Add Object Modal State
const showAddObjectModal = ref(false)
const addObjectParentTarget = ref(null)
const selectedAddPresetId = ref('table')
const addObjectForm = ref({ name: 'Стол', icon: '🪵' })

// Modals
const showNewModal = ref(false)
const showExportModal = ref(false)
const copyStatusText = ref('Копировать в буфер')

// Map Resize Modal State
const showResizeModal = ref(false)
const resizeForm = ref({
	mode: 'sides', // 'sides' | 'anchor'
	// Mode: sides (deltas for each direction)
	north: 0, // rows added/removed North (-Y)
	south: 0, // rows added/removed South (+Y)
	west: 0,  // cols added/removed West (-X)
	east: 0,  // cols added/removed East (+X)
	// Mode: anchor (target size + anchor position)
	gridWidth: 11,
	gridHeight: 11,
	anchor: 'center', // 'top-left'|'top'|'top-right'|'left'|'center'|'right'|'bottom-left'|'bottom'|'bottom-right'
	fillType: 'void',
	customFillTile: 'grass'
})

const currentMapBounds = computed(() => {
	let b = mapData.value?.bounds
	if (!b && (mapData.value?.gridWidth || mapData.value?.gridHeight)) {
		const gw = mapData.value?.gridWidth || 11
		const gh = mapData.value?.gridHeight || 11
		const halfW = Math.floor(gw / 2)
		const halfH = Math.floor(gh / 2)
		b = { minX: -halfW, maxX: halfW, minY: -halfH, maxY: halfH }
	}
	if (!b) {
		b = { minX: -5, maxX: 5, minY: -5, maxY: 5 }
	}
	return b
})

const previewResizeBounds = computed(() => {
	const current = currentMapBounds.value
	if (resizeForm.value.mode === 'sides') {
		return calculateDirectionalBounds(current, {
			north: resizeForm.value.north,
			south: resizeForm.value.south,
			west: resizeForm.value.west,
			east: resizeForm.value.east
		})
	} else {
		const w = Math.max(1, Math.min(2000, parseInt(resizeForm.value.gridWidth, 10) || (current.maxX - current.minX + 1)))
		const h = Math.max(1, Math.min(2000, parseInt(resizeForm.value.gridHeight, 10) || (current.maxY - current.minY + 1)))
		return calculateAnchorBounds(current, w, h, resizeForm.value.anchor || 'center')
	}
})

const prunedTilesCount = computed(() => {
	const b = previewResizeBounds.value
	return (mapData.value?.tiles || []).filter(
		(t) => t.x < b.minX || t.x > b.maxX || t.y < b.minY || t.y > b.maxY
	).length
})

const prunedObjectsCount = computed(() => {
	const b = previewResizeBounds.value
	return (mapData.value?.objects || []).filter(
		(o) => o.x < b.minX || o.x > b.maxX || o.y < b.minY || o.y > b.maxY
	).length
})

const newMapForm = ref({
	id: 'custom_location',
	name: 'Новая локация',
	folder: 'tests',
	gridWidth: 11,
	gridHeight: 11,
	baseType: 'void',
	spawnPlatform: true
})

const tileTypes = [
	{ id: 'void', name: '🌌 Пропасть (пустота)', color: '#090d16', isVoid: true },
	{ id: 'grass', name: 'Трава', color: '#3c5a3e', texture: 'grass' },
	{ id: 'soil', name: 'Грядка / Грунт', color: '#5c4033', texture: 'soil' },
	{ id: 'stone_terrace', name: 'Каменная плитка', color: '#606b7d', texture: 'stone_terrace' },
	{ id: 'wood_planks', name: 'Деревянный настил', color: '#6d5234', texture: 'wood_planks' },
	{ id: 'stairs', name: 'Ступени', color: '#727e94', texture: 'steps' },
	{ id: 'slab', name: 'Серая плита', color: '#64748b', texture: 'slab' },
	{ id: 'slab-dark', name: 'Темная плита', color: '#334155', texture: 'slab-dark' },
	{ id: 'slab-cube', name: 'Куб-блок', color: '#475569', texture: 'slab-cube' },
	{ id: 'slab-cube-dark', name: 'Темный куб', color: '#1e293b', texture: 'slab-cube-dark' },
	{ id: 'watter', name: 'Вода', color: '#0284c7', texture: 'watter' },
	{ id: 'watter-slab', name: 'Водная плита', color: '#0369a1', texture: 'watter-slab' },
	{ id: 'ice', name: '🧊 Лёд (скользкий)', color: '#bae6fd' },
	{ id: 'lava', name: '🔥 Лава (раскаленная)', color: '#ea580c' },
	{ id: 'water', name: '🌊 Вода (глубокая)', color: '#0284c7' }
]

const wallTypes = [
	{ id: 'stone_wall', name: 'Каменная стена', icon: '🧱' },
	{ id: 'wood_wall', name: 'Деревянная стена', icon: '🪵' },
	{ id: 'door', name: 'Дверь (проход)', icon: '🚪' },
	{ id: 'fence', name: 'Плетень / Забор', icon: '🎋' }
]

const availableObjects = [
	{ id: 'weed', name: 'Сорняк', icon: '🌿', solid: false, interactive: true, action: 'weed' },
	{ id: 'table', name: 'Обеденный стол (с посудой)', icon: '🪵', solid: true, interactive: false, isNested: true },
	{ id: 'barrel', name: 'Бочка', icon: '🛢️', solid: true, interactive: false },
	{ id: 'well', name: 'Колодец (2×2)', icon: '⛲', solid: true, interactive: true, size: [2, 2] },
	{ id: 'fence', name: 'Забор', icon: '🪵', solid: true, interactive: false },
	{ id: 'crate', name: 'Ящик', icon: '📦', solid: true, interactive: false },
	{ id: 'chest', name: 'Сундук', icon: '💎', solid: true, interactive: true }
]

const addPresets = [
	{ id: 'table', name: 'Стол (с посудой)', icon: '🪵' },
	{ id: 'plate', name: 'Тарелка', icon: '🍽️' },
	{ id: 'food', name: 'Жареная птица', icon: '🍗' },
	{ id: 'candlestick', name: 'Подсвечник', icon: '🕯️' },
	{ id: 'barrel', name: 'Бочка', icon: '🛢️' },
	{ id: 'chest', name: 'Сундук', icon: '💎' },
	{ id: 'well', name: 'Колодец', icon: '⛲' },
	{ id: 'weed', name: 'Сорняк', icon: '🌿' },
	{ id: 'crate', name: 'Ящик', icon: '📦' },
	{ id: 'custom', name: 'Свой предмет', icon: '✨' }
]

watch(selectedAddPresetId, (id) => {
	const p = addPresets.find((item) => item.id === id)
	if (p && id !== 'custom') {
		addObjectForm.value.name = p.name
		addObjectForm.value.icon = p.icon
	}
})

// Inspector Computed Properties
const selectedTileData = computed(() => {
	if (!selectedTileCoord.value) return null
	return mapData.value.tiles.find(
		(t) => t.x === selectedTileCoord.value.x && t.y === selectedTileCoord.value.y
	) || null
})

const currentTileObjects = computed(() => {
	if (!selectedTileCoord.value) return []
	return mapData.value.objects.filter(
		(o) => o.x === selectedTileCoord.value.x && o.y === selectedTileCoord.value.y
	)
})

const selectedNode = computed(() => {
	if (!selectedNodeId.value) return null
	return findNodeById(selectedNodeId.value, currentTileObjects.value)
})

const selectedNodePercentX = computed(() => {
	if (!selectedNode.value) return 0
	return subTileToPercent(selectedNode.value.offsetX || 0, selectedNode.value.offsetY || 0).percentX
})

const selectedNodePercentY = computed(() => {
	if (!selectedNode.value) return 0
	return subTileToPercent(selectedNode.value.offsetX || 0, selectedNode.value.offsetY || 0).percentY
})

function updateNodePercentX(val) {
	if (!selectedNode.value) return
	const currentPercentY = selectedNodePercentY.value
	const { offsetX } = percentToSubTile(val, currentPercentY)
	selectedNode.value.offsetX = offsetX
}

function updateNodePercentY(val) {
	if (!selectedNode.value) return
	const currentPercentX = selectedNodePercentX.value
	const { offsetY } = percentToSubTile(currentPercentX, val)
	selectedNode.value.offsetY = offsetY
}

const exportFormat = ref('hybrid') // 'hybrid' | 'full'

const hybridJsonText = computed(() => {
	const bounds = currentMapBounds.value
	const { terrain, overrides } = packRleTerrain(bounds, mapData.value.tiles || [])
	const compactObjects = (mapData.value.objects || []).map(compactObjectForExport)

	const hybridData = {
		id: mapData.value.id || 'isometric_map',
		name: mapData.value.name || 'Изометрическая локация',
		description: mapData.value.description || '',
		tileWidth: mapData.value.tileWidth || 64,
		tileHeight: mapData.value.tileHeight || 32,
		heightStep: mapData.value.heightStep || 16,
		gridWidth: bounds.maxX - bounds.minX + 1,
		gridHeight: bounds.maxY - bounds.minY + 1,
		bounds,
		defaultSpawn: mapData.value.defaultSpawn || { x: 0, y: 0, z: 0, facing: 'SE' },
		terrain
	}

	if (overrides && Object.keys(overrides).length > 0) {
		hybridData.overrides = overrides
	}

	if (compactObjects.length > 0) {
		hybridData.objects = compactObjects
	}

	if (Array.isArray(mapData.value.characters) && mapData.value.characters.length > 0) {
		hybridData.characters = mapData.value.characters
	}

	if (Array.isArray(mapData.value.exits) && mapData.value.exits.length > 0) {
		hybridData.exits = mapData.value.exits
	}

	return JSON.stringify(hybridData, null, 2)
})

const fullJsonText = computed(() => {
	return JSON.stringify(mapData.value, null, 2)
})

const exportedJsonText = computed(() => {
	return exportFormat.value === 'hybrid' ? hybridJsonText.value : fullJsonText.value
})

const exportSizeKb = computed(() => {
	const bytes = new Blob([exportedJsonText.value]).size
	return (bytes / 1024).toFixed(1)
})

const fullSizeKb = computed(() => {
	const bytes = new Blob([fullJsonText.value]).size
	return (bytes / 1024).toFixed(1)
})

const savingsPercent = computed(() => {
	const fullBytes = new Blob([fullJsonText.value]).size
	const hybridBytes = new Blob([hybridJsonText.value]).size
	if (fullBytes <= 0) return 0
	const saved = Math.round(((fullBytes - hybridBytes) / fullBytes) * 100)
	return Math.max(0, saved)
})

// Tree search helpers
function findNodeById(id, list) {
	for (const item of list) {
		if (item.id === id) return item
		if (Array.isArray(item.children) && item.children.length > 0) {
			const found = findNodeById(id, item.children)
			if (found) return found
		}
	}
	return null
}

function removeNodeById(id, list) {
	for (let i = 0; i < list.length; i++) {
		if (list[i].id === id) {
			list.splice(i, 1)
			return true
		}
		if (Array.isArray(list[i].children) && list[i].children.length > 0) {
			const removed = removeNodeById(id, list[i].children)
			if (removed) {
				if (list[i].children.length === 0) {
					delete list[i].children
				}
				return true
			}
		}
	}
	return false
}

function closeInspector() {
	selectedTileCoord.value = null
	selectedNodeId.value = null
}

function onSelectObjectNode(node) {
	selectedNodeId.value = node.id
}

function onDeleteObjectNode(node) {
	removeNodeById(node.id, mapData.value.objects)
	if (selectedNodeId.value === node.id) {
		selectedNodeId.value = null
	}
}

function openAddObjectModal(parent = null) {
	addObjectParentTarget.value = parent
	if (parent) {
		selectedAddPresetId.value = parent.type === 'table' ? 'plate' : 'food'
	} else {
		selectedAddPresetId.value = 'table'
	}
	const p = addPresets.find((item) => item.id === selectedAddPresetId.value)
	addObjectForm.value = {
		name: p ? p.name : 'Новый объект',
		icon: p ? p.icon : '📦'
	}
	showAddObjectModal.value = true
}

function confirmAddObject() {
	const parent = addObjectParentTarget.value
	const typeId = selectedAddPresetId.value
	const generatedId = `${typeId}_${Date.now().toString().slice(-4)}`

	if (parent) {
		// Add as child
		if (!Array.isArray(parent.children)) {
			parent.children = []
		}
		let defZ = 6
		let defZIndex = (parent.zIndex || 1) + 1
		if (parent.type === 'table') {
			defZ = 10
		} else if (parent.type === 'plate') {
			defZ = 4
		}

		const newChild = {
			id: generatedId,
			type: typeId,
			name: addObjectForm.value.name,
			icon: addObjectForm.value.icon,
			offsetX: 0,
			offsetY: 0,
			offsetZ: defZ,
			zIndex: defZIndex,
			facing: parent.facing || 'SE'
		}
		parent.children.push(newChild)
		selectedNodeId.value = generatedId
	} else if (selectedTileCoord.value) {
		// Add as root on tile
		const newRoot = {
			id: generatedId,
			type: typeId,
			name: addObjectForm.value.name,
			icon: addObjectForm.value.icon,
			x: selectedTileCoord.value.x,
			y: selectedTileCoord.value.y,
			z: selectedTileData.value?.z || 0,
			offsetX: 0,
			offsetY: 0,
			offsetZ: 0,
			zIndex: 1,
			facing: selectedObjectFacing.value,
			solid: typeId !== 'weed',
			interactive: typeId === 'weed' || typeId === 'chest'
		}

		if (typeId === 'table') {
			newRoot.children = [
				{
					id: `plate_${Date.now().toString().slice(-3)}`,
					type: 'plate',
					name: 'Глиняная тарелка',
					icon: '🍽️',
					offsetX: 4,
					offsetY: -4,
					offsetZ: 10,
					zIndex: 2,
					children: [
						{
							id: `food_${Date.now().toString().slice(-3)}`,
							type: 'food',
							name: 'Жареная птица',
							icon: '🍗',
							offsetX: 0,
							offsetY: 0,
							offsetZ: 4,
							zIndex: 3
						}
					]
				},
				{
					id: `candle_${Date.now().toString().slice(-3)}`,
					type: 'candlestick',
					name: 'Подсвечник',
					icon: '🕯️',
					offsetX: -6,
					offsetY: 6,
					offsetZ: 10,
					zIndex: 2
				}
			]
		}

		mapData.value.objects.push(newRoot)
		selectedNodeId.value = generatedId
	}

	showAddObjectModal.value = false
}

// Wall edge helpers
function getWallBadgeText(wall) {
	if (!wall) return 'Нет'
	if (wall.door) return wall.open ? 'Дверь (откр)' : 'Дверь (закр)'
	if (wall.type === 'wood_wall') return 'Деревянная'
	if (wall.type === 'fence') return 'Забор'
	return 'Каменная'
}

function addWallToEdge(edge) {
	if (!selectedTileData.value) return
	selectedTileData.value.walls = selectedTileData.value.walls || {}
	selectedTileData.value.walls[edge] = {
		type: 'stone_wall',
		height: 1.5,
		solid: true,
		door: false,
		open: false
	}
}

function removeWallFromEdge(edge) {
	if (!selectedTileData.value?.walls) return
	delete selectedTileData.value.walls[edge]
	if (Object.keys(selectedTileData.value.walls).length === 0) {
		delete selectedTileData.value.walls
	}
}

function onWallTypeChange(edge, type) {
	if (!selectedTileData.value?.walls?.[edge]) return
	const isDoor = type === 'door'
	selectedTileData.value.walls[edge].type = isDoor ? 'wood_wall' : type
	selectedTileData.value.walls[edge].door = isDoor
	if (!isDoor) delete selectedTileData.value.walls[edge].open
}

function onLoadSelectedMap() {
	const data = mapCache[selectedMapId.value]
	if (data) {
		mapData.value = normalizeLocationData(JSON.parse(JSON.stringify(data)))
		selectedTileCoord.value = { x: 0, y: 0 }
		const rootObjs = currentTileObjects.value
		selectedNodeId.value = rootObjs.length > 0 ? rootObjs[0].id : null
		canvasRef.value?.resetLocation?.()
	}
}

function handleBrushApply({ centerTile, cells, tool = activeTool.value, isRightClick = false }) {
	if (!centerTile) return
	hoveredInfo.value = { x: centerTile.x, y: centerTile.y, z: centerTile.z }
	selectedTileCoord.value = { x: centerTile.x, y: centerTile.y }

	if (!cells || cells.length === 0) {
		cells = [{ x: centerTile.x, y: centerTile.y }]
	}

	const cellKeys = new Set(cells.map((c) => `${c.x},${c.y}`))

	if (tool === 'tile') {
		if (selectedTileType.value === 'void' || isRightClick) {
			// Erase all tiles in cells -> make them void/abyss!
			mapData.value.objects = mapData.value.objects.filter(
				(o) => !cellKeys.has(`${o.x},${o.y}`)
			)
			mapData.value.tiles = mapData.value.tiles.filter(
				(t) => !cellKeys.has(`${t.x},${t.y}`)
			)
			selectedNodeId.value = null
		} else {
			// Place or update tiles in all cells!
			const foundType = tileTypes.find((t) => t.id === selectedTileType.value)
			const existingTileMap = new Map()
			for (const t of mapData.value.tiles) {
				existingTileMap.set(`${t.x},${t.y}`, t)
			}

			const newTilesToAdd = []
			for (const cell of cells) {
				const existing = existingTileMap.get(`${cell.x},${cell.y}`)
				if (existing) {
					existing.type = selectedTileType.value
					if (foundType?.texture) {
						existing.texture = foundType.texture
					} else {
						delete existing.texture
					}
				} else {
					const newTile = {
						x: cell.x,
						y: cell.y,
						z: 0,
						type: selectedTileType.value,
						walkable: true
					}
					if (foundType?.texture) {
						newTile.texture = foundType.texture
					}
					newTilesToAdd.push(newTile)
					existingTileMap.set(`${cell.x},${cell.y}`, newTile)
				}
			}
			if (newTilesToAdd.length > 0) {
				mapData.value.tiles.push(...newTilesToAdd)
			}
		}
	} else if (tool === 'elevation') {
		const existingTileMap = new Map()
		for (const t of mapData.value.tiles) {
			existingTileMap.set(`${t.x},${t.y}`, t)
		}
		const newTilesToAdd = []
		for (const cell of cells) {
			let existing = existingTileMap.get(`${cell.x},${cell.y}`)
			if (!existing) {
				existing = {
					x: cell.x,
					y: cell.y,
					z: 0,
					type: 'stone_terrace',
					walkable: true
				}
				existingTileMap.set(`${cell.x},${cell.y}`, existing)
				newTilesToAdd.push(existing)
			}
			if (elevationMode.value === 'raise') {
				existing.z = Math.min(4, (existing.z || 0) + 1)
			} else if (elevationMode.value === 'lower') {
				existing.z = Math.max(-1, (existing.z || 0) - 1)
			} else if (elevationMode.value === 'set') {
				existing.z = exactZ.value
			}
		}
		if (newTilesToAdd.length > 0) {
			mapData.value.tiles.push(...newTilesToAdd)
		}
	} else if (tool === 'eraser') {
		const existingTileMap = new Map()
		for (const t of mapData.value.tiles) {
			existingTileMap.set(`${t.x},${t.y}`, t)
		}
		const toDeleteTileKeys = new Set()

		// Filter out objects in affected cells
		mapData.value.objects = mapData.value.objects.filter((o) => !cellKeys.has(`${o.x},${o.y}`))

		for (const cell of cells) {
			const key = `${cell.x},${cell.y}`
			const existing = existingTileMap.get(key)
			if (existing) {
				if (existing.walls && Object.keys(existing.walls).length > 0) {
					delete existing.walls
				} else if (existing.z && existing.z !== 0) {
					existing.z = 0
				} else {
					toDeleteTileKeys.add(key)
				}
			}
		}
		if (toDeleteTileKeys.size > 0) {
			mapData.value.tiles = mapData.value.tiles.filter(
				(t) => !toDeleteTileKeys.has(`${t.x},${t.y}`)
			)
			selectedNodeId.value = null
		}
	}
}

function handleTileClick({ tile }) {
	if (!tile) return
	hoveredInfo.value = { x: tile.x, y: tile.y, z: tile.z }

	let targetTile = mapData.value.tiles.find((t) => t.x === tile.x && t.y === tile.y)

	// In Select / Inspector Mode: simply select the tile or void cell and show inspector drawer
	if (activeTool.value === 'select') {
		selectedTileCoord.value = { x: tile.x, y: tile.y }
		const objs = mapData.value.objects.filter((o) => o.x === tile.x && o.y === tile.y)
		selectedNodeId.value = objs.length > 0 ? objs[0].id : null
		return
	}

	// Always synchronize selectedTileCoord when editing
	selectedTileCoord.value = { x: tile.x, y: tile.y }

	// Delegate brush-based tools
	if (['tile', 'elevation', 'eraser'].includes(activeTool.value)) {
		handleBrushApply({ centerTile: tile, cells: [tile], tool: activeTool.value })
		return
	}

	if (activeTool.value === 'wall') {
		if (!targetTile) {
			targetTile = {
				x: tile.x,
				y: tile.y,
				z: 0,
				type: 'stone_terrace',
				walkable: true
			}
			mapData.value.tiles.push(targetTile)
		}
		targetTile.walls = targetTile.walls || {}
		if (targetTile.walls[selectedWallEdge.value]) {
			delete targetTile.walls[selectedWallEdge.value]
			if (Object.keys(targetTile.walls).length === 0) {
				delete targetTile.walls
			}
		} else {
			const isDoor = selectedWallType.value === 'door'
			targetTile.walls[selectedWallEdge.value] = {
				type: isDoor ? 'wood_wall' : selectedWallType.value,
				height: selectedWallHeight.value,
				solid: true,
				door: isDoor,
				open: false
			}
		}
	} else if (activeTool.value === 'object') {
		if (!targetTile) {
			targetTile = {
				x: tile.x,
				y: tile.y,
				z: 0,
				type: 'stone_terrace',
				walkable: true
			}
			mapData.value.tiles.push(targetTile)
		}
		const objDef = availableObjects.find((o) => o.id === selectedObjectType.value)
		if (objDef) {
			mapData.value.objects = mapData.value.objects.filter(
				(o) => !(o.x === tile.x && o.y === tile.y)
			)
			const newObj = {
				id: `${objDef.id}_${Date.now().toString().slice(-4)}`,
				type: objDef.id,
				name: objDef.name,
				x: tile.x,
				y: tile.y,
				z: targetTile.z || 0,
				facing: selectedObjectFacing.value,
				size: objDef.size || [1, 1],
				solid: objDef.solid,
				interactive: objDef.interactive,
				action: objDef.action,
				icon: objDef.icon
			}

			if (objDef.isNested) {
				newObj.zIndex = 1
				newObj.children = [
					{
						id: `plate_${Date.now().toString().slice(-3)}`,
						type: 'plate',
						name: 'Глиняная тарелка',
						icon: '🍽️',
						offsetX: 4,
						offsetY: -4,
						offsetZ: 10,
						zIndex: 2,
						children: [
							{
								id: `food_${Date.now().toString().slice(-3)}`,
								type: 'food',
								name: 'Жареная птица',
								icon: '🍗',
								offsetX: 0,
								offsetY: 0,
								offsetZ: 4,
								zIndex: 3
							}
						]
					},
					{
						id: `candle_${Date.now().toString().slice(-3)}`,
						type: 'candlestick',
						name: 'Подсвечник',
						icon: '🕯️',
						offsetX: -6,
						offsetY: 6,
						offsetZ: 10,
						zIndex: 2
					}
				]
			}

			mapData.value.objects.push(newObj)
			selectedNodeId.value = newObj.id
		}
	} else if (activeTool.value === 'spawn') {
		if (!targetTile) {
			targetTile = {
				x: tile.x,
				y: tile.y,
				z: 0,
				type: 'stone_terrace',
				walkable: true
			}
			mapData.value.tiles.push(targetTile)
		}
		mapData.value.defaultSpawn = {
			x: tile.x,
			y: tile.y,
			z: targetTile.z || 0,
			facing: 'SE'
		}
	} else if (activeTool.value === 'eraser') {
		if (targetTile) {
			const hasObj = mapData.value.objects.some((o) => o.x === tile.x && o.y === tile.y)
			if (hasObj) {
				mapData.value.objects = mapData.value.objects.filter(
					(o) => !(o.x === tile.x && o.y === tile.y)
				)
				selectedNodeId.value = null
			} else if (targetTile.walls) {
				delete targetTile.walls
			} else if (targetTile.z && targetTile.z !== 0) {
				targetTile.z = 0
			} else {
				// Flat bare tile: remove completely to create an abyss
				mapData.value.tiles = mapData.value.tiles.filter(
					(t) => !(t.x === tile.x && t.y === tile.y)
				)
				selectedNodeId.value = null
			}
		}
	}
}

function handleTileRightClick({ tile }) {
	if (!tile) return
	if (['tile', 'elevation', 'eraser'].includes(activeTool.value)) {
		handleBrushApply({ centerTile: tile, cells: [tile], tool: 'eraser', isRightClick: true })
		return
	}
	const hasObj = mapData.value.objects.some((o) => o.x === tile.x && o.y === tile.y)
	if (hasObj) {
		mapData.value.objects = mapData.value.objects.filter(
			(o) => !(o.x === tile.x && o.y === tile.y)
		)
	}
	const targetTile = mapData.value.tiles.find((t) => t.x === tile.x && t.y === tile.y)
	if (targetTile?.walls) {
		delete targetTile.walls
	} else if (targetTile && !hasObj) {
		mapData.value.tiles = mapData.value.tiles.filter(
			(t) => !(t.x === tile.x && t.y === tile.y)
		)
	}
	if (selectedTileCoord.value && selectedTileCoord.value.x === tile.x && selectedTileCoord.value.y === tile.y) {
		selectedNodeId.value = null
	}
}

function setExactZ(val) {
	elevationMode.value = 'set'
	exactZ.value = val
}

function openNewMapModal() {
	showNewModal.value = true
}

function validateNewMapDim(field) {
	let val = parseInt(newMapForm.value[field], 10)
	if (isNaN(val) || val < 1) val = 1
	if (val > 2000) val = 2000
	newMapForm.value[field] = val
}

function confirmCreateNewMap() {
	let w = parseInt(newMapForm.value.gridWidth, 10) || 11
	let h = parseInt(newMapForm.value.gridHeight, 10) || 11
	w = Math.max(1, Math.min(2000, w))
	h = Math.max(1, Math.min(2000, h))

	const minX = -Math.floor(w / 2)
	const maxX = w % 2 === 0 ? Math.floor(w / 2) - 1 : Math.floor(w / 2)
	const minY = -Math.floor(h / 2)
	const maxY = h % 2 === 0 ? Math.floor(h / 2) - 1 : Math.floor(h / 2)

	let generatedTiles = []
	if (newMapForm.value.baseType === 'void') {
		generatedTiles = newMapForm.value.spawnPlatform !== false
			? [{ x: 0, y: 0, z: 0, type: 'stone_terrace', walkable: true }]
			: []
	} else {
		generatedTiles = createCenteredGrid({
			width: w,
			height: h,
			defaultTileType: newMapForm.value.baseType || 'grass',
			defaultZ: 0
		})
	}

	mapData.value = {
		id: newMapForm.value.id || 'custom_location',
		name: newMapForm.value.name || 'Новая локация',
		description: 'Пользовательская изометрическая локация.',
		tileWidth: 64,
		tileHeight: 32,
		heightStep: 16,
		gridWidth: w,
		gridHeight: h,
		bounds: { minX, maxX, minY, maxY },
		defaultSpawn: { x: 0, y: 0, z: 0, facing: 'SE' },
		tiles: generatedTiles,
		objects: [],
		exits: []
	}

	selectedTileCoord.value = { x: 0, y: 0 }
	selectedNodeId.value = null
	showNewModal.value = false
	resetCamera()
}

// Map Resizing System
function openResizeModal() {
	const b = currentMapBounds.value
	resizeForm.value.mode = 'sides'
	resetSideDeltas()
	resizeForm.value.gridWidth = b.maxX - b.minX + 1
	resizeForm.value.gridHeight = b.maxY - b.minY + 1
	resizeForm.value.anchor = 'center'
	resizeForm.value.fillType = 'void'
	resizeForm.value.customFillTile = 'grass'
	showResizeModal.value = true
}

function stepSideDelta(side, delta) {
	if (typeof resizeForm.value[side] !== 'number') {
		resizeForm.value[side] = 0
	}
	resizeForm.value[side] += delta
}

function resetSideDeltas() {
	resizeForm.value.north = 0
	resizeForm.value.south = 0
	resizeForm.value.west = 0
	resizeForm.value.east = 0
}

function setResizePreset(size) {
	resizeForm.value.gridWidth = size
	resizeForm.value.gridHeight = size
}

function stepResize(delta) {
	let nw = (parseInt(resizeForm.value.gridWidth, 10) || 11) + delta
	let nh = (parseInt(resizeForm.value.gridHeight, 10) || 11) + delta
	if (nw < 1) nw = 1
	if (nh < 1) nh = 1
	if (nw > 2000) nw = 2000
	if (nh > 2000) nh = 2000
	resizeForm.value.gridWidth = nw
	resizeForm.value.gridHeight = nh
}

function confirmResizeMap() {
	const b = previewResizeBounds.value
	const newMinX = b.minX
	const newMaxX = b.maxX
	const newMinY = b.minY
	const newMaxY = b.maxY
	const newW = b.gridWidth
	const newH = b.gridHeight

	// Filter out out-of-bounds tiles & objects if shrinking
	mapData.value.tiles = mapData.value.tiles.filter(
		(t) => t.x >= newMinX && t.x <= newMaxX && t.y >= newMinY && t.y <= newMaxY
	)
	mapData.value.objects = mapData.value.objects.filter(
		(o) => o.x >= newMinX && o.x <= newMaxX && o.y >= newMinY && o.y <= newMaxY
	)

	// If fillType === 'tile', fill empty spots within new bounds
	if (resizeForm.value.fillType === 'tile') {
		const existingKeys = new Set(mapData.value.tiles.map((t) => `${t.x},${t.y}`))
		const tileType = resizeForm.value.customFillTile || 'grass'
		const foundDef = tileTypes.find((item) => item.id === tileType)
		for (let y = newMinY; y <= newMaxY; y++) {
			for (let x = newMinX; x <= newMaxX; x++) {
				if (!existingKeys.has(`${x},${y}`)) {
					mapData.value.tiles.push({
						x,
						y,
						z: 0,
						type: tileType,
						texture: foundDef?.texture || null,
						walkable: true
					})
				}
			}
		}
	}

	mapData.value.gridWidth = newW
	mapData.value.gridHeight = newH
	mapData.value.bounds = {
		minX: newMinX,
		maxX: newMaxX,
		minY: newMinY,
		maxY: newMaxY
	}

	showResizeModal.value = false
	canvasRef.value?.resetLocation?.()
}

function createTileAtSelectedVoid() {
	if (!selectedTileCoord.value) return
	const { x, y } = selectedTileCoord.value
	const tType = selectedTileType.value === 'void' ? 'stone_terrace' : selectedTileType.value
	const foundDef = tileTypes.find((item) => item.id === tType)
	const newTile = {
		x,
		y,
		z: 0,
		type: tType,
		texture: foundDef?.texture || null,
		walkable: true
	}
	mapData.value.tiles.push(newTile)
}

function turnCurrentTileToVoid() {
	if (!selectedTileCoord.value) return
	const { x, y } = selectedTileCoord.value
	mapData.value.objects = mapData.value.objects.filter(
		(o) => !(o.x === x && o.y === y)
	)
	mapData.value.tiles = mapData.value.tiles.filter(
		(t) => !(t.x === x && t.y === y)
	)
	selectedNodeId.value = null
}

function openExportModal() {
	copyStatusText.value = 'Копировать в буфер'
	showExportModal.value = true
}

async function copyJsonToClipboard() {
	try {
		await navigator.clipboard.writeText(exportedJsonText.value)
		copyStatusText.value = '✔ Скопировано!'
		setTimeout(() => {
			copyStatusText.value = 'Копировать в буфер'
		}, 2000)
	} catch (e) {
		copyStatusText.value = 'Ошибка копирования'
	}
}

function downloadJsonFile() {
	const blob = new Blob([exportedJsonText.value], { type: 'application/json' })
	const url = URL.createObjectURL(blob)
	const a = document.createElement('a')
	a.href = url
	a.download = `${mapData.value.id || 'isometric_map'}.json`
	a.click()
	URL.revokeObjectURL(url)
}

function testCurrentMap() {
	router.push('/test/isometric')
}

function resetCamera() {
	canvasRef.value?.resetCamera?.()
}

function returnToHome() {
	router.push('/home')
}

function onEditorKeyDown(e) {
	if (e.target && (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA' || e.target.isContentEditable)) return
	if (e.key === '[') {
		brushSize.value = Math.max(1, brushSize.value - 1)
	} else if (e.key === ']') {
		brushSize.value = Math.min(11, brushSize.value + 1)
	}
}

onMounted(async () => {
	await loadCatalogs()
	window.addEventListener('keydown', onEditorKeyDown)
})

onUnmounted(() => {
	window.removeEventListener('keydown', onEditorKeyDown)
})
</script>

<style scoped>
.iso-editor-view {
	position: absolute;
	inset: 0;
	width: 100%;
	height: 100%;
	background: #0d1117;
	display: flex;
	flex-direction: column;
	font-family: Kurale, sans-serif;
	color: #e2e8f0;
	font-size: calc(1 * var(--size));
	overflow: hidden;
}

/* Header */
.editor-header {
	height: 3.5em;
	background: rgba(18, 24, 38, 0.95);
	border-bottom: 1px solid rgba(246, 196, 69, 0.3);
	display: flex;
	align-items: center;
	justify-content: space-between;
	padding: 0 1.2em;
	z-index: 30;
	flex-shrink: 0;
}

.header-left,
.header-right {
	display: flex;
	align-items: center;
	gap: 0.8em;
}

.header-selector-box {
	display: flex;
	align-items: center;
	gap: 0.4em;
	background: rgba(30, 41, 59, 0.8);
	border: 1px solid rgba(255, 255, 255, 0.15);
	border-radius: 0.4em;
	padding: 0.3em 0.7em;
}

.selector-icon {
	font-size: 1em;
}

.selector-label {
	font-size: 0.85em;
	color: #94a3b8;
}

.editor-select {
	background: rgba(15, 23, 42, 0.9);
	border: 1px solid rgba(246, 196, 69, 0.3);
	color: #f6c445;
	padding: 0.25em 0.5em;
	border-radius: 0.3em;
	font-size: 0.85em;
	outline: none;
	cursor: pointer;
	font-family: Kurale, sans-serif;
}

.map-title-badge {
	display: flex;
	flex-direction: column;
	align-items: center;
}

.map-name {
	font-size: 1.1em;
	font-weight: bold;
	color: #f6c445;
	font-family: Overlord, Kurale, serif;
}

.map-size {
	font-size: 0.75em;
	color: #94a3b8;
}

/* Workspace */
.editor-workspace {
	flex: 1;
	display: flex;
	position: relative;
	overflow: hidden;
}

/* Sidebar */
.editor-sidebar {
	width: 17em;
	background: rgba(15, 23, 42, 0.95);
	border-right: 1px solid rgba(255, 255, 255, 0.12);
	display: flex;
	flex-direction: column;
	gap: 1.2em;
	padding: 1.2em;
	overflow-y: auto;
	z-index: 20;
	flex-shrink: 0;
}

.tool-section {
	display: flex;
	flex-direction: column;
	gap: 0.6em;
}

.section-title {
	font-size: 0.85em;
	font-weight: bold;
	color: #f6c445;
	text-transform: uppercase;
	letter-spacing: 0.05em;
	border-bottom: 1px solid rgba(255, 255, 255, 0.1);
	padding-bottom: 0.3em;
}

.section-desc {
	font-size: 0.8em;
	color: #94a3b8;
	line-height: 1.35;
	margin: 0;
}

.selected-tile-indicator {
	background: rgba(56, 189, 248, 0.15);
	border: 1px solid rgba(56, 189, 248, 0.4);
	border-radius: 0.3em;
	padding: 0.4em 0.6em;
	display: flex;
	align-items: center;
	justify-content: space-between;
	font-size: 0.8em;
	color: #bae6fd;
}

.tool-tabs {
	display: grid;
	grid-template-columns: 1fr 1fr;
	gap: 0.4em;
}

.tool-tab {
	background: rgba(30, 41, 59, 0.8);
	border: 1px solid rgba(255, 255, 255, 0.15);
	color: #cbd5e1;
	padding: 0.5em 0.4em;
	border-radius: 0.3em;
	font-size: 0.85em;
	cursor: pointer;
	font-family: Kurale, sans-serif;
	transition: all 0.2s;
}

.tool-tab:hover {
	border-color: #f6c445;
	color: #ffffff;
}

.tool-tab.__active {
	background: rgba(246, 196, 69, 0.25);
	border-color: #f6c445;
	color: #f6c445;
	font-weight: bold;
}

.palette-grid {
	display: flex;
	flex-direction: column;
	gap: 0.4em;
}

.palette-btn {
	display: flex;
	align-items: center;
	gap: 0.6em;
	background: rgba(30, 41, 59, 0.7);
	border: 1px solid rgba(255, 255, 255, 0.12);
	color: #e2e8f0;
	padding: 0.4em 0.8em;
	border-radius: 0.3em;
	font-size: 0.85em;
	cursor: pointer;
	font-family: Kurale, sans-serif;
	transition: all 0.2s;
}

.palette-btn:hover {
	background: rgba(51, 65, 85, 0.9);
	border-color: #f6c445;
}

.palette-btn.__active {
	background: rgba(246, 196, 69, 0.25);
	border-color: #f6c445;
	color: #f6c445;
	font-weight: bold;
}

.palette-preview {
	width: 1.2em;
	height: 1.2em;
	border-radius: 0.2em;
	border: 1px solid rgba(255, 255, 255, 0.3);
}

.palette-icon {
	font-size: 1.2em;
}

.elevation-controls {
	display: flex;
	flex-direction: column;
	gap: 0.5em;
}

.exact-z-box {
	margin-top: 0.4em;
	display: flex;
	flex-direction: column;
	gap: 0.3em;
}

.sub-label {
	font-size: 0.8em;
	color: #94a3b8;
}

.z-buttons {
	display: grid;
	grid-template-columns: repeat(5, 1fr);
	gap: 0.3em;
}

.z-btn {
	background: rgba(30, 41, 59, 0.8);
	border: 1px solid rgba(255, 255, 255, 0.15);
	color: #e2e8f0;
	padding: 0.3em;
	border-radius: 0.2em;
	font-size: 0.8em;
	cursor: pointer;
	text-align: center;
}

.z-btn.__active {
	background: rgba(246, 196, 69, 0.3);
	border-color: #f6c445;
	color: #f6c445;
	font-weight: bold;
}

.edge-selector-grid {
	display: grid;
	grid-template-columns: repeat(2, 1fr);
	gap: 0.4em;
}

.edge-btn {
	background: rgba(30, 41, 59, 0.8);
	border: 1px solid rgba(255, 255, 255, 0.2);
	color: #cbd5e1;
	border-radius: 0.3em;
	padding: 0.35em 0.5em;
	font-size: 0.85em;
	font-weight: bold;
	cursor: pointer;
	text-align: center;
	transition: all 0.2s ease;
}

.edge-btn:hover {
	border-color: #f6c445;
	color: #f6c445;
}

.edge-btn.__active {
	background: rgba(246, 196, 69, 0.25);
	border-color: #f6c445;
	color: #f6c445;
}

.spawn-info {
	background: rgba(246, 196, 69, 0.15);
	border: 1px solid rgba(246, 196, 69, 0.3);
	border-radius: 0.3em;
	padding: 0.5em;
	font-size: 0.85em;
	display: flex;
	flex-direction: column;
	gap: 0.2em;
}

/* Canvas Wrap */
.editor-canvas-wrap {
	flex: 1;
	position: relative;
	overflow: hidden;
}

/* Status bar */
.editor-statusbar {
	position: absolute;
	bottom: 0;
	left: 0;
	right: 0;
	height: 2.2em;
	background: rgba(15, 23, 42, 0.9);
	border-top: 1px solid rgba(255, 255, 255, 0.1);
	display: flex;
	align-items: center;
	padding: 0 1.2em;
	gap: 1.5em;
	font-size: 0.8em;
	color: #94a3b8;
	z-index: 20;
}

.status-cell strong {
	color: #f6c445;
}

.status-toggles {
	margin-left: auto;
	display: flex;
	gap: 0.5em;
}

.status-toggle-btn {
	background: rgba(30, 41, 59, 0.8);
	border: 1px solid rgba(255, 255, 255, 0.2);
	color: #cbd5e1;
	padding: 0.15em 0.6em;
	border-radius: 0.2em;
	font-size: 0.85em;
	cursor: pointer;
}

.status-toggle-btn.__active {
	background: rgba(246, 196, 69, 0.25);
	border-color: #f6c445;
	color: #f6c445;
}

/* Inspector Drawer (Right Side) */
.editor-inspector-drawer {
	width: 23em;
	background: rgba(15, 23, 42, 0.96);
	border-left: 1px solid rgba(246, 196, 69, 0.3);
	display: flex;
	flex-direction: column;
	gap: 1em;
	padding: 1.2em;
	overflow-y: auto;
	z-index: 20;
	flex-shrink: 0;
	box-shadow: -0.4em 0 1.5em rgba(0, 0, 0, 0.6);
	animation: drawer-slide-in 0.2s ease-out;
}

@keyframes drawer-slide-in {
	from {
		transform: translateX(100%);
	}
	to {
		transform: translateX(0);
	}
}

.inspector-header {
	display: flex;
	align-items: center;
	justify-content: space-between;
	border-bottom: 1px solid rgba(246, 196, 69, 0.25);
	padding-bottom: 0.6em;
}

.inspector-title-box {
	display: flex;
	align-items: center;
	gap: 0.5em;
}

.inspector-icon {
	font-size: 1.4em;
}

.inspector-title {
	font-size: 1em;
	color: #f6c445;
	margin: 0;
	font-weight: bold;
}

.inspector-coords {
	font-size: 0.8em;
	color: #94a3b8;
}

.inspector-coords strong {
	color: #38bdf8;
}

.inspector-close-btn {
	background: none;
	border: 1px solid rgba(255, 255, 255, 0.15);
	color: #94a3b8;
	border-radius: 0.25em;
	padding: 0.2em 0.4em;
	font-size: 0.9em;
	cursor: pointer;
	transition: all 0.15s;
}

.inspector-close-btn:hover {
	border-color: #ef4444;
	color: #ef4444;
}

.inspector-section {
	background: rgba(30, 41, 59, 0.5);
	border: 1px solid rgba(255, 255, 255, 0.1);
	border-radius: 0.4em;
	padding: 0.8em;
	display: flex;
	flex-direction: column;
	gap: 0.6em;
}

.inspector-sec-header {
	display: flex;
	align-items: center;
	gap: 0.4em;
	font-size: 0.85em;
	font-weight: bold;
	color: #f6c445;
	border-bottom: 1px solid rgba(255, 255, 255, 0.08);
	padding-bottom: 0.3em;
}

.inspector-sec-header .sec-title-truncate {
	flex: 1;
	white-space: nowrap;
	overflow: hidden;
	text-overflow: ellipsis;
}

.sec-icon {
	font-size: 1.1em;
}

.inspector-btn-action-sm {
	margin-left: auto;
	background: rgba(16, 185, 129, 0.2);
	border: 1px solid #10b981;
	color: #34d399;
	border-radius: 0.25em;
	padding: 0.15em 0.45em;
	font-size: 0.75em;
	cursor: pointer;
	font-family: Kurale, sans-serif;
	transition: all 0.15s;
}

.inspector-btn-action-sm:hover {
	background: rgba(16, 185, 129, 0.35);
}

.inspector-field-row {
	display: flex;
	align-items: center;
	justify-content: space-between;
	gap: 0.5em;
	font-size: 0.85em;
}

.field-label {
	color: #cbd5e1;
	font-size: 0.85em;
}

.field-label-sm {
	color: #94a3b8;
	font-size: 0.8em;
}

.inspector-select {
	background: rgba(15, 23, 42, 0.9);
	border: 1px solid rgba(255, 255, 255, 0.2);
	color: #f6c445;
	padding: 0.25em 0.5em;
	border-radius: 0.3em;
	font-size: 0.85em;
	outline: none;
	cursor: pointer;
	font-family: Kurale, sans-serif;
}

.inspector-input {
	background: rgba(15, 23, 42, 0.9);
	border: 1px solid rgba(255, 255, 255, 0.2);
	color: #ffffff;
	padding: 0.25em 0.5em;
	border-radius: 0.3em;
	font-size: 0.85em;
	outline: none;
	font-family: Kurale, sans-serif;
	flex: 1;
}

.inspector-input-sm {
	width: 4em;
	background: rgba(15, 23, 42, 0.9);
	border: 1px solid rgba(255, 255, 255, 0.2);
	color: #38bdf8;
	padding: 0.2em 0.4em;
	border-radius: 0.25em;
	font-size: 0.85em;
	text-align: center;
	outline: none;
}

.field-checkbox-label {
	display: flex;
	align-items: center;
	gap: 0.5em;
	color: #cbd5e1;
	cursor: pointer;
	font-size: 0.85em;
}

.field-checkbox-label-sm {
	display: flex;
	align-items: center;
	gap: 0.4em;
	color: #94a3b8;
	cursor: pointer;
	font-size: 0.8em;
}

/* Walls list in inspector */
.walls-edges-list {
	display: flex;
	flex-direction: column;
	gap: 0.4em;
}

.wall-edge-card {
	background: rgba(15, 23, 42, 0.7);
	border: 1px solid rgba(255, 255, 255, 0.08);
	border-radius: 0.3em;
	padding: 0.4em 0.6em;
	display: flex;
	flex-direction: column;
	gap: 0.3em;
}

.wall-card-header {
	display: flex;
	align-items: center;
	gap: 0.5em;
	font-size: 0.8em;
}

.wall-edge-tag {
	font-weight: bold;
	color: #f6c445;
	background: rgba(246, 196, 69, 0.15);
	padding: 0.1em 0.4em;
	border-radius: 0.2em;
}

.wall-type-tag {
	color: #cbd5e1;
	flex: 1;
}

.wall-none-tag {
	color: #64748b;
	font-style: italic;
	flex: 1;
}

.wall-card-btn-box {
	margin-left: auto;
}

.wall-card-del-btn,
.wall-card-add-btn {
	background: none;
	border: 1px solid rgba(255, 255, 255, 0.15);
	border-radius: 0.2em;
	padding: 0.1em 0.35em;
	font-size: 0.75em;
	cursor: pointer;
	line-height: 1;
}

.wall-card-del-btn:hover {
	border-color: #ef4444;
	color: #ef4444;
}

.wall-card-add-btn:hover {
	border-color: #10b981;
	color: #10b981;
}

.wall-card-body {
	display: flex;
	flex-direction: column;
	gap: 0.3em;
	padding-top: 0.2em;
	border-top: 1px dashed rgba(255, 255, 255, 0.08);
}

.wall-body-row {
	display: flex;
	align-items: center;
	justify-content: space-between;
	gap: 0.4em;
}

.inspector-select-sm {
	background: rgba(30, 41, 59, 0.9);
	border: 1px solid rgba(255, 255, 255, 0.15);
	color: #f6c445;
	padding: 0.15em 0.4em;
	border-radius: 0.2em;
	font-size: 0.8em;
	font-family: Kurale, sans-serif;
	outline: none;
}

/* Object tree container */
.empty-objects-box {
	display: flex;
	flex-direction: column;
	align-items: center;
	gap: 0.5em;
	padding: 1em;
	background: rgba(15, 23, 42, 0.5);
	border-radius: 0.3em;
	text-align: center;
}

.empty-msg {
	font-size: 0.8em;
	color: #64748b;
}

.empty-add-btn {
	background: rgba(16, 185, 129, 0.2);
	border: 1px solid #10b981;
	color: #34d399;
	border-radius: 0.3em;
	padding: 0.3em 0.8em;
	font-size: 0.8em;
	cursor: pointer;
	font-family: Kurale, sans-serif;
}

.object-tree-container {
	display: flex;
	flex-direction: column;
	gap: 0.4em;
	max-height: 18em;
	overflow-y: auto;
	padding-right: 0.2em;
}

/* Selected Node Editor */
.inspector-node-editor {
	background: rgba(15, 23, 42, 0.85);
	border-color: rgba(56, 189, 248, 0.3);
}

.inspector-slider-box {
	display: flex;
	flex-direction: column;
	gap: 0.25em;
}

.slider-header {
	display: flex;
	justify-content: space-between;
	font-size: 0.8em;
}

.slider-label {
	color: #cbd5e1;
}

.slider-val {
	color: #38bdf8;
	font-weight: bold;
}

.inspector-range {
	width: 100%;
	cursor: pointer;
	accent-color: #38bdf8;
}

.inspector-node-btn-row {
	display: flex;
	gap: 0.6em;
	margin-top: 0.4em;
}

.node-btn-add-child {
	flex: 1;
	background: rgba(16, 185, 129, 0.2);
	border: 1px solid #10b981;
	color: #34d399;
	border-radius: 0.3em;
	padding: 0.35em 0.6em;
	font-size: 0.8em;
	cursor: pointer;
	font-family: Kurale, sans-serif;
	transition: all 0.15s;
}

.node-btn-add-child:hover {
	background: rgba(16, 185, 129, 0.35);
}

.node-btn-remove {
	background: rgba(239, 68, 68, 0.2);
	border: 1px solid #ef4444;
	color: #fca5a5;
	border-radius: 0.3em;
	padding: 0.35em 0.6em;
	font-size: 0.8em;
	cursor: pointer;
	font-family: Kurale, sans-serif;
	transition: all 0.15s;
}

.node-btn-remove:hover {
	background: rgba(239, 68, 68, 0.35);
}

/* Add Preset Grid */
.preset-object-grid {
	display: grid;
	grid-template-columns: repeat(2, 1fr);
	gap: 0.4em;
	margin-top: 0.3em;
}

.preset-item-btn {
	display: flex;
	align-items: center;
	gap: 0.4em;
	background: rgba(30, 41, 59, 0.8);
	border: 1px solid rgba(255, 255, 255, 0.15);
	color: #e2e8f0;
	padding: 0.35em 0.6em;
	border-radius: 0.3em;
	font-size: 0.85em;
	cursor: pointer;
	font-family: Kurale, sans-serif;
	transition: all 0.15s;
}

.preset-item-btn:hover {
	border-color: #f6c445;
}

.preset-item-btn.__active {
	background: rgba(246, 196, 69, 0.25);
	border-color: #f6c445;
	color: #f6c445;
	font-weight: bold;
}

.preset-icon {
	font-size: 1.2em;
}

.preset-name {
	font-size: 0.85em;
}

/* Modals */
.editor-modal-overlay {
	position: absolute;
	inset: 0;
	background: rgba(0, 0, 0, 0.7);
	display: flex;
	align-items: center;
	justify-content: center;
	z-index: 50;
	backdrop-filter: blur(0.3em);
}

.editor-modal {
	background: #131926;
	border: 1px solid #f6c445;
	border-radius: 0.6em;
	padding: 1.8em;
	width: 26em;
	display: flex;
	flex-direction: column;
	gap: 1em;
	box-shadow: 0 0.8em 2.5em rgba(0, 0, 0, 0.8);
}

.editor-modal-wide {
	width: 42em;
}

.modal-title {
	font-size: 1.3em;
	color: #f6c445;
	margin: 0;
	font-family: Overlord, Kurale, serif;
}

.modal-subtitle {
	font-size: 0.85em;
	color: #94a3b8;
	margin: -0.4em 0 0.4em 0;
}

.modal-form {
	display: flex;
	flex-direction: column;
	gap: 0.8em;
}

.form-group {
	display: flex;
	flex-direction: column;
	gap: 0.3em;
}

.form-label {
	font-size: 0.85em;
	color: #cbd5e1;
}

.form-input,
.form-select {
	background: rgba(15, 23, 42, 0.9);
	border: 1px solid rgba(255, 255, 255, 0.2);
	color: #f8fafc;
	padding: 0.4em 0.7em;
	border-radius: 0.3em;
	font-size: 0.85em;
	outline: none;
	font-family: Kurale, sans-serif;
}

.form-input:focus,
.form-select:focus {
	border-color: #f6c445;
}

.form-row-two {
	display: flex;
	gap: 0.8em;
}

.form-col {
	flex: 1;
	display: flex;
	flex-direction: column;
	gap: 0.25em;
}

.form-sublabel {
	font-size: 0.8em;
	color: #94a3b8;
}

.form-hint {
	font-size: 0.78em;
	color: #64748b;
}

.export-modal-top {
	display: flex;
	align-items: flex-start;
	justify-content: space-between;
	gap: 1em;
	margin-bottom: 0.6em;
	flex-wrap: wrap;
}

.export-modal-titles {
	flex: 1;
	min-width: 15em;
}

.export-format-selector {
	display: inline-flex;
	background: rgba(0, 0, 0, 0.4);
	border: 1px solid rgba(255, 255, 255, 0.15);
	border-radius: 0.5em;
	padding: 0.2em;
	gap: 0.25em;
	align-self: center;
}

.format-tab-btn {
	background: transparent;
	border: none;
	color: #94a3b8;
	padding: 0.35em 0.75em;
	border-radius: 0.35em;
	font-size: 0.8em;
	font-family: inherit;
	cursor: pointer;
	transition: all 0.2s;
}

.format-tab-btn:hover {
	color: #f8fafc;
}

.format-tab-btn.__active {
	background: #3b82f6;
	color: #ffffff;
	font-weight: 600;
	box-shadow: 0 0.1em 0.4em rgba(59, 130, 246, 0.4);
}

.export-stats-banner {
	display: flex;
	align-items: center;
	justify-content: space-between;
	background: rgba(15, 23, 42, 0.8);
	border: 1px solid rgba(56, 189, 248, 0.25);
	border-radius: 0.4em;
	padding: 0.4em 0.8em;
	font-size: 0.8em;
	margin-bottom: 0.6em;
}

.stats-savings {
	color: #4ade80;
	font-weight: 600;
}

.stats-info {
	color: #94a3b8;
}

.json-export-textarea {
	width: 100%;
	height: 18em;
	background: #090d14;
	border: 1px solid rgba(255, 255, 255, 0.2);
	color: #38bdf8;
	font-family: monospace;
	font-size: 0.8em;
	padding: 0.8em;
	border-radius: 0.4em;
	resize: none;
	outline: none;
}

.modal-buttons {
	display: flex;
	justify-content: flex-end;
	gap: 0.8em;
	margin-top: 0.5em;
}

/* Buttons */
.editor-btn {
	display: inline-flex;
	align-items: center;
	gap: 0.4em;
	padding: 0.4em 1em;
	border-radius: 0.35em;
	font-size: 0.85em;
	cursor: pointer;
	font-family: Kurale, sans-serif;
	transition: all 0.2s;
}

.editor-btn-back {
	background: rgba(30, 41, 59, 0.8);
	border: 1px solid rgba(246, 196, 69, 0.35);
	color: #f6c445;
}

.editor-btn-back:hover {
	background: rgba(246, 196, 69, 0.2);
	border-color: #f6c445;
}

.btn-icon {
	font-size: 1.2em;
	line-height: 1;
}

.editor-btn-primary {
	background: #f6c445;
	color: #0f172a;
	border: 1px solid #d9a830;
	font-weight: bold;
}

.editor-btn-primary:hover {
	background: #ffd369;
}

.editor-btn-secondary {
	background: rgba(30, 41, 59, 0.8);
	color: #e2e8f0;
	border: 1px solid rgba(255, 255, 255, 0.2);
}

.editor-btn-secondary:hover {
	background: rgba(51, 65, 85, 0.9);
}

.editor-btn-action {
	background: rgba(16, 185, 129, 0.2);
	border: 1px solid #10b981;
	color: #34d399;
}

.editor-btn-action:hover {
	background: rgba(16, 185, 129, 0.35);
}

.editor-btn-danger {
	background: rgba(239, 68, 68, 0.15);
	border: 1px solid #ef4444;
	color: #fca5a5;
	justify-content: center;
}

.editor-btn-danger:hover {
	background: rgba(239, 68, 68, 0.3);
	color: #ffffff;
}

.map-title-badge {
	cursor: pointer;
	padding: 0.2em 0.6em;
	border-radius: 0.4em;
	border: 1px solid transparent;
	transition: background 0.2s, border-color 0.2s;
}

.map-title-badge:hover {
	background: rgba(30, 41, 59, 0.7);
	border-color: rgba(246, 196, 69, 0.35);
}

.resize-quick-btn {
	width: 100%;
	margin-top: 0.6em;
	font-size: 0.85em;
	justify-content: center;
}

.palette-preview.__is-void {
	background: repeating-linear-gradient(
		45deg,
		#0f172a,
		#0f172a 0.25em,
		#1e293b 0.25em,
		#1e293b 0.5em
	) !important;
	border: 1px dashed #64748b;
}

.inspector-void-section {
	background: rgba(15, 23, 42, 0.7);
	border: 1px dashed rgba(100, 116, 139, 0.45);
	border-radius: 0.5em;
	padding: 1em;
	text-align: center;
}

.void-banner-icon {
	font-size: 2.2em;
	display: block;
	margin-bottom: 0.2em;
}

.void-banner-title {
	font-size: 1.1em;
	color: #94a3b8;
	font-weight: bold;
	margin-bottom: 0.4em;
}

.void-banner-desc {
	font-size: 0.8em;
	color: #64748b;
	line-height: 1.4;
	margin-bottom: 0.8em;
}

.resize-mode-tabs {
	display: flex;
	gap: 0.5em;
	margin-bottom: 0.8em;
}

.resize-mode-tab {
	flex: 1;
	background: rgba(30, 41, 59, 0.7);
	border: 1px solid rgba(255, 255, 255, 0.12);
	color: #94a3b8;
	padding: 0.5em 0.8em;
	border-radius: 0.4em;
	font-size: 0.85em;
	cursor: pointer;
	font-family: Kurale, sans-serif;
	transition: all 0.2s;
}

.resize-mode-tab:hover {
	color: #e2e8f0;
	border-color: rgba(255, 255, 255, 0.25);
}

.resize-mode-tab.__active {
	background: rgba(246, 196, 69, 0.2);
	border-color: #f6c445;
	color: #f6c445;
	font-weight: bold;
}

.resize-comparison-card {
	background: rgba(15, 23, 42, 0.85);
	border: 1px solid rgba(255, 255, 255, 0.12);
	border-radius: 0.4em;
	padding: 0.6em 0.8em;
	display: flex;
	flex-direction: column;
	gap: 0.3em;
	margin-bottom: 0.8em;
}

.resize-comp-row {
	display: flex;
	justify-content: space-between;
	align-items: baseline;
	font-size: 0.85em;
	color: #cbd5e1;
}

.resize-comp-val.__new {
	color: #38bdf8;
}

.resize-comp-coords {
	font-size: 0.85em;
	color: #94a3b8;
	margin-left: 0.4em;
	font-weight: normal;
}

.resize-comp-hint {
	font-size: 0.78em;
	color: #10b981;
	margin-top: 0.2em;
	border-top: 1px dashed rgba(255, 255, 255, 0.1);
	padding-top: 0.3em;
}

/* Sides 4-direction layout */
.resize-sides-container {
	display: flex;
	flex-direction: column;
	gap: 0.6em;
	margin-bottom: 0.8em;
}

.resize-side-card {
	background: rgba(20, 28, 45, 0.7);
	border: 1px solid rgba(255, 255, 255, 0.1);
	border-radius: 0.4em;
	padding: 0.5em 0.7em;
}

.resize-side-header {
	display: flex;
	align-items: center;
	gap: 0.4em;
	margin-bottom: 0.4em;
	font-size: 0.82em;
	color: #e2e8f0;
}

.resize-side-title {
	flex: 1;
}

.resize-side-delta {
	font-weight: bold;
	font-size: 0.9em;
	color: #94a3b8;
}

.resize-side-delta.__plus {
	color: #38bdf8;
}

.resize-side-delta.__minus {
	color: #f87171;
}

.resize-delta-buttons {
	display: flex;
	align-items: center;
	gap: 0.3em;
}

.side-step-btn {
	background: rgba(30, 41, 59, 0.9);
	border: 1px solid rgba(255, 255, 255, 0.15);
	color: #cbd5e1;
	border-radius: 0.3em;
	padding: 0.25em 0.5em;
	font-size: 0.8em;
	cursor: pointer;
	min-width: 2em;
	text-align: center;
}

.side-step-btn:hover {
	border-color: #f6c445;
	color: #f6c445;
}

.side-num-input {
	flex: 1;
	background: rgba(10, 15, 28, 0.9);
	border: 1px solid rgba(255, 255, 255, 0.2);
	color: #f8fafc;
	border-radius: 0.3em;
	padding: 0.25em 0.4em;
	font-size: 0.85em;
	text-align: center;
}

.resize-sides-mid-row {
	display: flex;
	align-items: stretch;
	gap: 0.6em;
}

.resize-sides-mid-row .resize-side-card {
	flex: 1;
}

.resize-center-preview {
	width: 5.5em;
	display: flex;
	flex-direction: column;
	align-items: center;
	justify-content: center;
	gap: 0.3em;
	background: rgba(15, 23, 42, 0.6);
	border: 1px dashed rgba(255, 255, 255, 0.15);
	border-radius: 0.4em;
	padding: 0.4em;
}

.center-origin-badge {
	font-size: 0.75em;
	color: #f6c445;
	font-weight: bold;
}

.center-reset-btn {
	padding: 0.2em 0.4em !important;
	font-size: 0.75em !important;
}

/* Anchor 3x3 grid */
.resize-anchor-container {
	margin-bottom: 0.8em;
}

.anchor-grid-matrix {
	display: grid;
	grid-template-columns: repeat(3, 3.2em);
	grid-gap: 0.4em;
	justify-content: center;
	margin-top: 0.3em;
}

.anchor-btn {
	height: 2.6em;
	background: rgba(30, 41, 59, 0.8);
	border: 1px solid rgba(255, 255, 255, 0.15);
	color: #cbd5e1;
	border-radius: 0.3em;
	font-size: 1.1em;
	display: flex;
	align-items: center;
	justify-content: center;
	cursor: pointer;
	transition: all 0.2s;
}

.anchor-btn:hover {
	border-color: #38bdf8;
	color: #38bdf8;
}

.anchor-btn.__active {
	background: rgba(56, 189, 248, 0.25);
	border-color: #38bdf8;
	color: #38bdf8;
	box-shadow: 0 0 0.5em rgba(56, 189, 248, 0.4);
}

.resize-current-info {
	background: rgba(15, 23, 42, 0.85);
	border: 1px solid rgba(255, 255, 255, 0.12);
	border-radius: 0.4em;
	padding: 0.6em 0.8em;
	font-size: 0.85em;
	color: #cbd5e1;
	display: flex;
	flex-direction: column;
	gap: 0.2em;
}

.resize-coords-info {
	color: #94a3b8;
	font-size: 0.8em;
}

.resize-step-buttons {
	display: flex;
	gap: 0.6em;
}

.resize-step-buttons .editor-btn {
	flex: 1;
	justify-content: center;
	font-size: 0.85em;
}

.resize-presets-grid {
	display: grid;
	grid-template-columns: repeat(3, 1fr);
	gap: 0.4em;
}

.preset-btn {
	background: rgba(30, 41, 59, 0.8);
	border: 1px solid rgba(255, 255, 255, 0.15);
	color: #cbd5e1;
	padding: 0.4em 0.6em;
	border-radius: 0.3em;
	font-size: 0.85em;
	cursor: pointer;
	font-family: Kurale, sans-serif;
	transition: all 0.2s;
}

.preset-btn:hover {
	border-color: #f6c445;
	color: #f6c445;
}

.preset-btn.__active {
	background: rgba(246, 196, 69, 0.2);
	border-color: #f6c445;
	color: #f6c445;
	font-weight: bold;
}

.resize-shrink-warning {
	background: rgba(239, 68, 68, 0.15);
	border: 1px solid #ef4444;
	color: #fca5a5;
	padding: 0.6em 0.8em;
	border-radius: 0.4em;
	font-size: 0.8em;
	line-height: 1.4;
}

/* Brush Controls */
.brush-size-badge {
	font-size: 0.8em;
	color: #38bdf8;
	background: rgba(56, 189, 248, 0.15);
	border: 1px solid rgba(56, 189, 248, 0.35);
	padding: 0.15em 0.5em;
	border-radius: 0.3em;
	font-weight: normal;
	text-transform: none;
	letter-spacing: 0;
}

.brush-shape-toggle {
	display: flex;
	gap: 0.5em;
}

.brush-shape-btn {
	flex: 1;
	background: rgba(30, 41, 59, 0.8);
	border: 1px solid rgba(255, 255, 255, 0.15);
	color: #cbd5e1;
	padding: 0.45em 0.6em;
	border-radius: 0.35em;
	font-size: 0.82em;
	font-family: Kurale, sans-serif;
	cursor: pointer;
	transition: all 0.2s;
	display: flex;
	align-items: center;
	justify-content: center;
	gap: 0.3em;
}

.brush-shape-btn:hover {
	border-color: #38bdf8;
	color: #38bdf8;
}

.brush-shape-btn.__active {
	background: rgba(56, 189, 248, 0.2);
	border-color: #38bdf8;
	color: #38bdf8;
	font-weight: bold;
}

.brush-slider-row {
	display: flex;
	flex-direction: column;
	gap: 0.35em;
}

.brush-slider-header {
	display: flex;
	justify-content: space-between;
	align-items: center;
}

.brush-size-number {
	color: #f6c445;
	font-size: 0.85em;
}

.brush-range-input {
	width: 100%;
	accent-color: #38bdf8;
	cursor: pointer;
	height: 1.5em;
}

.brush-quick-sizes {
	display: grid;
	grid-template-columns: repeat(7, 1fr);
	gap: 0.25em;
}

.size-quick-btn {
	background: rgba(30, 41, 59, 0.7);
	border: 1px solid rgba(255, 255, 255, 0.12);
	color: #94a3b8;
	padding: 0.3em 0;
	border-radius: 0.25em;
	font-size: 0.8em;
	font-family: Kurale, sans-serif;
	cursor: pointer;
	text-align: center;
	transition: all 0.15s;
}

.size-quick-btn:hover {
	border-color: #38bdf8;
	color: #ffffff;
}

.size-quick-btn.__active {
	background: rgba(56, 189, 248, 0.25);
	border-color: #38bdf8;
	color: #38bdf8;
	font-weight: bold;
}

.brush-hint-box {
	display: flex;
	flex-direction: column;
	gap: 0.25em;
	background: rgba(15, 23, 42, 0.6);
	border: 1px solid rgba(255, 255, 255, 0.08);
	border-radius: 0.35em;
	padding: 0.4em 0.6em;
}

.hint-line {
	font-size: 0.72em;
	color: #94a3b8;
	line-height: 1.35;
}
</style>
