<template>
	<div class="hex-editor-view">
		<!-- Header Toolbar -->
		<header class="editor-header">
			<div class="header-left">
				<button class="editor-btn editor-btn-back" @click="returnToHome">
					<span class="btn-icon">‹</span>
					<span>Меню</span>
				</button>

				<!-- Location / Map Loader Selector (analogous to IsoEditorView) -->
				<div class="header-selector-box">
					<span class="selector-icon">📂</span>
					<label class="selector-label">Карта:</label>
					<select
						v-model="selectedMapId"
						class="editor-select"
						@change="onLoadSelectedMap"
					>
						<option
							v-for="item in availableMaps"
							:key="item.id"
							:value="item.id"
						>
							{{ item.name }}
						</option>
					</select>
				</div>

				<div
					class="header-map-title map-title-clickable"
					title="Кликните, чтобы изменить размер сетки карты"
					@click="openResizeModal"
				>
					<span class="map-icon">⬡</span>
					<span class="map-name">{{ mapData.name || 'Новая гексагональная карта' }}</span>
					<span class="map-badge">{{ mapData.cols }}×{{ mapData.rows }}</span>
				</div>

				<button class="editor-btn editor-btn-action" @click="openResizeModal" title="Изменить размер сетки карты">
					<span>📐 Размер сетки</span>
				</button>
				<button class="editor-btn editor-btn-secondary" @click="openNewMapModal">
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
				<button
					class="editor-btn"
					:class="{ '__active': showBordersFilter, 'editor-btn-secondary': !showBordersFilter }"
					@click="showBordersFilter = !showBordersFilter"
					:title="showBordersFilter ? 'Скрыть границы государств' : 'Показать границы государств'"
				>
					<span>🏳️ Границы: {{ showBordersFilter ? 'ВКЛ' : 'ВЫКЛ' }}</span>
				</button>
				<button
					class="editor-btn editor-btn-save"
					:class="{ '__dirty': isDirty }"
					:disabled="isSaving"
					title="Сохранить карту на диск в @data/hexmaps/ (Ctrl+S)"
					@click="saveCurrentMap"
				>
					<span class="btn-icon">💾</span>
					<span>{{ isSaving ? 'Сохранение...' : (isDirty ? 'Сохранить *' : 'Сохранить') }}</span>
				</button>
				<button class="editor-btn editor-btn-secondary" @click="openExportModal" title="Экспорт и скачивание JSON">
					<span>📄 Экспорт JSON</span>
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

							<!-- Faction Territory Tint & Border in SVG Preview -->
							<polygon
								v-if="previewHexData.factionVisuals"
								:points="previewHexData.pointsStr"
								:fill="selectedCell.fillColor || previewHexData.factionVisuals.fillColor"
								:stroke="selectedCell.borderColor || previewHexData.factionVisuals.borderColor"
								stroke-width="2.5"
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
							<select v-model="selectedCell.terrain" class="inspector-select" @change="markDirty">
								<option v-for="b in biomesList" :key="b.id" :value="b.id">
									{{ b.name }}
								</option>
							</select>
						</div>

						<div class="inspector-field">
							<label class="field-label">Рельеф:</label>
							<select v-model="selectedCell.feature" class="inspector-select" @change="markDirty">
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
									@click="selectedCell.mountainRadius = r; markDirty()"
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
									@click="selectedCell.settlement = null; markDirty()"
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
									<select v-model="selectedCell.settlement.type" class="inspector-select" @change="markDirty">
										<option v-for="s in settlementTypesList" :key="s.id" :value="s.id">
											{{ s.icon }} {{ s.name }}
										</option>
									</select>
								</div>

								<div class="inspector-field">
									<label class="field-label">Имя:</label>
									<input v-model="selectedCell.settlement.name" class="inspector-input" @input="markDirty" />
								</div>

								<div class="inspector-field">
									<label class="field-label">Описание:</label>
									<textarea v-model="selectedCell.settlement.description" class="inspector-textarea" @input="markDirty"></textarea>
								</div>

								<div class="inspector-field">
									<label class="field-checkbox-label">
										<input type="checkbox" v-model="selectedCell.settlement.hasLocalMap" @change="markDirty" />
										<span>Есть локальная карта</span>
									</label>
								</div>

								<div v-if="selectedCell.settlement.hasLocalMap" class="inspector-field">
									<label class="field-label">ID локальной карты:</label>
									<input v-model="selectedCell.settlement.localMapId" class="inspector-input" placeholder="carne" @input="markDirty" />
								</div>
							</div>
						</div>

						<!-- Faction / Nation (Civilization Borders) -->
						<div class="inspector-section-block">
							<div class="section-block-title">
								<span>🏳️ Государство / Фракция</span>
								<button
									v-if="selectedCell.faction"
									class="btn-del-sm"
									@click="selectedCell.faction = null; selectedCell.borderColor = null; selectedCell.fillColor = null; markDirty()"
								>
									Снять
								</button>
							</div>

							<div class="inspector-field">
								<label class="field-label">Принадлежность:</label>
								<select v-model="selectedCell.faction" class="inspector-select" @change="markDirty">
									<option :value="null">-- Нейтральные земли --</option>
									<option v-for="f in factionsList" :key="f.id" :value="f.id">
										{{ f.icon }} {{ f.name }}
									</option>
								</select>
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

					<!-- Tool 2: Factions & Borders (Civilization) -->
					<div v-if="activeTool === 'faction'" class="tool-section">
						<div class="section-title">Границы и территории (Civilization)</div>
						<p class="section-desc">
							Клик по гексу привязывает его к фракции. Границы между государствами отрисовываются стилизованными геральдическими линиями.
						</p>

						<div class="sub-label">Радиус кисти:</div>
						<div class="num-selector">
							<button
								v-for="r in [1, 2, 3]"
								:key="r"
								class="num-btn"
								:class="{ __active: factionBrushRadius === r }"
								@click="factionBrushRadius = r"
							>
								{{ r }} гекс{{ r > 1 ? 'а' : '' }}
							</button>
						</div>

						<div class="sub-label" style="margin-top: 0.8em;">Выберите фракцию / государство:</div>
						<div class="palette-grid faction-palette-grid">
							<button
								class="palette-btn"
								:class="{ __active: selectedFactionId === null }"
								@click="selectedFactionId = null"
								title="Очистить принадлежность (Нейтральные земли)"
							>
								<span class="neutral-swatch">⬜</span>
								<span class="palette-name">Нейтрально</span>
							</button>

							<button
								v-for="f in factionsList"
								:key="f.id"
								class="palette-btn faction-palette-btn"
								:class="{ __active: selectedFactionId === f.id }"
								@click="selectedFactionId = f.id"
								:style="{
									borderColor: selectedFactionId === f.id ? (f.borderColor || '#38bdf8') : undefined
								}"
							>
								<span
									class="faction-swatch"
									:style="{
										backgroundColor: f.fillColor || hexToRgba(f.borderColor || '#38bdf8', 0.22),
										borderColor: f.borderColor || '#38bdf8'
									}"
								>
									{{ f.icon }}
								</span>
								<span class="palette-name">{{ f.name }}</span>
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
					:show-borders="showBordersFilter"
					:factions-map="factionsList"
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
						<label class="form-label">ID карты (имя файла):</label>
						<input v-model="newMapForm.id" class="form-input" placeholder="например: my_custom_map" />
					</div>
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

		<!-- Modal: Resize Current Map -->
		<div v-if="showResizeModal" class="modal-backdrop">
			<div class="modal-card modal-card-wide resize-modal-card">
				<div class="modal-header">
					<div class="modal-title-wrap">
						<span class="modal-title-icon">📐</span>
						<div>
							<h3 class="modal-title">Изменение размера сетки карты</h3>
							<p class="modal-subtitle">
								Координаты существующих гексов и мировой ноль (0, 0) сохраняются. Выберите способ расширения:
							</p>
						</div>
					</div>
					<button class="btn-close" @click="showResizeModal = false">×</button>
				</div>

				<div class="modal-body resize-modal-body">
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
								{{ currentMapBounds.cols }} × {{ currentMapBounds.rows }}
								<span class="resize-comp-coords">
									(Колонки: [{{ currentMapBounds.minCol }}..{{ currentMapBounds.maxCol }}], Ряды: [{{ currentMapBounds.minRow }}..{{ currentMapBounds.maxRow }}])
								</span>
							</strong>
						</div>
						<div class="resize-comp-row">
							<span class="resize-comp-label">Новые границы:</span>
							<strong class="resize-comp-val __new">
								{{ previewResizeBounds.cols }} × {{ previewResizeBounds.rows }}
								<span class="resize-comp-coords">
									(Колонки: [{{ previewResizeBounds.minCol }}..{{ previewResizeBounds.maxCol }}], Ряды: [{{ previewResizeBounds.minRow }}..{{ previewResizeBounds.maxRow }}])
								</span>
							</strong>
						</div>
						<div class="resize-comp-hint">
							🎯 Мировой ноль (0, 0) остаётся неизменным. Все существующие реки, дороги и поселения сохранят свои позиции.
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
								<label class="form-sublabel">Колонки (Ширина):</label>
								<input
									v-model.number="resizeForm.cols"
									type="number"
									min="1"
									max="500"
									class="form-input"
								/>
							</div>
							<div class="form-col">
								<label class="form-sublabel">Ряды (Высота):</label>
								<input
									v-model.number="resizeForm.rows"
									type="number"
									min="1"
									max="500"
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
								<button class="editor-btn editor-btn-secondary" @click="stepResize(-10)">
									➖ -10
								</button>
								<button class="editor-btn editor-btn-secondary" @click="stepResize(+10)">
									➕ +10
								</button>
							</div>
						</div>

						<div class="form-group">
							<label class="form-sublabel">Пресеты размеров:</label>
							<div class="resize-presets-grid">
								<button
									v-for="p in [
										{ w: 24, h: 16 },
										{ w: 32, h: 22 },
										{ w: 40, h: 26 },
										{ w: 48, h: 32 },
										{ w: 60, h: 40 }
									]"
									:key="`${p.w}x${p.h}`"
									class="preset-btn"
									:class="{ __active: resizeForm.cols === p.w && resizeForm.rows === p.h }"
									@click="setResizePreset(p.w, p.h)"
								>
									{{ p.w }}×{{ p.h }}
								</button>
							</div>
						</div>

						<!-- 3x3 Anchor Matrix -->
						<div class="form-group">
							<label class="form-sublabel">Точка привязки (Якорь 3×3):</label>
							<div class="anchor-grid-matrix">
								<button
									v-for="anc in [
										{ id: 'top-left', label: '↖️', title: 'Сверху-слева' },
										{ id: 'top', label: '⬆️', title: 'Сверху' },
										{ id: 'top-right', label: '↗️', title: 'Сверху-справа' },
										{ id: 'left', label: '⬅️', title: 'Слева' },
										{ id: 'center', label: '⏺️', title: 'По центру' },
										{ id: 'right', label: '➡️', title: 'Справа' },
										{ id: 'bottom-left', label: '↙️', title: 'Снизу-слева' },
										{ id: 'bottom', label: '⬇️', title: 'Снизу' },
										{ id: 'bottom-right', label: '↘️', title: 'Снизу-справа' }
									]"
									:key="anc.id"
									class="anchor-btn"
									:class="{ __active: resizeForm.anchor === anc.id }"
									:title="anc.title"
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
						<select v-model="resizeForm.fillTerrain" class="form-select">
							<option v-for="b in biomesList" :key="b.id" :value="b.id">
								{{ b.icon }} {{ b.name }}
							</option>
						</select>
					</div>

					<!-- Warning when shrinking -->
					<div
						v-if="prunedCellsCount > 0 || prunedSettlementsCount > 0"
						class="resize-shrink-warning"
					>
						⚠️ Внимание: при уменьшении сетки будут безвозвратно удалены:
						<strong>{{ prunedCellsCount }} гексов</strong>
						<span v-if="prunedSettlementsCount > 0"> и <strong>{{ prunedSettlementsCount }} поселений</strong></span>,
						выходящих за новые границы!
					</div>
				</div>

				<div class="modal-footer">
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

		<!-- Status Toast Notification -->
		<Transition name="toast">
			<div
				v-if="statusMessage"
				class="status-toast"
				:class="`__${statusMessage.type}`"
			>
				<span class="toast-icon">
					{{ statusMessage.type === 'error' ? '❌' : statusMessage.type === 'warning' ? '⚠️' : statusMessage.type === 'success' ? '✅' : 'ℹ️' }}
				</span>
				<span class="toast-text">{{ statusMessage.text }}</span>
			</div>
		</Transition>
	</div>
