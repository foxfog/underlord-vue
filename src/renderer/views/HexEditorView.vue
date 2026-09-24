<template>
	<div class="hex-editor-view">
		<!-- Header Toolbar -->
		<header class="editor-header">
			<div class="header-left">
				<button class="editor-btn editor-btn-back" @click="returnToHome">
					<span class="btn-icon">‹</span>
					<span>Меню</span>
				</button>

				<div class="header-map-title">
					<span class="map-icon">⬡</span>
					<span class="map-name">{{ mapData.name || 'Новая гексагональная карта' }}</span>
					<span class="map-badge">{{ mapData.cols }}×{{ mapData.rows }}</span>
				</div>

				<button class="editor-btn editor-btn-action" @click="openNewMapModal">
					<span>➕ Новая карта</span>
				</button>
			</div>

			<div class="header-center">
				<div class="editor-tool-group">
					<button
						v-for="tool in toolsList"
						:key="tool.id"
						class="editor-tool-tab"
						:class="{ __active: activeTool === tool.id }"
						@click="setTool(tool.id)"
						:title="tool.desc"
					>
						<span class="tool-icon">{{ tool.icon }}</span>
						<span class="tool-name">{{ tool.name }}</span>
					</button>
				</div>
			</div>

			<div class="header-right">
				<button class="editor-btn editor-btn-secondary" @click="openExportModal">
					<span>💾 Экспорт JSON</span>
				</button>
			</div>
		</header>

		<!-- Main Workspace Area -->
		<div class="editor-workspace">
			<!-- Left Tool Options Palette & Hex Inspector -->
			<aside class="editor-sidebar">
				<!-- Hex Inspector Section (when a hex is selected) -->
				<div v-if="selectedCell" class="hex-inspector-section">
					<div class="inspector-card-header">
						<div class="inspector-card-title">
							<span class="inspector-card-icon">⬡</span>
							<span>Гекс ({{ selectedCell.col }}, {{ selectedCell.row }})</span>
						</div>
						<button class="btn-close-sm" title="Снять выделение" @click="selectedHexCoord = null">✕</button>
					</div>

					<!-- Interactive 2.5D SVG Hex Preview -->
					<div v-if="previewHexData" class="hex-preview-wrap">
						<svg class="hex-preview-svg" viewBox="0 0 220 170">
							<defs>
								<filter id="hexShadow" x="-10%" y="-10%" width="120%" height="120%">
									<feDropShadow dx="0" dy="2" stdDeviation="2.5" flood-color="#000000" flood-opacity="0.45" />
								</filter>
							</defs>

							<!-- Connected Roads from Center to Edges -->
							<g class="preview-roads">
								<template v-for="e in previewHexData.edges" :key="'road-' + e.edge">
									<line
										v-if="e.hasRoad"
										:x1="previewHexData.cx"
										:y1="previewHexData.cy"
										:x2="e.mx"
										:y2="e.my"
										:stroke="e.roadType === 'stone' ? '#94a3b8' : '#b45309'"
										:stroke-width="e.roadType === 'stone' ? 5 : 4"
										:stroke-dasharray="e.roadType === 'stone' ? 'none' : '4 2'"
										stroke-linecap="round"
									/>
								</template>
								<!-- Central Road Hub -->
								<circle
									v-if="selectedCell.road && selectedCell.road !== 'none'"
									:cx="previewHexData.cx"
									:cy="previewHexData.cy"
									r="6"
									:fill="selectedCell.road === 'stone' ? '#94a3b8' : '#b45309'"
									:stroke="selectedCell.road === 'stone' ? '#475569' : '#451a03'"
									stroke-width="2"
								/>
							</g>

							<!-- Base Hexagon Polygon -->
							<polygon
								:points="previewHexData.pointsStr"
								:fill="biomeColor"
								stroke="#334155"
								stroke-width="2"
								filter="url(#hexShadow)"
							/>

							<!-- Relief Features -->
							<!-- Hills -->
							<g v-if="selectedCell.feature === 'hills'" class="preview-feature-hills">
								<path d="M 96 90 Q 104 76 112 90" fill="#475569" stroke="#64748b" stroke-width="1.5" />
								<path d="M 108 92 Q 118 72 128 92" fill="#334155" stroke="#64748b" stroke-width="1.5" />
								<text x="110" y="86" text-anchor="middle" font-size="14">⛰️</text>
							</g>

							<!-- Mountain -->
							<g v-if="selectedCell.feature === 'mountain'" class="preview-feature-mountain">
								<polygon points="110,54 90,92 130,92" fill="#334155" stroke="#475569" stroke-width="1.5" />
								<polygon points="110,54 100,70 120,70" fill="#f8fafc" />
								<line x1="110" y1="54" x2="110" y2="92" stroke="rgba(0,0,0,0.3)" stroke-width="1.5" />
								<text v-if="selectedCell.mountainRadius > 1" x="110" y="104" text-anchor="middle" font-size="10" fill="#f6c445" font-weight="bold">
									R{{ selectedCell.mountainRadius }}
								</text>
							</g>

							<!-- Settlement Badge -->
							<g v-if="selectedCell.settlement" class="preview-settlement">
								<rect x="75" y="68" width="70" height="24" rx="4" fill="rgba(15, 23, 42, 0.85)" stroke="#f6c445" stroke-width="1" />
								<text x="90" y="84" text-anchor="middle" font-size="12">{{ settlementIcon(selectedCell.settlement.type) }}</text>
								<text x="118" y="84" text-anchor="middle" font-size="9" fill="#f8fafc" font-weight="bold">
									{{ truncateText(selectedCell.settlement.name, 9) }}
								</text>
							</g>

							<!-- Rivers on the 6 Edges -->
							<g class="preview-rivers">
								<template v-for="e in previewHexData.edges" :key="'river-' + e.edge">
									<!-- River Under-layer (Deep Blue) -->
									<line
										v-if="e.hasRiver"
										:x1="e.endpoints.from.x"
										:y1="e.endpoints.from.y"
										:x2="e.endpoints.to.x"
										:y2="e.endpoints.to.y"
										stroke="#0369a1"
										:stroke-width="e.width * 2.8 + 2.5"
										stroke-linecap="round"
									/>
									<!-- River Water Flow Ribbon -->
									<line
										v-if="e.hasRiver"
										:x1="e.endpoints.from.x"
										:y1="e.endpoints.from.y"
										:x2="e.endpoints.to.x"
										:y2="e.endpoints.to.y"
										stroke="#38bdf8"
										:stroke-width="e.width * 2.8"
										stroke-linecap="round"
									/>
									<!-- Animated Flow Current Dash -->
									<line
										v-if="e.hasRiver"
										class="river-flow-animated"
										:class="e.flowDir === 1 ? '__flow-fwd' : '__flow-rev'"
										:x1="e.endpoints.from.x"
										:y1="e.endpoints.from.y"
										:x2="e.endpoints.to.x"
										:y2="e.endpoints.to.y"
										stroke="rgba(255, 255, 255, 0.9)"
										:stroke-width="Math.max(1, e.width * 0.9)"
										stroke-linecap="round"
										stroke-dasharray="5 5"
									/>
									<!-- Flow Direction Arrow (Chevron) -->
									<polygon
										v-if="e.hasRiver"
										:points="e.arrowPoints"
										fill="#ffffff"
										stroke="#0284c7"
										stroke-width="1"
									/>

									<!-- Auto Bridge (if road + river) -->
									<g v-if="e.hasBridge" class="preview-bridge">
										<line
											:x1="e.mx - (e.endpoints.to.y - e.endpoints.from.y) * 0.12"
											:y1="e.my + (e.endpoints.to.x - e.endpoints.from.x) * 0.12"
											:x2="e.mx + (e.endpoints.to.y - e.endpoints.from.y) * 0.12"
											:y2="e.my - (e.endpoints.to.x - e.endpoints.from.x) * 0.12"
											stroke="#78350f"
											stroke-width="3"
										/>
									</g>

									<!-- Invisible Wide Touch Zone for clicking the edge -->
									<line
										class="edge-click-zone"
										:x1="e.endpoints.from.x"
										:y1="e.endpoints.from.y"
										:x2="e.endpoints.to.x"
										:y2="e.endpoints.to.y"
										stroke="transparent"
										stroke-width="16"
										stroke-linecap="round"
										@click.stop="onPreviewEdgeClick(e.edge)"
									/>
								</template>
							</g>

							<!-- Edge Label Badges (N, NE, SE, S, SW, NW) around hex -->
							<g class="preview-edge-badges">
								<g
									v-for="e in previewHexData.edges"
									:key="'badge-' + e.edge"
									class="preview-edge-badge"
									:class="{ __has_river: e.hasRiver }"
									:transform="`translate(${e.labelX}, ${e.labelY})`"
									@click.stop="onPreviewEdgeClick(e.edge)"
								>
									<circle
										r="11"
										:fill="e.hasRiver ? '#0284c7' : 'rgba(30, 41, 59, 0.9)'"
										:stroke="e.hasRiver ? '#38bdf8' : 'rgba(255, 255, 255, 0.25)'"
										stroke-width="1.2"
									/>
									<text
										y="3.5"
										text-anchor="middle"
										font-size="9"
										:fill="e.hasRiver ? '#ffffff' : '#cbd5e1'"
										font-weight="bold"
									>
										{{ e.edge }}
									</text>
								</g>
							</g>
						</svg>

						<div class="preview-hint">
							💡 Клик по грани переключает реку / направление течения
						</div>
					</div>

					<!-- Rivers Manager on 6 Edges -->
					<div class="rivers-manager-section">
						<div class="rivers-header">
							<span class="sub-label">🌊 Течение рек по граням:</span>
							<span class="rivers-count-badge">{{ hexRiversCount }} / 6</span>
						</div>

						<div class="edges-list">
							<div
								v-for="e in previewHexData.edges"
								:key="e.edge"
								class="edge-row"
								:class="{ '__has-river': e.hasRiver }"
							>
								<div class="edge-info">
									<span class="edge-tag" :class="{ __active: e.hasRiver }">{{ e.edge }}</span>
									<span class="edge-name">{{ edgeLabels[e.edge] }}</span>
								</div>

								<div v-if="e.hasRiver" class="edge-river-controls">
									<!-- Direction Toggle Button -->
									<button
										class="btn-flow-toggle"
										@click="flipEdgeRiverDirection(e.edge)"
										:title="'Сменить направление: ' + e.directionName"
									>
										⇄ {{ e.directionName }}
									</button>

									<!-- Width Selector -->
									<div class="edge-width-selector">
										<button
											v-for="w in [1, 2, 3]"
											:key="w"
											class="edge-w-btn"
											:class="{ __active: e.width === w }"
											@click="setEdgeRiverWidth(e.edge, w)"
											:title="'Ширина ' + w"
										>
											{{ w }}
										</button>
									</div>

									<!-- Delete Button -->
									<button
										class="btn-del-sm"
										@click="removeEdgeRiver(e.edge)"
										title="Удалить реку с грани"
									>
										✕
									</button>
								</div>

								<div v-else class="edge-empty-controls">
									<button class="btn-add-river-edge" @click="toggleEdgeRiver(e.edge)">
										➕ Река
									</button>
								</div>
							</div>
						</div>
					</div>

					<!-- Hex Properties (Biome, Relief, Settlement) -->
					<div class="hex-props-section">
						<div class="section-title">Свойства гекса</div>

						<div class="inspector-field">
							<label class="field-label">Биом:</label>
							<select v-model="selectedCell.terrain" class="inspector-select">
								<option v-for="b in biomesList" :key="b.id" :value="b.id">
									{{ b.name }}
								</option>
							</select>
						</div>

						<div class="inspector-field">
							<label class="field-label">Рельеф:</label>
							<select v-model="selectedCell.feature" class="inspector-select">
								<option value="none">Равнина (Без рельефа)</option>
								<option value="hills">Холмы</option>
								<option value="mountain">Гора</option>
							</select>
						</div>

						<div class="inspector-field">
							<label class="field-label">Дорога:</label>
							<select v-model="selectedCell.road" class="inspector-select" @change="onRoadPropertyChange">
								<option value="none">Нет дороги</option>
								<option value="dirt">🪵 Гравийная дорога</option>
								<option value="stone">🧱 Каменная дорога</option>
							</select>
						</div>

						<div v-if="selectedCell.feature === 'mountain'" class="inspector-field">
							<label class="field-label">Радиус горы:</label>
							<div class="num-selector">
								<button
									v-for="r in [1, 2, 3]"
									:key="r"
									class="num-btn"
									:class="{ __active: (selectedCell.mountainRadius || 1) === r }"
									@click="selectedCell.mountainRadius = r"
								>
									{{ r }}
								</button>
							</div>
						</div>

						<!-- Settlement Details -->
						<div class="inspector-section-block">
							<div class="section-block-title">
								<span>🏰 Поселение</span>
								<button
									v-if="selectedCell.settlement"
									class="btn-del-sm"
									@click="selectedCell.settlement = null"
								>
									Удалить
								</button>
								<button
									v-else
									class="btn-add-sm"
									@click="addSettlementToSelected"
								>
									➕ Добавить
								</button>
							</div>

							<div v-if="selectedCell.settlement" class="settlement-edit-fields">
								<div class="inspector-field">
									<label class="field-label">Тип:</label>
									<select v-model="selectedCell.settlement.type" class="inspector-select">
										<option v-for="s in settlementTypesList" :key="s.id" :value="s.id">
											{{ s.icon }} {{ s.name }}
										</option>
									</select>
								</div>

								<div class="inspector-field">
									<label class="field-label">Имя:</label>
									<input v-model="selectedCell.settlement.name" class="inspector-input" />
								</div>

								<div class="inspector-field">
									<label class="field-label">Описание:</label>
									<textarea v-model="selectedCell.settlement.description" class="inspector-textarea"></textarea>
								</div>

								<div class="inspector-field">
									<label class="field-checkbox-label">
										<input type="checkbox" v-model="selectedCell.settlement.hasLocalMap" />
										<span>Есть локальная карта</span>
									</label>
								</div>

								<div v-if="selectedCell.settlement.hasLocalMap" class="inspector-field">
									<label class="field-label">ID локальной карты:</label>
									<input v-model="selectedCell.settlement.localMapId" class="inspector-input" placeholder="carne" />
								</div>
							</div>
						</div>
					</div>
				</div>

				<!-- Tool Options Wrap (when tool options are needed) -->
				<div class="tool-options-wrap" :class="{ '__has_inspector': selectedCell }">
					<div v-if="selectedCell" class="tool-options-header">
						<span class="sub-label">🛠️ Активный инструмент: {{ activeToolName }}</span>
					</div>

					<!-- Tool 1: Biomes / Terrains -->
					<div v-if="activeTool === 'biome'" class="tool-section">
						<div class="section-title">Тип покрытия (Биом)</div>
						<div class="palette-grid">
							<button
								v-for="b in biomesList"
								:key="b.id"
								class="palette-btn"
								:class="{ __active: selectedBiome === b.id }"
								@click="selectedBiome = b.id"
							>
								<span class="palette-color-swatch" :style="{ background: b.color }"></span>
								<span class="palette-name">{{ b.name }}</span>
							</button>
						</div>

						<div class="sub-label" style="margin-top: 0.8em;">Радиус кисти:</div>
						<div class="num-selector">
							<button
								v-for="r in [1, 2, 3]"
								:key="r"
								class="num-btn"
								:class="{ __active: brushRadius === r }"
								@click="brushRadius = r"
							>
								{{ r }} гекс{{ r > 1 ? 'а' : '' }}
							</button>
						</div>
					</div>

					<!-- Tool 2: Mountains -->
					<div v-if="activeTool === 'mountain'" class="tool-section">
						<div class="section-title">Горы и горные массивы</div>
						<p class="section-desc">
							Кликните на гекс, чтобы воздвигнуть гору. При радиусе 2 или 3 вокруг центрального пика сформируются горные отроги.
						</p>

						<div class="sub-label">Площадь / Радиус массива:</div>
						<div class="num-selector">
							<button
								v-for="r in [1, 2, 3]"
								:key="r"
								class="num-btn"
								:class="{ __active: selectedMountainRadius === r }"
								@click="selectedMountainRadius = r"
							>
								{{ r === 1 ? '1 (Пик)' : r === 2 ? '2 (Массив)' : '3 (Хребет)' }}
							</button>
						</div>
					</div>

					<!-- Tool 3: Hills -->
					<div v-if="activeTool === 'hills'" class="tool-section">
						<div class="section-title">Холмы</div>
						<p class="section-desc">
							Клик по гексу поднимает холмистый рельеф. Повторный клик снимает холмы. На холмах также могут размещаться дороги и поселения.
						</p>
					</div>

					<!-- Tool 4: Rivers -->
					<div v-if="activeTool === 'river'" class="tool-section">
						<div class="section-title">Реки по граням гексов</div>
						<p class="section-desc">
							Реки текут по граням между гексами (как в Civilization). Наведите курсор на нужную грань гекса и кликните.
						</p>

						<div class="sub-label">Ширина реки на грани:</div>
						<div class="num-selector">
							<button
								v-for="w in [1, 2, 3]"
								:key="w"
								class="num-btn"
								:class="{ __active: selectedRiverWidth === w }"
								@click="selectedRiverWidth = w"
							>
								{{ w === 1 ? '1 (Ручей)' : w === 2 ? '2 (Река)' : '3 (Широкая)' }}
							</button>
						</div>
						<p class="section-hint">
							💡 Повторный клик по грани с рекой удалит реку с этой грани.
						</p>
					</div>

					<!-- Tool 5: Roads (Civilization Style) -->
					<div v-if="activeTool === 'road'" class="tool-section">
						<div class="section-title">Дороги (стиль Civilization)</div>
						<p class="section-desc">
							Кликните на любой гекс, чтобы разместить на нём дорогу. Соседние клетки с дорогами <strong>автоматически соединяются перекрёстками</strong> и мостами через реки!
						</p>

						<div class="sub-label">Тип дороги:</div>
						<div class="palette-grid">
							<button
								class="palette-btn"
								:class="{ __active: selectedRoadType === 'dirt' }"
								@click="selectedRoadType = 'dirt'"
							>
								<span class="palette-icon">🪵</span>
								<span class="palette-name">Гравийная</span>
							</button>
							<button
								class="palette-btn"
								:class="{ __active: selectedRoadType === 'stone' }"
								@click="selectedRoadType = 'stone'"
							>
								<span class="palette-icon">🧱</span>
								<span class="palette-name">Каменная</span>
							</button>
						</div>

						<div class="sub-label">Радиус кисти:</div>
						<div class="num-selector">
							<button
								v-for="r in [1, 2, 3]"
								:key="r"
								class="num-btn"
								:class="{ __active: brushRadius === r }"
								@click="brushRadius = r"
							>
								{{ r === 1 ? '1 гекс' : `Радиус ${r}` }}
							</button>
						</div>

						<p class="section-hint">
							💡 Повторный клик тем же типом дороги удаляет дорогу с клетки.
						</p>
					</div>

					<!-- Tool 6: Settlements -->
					<div v-if="activeTool === 'settlement'" class="tool-section">
						<div class="section-title">Поселения и Города</div>
						<div class="palette-grid">
							<button
								v-for="s in settlementTypesList"
								:key="s.id"
								class="palette-btn"
								:class="{ __active: selectedSettlementType === s.id }"
								@click="selectedSettlementType = s.id"
							>
								<span class="palette-icon">{{ s.icon }}</span>
								<span class="palette-name">{{ s.name }}</span>
							</button>
						</div>

						<div class="settlement-form" style="margin-top: 0.8em;">
							<div class="form-group-sm">
								<label class="form-label-sm">Название поселения:</label>
								<input v-model="newSettlementName" class="form-input-sm" placeholder="Например: Деревня Карн" />
							</div>
							<div class="form-group-sm">
								<label class="form-label-sm">Описание:</label>
								<textarea v-model="newSettlementDesc" class="form-textarea-sm" placeholder="Краткое описание"></textarea>
							</div>
						</div>
					</div>

					<!-- Tool 7: Eraser -->
					<div v-if="activeTool === 'eraser'" class="tool-section">
						<div class="section-title">Ластик</div>
						<p class="section-desc">
							Клик по гексу удалит с него поселение, горы или холмы. Клик по грани с рекой удалит реку. Клик по дороге удалит дорогу.
						</p>
					</div>

					<!-- Tool 8: Select / Inspector -->
					<div v-if="activeTool === 'select' && !selectedCell" class="tool-section">
						<div class="section-title">Инспектор гекса</div>
						<p class="section-desc">
							Кликните на любой гекс на карте для просмотра его структуры, рек по 6 граням и параметров.
						</p>
					</div>
				</div>
			</aside>

			<!-- Canvas Workspace Area -->
			<main class="editor-canvas-wrap">
				<HexCanvas
					ref="canvasRef"
					:map-data="mapData"
					:active-tool="activeTool"
					:active-biome="selectedBiome"
					:active-mountain-radius="selectedMountainRadius"
					:active-river-width="selectedRiverWidth"
					:active-road-type="selectedRoadType"
					:active-settlement-type="selectedSettlementType"
					:selected-hex="selectedHexCoord"
					:pitch="mapPitch"
					@pitch-change="p => mapPitch = p"
					@hex-click="onHexClick"
					@edge-click="onEdgeClick"
				/>
			</main>
		</div>

		<!-- Modal: New Map -->
		<div v-if="showNewModal" class="modal-backdrop">
			<div class="modal-card">
				<div class="modal-header">
					<h3>Создать новую гексагональную карту</h3>
					<button class="btn-close" @click="showNewModal = false">×</button>
				</div>
				<div class="modal-body">
					<div class="form-group">
						<label class="form-label">Название карты:</label>
						<input v-model="newMapForm.name" class="form-input" placeholder="Название" />
					</div>
					<div class="form-group">
						<label class="form-label">Колонок (Ширина):</label>
						<input v-model.number="newMapForm.cols" type="number" min="5" max="60" class="form-input" />
					</div>
					<div class="form-group">
						<label class="form-label">Строк (Высота):</label>
						<input v-model.number="newMapForm.rows" type="number" min="5" max="50" class="form-input" />
					</div>
					<div class="form-group">
						<label class="form-label">Базовое покрытие:</label>
						<select v-model="newMapForm.baseTerrain" class="form-select">
							<option v-for="b in biomesList" :key="b.id" :value="b.id">
								{{ b.name }}
							</option>
						</select>
					</div>
				</div>
				<div class="modal-footer">
					<button class="editor-btn editor-btn-primary" @click="confirmCreateNewMap">Создать</button>
					<button class="editor-btn editor-btn-secondary" @click="showNewModal = false">Отмена</button>
				</div>
			</div>
		</div>

		<!-- Modal: Export JSON -->
		<div v-if="showExportModal" class="modal-backdrop">
			<div class="modal-card modal-card-wide">
				<div class="modal-header">
					<h3>Экспорт гексагональной карты (.json)</h3>
					<button class="btn-close" @click="showExportModal = false">×</button>
				</div>
				<div class="modal-body">
					<textarea :value="exportedJsonText" class="json-textarea" readonly></textarea>
				</div>
				<div class="modal-footer">
					<button class="editor-btn editor-btn-primary" @click="copyJson">
						{{ copyStatus }}
					</button>
					<button class="editor-btn editor-btn-action" @click="downloadJson">
						💾 Скачать .json
					</button>
					<button class="editor-btn editor-btn-secondary" @click="showExportModal = false">Закрыть</button>
				</div>
			</div>
		</div>
	</div>