</template>

<script setup>
import { ref, computed, watch, onMounted, onUnmounted } from 'vue'
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
	rebuildAllRoadConnections,
	getFactionVisuals,
	hexToRgba,
	loadHexMap,
	loadFactionsData,
	FACTION_PRESETS
} from '@/utils/hexmap/hexLoader.js'
import {
	HEX_EDGES,
	getHexesInRadius,
	getCanonicalEdgeKey,
	getHexNeighbor,
	hexDistance,
	getHexVertices,
	getHexEdgeEndpoints,
	getEdgeFlowDirectionName,
	calculateDirectionalBounds,
	calculateAnchorBounds
} from '@/utils/hexmap/hexCoords.js'

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

// Available Maps Registry and Session Cache (analogous to IsoEditorView)
const availableMaps = ref([
	{ id: 'newworld_hex', name: 'Новый Мир (Тактическая)' }
])
const selectedMapId = ref('newworld_hex')
const mapCache = {}

// Current Map State (defaults to empty map until loadMapById resolves)
const mapData = ref(createDefaultHexMap(20, 15, 'grass'))
const mapPitch = ref(45)

const isDirty = ref(false)
const isSaving = ref(false)
const statusMessage = ref(null)
let toastTimeout = null

function showToast(text, type = 'info', duration = 3000) {
	if (toastTimeout) clearTimeout(toastTimeout)
	statusMessage.value = { text, type }
	toastTimeout = setTimeout(() => {
		statusMessage.value = null
		toastTimeout = null
	}, duration)
}