</template>

<script setup>
import { ref, computed, watch } from 'vue'
import { useRouter } from 'vue-router'
import HexCanvas from '@/components/game/hexmap/HexCanvas.vue'
import {
	BIOMES,
	SETTLEMENT_TYPES,
	ROAD_TYPES,
	normalizeHexMapData,
	createDefaultHexMap,
	getCanonicalRoadKey,
	getRiverOnEdge,
	getRiverDataOnEdge,
	syncRoadsForCell,
	rebuildAllRoadConnections
} from '@/utils/hexmap/hexLoader.js'
import {
	HEX_EDGES,
	getHexesInRadius,
	getCanonicalEdgeKey,
	getHexNeighbor,
	hexDistance,
	getHexVertices,
	getHexEdgeEndpoints,
	getEdgeFlowDirectionName
} from '@/utils/hexmap/hexCoords.js'
import defaultNewWorldHex from '@data/hexmaps/newworld_hex.json'

const router = useRouter()
const canvasRef = ref(null)

const edgeLabels = {
	N: 'Север (N)',
	NE: 'Сев.-Восток (NE)',
	SE: 'Юго-Восток (SE)',
	S: 'Юг (S)',
	SW: 'Юго-Запад (SW)',
	NW: 'Сев.-Запад (NW)'
}