function markDirty() {
	isDirty.value = true
}

watch(mapPitch, (newP) => {
	if (mapData.value) {
		mapData.value.pitch = newP
		markDirty()
	}
})

// Factions & Borders State (Civilization Style)
const fractionsRaw = ref(Object.values(FACTION_PRESETS))
const factionsList = computed(() => {
	const raw = Array.isArray(fractionsRaw.value) ? fractionsRaw.value : Object.values(fractionsRaw.value || {})
	return raw.map(f => {
		const visuals = getFactionVisuals(f.id, raw)
		return {
			id: f.id,
			name: f.name || visuals?.name || f.id,
			icon: f.icon || visuals?.icon || '🏳️',
			type: f.type || 'faction',
			borderColor: visuals?.borderColor || '#38bdf8',
			fillColor: visuals?.fillColor || 'rgba(56, 189, 248, 0.16)'
		}
	})
})

const selectedFactionId = ref('re-estize')
const factionBrushRadius = ref(1)
const showBordersFilter = ref(true)

// Active Tools
const activeTool = ref('select') // 'select' | 'biome' | 'faction' | 'mountain' | 'hills' | 'river' | 'road' | 'settlement' | 'eraser'
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
const showResizeModal = ref(false)
const showExportModal = ref(false)
const copyStatus = ref('Копировать в буфер')

const resizeForm = ref({
	mode: 'sides', // 'sides' | 'anchor'
	north: 0,
	south: 0,
	west: 0,
	east: 0,
	cols: 24,
	rows: 16,
	anchor: 'center',
	fillTerrain: 'water'
})

const currentMapBounds = computed(() => {
	const b = mapData.value?.bounds
	const minCol = b?.minCol !== undefined ? b.minCol : 0
	const maxCol = b?.maxCol !== undefined ? b.maxCol : ((mapData.value?.cols || 20) - 1)
	const minRow = b?.minRow !== undefined ? b.minRow : 0
	const maxRow = b?.maxRow !== undefined ? b.maxRow : ((mapData.value?.rows || 15) - 1)
	return {
		minCol,
		maxCol,
		minRow,
		maxRow,
		cols: maxCol - minCol + 1,
		rows: maxRow - minRow + 1
	}
})

const previewResizeBounds = computed(() => {
	const cur = currentMapBounds.value
	if (resizeForm.value.mode === 'sides') {
		return calculateDirectionalBounds(cur, {
			north: resizeForm.value.north,
			south: resizeForm.value.south,
			west: resizeForm.value.west,
			east: resizeForm.value.east
		})
	}
	return calculateAnchorBounds(
		cur,
		Math.max(1, parseInt(resizeForm.value.cols, 10) || cur.cols),
		Math.max(1, parseInt(resizeForm.value.rows, 10) || cur.rows),
		resizeForm.value.anchor
	)
})