// Current Map State
const mapData = ref(normalizeHexMapData(JSON.parse(JSON.stringify(defaultNewWorldHex))))
const mapPitch = ref(mapData.value?.pitch || 45)

watch(mapPitch, (newP) => {
	if (mapData.value) {
		mapData.value.pitch = newP
	}
})



// Active Tools
const activeTool = ref('select') // 'select' | 'biome' | 'mountain' | 'hills' | 'river' | 'road' | 'settlement' | 'eraser'
const selectedBiome = ref('grass')
const brushRadius = ref(1)
const selectedMountainRadius = ref(1)
const selectedRiverWidth = ref(2)
const selectedRoadType = ref('stone')
const selectedSettlementType = ref('village')
const newSettlementName = ref('')
const newSettlementDesc = ref('')

// Selection State
const selectedHexCoord = ref(null)

// Modals State
const showNewModal = ref(false)
const showExportModal = ref(false)
const copyStatus = ref('Копировать в буфер')

const newMapForm = ref({
	name: 'Новая гексагональная карта',
	cols: 20,
	rows: 15,
	baseTerrain: 'grass'
})

const toolsList = [
	{ id: 'select', name: 'Инспектор', icon: '🔍', desc: 'Выбор и редактирование гекса' },
	{ id: 'biome', name: 'Биом', icon: '🌿', desc: 'Нанесение покрытия (трава, вода, пустыня, снег)' },
	{ id: 'hills', name: 'Холмы', icon: '⛰️', desc: 'Установка холмов' },
	{ id: 'mountain', name: 'Горы', icon: '🏔️', desc: 'Горные пики и массивы (радиус 1..3)' },
	{ id: 'river', name: 'Реки', icon: '🌊', desc: 'Реки по граням гексов (ширина 1..3)' },
	{ id: 'road', name: 'Дороги', icon: '🛣️', desc: 'Поклеточные дороги (стиль Civilization)' },
	{ id: 'settlement', name: 'Поселение', icon: '🏰', desc: 'Лагеря, деревни, города и крепости' },
	{ id: 'eraser', name: 'Ластик', icon: '🧹', desc: 'Стирание рек, дорог и объектов' }
]