const prunedCellsCount = computed(() => {
	const b = previewResizeBounds.value
	let count = 0
	for (const cell of Object.values(mapData.value?.cells || {})) {
		if (cell.col < b.minCol || cell.col > b.maxCol || cell.row < b.minRow || cell.row > b.maxRow) {
			count++
		}
	}
	return count
})

const prunedSettlementsCount = computed(() => {
	const b = previewResizeBounds.value
	let count = 0
	for (const cell of Object.values(mapData.value?.cells || {})) {
		if (cell.settlement && (cell.col < b.minCol || cell.col > b.maxCol || cell.row < b.minRow || cell.row > b.maxRow)) {
			count++
		}
	}
	return count
})

function isHexInBounds(col, row) {
	const b = currentMapBounds.value
	return col >= b.minCol && col <= b.maxCol && row >= b.minRow && row <= b.maxRow
}

const newMapForm = ref({
	id: 'custom_hex_map',
	name: 'Новая гексагональная карта',
	cols: 20,
	rows: 15,
	baseTerrain: 'grass'
})

const toolsList = [
	{ id: 'select', name: 'Инспектор', icon: '🔍', desc: 'Выбор и редактирование гекса' },
	{ id: 'biome', name: 'Биом', icon: '🌿', desc: 'Нанесение покрытия (трава, вода, пустыня, снег)' },
	{ id: 'faction', name: 'Фракции', icon: '🏳️', desc: 'Границы государств и территории (стиль Civilization)' },
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

const selectedFactionVisuals = computed(() => {
	if (!selectedCell.value?.faction) return null
	return getFactionVisuals(selectedCell.value.faction, fractionsRaw)
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
		edges,
		factionVisuals: selectedFactionVisuals.value
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
	markDirty()
}

function flipEdgeRiverDirection(edge) {
	if (!selectedCell.value) return
	const col = selectedCell.value.col
	const row = selectedCell.value.row
	const key = getCanonicalEdgeKey(col, row, edge)
	if (mapData.value.rivers[key]) {
		mapData.value.rivers[key].flowDir = mapData.value.rivers[key].flowDir === -1 ? 1 : -1
		markDirty()
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
	markDirty()
}

function removeEdgeRiver(edge) {
	if (!selectedCell.value) return
	const col = selectedCell.value.col
	const row = selectedCell.value.row
	const key = getCanonicalEdgeKey(col, row, edge)
	delete mapData.value.rivers[key]
	markDirty()
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
	markDirty()
}

const exportedJsonText = computed(() => {
	return JSON.stringify(mapData.value, null, 2)
})

function returnToHome() {
	if (isDirty.value) {
		const confirmed = window.confirm('У вас есть несохранённые изменения. Вы действительно хотите выйти в меню?')
		if (!confirmed) return
	}
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
				if (!isHexInBounds(h.col, h.row)) continue
				const c = getOrCreateCell(h.col, h.row)
				c.terrain = selectedBiome.value
			}
			markDirty()
			break
		}
		case 'hills': {
			targetCell.feature = targetCell.feature === 'hills' ? 'none' : 'hills'
			markDirty()
			break
		}
		case 'mountain': {
			const radius = selectedMountainRadius.value
			const targetHexes = getHexesInRadius(col, row, radius)
			for (const h of targetHexes) {
				if (!isHexInBounds(h.col, h.row)) continue
				const c = getOrCreateCell(h.col, h.row)
				c.feature = 'mountain'
				c.mountainRadius = radius
			}
			markDirty()
			break
		}
		case 'road': {
			// Civilization-style per-cell road: click to pave, auto-connect to road neighbors
			const radius = brushRadius.value || 1
			const targetHexes = getHexesInRadius(col, row, radius)
			for (const h of targetHexes) {
				if (!isHexInBounds(h.col, h.row)) continue
				const c = getOrCreateCell(h.col, h.row)
				if (c.road === selectedRoadType.value) {
					c.road = 'none'
				} else {
					c.road = selectedRoadType.value
				}
				syncRoadsForCell(mapData.value, h.col, h.row)
			}
			markDirty()
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
			markDirty()
			break
		}
		case 'faction': {
			const radius = factionBrushRadius.value || 1
			const targetHexes = getHexesInRadius(col, row, radius)
			for (const h of targetHexes) {
				if (!isHexInBounds(h.col, h.row)) continue
				const c = getOrCreateCell(h.col, h.row)
				if (selectedFactionId.value === null) {
					c.faction = null
					c.borderColor = null
					c.fillColor = null
				} else {
					c.faction = selectedFactionId.value
				}
			}
			markDirty()
			break
		}
	}
}

function onEdgeClick({ col, row, edge, width }) {
	const key = getCanonicalEdgeKey(col, row, edge)
	if (activeTool.value === 'eraser') {
		delete mapData.value.rivers[key]
		markDirty()
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
		markDirty()
	}
}

function eraseHex(col, row) {
	const k = `${col},${row}`
	if (mapData.value.cells[k]) {
		if (activeTool.value === 'faction') {
			mapData.value.cells[k].faction = null
			mapData.value.cells[k].borderColor = null
			mapData.value.cells[k].fillColor = null
		} else {
			mapData.value.cells[k].settlement = null
			mapData.value.cells[k].feature = 'none'
			mapData.value.cells[k].road = 'none'
			mapData.value.cells[k].faction = null
			mapData.value.cells[k].borderColor = null
			mapData.value.cells[k].fillColor = null
		}
	}
	syncRoadsForCell(mapData.value, col, row)
	markDirty()
}