const biomesList = Object.values(BIOMES)
const settlementTypesList = Object.values(SETTLEMENT_TYPES)

const activeToolName = computed(() => {
	const t = toolsList.find(item => item.id === activeTool.value)
	return t ? t.name : activeTool.value
})

const selectedCell = computed(() => {
	if (!selectedHexCoord.value) return null
	const key = `${selectedHexCoord.value.col},${selectedHexCoord.value.row}`
	return mapData.value?.cells?.[key] || null
})

const biomeColor = computed(() => {
	if (!selectedCell.value) return '#4ade80'
	return BIOMES[selectedCell.value.terrain]?.color || '#4ade80'
})

const previewHexData = computed(() => {
	if (!selectedCell.value) return null
	const cx = 110
	const cy = 85
	const r = 64
	const tilt = 0.70
	const vertices = getHexVertices(cx, cy, r, tilt)
	const pointsStr = vertices.map(v => `${v.x.toFixed(1)},${v.y.toFixed(1)}`).join(' ')
	const col = selectedCell.value.col
	const row = selectedCell.value.row

	const edges = HEX_EDGES.map(edge => {
		const endpoints = getHexEdgeEndpoints(vertices, edge)
		const river = getRiverDataOnEdge(mapData.value.rivers, col, row, edge)
		const neighbor = getHexNeighbor(col, row, edge)
		const roadKey = getCanonicalRoadKey(col, row, neighbor.col, neighbor.row)
		const road = mapData.value.roads?.[roadKey] || null

		// Midpoint of the edge
		const mx = (endpoints.from.x + endpoints.to.x) / 2
		const my = (endpoints.from.y + endpoints.to.y) / 2

		// Flow direction and vector for arrows
		const flowDir = river ? (river.flowDir === -1 ? -1 : 1) : 1
		const rdx = endpoints.to.x - endpoints.from.x
		const rdy = endpoints.to.y - endpoints.from.y
		const rLen = Math.hypot(rdx, rdy) || 1
		const ux = (rdx / rLen) * flowDir
		const uy = (rdy / rLen) * flowDir
		const px = -uy
		const py = ux

		// Chevron arrow points centered around midpoint
		const tipX = mx + ux * 8
		const tipY = my + uy * 8
		const fin1X = mx - ux * 6 + px * 5
		const fin1Y = my - uy * 6 + py * 5
		const fin2X = mx - ux * 6 - px * 5
		const fin2Y = my - uy * 6 - py * 5
		const arrowPoints = `${tipX.toFixed(1)},${tipY.toFixed(1)} ${fin1X.toFixed(1)},${fin1Y.toFixed(1)} ${fin2X.toFixed(1)},${fin2Y.toFixed(1)}`

		// Label position offset outward from hex center
		const outDx = mx - cx
		const outDy = my - cy
		const outLen = Math.hypot(outDx, outDy) || 1
		const labelX = mx + (outDx / outLen) * 20
		const labelY = my + (outDy / outLen) * 20

		return {
			edge,
			endpoints,
			river,
			hasRiver: !!river,
			flowDir,
			width: river ? river.width : 0,
			directionName: getEdgeFlowDirectionName(edge, flowDir),
			mx,
			my,
			labelX: Math.round(labelX),
			labelY: Math.round(labelY),
			arrowPoints,
			hasRoad: !!road,
			roadType: road?.type || 'dirt',
			hasBridge: !!(river && road)
		}
	})

	return {
		cx,
		cy,
		vertices,
		pointsStr,
		edges
	}
})

const hexRiversCount = computed(() => {
	if (!previewHexData.value) return 0
	return previewHexData.value.edges.filter(e => e.hasRiver).length
})

function truncateText(text, maxLen = 10) {
	if (!text) return ''
	return text.length > maxLen ? text.slice(0, maxLen - 1) + '…' : text
}

function settlementIcon(type) {
	return SETTLEMENT_TYPES[type]?.icon || '🏰'
}

function toggleEdgeRiver(edge) {
	if (!selectedCell.value) return
	const col = selectedCell.value.col
	const row = selectedCell.value.row
	const key = getCanonicalEdgeKey(col, row, edge)

	if (mapData.value.rivers[key]) {
		delete mapData.value.rivers[key]
	} else {
		mapData.value.rivers[key] = {
			col,
			row,
			edge,
			width: selectedRiverWidth.value || 2,
			flowDir: 1
		}
	}
}

function flipEdgeRiverDirection(edge) {
	if (!selectedCell.value) return
	const col = selectedCell.value.col
	const row = selectedCell.value.row
	const key = getCanonicalEdgeKey(col, row, edge)
	if (mapData.value.rivers[key]) {
		mapData.value.rivers[key].flowDir = mapData.value.rivers[key].flowDir === -1 ? 1 : -1
	}
}

function setEdgeRiverWidth(edge, width) {
	if (!selectedCell.value) return
	const col = selectedCell.value.col
	const row = selectedCell.value.row
	const key = getCanonicalEdgeKey(col, row, edge)
	if (mapData.value.rivers[key]) {
		mapData.value.rivers[key].width = width
	} else {
		mapData.value.rivers[key] = {
			col,
			row,
			edge,
			width,
			flowDir: 1
		}
	}
}

function removeEdgeRiver(edge) {
	if (!selectedCell.value) return
	const col = selectedCell.value.col
	const row = selectedCell.value.row
	const key = getCanonicalEdgeKey(col, row, edge)
	delete mapData.value.rivers[key]
}

function onPreviewEdgeClick(edge) {
	if (!selectedCell.value) return
	const col = selectedCell.value.col
	const row = selectedCell.value.row
	const key = getCanonicalEdgeKey(col, row, edge)
	const existing = mapData.value.rivers[key]

	if (!existing) {
		mapData.value.rivers[key] = {
			col,
			row,
			edge,
			width: selectedRiverWidth.value || 2,
			flowDir: 1
		}
	} else {
		// Toggle/flip direction when clicked directly in preview!
		existing.flowDir = existing.flowDir === -1 ? 1 : -1
	}
}

const exportedJsonText = computed(() => {
	return JSON.stringify(mapData.value, null, 2)
})

function returnToHome() {
	router.push('/home')
}

function setTool(toolId) {
	activeTool.value = toolId
}

function getOrCreateCell(col, row, defaultTerrain = 'grass') {
	const k = `${col},${row}`
	if (!mapData.value.cells[k]) {
		mapData.value.cells[k] = {
			col,
			row,
			terrain: defaultTerrain,
			elevation: 0,
			feature: 'none',
			mountainRadius: 1,
			road: 'none',
			settlement: null
		}
	}
	return mapData.value.cells[k]
}