function onRoadPropertyChange() {
	if (!selectedCell.value) return
	syncRoadsForCell(mapData.value, selectedCell.value.col, selectedCell.value.row)
	markDirty()
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
	markDirty()
}

function openNewMapModal() {
	if (isDirty.value) {
		const confirmed = window.confirm('У вас есть несохранённые изменения. Создать новую карту поверх текущей?')
		if (!confirmed) return
	}
	newMapForm.value = {
		id: `hexmap_${Date.now().toString(36)}`,
		name: 'Новая гексагональная карта',
		cols: 20,
		rows: 15,
		baseTerrain: 'grass'
	}
	showNewModal.value = true
}

function confirmCreateNewMap() {
	const cleanId = (newMapForm.value.id || '').trim().toLowerCase().replace(/[^a-z0-9_-]/gi, '_') || `hexmap_${Date.now().toString(36)}`
	mapData.value = createDefaultHexMap(
		newMapForm.value.cols,
		newMapForm.value.rows,
		newMapForm.value.baseTerrain
	)
	mapData.value.id = cleanId
	mapData.value.name = newMapForm.value.name || cleanId
	mapData.value.pitch = mapPitch.value
	selectedHexCoord.value = null

	const cleanPayload = JSON.parse(JSON.stringify(mapData.value))
	mapCache[cleanId] = cleanPayload

	if (!availableMaps.value.some(m => m.id === cleanId)) {
		availableMaps.value.push({
			id: cleanId,
			name: mapData.value.name
		})
	}
	selectedMapId.value = cleanId
	markDirty()
	showNewModal.value = false
	canvasRef.value?.resetCamera?.()
	showToast(`Создана новая карта: ${mapData.value.name}`, 'info')
}

// Map Resizing System
function openResizeModal() {
	const b = currentMapBounds.value
	resizeForm.value.mode = 'sides'
	resetSideDeltas()
	resizeForm.value.cols = b.cols
	resizeForm.value.rows = b.rows
	resizeForm.value.anchor = 'center'
	resizeForm.value.fillTerrain = 'water'
	showResizeModal.value = true
}

function resetSideDeltas() {
	resizeForm.value.north = 0
	resizeForm.value.south = 0
	resizeForm.value.west = 0
	resizeForm.value.east = 0
}

function stepSideDelta(side, delta) {
	if (typeof resizeForm.value[side] !== 'number') {
		resizeForm.value[side] = 0
	}
	resizeForm.value[side] += delta
}

function setResizePreset(cols, rows) {
	resizeForm.value.cols = cols
	resizeForm.value.rows = rows
}

function stepResize(delta) {
	let nc = (parseInt(resizeForm.value.cols, 10) || 20) + delta
	let nr = (parseInt(resizeForm.value.rows, 10) || 15) + delta
	if (nc < 1) nc = 1
	if (nr < 1) nr = 1
	if (nc > 500) nc = 500
	if (nr > 500) nr = 500
	resizeForm.value.cols = nc
	resizeForm.value.rows = nr
}