function onHexClick({ col, row, cell, isRightClick }) {
	if (isRightClick || activeTool.value === 'eraser') {
		eraseHex(col, row)
		return
	}

	selectedHexCoord.value = { col, row }
	const targetCell = getOrCreateCell(col, row)

	switch (activeTool.value) {
		case 'select': {
			// Just select
			break
		}
		case 'biome': {
			// Apply biome with brush radius
			const targetHexes = getHexesInRadius(col, row, brushRadius.value)
			for (const h of targetHexes) {
				if (h.col < 0 || h.col >= mapData.value.cols || h.row < 0 || h.row >= mapData.value.rows) continue
				const c = getOrCreateCell(h.col, h.row)
				c.terrain = selectedBiome.value
			}
			break
		}
		case 'hills': {
			targetCell.feature = targetCell.feature === 'hills' ? 'none' : 'hills'
			break
		}
		case 'mountain': {
			const radius = selectedMountainRadius.value
			const targetHexes = getHexesInRadius(col, row, radius)
			for (const h of targetHexes) {
				if (h.col < 0 || h.col >= mapData.value.cols || h.row < 0 || h.row >= mapData.value.rows) continue
				const c = getOrCreateCell(h.col, h.row)
				c.feature = 'mountain'
				c.mountainRadius = radius
			}
			break
		}
		case 'road': {
			// Civilization-style per-cell road: click to pave, auto-connect to road neighbors
			const radius = brushRadius.value || 1
			const targetHexes = getHexesInRadius(col, row, radius)
			for (const h of targetHexes) {
				if (h.col < 0 || h.col >= mapData.value.cols || h.row < 0 || h.row >= mapData.value.rows) continue
				const c = getOrCreateCell(h.col, h.row)
				if (c.road === selectedRoadType.value) {
					c.road = 'none'
				} else {
					c.road = selectedRoadType.value
				}
				syncRoadsForCell(mapData.value, h.col, h.row)
			}
			break
		}
		case 'settlement': {
			targetCell.settlement = {
				id: `settlement_${col}_${row}`,
				name: newSettlementName.value || SETTLEMENT_TYPES[selectedSettlementType.value]?.name || 'Поселение',
				type: selectedSettlementType.value,
				description: newSettlementDesc.value || '',
				hasLocalMap: false
			}
			break
		}
	}
}

function onEdgeClick({ col, row, edge, width }) {
	const key = getCanonicalEdgeKey(col, row, edge)
	if (activeTool.value === 'eraser') {
		delete mapData.value.rivers[key]
		return
	}

	if (activeTool.value === 'river') {
		if (mapData.value.rivers[key]) {
			if (mapData.value.rivers[key].width === width) {
				// Clicked same width again -> remove river
				delete mapData.value.rivers[key]
			} else {
				// Update width
				mapData.value.rivers[key].width = width
			}
		} else {
			// Add river
			mapData.value.rivers[key] = {
				col,
				row,
				edge,
				width,
				flowDir: 1
			}
		}
	}
}

function eraseHex(col, row) {
	const k = `${col},${row}`
	if (mapData.value.cells[k]) {
		mapData.value.cells[k].settlement = null
		mapData.value.cells[k].feature = 'none'
		mapData.value.cells[k].road = 'none'
	}
	syncRoadsForCell(mapData.value, col, row)
}

function onRoadPropertyChange() {
	if (!selectedCell.value) return
	syncRoadsForCell(mapData.value, selectedCell.value.col, selectedCell.value.row)
}

function addSettlementToSelected() {
	if (!selectedCell.value) return
	selectedCell.value.settlement = {
		id: `settlement_${selectedCell.value.col}_${selectedCell.value.row}`,
		name: 'Новое поселение',
		type: 'village',
		description: '',
		hasLocalMap: false
	}
}

function openNewMapModal() {
	showNewModal.value = true
}

function confirmCreateNewMap() {
	mapData.value = createDefaultHexMap(
		newMapForm.value.cols,
		newMapForm.value.rows,
		newMapForm.value.baseTerrain
	)
	mapData.value.name = newMapForm.value.name
	mapData.value.pitch = mapPitch.value
	selectedHexCoord.value = null
	showNewModal.value = false
	canvasRef.value?.resetCamera?.()
}

function openExportModal() {
	copyStatus.value = 'Копировать в буфер'
	showExportModal.value = true
}

async function copyJson() {
	try {
		await navigator.clipboard.writeText(exportedJsonText.value)
		copyStatus.value = '✅ Скопировано!'
		setTimeout(() => {
			copyStatus.value = 'Копировать в буфер'
		}, 2000)
	} catch (e) {
		console.error(e)
	}
}

function downloadJson() {
	const blob = new Blob([exportedJsonText.value], { type: 'application/json' })
	const url = URL.createObjectURL(blob)
	const a = document.createElement('a')
	a.href = url
	a.download = `${mapData.value.id || 'hexmap'}.json`
	a.click()
	URL.revokeObjectURL(url)
}
</script>

<style scoped>
.hex-editor-view {
	position: absolute;
	inset: 0;
	display: flex;
	flex-direction: column;
	background: #090d16;
	color: #e2e8f0;
	overflow: hidden;
}

/* Header */
.editor-header {
	height: 3.2em;
	background: #0f172a;
	border-bottom: 1px solid rgba(255, 255, 255, 0.1);
	display: flex;
	align-items: center;
	justify-content: space-between;
	padding: 0 1em;
	gap: 1em;
	z-index: 20;
}

.header-left,
.header-right {
	display: flex;
	align-items: center;
	gap: 0.6em;
}

.header-map-title {
	display: flex;
	align-items: center;
	gap: 0.4em;
	background: rgba(30, 41, 59, 0.8);
	border: 1px solid rgba(255, 255, 255, 0.15);
	padding: 0.3em 0.8em;
	border-radius: 0.3em;
}

.map-icon {
	color: #f6c445;
	font-size: 1.1em;
}

.map-name {
	font-weight: bold;
	font-size: 0.85em;
	color: #f8fafc;
}

.map-badge {
	background: rgba(246, 196, 69, 0.2);
	color: #f6c445;
	font-size: 0.75em;
	padding: 0.1em 0.4em;
	border-radius: 0.2em;
}

/* Tool Tab Buttons in Header Center */
.editor-tool-group {
	display: flex;
	background: rgba(15, 23, 42, 0.9);
	border: 1px solid rgba(255, 255, 255, 0.15);
	border-radius: 0.3em;
	padding: 0.2em;
	gap: 0.2em;
}

.editor-tool-tab {
	background: transparent;
	border: none;
	color: #94a3b8;
	padding: 0.3em 0.6em;
	font-size: 0.8em;
	border-radius: 0.2em;
	cursor: pointer;
	display: flex;
	align-items: center;
	gap: 0.3em;
	transition: all 0.2s ease;
}

.editor-tool-tab:hover {
	color: #f8fafc;
	background: rgba(255, 255, 255, 0.05);
}

.editor-tool-tab.__active {
	background: rgba(246, 196, 69, 0.25);
	color: #f6c445;
	font-weight: bold;
}

/* Buttons */
.editor-btn {
	background: #1e293b;
	border: 1px solid rgba(255, 255, 255, 0.2);
	color: #e2e8f0;
	padding: 0.35em 0.8em;
	border-radius: 0.3em;
	font-size: 0.85em;
	cursor: pointer;
	display: flex;
	align-items: center;
	gap: 0.4em;
	transition: all 0.2s ease;
}

.editor-btn:hover {
	background: #334155;
	border-color: #f6c445;
	color: #f6c445;
}

.editor-btn-primary {
	background: #f6c445;
	color: #0f172a;
	font-weight: bold;
	border-color: #f6c445;
}

.editor-btn-primary:hover {
	background: #eab308;
	color: #0f172a;
}

.editor-btn-action {
	background: #0284c7;
	color: #f8fafc;
	border-color: #38bdf8;
}

.editor-btn-action:hover {
	background: #0369a1;
	color: #f8fafc;
}

/* Workspace */
.editor-workspace {
	flex: 1;
	display: flex;
	position: relative;
	overflow: hidden;
}

.editor-sidebar {
	width: 22em;
	flex-shrink: 0;
	background: #0f172a;
	border-right: 1px solid rgba(255, 255, 255, 0.1);
	padding: 0.8em;
	overflow-y: auto;
	display: flex;
	flex-direction: column;
	gap: 0.9em;
}

/* Hex Inspector in Left Sidebar */
.hex-inspector-section {
	background: rgba(15, 23, 42, 0.85);
	border: 1px solid rgba(246, 196, 69, 0.35);
	border-radius: 0.4em;
	padding: 0.7em;
	display: flex;
	flex-direction: column;
	gap: 0.8em;
	box-shadow: 0 0.4em 1em rgba(0, 0, 0, 0.4);
}

.inspector-card-header {
	display: flex;
	align-items: center;
	justify-content: space-between;
	padding-bottom: 0.4em;
	border-bottom: 1px solid rgba(255, 255, 255, 0.1);
}

.inspector-card-title {
	display: flex;
	align-items: center;
	gap: 0.4em;
	font-weight: bold;
	font-size: 0.88em;
	color: #f6c445;
}

.inspector-card-icon {
	font-size: 1.1em;
}

/* 2.5D SVG Hex Preview */
.hex-preview-wrap {
	background: #070b14;
	border: 1px solid rgba(255, 255, 255, 0.12);
	border-radius: 0.35em;
	padding: 0.4em 0.2em;
	display: flex;
	flex-direction: column;
	align-items: center;
	position: relative;
}

.hex-preview-svg {
	width: 100%;
	height: 10.5em;
	display: block;
	overflow: visible;
}

.preview-hint {
	font-size: 0.72em;
	color: #94a3b8;
	text-align: center;
	margin-top: 0.3em;
	line-height: 1.3;
}

.preview-edge-badge {
	cursor: pointer;
	transition: transform 0.15s ease;
}

.preview-edge-badge:hover {
	transform: scale(1.15);
}

.edge-click-zone {
	cursor: pointer;
	transition: stroke 0.15s ease;
}

.edge-click-zone:hover {
	stroke: rgba(56, 189, 248, 0.5);
}

/* Flow Dash Animation */
.river-flow-animated.__flow-fwd {
	animation: riverFlowFwd 1.2s linear infinite;
}

.river-flow-animated.__flow-rev {
	animation: riverFlowRev 1.2s linear infinite;
}

@keyframes riverFlowFwd {
	from {
		stroke-dashoffset: 20;
	}
	to {
		stroke-dashoffset: 0;
	}
}

@keyframes riverFlowRev {
	from {
		stroke-dashoffset: 0;
	}
	to {
		stroke-dashoffset: 20;
	}
}

/* Rivers on 6 Edges Manager */
.rivers-manager-section {
	display: flex;
	flex-direction: column;
	gap: 0.4em;
}

.rivers-header {
	display: flex;
	align-items: center;
	justify-content: space-between;
}

.rivers-count-badge {
	background: rgba(56, 189, 248, 0.15);
	color: #38bdf8;
	border: 1px solid rgba(56, 189, 248, 0.3);
	font-size: 0.72em;
	padding: 0.1em 0.4em;
	border-radius: 0.2em;
	font-weight: bold;
}

.edges-list {
	display: flex;
	flex-direction: column;
	gap: 0.3em;
}

.edge-row {
	display: flex;
	align-items: center;
	justify-content: space-between;
	background: rgba(30, 41, 59, 0.45);
	border: 1px solid rgba(255, 255, 255, 0.08);
	padding: 0.25em 0.45em;
	border-radius: 0.25em;
	font-size: 0.78em;
	gap: 0.3em;
	transition: all 0.15s ease;
}

.edge-row.__has-river {
	background: rgba(2, 132, 199, 0.18);
	border-color: rgba(56, 189, 248, 0.35);
}

.edge-info {
	display: flex;
	align-items: center;
	gap: 0.35em;
	min-width: 6.2em;
}

.edge-tag {
	background: rgba(15, 23, 42, 0.85);
	border: 1px solid rgba(255, 255, 255, 0.2);
	color: #94a3b8;
	font-size: 0.82em;
	font-weight: bold;
	width: 1.8em;
	text-align: center;
	border-radius: 0.2em;
	padding: 0.1em 0;
}

.edge-tag.__active {
	background: #0284c7;
	border-color: #38bdf8;
	color: #f8fafc;
}

.edge-name {
	color: #cbd5e1;
	font-size: 0.85em;
	white-space: nowrap;
}

.edge-river-controls {
	display: flex;
	align-items: center;
	gap: 0.25em;
}

.edge-empty-controls {
	display: flex;
	align-items: center;
}

.btn-flow-toggle {
	background: #1e293b;
	border: 1px solid rgba(56, 189, 248, 0.45);
	color: #38bdf8;
	padding: 0.2em 0.4em;
	border-radius: 0.2em;
	font-size: 0.82em;
	cursor: pointer;
	white-space: nowrap;
	display: flex;
	align-items: center;
	gap: 0.2em;
	transition: all 0.15s ease;
}

.btn-flow-toggle:hover {
	background: rgba(56, 189, 248, 0.2);
	border-color: #38bdf8;
	color: #ffffff;
}

.edge-width-selector {
	display: flex;
	gap: 0.15em;
}

.edge-w-btn {
	background: #1e293b;
	border: 1px solid rgba(255, 255, 255, 0.15);
	color: #94a3b8;
	width: 1.35em;
	height: 1.35em;
	border-radius: 0.2em;
	font-size: 0.78em;
	cursor: pointer;
	display: flex;
	align-items: center;
	justify-content: center;
	padding: 0;
	transition: all 0.15s ease;
}

.edge-w-btn:hover {
	color: #f8fafc;
	border-color: rgba(255, 255, 255, 0.3);
}

.edge-w-btn.__active {
	background: #38bdf8;
	color: #0f172a;
	font-weight: bold;
	border-color: #38bdf8;
}

.btn-add-river-edge {
	background: rgba(30, 41, 59, 0.8);
	border: 1px dashed rgba(255, 255, 255, 0.25);
	color: #94a3b8;
	padding: 0.2em 0.5em;
	border-radius: 0.2em;
	font-size: 0.8em;
	cursor: pointer;
	transition: all 0.15s ease;
}

.btn-add-river-edge:hover {
	border-color: #38bdf8;
	color: #38bdf8;
	background: rgba(56, 189, 248, 0.1);
}

/* Hex Props Section */
.hex-props-section {
	display: flex;
	flex-direction: column;
	gap: 0.6em;
	padding-top: 0.4em;
	border-top: 1px solid rgba(255, 255, 255, 0.1);
}

/* Tool Options Wrap */
.tool-options-wrap {
	display: flex;
	flex-direction: column;
	gap: 1em;
}