function confirmResizeMap() {
	const b = previewResizeBounds.value
	const newMinCol = b.minCol
	const newMaxCol = b.maxCol
	const newMinRow = b.minRow
	const newMaxRow = b.maxRow
	const newCols = b.cols
	const newRows = b.rows

	// 1. Prune cells out of bounds
	const newCells = {}
	for (const [key, cell] of Object.entries(mapData.value.cells || {})) {
		if (cell.col >= newMinCol && cell.col <= newMaxCol && cell.row >= newMinRow && cell.row <= newMaxRow) {
			newCells[key] = cell
		}
	}

	// 2. Prune rivers where both adjacent cells are out of bounds
	const newRivers = {}
	for (const [key, river] of Object.entries(mapData.value.rivers || {})) {
		const neighbor = getHexNeighbor(river.col, river.row, river.edge)
		const selfIn = river.col >= newMinCol && river.col <= newMaxCol && river.row >= newMinRow && river.row <= newMaxRow
		const neighborIn = neighbor.col >= newMinCol && neighbor.col <= newMaxCol && neighbor.row >= newMinRow && neighbor.row <= newMaxRow
		if (selfIn || neighborIn) {
			newRivers[key] = river
		}
	}

	// 3. Prune roads if either end is out of bounds
	const newRoads = {}
	for (const [key, road] of Object.entries(mapData.value.roads || {})) {
		const fromIn = road.from.col >= newMinCol && road.from.col <= newMaxCol && road.from.row >= newMinRow && road.from.row <= newMaxRow
		const toIn = road.to.col >= newMinCol && road.to.col <= newMaxCol && road.to.row >= newMinRow && road.to.row <= newMaxRow
		if (fromIn && toIn) {
			newRoads[key] = road
		}
	}

	// 4. Fill empty cells in new bounds with chosen fillTerrain
	const fillTerrain = resizeForm.value.fillTerrain || 'water'
	for (let c = newMinCol; c <= newMaxCol; c++) {
		for (let r = newMinRow; r <= newMaxRow; r++) {
			const k = `${c},${r}`
			if (!newCells[k]) {
				newCells[k] = {
					col: c,
					row: r,
					terrain: fillTerrain,
					elevation: 0,
					feature: 'none',
					mountainRadius: 1,
					road: 'none',
					faction: null,
					borderColor: null,
					fillColor: null,
					settlement: null
				}
			}
		}
	}

	mapData.value.cells = newCells
	mapData.value.rivers = newRivers
	mapData.value.roads = newRoads
	mapData.value.cols = newCols
	mapData.value.rows = newRows
	mapData.value.bounds = {
		minCol: newMinCol,
		maxCol: newMaxCol,
		minRow: newMinRow,
		maxRow: newMaxRow
	}

	rebuildAllRoadConnections(mapData.value)
	markDirty()
	showResizeModal.value = false
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

// Map Loading, Selection & Saving System (analogous to IsoEditorView)
async function refreshAvailableMaps() {
	if (typeof window !== 'undefined' && window.electronAPI?.dataEditor?.listFiles) {
		try {
			const res = await window.electronAPI.dataEditor.listFiles('hexmaps')
			if (res.success && Array.isArray(res.files)) {
				const jsonFiles = res.files.filter(f => typeof f === 'string' && f.endsWith('.json'))
				for (const file of jsonFiles) {
					const mapId = file.replace(/\.json$/, '')
					if (!availableMaps.value.some(m => m.id === mapId)) {
						let mapName = mapId === 'newworld_hex' ? 'Новый Мир (Тактическая)' : mapId
						try {
							const readRes = await window.electronAPI.dataEditor.readFile(`hexmaps/${file}`)
							if (readRes.success && readRes.data) {
								mapCache[mapId] = readRes.data
								if (readRes.data.name) {
									mapName = readRes.data.name
								}
							}
						} catch (e) {
							console.warn('[HexEditorView] Failed to read map details for', file, e)
						}
						availableMaps.value.push({ id: mapId, name: mapName })
					}
				}
			}
		} catch (err) {
			console.warn('[HexEditorView] Error scanning hexmaps folder:', err)
		}
	}

	// Also discover custom maps from localStorage (for web / dev mode)
	if (typeof localStorage !== 'undefined') {
		for (let i = 0; i < localStorage.length; i++) {
			const k = localStorage.key(i)
			if (k && k.startsWith('hexmap_')) {
				const mapId = k.replace('hexmap_', '')
				if (!availableMaps.value.some(m => m.id === mapId)) {
					try {
						const parsed = JSON.parse(localStorage.getItem(k))
						mapCache[mapId] = parsed
						availableMaps.value.push({
							id: mapId,
							name: parsed.name || mapId
						})
					} catch (e) {}
				}
			}
		}
	}
}

async function loadMapById(mapId) {
	if (!mapId) return
	let rawData = mapCache[mapId]

	if (!rawData && typeof window !== 'undefined' && window.electronAPI?.dataEditor?.readFile) {
		try {
			const res = await window.electronAPI.dataEditor.readFile(`hexmaps/${mapId}.json`)
			if (res.success && res.data) {
				rawData = res.data
				mapCache[mapId] = rawData
			}
		} catch (err) {
			console.error('[HexEditorView] Error reading map from disk:', err)
		}
	}

	if (!rawData && typeof localStorage !== 'undefined') {
		const local = localStorage.getItem(`hexmap_${mapId}`)
		if (local) {
			try {
				rawData = JSON.parse(local)
				mapCache[mapId] = rawData
			} catch (e) {}
		}
	}

	if (!rawData) {
		rawData = await loadHexMap(mapId)
		if (rawData) {
			mapCache[mapId] = rawData
		}
	}

	if (rawData) {
		mapData.value = normalizeHexMapData(JSON.parse(JSON.stringify(rawData)))
		if (!mapData.value.id) {
			mapData.value.id = mapId
		}
		if (mapData.value.pitch) {
			mapPitch.value = mapData.value.pitch
		}
		selectedHexCoord.value = null
		selectedMapId.value = mapId
		isDirty.value = false
		canvasRef.value?.resetCamera?.()
		showToast(`Карта "${mapData.value.name || mapId}" успешно загружена`, 'info')
	} else {
		showToast(`Не удалось загрузить данные карты "${mapId}"`, 'error')
	}
}

async function onLoadSelectedMap() {
	if (isDirty.value) {
		const confirmed = window.confirm('У вас есть несохранённые изменения. Переключить карту без сохранения?')
		if (!confirmed) {
			selectedMapId.value = mapData.value.id || 'newworld_hex'
			return
		}
	}
	await loadMapById(selectedMapId.value)
}

async function saveCurrentMap() {
	if (isSaving.value) return
	isSaving.value = true

	try {
		const mapId = mapData.value.id || selectedMapId.value || 'newworld_hex'
		mapData.value.id = mapId
		if (mapPitch.value) {
			mapData.value.pitch = mapPitch.value
		}

		const payload = JSON.parse(JSON.stringify(mapData.value))
		mapCache[mapId] = payload

		// Update or insert into availableMaps
		const existingItem = availableMaps.value.find(m => m.id === mapId)
		if (existingItem) {
			existingItem.name = mapData.value.name || mapId
		} else {
			availableMaps.value.push({
				id: mapId,
				name: mapData.value.name || mapId
			})
		}
		selectedMapId.value = mapId

		let savedToDisk = false
		if (typeof window !== 'undefined' && window.electronAPI?.dataEditor?.writeFile) {
			const res = await window.electronAPI.dataEditor.writeFile(`hexmaps/${mapId}.json`, payload)
			if (!res.success) {
				throw new Error(res.error || 'Ошибка записи файла на диск')
			}
			savedToDisk = true
		}

		if (typeof localStorage !== 'undefined') {
			try {
				localStorage.setItem(`hexmap_${mapId}`, JSON.stringify(payload))
			} catch (e) {
				console.warn('localStorage save warning:', e)
			}
		}

		isDirty.value = false
		const targetDesc = savedToDisk ? 'на диск (@data/hexmaps/)' : 'в память браузера'
		showToast(`Карта "${mapData.value.name || mapId}" сохранена ${targetDesc}!`, 'success')
	} catch (err) {
		console.error('[HexEditorView] Ошибка сохранения карты:', err)
		showToast(`Ошибка сохранения: ${err.message || err}`, 'error')
	} finally {
		isSaving.value = false
	}
}

function onEditorKeyDown(e) {
	if (e.target && (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA' || e.target.isContentEditable)) {
		return
	}
	if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') {
		e.preventDefault()
		saveCurrentMap()
	}
}

onMounted(async () => {
	window.addEventListener('keydown', onEditorKeyDown)
	const loadedFactions = await loadFactionsData()
	if (loadedFactions && loadedFactions.length > 0) {
		fractionsRaw.value = loadedFactions
	}
	await refreshAvailableMaps()
	await loadMapById(selectedMapId.value)
})

onUnmounted(() => {
	window.removeEventListener('keydown', onEditorKeyDown)
})
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

.editor-btn.__active {
	background: #1e3a5f;
	border-color: #38bdf8;
	color: #38bdf8;
	box-shadow: 0 0 0.4em rgba(56, 189, 248, 0.4);
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

.editor-btn-save {
	background: #059669;
	color: #ffffff;
	font-weight: bold;
	border-color: #10b981;
}

.editor-btn-save:hover {
	background: #10b981;
	color: #ffffff;
	box-shadow: 0 0 0.5em rgba(16, 185, 129, 0.4);
}

.editor-btn-save.__dirty {
	background: #d97706;
	border-color: #f59e0b;
	color: #ffffff;
	box-shadow: 0 0 0.6em rgba(245, 158, 11, 0.4);
}

.editor-btn-save:disabled {
	opacity: 0.6;
	cursor: not-allowed;
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

.faction-palette-grid {
	grid-template-columns: 1fr;
	max-height: 18em;
	overflow-y: auto;
	padding-right: 0.2em;
}

.faction-palette-btn {
	justify-content: flex-start;
}

.faction-swatch {
	width: 1.6em;
	height: 1.6em;
	border-radius: 0.2em;
	border: 1px solid #38bdf8;
	display: flex;
	align-items: center;
	justify-content: center;
	font-size: 0.85em;
	flex-shrink: 0;
}

.neutral-swatch {
	width: 1.6em;
	height: 1.6em;
	display: flex;
	align-items: center;
	justify-content: center;
	font-size: 0.85em;
	flex-shrink: 0;
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

/* Map Title Clickable Badge */
.map-title-clickable {
	cursor: pointer;
	transition: background 0.15s ease;
	padding: 0.2em 0.5em;
	border-radius: 0.3em;
}

.map-title-clickable:hover {
	background: rgba(255, 255, 255, 0.08);
}

/* Resize Modal */
.resize-modal-card {
	width: 44em;
	max-width: 95%;
	max-height: 90%;
	overflow-y: auto;
}

.modal-title-wrap {
	display: flex;
	align-items: center;
	gap: 0.8em;
}

.modal-title-icon {
	font-size: 1.8em;
}

.modal-subtitle {
	font-size: 0.8em;
	color: #94a3b8;
	margin: 0.2em 0 0;
	font-weight: normal;
}

.resize-mode-tabs {
	display: flex;
	gap: 0.6em;
	margin-bottom: 0.6em;
}

.resize-mode-tab {
	flex: 1;
	padding: 0.5em 0.8em;
	border-radius: 0.35em;
	font-size: 0.85em;
	background: rgba(30, 41, 59, 0.7);
	border: 1px solid rgba(255, 255, 255, 0.12);
	color: #cbd5e1;
	cursor: pointer;
	font-family: inherit;
	transition: all 0.15s ease;
}

.resize-mode-tab:hover {
	border-color: #38bdf8;
	color: #ffffff;
}

.resize-mode-tab.__active {
	background: rgba(56, 189, 248, 0.25);
	border-color: #38bdf8;
	color: #ffffff;
	font-weight: bold;
}

.resize-comparison-card {
	background: rgba(15, 23, 42, 0.85);
	border: 1px solid rgba(255, 255, 255, 0.12);
	border-radius: 0.4em;
	padding: 0.6em 0.8em;
	display: flex;
	flex-direction: column;
	gap: 0.4em;
	font-size: 0.85em;
}

.resize-comp-row {
	display: flex;
	align-items: center;
	gap: 0.5em;
}

.resize-comp-label {
	color: #94a3b8;
}

.resize-comp-val {
	color: #e2e8f0;
}

.resize-comp-val.__new {
	color: #38bdf8;
}

.resize-comp-coords {
	color: #64748b;
	font-weight: normal;
	font-size: 0.9em;
}

.resize-comp-hint {
	color: #94a3b8;
	font-size: 0.8em;
	line-height: 1.35;
}

/* Sides Grid Controls */
.resize-sides-grid {
	display: flex;
	flex-direction: column;
	gap: 0.6em;
	align-items: center;
}

.resize-side-card {
	background: rgba(30, 41, 59, 0.6);
	border: 1px solid rgba(255, 255, 255, 0.12);
	border-radius: 0.35em;
	padding: 0.5em 0.8em;
	box-sizing: border-box;
}

.resize-side-north,
.resize-side-south {
	width: 22em;
}

.resize-sides-mid-row {
	display: flex;
	align-items: center;
	justify-content: center;
	gap: 0.8em;
	width: 100%;
}

.resize-side-west,
.resize-side-east {
	flex: 1;
	max-width: 19em;
}

.resize-side-header {
	display: flex;
	align-items: center;
	gap: 0.4em;
	margin-bottom: 0.4em;
}

.resize-side-icon {
	font-size: 1.1em;
}

.resize-side-title {
	font-size: 0.82em;
	color: #e2e8f0;
	flex: 1;
}

.resize-side-delta {
	font-size: 0.82em;
	font-weight: bold;
	color: #94a3b8;
}

.resize-side-delta.__plus {
	color: #4ade80;
}

.resize-side-delta.__minus {
	color: #f87171;
}

.resize-side-controls {
	display: flex;
	justify-content: center;
}

.resize-delta-buttons {
	display: flex;
	align-items: center;
	gap: 0.3em;
}

.side-step-btn {
	background: rgba(51, 65, 85, 0.8);
	border: 1px solid rgba(255, 255, 255, 0.15);
	color: #cbd5e1;
	padding: 0.25em 0.5em;
	border-radius: 0.25em;
	font-size: 0.78em;
	cursor: pointer;
	font-family: inherit;
	transition: all 0.15s ease;
}

.side-step-btn:hover {
	border-color: #38bdf8;
	color: #ffffff;
}

.side-num-input {
	width: 3.5em;
	text-align: center;
	background: rgba(15, 23, 42, 0.9);
	border: 1px solid rgba(255, 255, 255, 0.2);
	border-radius: 0.25em;
	color: #f6c445;
	font-weight: bold;
	padding: 0.2em 0.4em;
	font-size: 0.85em;
}

.resize-center-preview {
	width: 5.5em;
	display: flex;
	flex-direction: column;
	align-items: center;
	gap: 0.3em;
}

.center-origin-badge {
	font-size: 0.75em;
	color: #f6c445;
	font-weight: bold;
}

.center-reset-btn {
	padding: 0.2em 0.5em !important;
	font-size: 0.75em !important;
}

/* Anchor Mode Controls */
.form-row-two {
	display: flex;
	gap: 0.8em;
	margin-bottom: 0.6em;
}

.form-col {
	flex: 1;
	display: flex;
	flex-direction: column;
	gap: 0.2em;
}

.form-sublabel {
	font-size: 0.8em;
	color: #94a3b8;
}

.resize-step-buttons {
	display: flex;
	gap: 0.5em;
	margin-top: 0.3em;
}

.resize-step-buttons .editor-btn {
	flex: 1;
	justify-content: center;
	font-size: 0.8em;
	padding: 0.35em 0.6em;
}

.resize-presets-grid {
	display: grid;
	grid-template-columns: repeat(5, 1fr);
	gap: 0.4em;
	margin-top: 0.3em;
}

.preset-btn {
	background: rgba(30, 41, 59, 0.7);
	border: 1px solid rgba(255, 255, 255, 0.15);
	color: #cbd5e1;
	padding: 0.35em 0.5em;
	border-radius: 0.3em;
	font-size: 0.8em;
	cursor: pointer;
	font-family: inherit;
	text-align: center;
	transition: all 0.15s ease;
}

.preset-btn:hover {
	border-color: #38bdf8;
	color: #ffffff;
}

.preset-btn.__active {
	background: rgba(56, 189, 248, 0.25);
	border-color: #38bdf8;
	color: #ffffff;
	font-weight: bold;
}

.anchor-grid-matrix {
	display: grid;
	grid-template-columns: repeat(3, 1fr);
	gap: 0.4em;
	max-width: 12em;
	margin: 0.3em auto 0;
}

.anchor-btn {
	height: 2.4em;
	display: flex;
	align-items: center;
	justify-content: center;
	font-size: 1.1em;
	background: rgba(30, 41, 59, 0.7);
	border: 1px solid rgba(255, 255, 255, 0.15);
	border-radius: 0.3em;
	color: #cbd5e1;
	cursor: pointer;
	transition: all 0.15s ease;
}

.anchor-btn:hover {
	border-color: #f6c445;
	color: #ffffff;
}

.anchor-btn.__active {
	background: rgba(246, 196, 69, 0.25);
	border-color: #f6c445;
	color: #ffffff;
	font-weight: bold;
}

.resize-shrink-warning {
	background: rgba(239, 68, 68, 0.15);
	border: 1px solid #ef4444;
	border-radius: 0.35em;
	padding: 0.5em 0.8em;
	font-size: 0.82em;
	color: #fca5a5;
	line-height: 1.4;
}

/* Status Toast Notification */
.status-toast {
	position: absolute;
	bottom: 1.5em;
	right: 1.5em;
	display: flex;
	align-items: center;
	gap: 0.6em;
	padding: 0.6em 1em;
	border-radius: 0.45em;
	box-shadow: 0 0.5em 1.5em rgba(0, 0, 0, 0.7);
	z-index: 1000;
	font-size: 0.88em;
	font-weight: 600;
	backdrop-filter: blur(0.3em);
}

.status-toast.__success {
	background: rgba(16, 185, 129, 0.95);
	color: #ffffff;
	border: 1px solid #34d399;
}

.status-toast.__error {
	background: rgba(239, 68, 68, 0.95);
	color: #ffffff;
	border: 1px solid #f87171;
}

.status-toast.__warning {
	background: rgba(245, 158, 11, 0.95);
	color: #0f172a;
	border: 1px solid #fbbf24;
}

.status-toast.__info {
	background: rgba(30, 41, 59, 0.95);
	color: #f1f5f9;
	border: 1px solid rgba(255, 255, 255, 0.2);
}

.toast-enter-active,
.toast-leave-active {
	transition: all 0.25s ease;
}

.toast-enter-from,
.toast-leave-to {
	opacity: 0;
	transform: translateY(1em);
}
</style>