.tool-options-wrap.__has_inspector {
	padding-top: 0.6em;
	border-top: 1px dashed rgba(255, 255, 255, 0.15);
}

.tool-options-header {
	padding-bottom: 0.3em;
}

.tool-section {
	display: flex;
	flex-direction: column;
	gap: 0.6em;
}

.section-title {
	font-size: 0.9em;
	font-weight: bold;
	color: #f6c445;
	border-bottom: 1px solid rgba(246, 196, 69, 0.3);
	padding-bottom: 0.3em;
}

.section-desc {
	font-size: 0.78em;
	color: #94a3b8;
	line-height: 1.4;
	margin: 0;
}

.section-hint {
	font-size: 0.75em;
	color: #38bdf8;
	line-height: 1.4;
	margin-top: 0.4em;
}

.sub-label {
	font-size: 0.8em;
	color: #cbd5e1;
	font-weight: bold;
}

/* Palettes */
.palette-grid {
	display: grid;
	grid-template-columns: repeat(2, 1fr);
	gap: 0.4em;
}

.palette-btn {
	background: rgba(30, 41, 59, 0.8);
	border: 1px solid rgba(255, 255, 255, 0.15);
	color: #e2e8f0;
	padding: 0.4em;
	border-radius: 0.3em;
	font-size: 0.8em;
	display: flex;
	align-items: center;
	gap: 0.4em;
	cursor: pointer;
	transition: all 0.2s ease;
}

.palette-btn:hover {
	border-color: #f6c445;
}

.palette-btn.__active {
	background: rgba(246, 196, 69, 0.25);
	border-color: #f6c445;
	color: #f6c445;
	font-weight: bold;
}

.palette-color-swatch {
	width: 1.2em;
	height: 1.2em;
	border-radius: 0.2em;
	border: 1px solid rgba(0, 0, 0, 0.4);
}

.num-selector {
	display: flex;
	gap: 0.4em;
}

.num-btn {
	flex: 1;
	background: rgba(30, 41, 59, 0.8);
	border: 1px solid rgba(255, 255, 255, 0.15);
	color: #e2e8f0;
	padding: 0.35em;
	border-radius: 0.2em;
	font-size: 0.8em;
	cursor: pointer;
	text-align: center;
}

.num-btn.__active {
	background: rgba(246, 196, 69, 0.3);
	border-color: #f6c445;
	color: #f6c445;
	font-weight: bold;
}



.editor-btn-sm {
	background: #334155;
	border: 1px solid rgba(255, 255, 255, 0.2);
	color: #cbd5e1;
	padding: 0.15em 0.5em;
	border-radius: 0.2em;
	font-size: 0.75em;
	cursor: pointer;
}

/* Canvas Area */
.editor-canvas-wrap {
	flex: 1;
	min-width: 0;
	position: relative;
	overflow: hidden;
}

.btn-close-sm {
	background: transparent;
	border: none;
	color: #94a3b8;
	font-size: 0.9em;
	cursor: pointer;
}

.inspector-body {
	padding: 0.8em;
	display: flex;
	flex-direction: column;
	gap: 0.8em;
}

.inspector-field {
	display: flex;
	flex-direction: column;
	gap: 0.2em;
}

.field-label {
	font-size: 0.78em;
	color: #94a3b8;
}

.inspector-select,
.inspector-input,
.inspector-textarea {
	background: #1e293b;
	border: 1px solid rgba(255, 255, 255, 0.15);
	color: #f8fafc;
	padding: 0.35em 0.5em;
	border-radius: 0.2em;
	font-size: 0.8em;
}

.inspector-textarea {
	min-height: 4em;
	resize: vertical;
}

.inspector-section-block {
	background: rgba(30, 41, 59, 0.5);
	border: 1px solid rgba(255, 255, 255, 0.1);
	border-radius: 0.3em;
	padding: 0.6em;
	display: flex;
	flex-direction: column;
	gap: 0.6em;
}

.section-block-title {
	display: flex;
	align-items: center;
	justify-content: space-between;
	font-size: 0.85em;
	font-weight: bold;
	color: #4ade80;
}

.btn-del-sm {
	background: rgba(239, 68, 68, 0.2);
	border: 1px solid rgba(239, 68, 68, 0.5);
	color: #ef4444;
	font-size: 0.75em;
	padding: 0.1em 0.4em;
	border-radius: 0.2em;
	cursor: pointer;
}

.btn-add-sm {
	background: rgba(74, 222, 128, 0.2);
	border: 1px solid rgba(74, 222, 128, 0.5);
	color: #4ade80;
	font-size: 0.75em;
	padding: 0.1em 0.4em;
	border-radius: 0.2em;
	cursor: pointer;
}

.settlement-edit-fields {
	display: flex;
	flex-direction: column;
	gap: 0.5em;
}

.field-checkbox-label {
	display: flex;
	align-items: center;
	gap: 0.4em;
	font-size: 0.8em;
	color: #cbd5e1;
	cursor: pointer;
}

/* Modals */
.modal-backdrop {
	position: absolute;
	inset: 0;
	background: rgba(0, 0, 0, 0.75);
	display: flex;
	align-items: center;
	justify-content: center;
	z-index: 50;
	backdrop-filter: blur(0.2em);
}

.modal-card {
	background: #0f172a;
	border: 1px solid rgba(246, 196, 69, 0.4);
	border-radius: 0.4em;
	width: 25em;
	display: flex;
	flex-direction: column;
	box-shadow: 0 1em 2em rgba(0, 0, 0, 0.8);
}

.modal-card-wide {
	width: 40em;
}

.modal-header {
	padding: 0.8em 1em;
	border-bottom: 1px solid rgba(255, 255, 255, 0.1);
	display: flex;
	align-items: center;
	justify-content: space-between;
}

.modal-header h3 {
	margin: 0;
	font-size: 1em;
	color: #f6c445;
}

.btn-close {
	background: transparent;
	border: none;
	color: #94a3b8;
	font-size: 1.2em;
	cursor: pointer;
}

.modal-body {
	padding: 1em;
	display: flex;
	flex-direction: column;
	gap: 0.8em;
}

.modal-footer {
	padding: 0.8em 1em;
	border-top: 1px solid rgba(255, 255, 255, 0.1);
	display: flex;
	justify-content: flex-end;
	gap: 0.6em;
}

.form-group {
	display: flex;
	flex-direction: column;
	gap: 0.2em;
}

.form-label {
	font-size: 0.8em;
	color: #cbd5e1;
}

.form-input,
.form-select {
	background: #1e293b;
	border: 1px solid rgba(255, 255, 255, 0.15);
	color: #f8fafc;
	padding: 0.4em 0.6em;
	border-radius: 0.2em;
	font-size: 0.85em;
}

.json-textarea {
	width: 100%;
	height: 18em;
	background: #090d16;
	border: 1px solid rgba(255, 255, 255, 0.15);
	color: #a5f3fc;
	font-family: monospace;
	font-size: 0.78em;
	padding: 0.6em;
	box-sizing: border-box;
	border-radius: 0.2em;
	resize: none;
}
</style>
