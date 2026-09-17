<template>
	<div class="char-tester-view">
		<!-- Top Navigation & Toolbar -->
		<header class="tester-header">
			<div class="header-left">
				<button class="nav-btn" @click="returnToTests">
					<span class="btn-arrow">‹</span>
					<span>К тестам</span>
				</button>
				<button
					class="nav-btn __editor-btn"
					title="Перейти к анкете и биометрии этого персонажа в редакторе данных"
					@click="goToDataEditor"
				>
					<span class="btn-icon">📝</span>
					<span>Редактор данных</span>
				</button>

				<div class="header-title-box">
					<span class="header-icon">🎭</span>
					<span class="header-title">Студия спрайтов и риггинга (Live2D-Lite)</span>
				</div>
			</div>

			<!-- Character Selector -->
			<div class="header-char-select">
				<label class="hcs-label">Персонаж:</label>
				<select
					:value="selectedCharacterId"
					class="char-select-dropdown"
					@change="selectCharacter($event.target.value)"
				>
					<option v-for="c in charactersList" :key="c" :value="c">
						{{ c === 'default' ? '⭐ default (Базовый)' : c }}
					</option>
				</select>
			</div>

			<!-- View Mode Tabs (2D Rig vs Isometric) -->
			<div class="header-view-tabs">
				<button
					type="button"
					class="view-tab-btn"
					:class="{ __active: viewMode === 'default' }"
					@click="viewMode = 'default'"
				>
					<span class="vtb-icon">🖼️</span>
					<span>Обычный вид (2D Риг)</span>
				</button>
				<button
					type="button"
					class="view-tab-btn"
					:class="{ __active: viewMode === 'isometric' }"
					@click="viewMode = 'isometric'"
				>
					<span class="vtb-icon">🎲</span>
					<span>Изометрия</span>
				</button>
			</div>

			<!-- Header Actions -->
			<div class="header-right">
				<button
					class="action-btn __save"
					title="Сохранить структуру частей тела в body.json"
					@click="saveBodyJson"
				>
					<span>💾</span>
					<span>Сохранить body.json</span>
				</button>
				<button
					class="action-btn __save-alt"
					title="Сохранить визуальный скейл (size) в values.json"
					@click="saveValuesJson"
				>
					<span>📏</span>
					<span>Сохранить скейл</span>
				</button>
			</div>
		</header>

		<!-- Alert Banner -->
		<Transition name="fade">
			<div v-if="statusMessage" class="status-banner" :class="`__${statusMessage.type}`">
				<span class="status-icon">
					{{ statusMessage.type === 'error' ? '⚠️' : '✔' }}
				</span>
				<span class="status-text">{{ statusMessage.text }}</span>
			</div>
		</Transition>

		<!-- Main Studio Workspace -->
		<div class="studio-workspace">
			<!-- CENTER: Canvas Stage -->
			<div
				class="stage-viewport"
				ref="stageViewportRef"
				:class="{ '__is-panning': isPanningStage }"
				@mousedown="onStageMouseDown"
				@touchstart="onStageTouchStart"
				@wheel.prevent="onStageWheel"
				@dragstart.prevent
				@contextmenu.prevent
			>
				<!-- Stage Toolbar / Overlay Controls -->
				<div class="stage-toolbar">
					<div class="stage-toggles">
						<button
							type="button"
							class="stage-toggle-btn"
							:class="{ __active: showGrid }"
							title="Сетка сцены"
							@click="showGrid = !showGrid"
						>
							<span>📐</span> Сетка
						</button>
						<button
							type="button"
							class="stage-toggle-btn"
							:class="{ __active: showBones }"
							title="Показать скелет, кости и точки вращения (пивоты)"
							@click="showBones = !showBones"
						>
							<span>🦴</span> Скелет
						</button>
						<button
							type="button"
							class="stage-toggle-btn"
							:class="{ __active: showSpriteCenter }"
							title="Показать точки центра спрайтов"
							@click="showSpriteCenter = !showSpriteCenter"
						>
							<span>🎯</span> Центр спрайта
						</button>
						<button
							v-if="showSpriteCenter"
							type="button"
							class="stage-toggle-btn __center-filter-btn"
							:class="{ __active: isCenterPartsModalOpen }"
							title="Выбрать части тела для отображения центра (открыть панель с чекбоксами)"
							@click="isCenterPartsModalOpen = !isCenterPartsModalOpen"
						>
							<span>⚙️</span> Части ({{ visibleCenterParts.length }}/{{
								Object.keys(bodyParts).length
							}})
						</button>
						<button
							type="button"
							class="stage-toggle-btn"
							:class="{ __active: showRuler }"
							title="Шкала роста в сантиметрах"
							@click="showRuler = !showRuler"
						>
							<span>📏</span> Линейка
						</button>
					</div>

					<div class="stage-zoom-controls">
						<button
							type="button"
							class="stage-toggle-btn"
							:class="{ __active: stagePanOffset.x !== 0 || stagePanOffset.y !== 0 }"
							:title="`Текущее смещение сцены: X=${stagePanOffset.x}em, Y=${stagePanOffset.y}em. Нажмите для центрирования.`"
							@click="resetPan"
						>
							<span>🎯</span> Центр
						</button>
						<button type="button" class="zoom-btn" title="Отдалить" @click="zoomOut">
							-
						</button>
						<span class="zoom-val">{{ Math.round(stageZoom * 100) }}%</span>
						<button type="button" class="zoom-btn" title="Приблизить" @click="zoomIn">
							+
						</button>
						<button
							type="button"
							class="zoom-reset-btn"
							title="Сбросить масштаб (100%) и вернуть сцену в центр"
							@click="resetView"
						>
							Сброс
						</button>
					</div>
				</div>

				<!-- Side Drawer Modal for Part Center Filter -->
				<Transition name="slide-left">
					<div
						v-if="showSpriteCenter && isCenterPartsModalOpen"
						class="center-parts-drawer"
						@click.stop
						@mousedown.stop
						@touchstart.stop
					>
						<!-- Drawer Header -->
						<div class="cpd-header">
							<div class="cpd-title-box">
								<span class="cpd-icon">🎯</span>
								<div class="cpd-title-meta">
									<h4 class="cpd-title">Центры частей тела</h4>
									<span class="cpd-subtitle"
										>Выберите части для показа точек</span
									>
								</div>
							</div>
							<button
								type="button"
								class="cpd-close-btn"
								title="Закрыть панель (ESC)"
								@click="isCenterPartsModalOpen = false"
							>
								✕
							</button>
						</div>

						<!-- Quick Action Buttons -->
						<div class="cpd-actions-row">
							<button
								type="button"
								class="cpd-action-btn"
								title="Показать центр у всех частей"
								@click="selectAllCenterParts"
							>
								✓ Все
							</button>
							<button
								type="button"
								class="cpd-action-btn"
								title="Скрыть центр у всех частей"
								@click="deselectAllCenterParts"
							>
								✕ Снять
							</button>
							<button
								type="button"
								class="cpd-action-btn"
								title="Инвертировать выбор"
								@click="invertCenterParts"
							>
								⇄ Инверт
							</button>
						</div>

						<!-- Checkboxes List of Body Parts -->
						<div class="cpd-parts-list">
							<div
								v-for="(part, name) in bodyParts"
								:key="name"
								class="cpd-part-item"
								:class="{
									__checked: visibleCenterParts.includes(name),
									__selected: selectedPartName === name
								}"
								@click="toggleCenterPart(name)"
							>
								<input
									type="checkbox"
									:checked="visibleCenterParts.includes(name)"
									class="cpd-checkbox"
									@click.stop
									@change="toggleCenterPart(name)"
								/>
								<div class="cpd-part-info">
									<span class="cpd-part-name">{{ name }}</span>
									<span v-if="part.parent" class="cpd-part-parent"
										>прикреплён к: <em>{{ part.parent }}</em></span
									>
									<span v-else class="cpd-part-root-tag">⭐ Корень (body)</span>
								</div>
								<button
									type="button"
									class="cpd-inspect-btn"
									title="Выбрать эту часть в риге"
									@click.stop="onPartClick(name)"
								>
									🔍
								</button>
							</div>
						</div>

						<!-- Footer Summary -->
						<div class="cpd-footer">
							<span
								>Точек: <strong>{{ visibleCenterParts.length }}</strong> из
								{{ Object.keys(bodyParts).length }}</span
							>
						</div>
					</div>
				</Transition>

				<!-- ISOMETRIC MODE VIEW -->
				<div
					v-if="viewMode === 'isometric'"
					class="isometric-stage-canvas"
					:style="{
						transform: `translate(${stagePanOffset.x}em, ${stagePanOffset.y}em) scale(${stageZoom})`
					}"
				>
					<div class="iso-tile-ground">
						<!-- Isometric 64x32 diamond tile ground -->
						<div class="iso-diamond-grid"></div>
						<!-- Isometric character sprite -->
						<div
							class="iso-sprite-wrap"
							:class="{ '__flip-x': isoFlipped }"
							:style="{ scale: characterScale }"
						>
							<img
								:src="isometricSpriteSrc"
								class="iso-sprite-img"
								alt="Isometric character"
								draggable="false"
								@error="onIsoImgError"
							/>
						</div>
					</div>

					<div class="iso-controls-panel">
						<span class="icp-label">Спрайт изометрии:</span>
						<code class="icp-path">{{ isometricSpriteSrc }}</code>
						<div class="icp-actions">
							<button
								type="button"
								class="iso-flip-btn"
								:class="{ __active: isoFlipped }"
								@click="isoFlipped = !isoFlipped"
							>
								↔️ Отразить горизонтально
							</button>
						</div>
					</div>
				</div>

				<!-- DEFAULT 2D RIG MODE VIEW -->
				<div
					v-else
					class="stage-canvas-area"
					:class="{ '__with-grid': showGrid }"
					:style="{
						transform: `translate(${stagePanOffset.x}em, ${stagePanOffset.y}em) scale(${stageZoom})`
					}"
				>
					<div class="stage-frame" ref="stageFrameRef">
						<!-- Height Ruler in centimeters -->
						<div v-if="showRuler" class="height-ruler">
							<div
								v-for="h in rulerMarks"
								:key="h"
								class="ruler-mark"
								:class="{ __zero: h === 0 }"
								:style="{ bottom: `${(h / 240) * 100}%` }"
							>
								<span class="mark-line"></span>
								<span class="mark-text">{{ h }} см</span>
							</div>
						</div>

						<!-- Horizontal Center Axis Guide (Vertical line X: 0) -->
						<div v-if="showRuler" class="center-axis-guide">
							<div class="cag-line"></div>
							<div
								class="cag-badge"
								title="Центральная вертикальная ось сцены (X: 0). Показывает центральную линию расположения персонажа в сценах. Выровняйте центр персонажа с помощью смещения X."
							>
								↔️ Ось X: 0
							</div>
						</div>

						<!-- Ground Baseline Guide Line (0 cm Standing / Feet line) -->
						<div v-if="showRuler" class="ground-baseline-guide">
							<div class="gbg-line"></div>
							<div
								class="gbg-badge"
								title="Точка стояния / Уровень земли (0 см). Подгоните подошвы/пятки персонажа точно под эту линию с помощью смещения Y."
							>
								⚓ 0 см (Земля / Стопы)
							</div>
						</div>

						<!-- Target Canonical Height Guide Line (Fixed at character's biological height) -->
						<div
							v-if="showRuler"
							class="target-height-guide"
							:style="{ bottom: `${(baseHeightCm / 240) * 100}%` }"
						>
							<div class="thg-line"></div>
							<div
								class="thg-badge"
								:title="`Канонический рост из биометрии: ${baseHeightCm} см. Подгоните макушку спрайта под эту линию с помощью скейла.`"
							>
								🎯 Целевой рост: {{ baseHeightCm }} см
							</div>
						</div>

						<!-- Character Rig Container -->
						<div
							class="char character-rig-root"
							ref="charRigRef"
							:class="[
								`char-${selectedCharacterId}`,
								`orientation-${orientation === 'inverted' ? 'left' : 'right'}`,
								{ 'char-back': isBackView }
							]"
							:style="{
								transform: `translate(calc(-50% + ${rootOffset.x}%), ${-rootOffset.y}%) scale(${characterScale})`,
								transformOrigin: 'center bottom'
							}"
						>
							<div class="char-body char-body-canvas" ref="charBodyCanvasRef">
								<!-- Recursive Root Sprites via RigPartNode -->
								<template
									v-for="(sprite, name) in spritesByParent[null]"
									:key="name"
								>
									<RigPartNode
										:sprite="sprite"
										:sprite-name="name"
										:character-id="selectedCharacterId"
										:sprites="bodyParts"
										:sprites-by-parent="spritesByParent"
										:selected-part-name="selectedPartName"
										:part-pivots="partPivots"
										:part-rotations="partRotations"
										:eye-offset="eyeLinkedOffset"
										:show-bones="showBones"
										:get-effective-part-image="getEffectivePartImage"
										@select-part="onPartClick"
										@part-loaded="scheduleUpdatePartCenters"
										@part-img-error="onPartImgError($event.event, $event.name)"
									/>
								</template>
							</div>
						</div>

						<!-- Crosshair Sprite Centers Overlay (Top-level, undeformed, 1px crisp crosshairs) -->
						<div
							v-if="showSpriteCenter && viewMode !== 'isometric'"
							class="stage-sprite-centers-layer"
						>
							<div
								v-for="item in partCenters"
								:key="item.name"
								class="rig-part-crosshair"
								:class="{
									__selected: selectedPartName === item.name,
									'__is-root': item.isRoot
								}"
								:style="{
									left: `${item.x}px`,
									top: `${item.y}px`,
									transform: `translate(-50%, -50%) scale(${1 / stageZoom})`
								}"
								:title="item.title"
								@click.stop="onPartClick(item.name)"
							>
								<span class="crosshair-h"></span>
								<span class="crosshair-v"></span>
							</div>
						</div>
					</div>
				</div>
			</div>

			<!-- RIGHT SIDEBAR: Tool Panels & Inspectors -->
			<aside class="studio-sidebar">
				<!-- Sidebar Tabs Switcher -->
				<div class="sidebar-tabs-nav">
					<button
						type="button"
						class="sidebar-tab-btn"
						:class="{ __active: activeSidebarTab === 'rig' }"
						@click="activeSidebarTab = 'rig'"
					>
						<span class="stb-icon">🦴</span>
						<span class="stb-name">Риг и части</span>
					</button>
					<button
						type="button"
						class="sidebar-tab-btn"
						:class="{ __active: activeSidebarTab === 'pose' }"
						@click="activeSidebarTab = 'pose'"
					>
						<span class="stb-icon">💃</span>
						<span class="stb-name">Поза и Анимации</span>
					</button>
					<button
						type="button"
						class="sidebar-tab-btn"
						:class="{ __active: activeSidebarTab === 'emotions' }"
						@click="activeSidebarTab = 'emotions'"
					>
						<span class="stb-icon">👀</span>
						<span class="stb-name">Эмоции и Взгляд</span>
					</button>
					<button
						type="button"
						class="sidebar-tab-btn"
						:class="{ __active: activeSidebarTab === 'view' }"
						@click="activeSidebarTab = 'view'"
					>
						<span class="stb-icon">📏</span>
						<span class="stb-name">Вид и Рост</span>
					</button>
				</div>

				<!-- TAB 1: RIG & PARTS HIERARCHY -->
				<div v-if="activeSidebarTab === 'rig'" class="sidebar-tab-content">
					<!-- Quick Decomposition Action Banner -->
					<div v-if="isSingleSpriteBody" class="decompose-callout-card">
						<div class="dcc-header">
							<span class="dcc-icon">✂️</span>
							<span class="dcc-title">Единый спрайт тела</span>
						</div>
						<p class="dcc-desc">
							Сейчас у этого персонажа только один цельный спрайт. Нажмите кнопку,
							чтобы разделить его на отдельные части тела (голову, руки, туловище).
						</p>
						<button
							type="button"
							class="action-btn __primary"
							@click="decomposeSingleBody"
						>
							⚡ Разделить тело на части
						</button>
					</div>

					<!-- Arm Decomposition helper -->
					<div v-if="canDecomposeArms" class="arm-decompose-box">
						<span class="adb-label">Дробление рук на звенья:</span>
						<div class="adb-buttons">
							<button
								v-if="!bodyParts['arm2_left'] && bodyParts['arm_left']"
								type="button"
								class="split-btn"
								@click="decomposeArm('left')"
							>
								✂️ Разделить левую руку
							</button>
							<button
								v-if="!bodyParts['arm2_right'] && bodyParts['arm_right']"
								type="button"
								class="split-btn"
								@click="decomposeArm('right')"
							>
								✂️ Разделить правую руку
							</button>
						</div>
					</div>

					<!-- Hierarchy Tree Card -->
					<div class="sidebar-section-card">
						<div class="ssc-header">
							<span class="ssc-title">Дерево частей тела (Hierarchy)</span>
							<button
								type="button"
								class="mini-btn"
								@click="isAddingPart = !isAddingPart"
							>
								➕ Добавить часть
							</button>
						</div>

						<!-- Add Part Form -->
						<div v-if="isAddingPart" class="add-part-inline-form">
							<div class="form-row">
								<input
									v-model="newPartName"
									type="text"
									class="studio-input"
									placeholder="Имя части (например: hair, mouth, neck)..."
									@keyup.enter="handleAddNewPart"
								/>
								<select v-model="newPartParent" class="studio-select">
									<option :value="null">Без родителя (Root)</option>
									<option
										v-for="name in Object.keys(bodyParts)"
										:key="name"
										:value="name"
									>
										Крепить к: {{ name }}
									</option>
								</select>
							</div>
							<div class="form-actions">
								<button
									type="button"
									class="action-btn __primary __sm"
									:disabled="!newPartName.trim()"
									@click="handleAddNewPart"
								>
									Добавить
								</button>
								<button
									type="button"
									class="action-btn __secondary __sm"
									@click="isAddingPart = false"
								>
									Отмена
								</button>
							</div>
						</div>

						<!-- Parts List -->
						<div class="parts-hierarchy-list">
							<div
								v-for="(p, name) in bodyParts"
								:key="name"
								class="part-list-item"
								:class="{
									__active: selectedPartName === name,
									'__is-child': Boolean(p.parent)
								}"
								@click="selectedPartName = name"
							>
								<span class="pli-tree-indent">
									{{ p.parent ? '↳' : '•' }}
								</span>
								<span class="pli-name">{{ name }}</span>
								<span v-if="p.parent" class="pli-parent-tag"
									>-> {{ p.parent }}</span
								>
								<span class="pli-zindex">Z: {{ p.zindex }}</span>
								<button
									v-if="name !== 'body'"
									type="button"
									class="pli-delete-btn"
									title="Удалить часть"
									@click.stop="removeBodyPart(name)"
								>
									✕
								</button>
							</div>
						</div>
					</div>

					<!-- Selected Part Inspector -->
					<div v-if="currentPart" class="sidebar-section-card">
						<div class="ssc-header">
							<span class="ssc-title"
								>Инспектор части: <strong>{{ selectedPartName }}</strong></span
							>
						</div>

						<!-- Image Source -->
						<div class="control-field">
							<label class="field-label">Файл спрайта:</label>
							<select
								:value="currentPart.image"
								class="studio-select"
								@change="currentPart.image = $event.target.value"
							>
								<option v-for="img in availableImages" :key="img" :value="img">
									{{ img }}
								</option>
							</select>
							<input
								v-model="currentPart.image"
								type="text"
								class="studio-input __mt"
								placeholder="Или укажите путь к изображению..."
							/>
						</div>

						<!-- Parent Selection -->
						<div class="control-field">
							<label class="field-label">Родительская часть (Parent):</label>
							<select
								v-model="currentPart.parent"
								class="studio-select"
								:disabled="selectedPartName === 'body'"
							>
								<option :value="null">Нет (Корневая часть)</option>
								<option
									v-for="name in Object.keys(bodyParts).filter(
										(k) => k !== selectedPartName
									)"
									:key="name"
									:value="name"
								>
									{{ name }}
								</option>
							</select>
						</div>

						<!-- Z-Index -->
						<div class="control-field">
							<div class="field-label-row">
								<label class="field-label">Порядок наложения (Z-Index):</label>
								<span class="field-val">{{ currentPart.zindex }}</span>
							</div>
							<div class="field-range-row">
								<input
									v-model.number="currentPart.zindex"
									type="range"
									min="-5"
									max="15"
									step="1"
									class="studio-range"
								/>
								<input
									v-model.number="currentPart.zindex"
									type="number"
									class="studio-number-input"
								/>
							</div>
						</div>

						<!-- Offset X & Offset Y -->
						<div class="control-field">
							<div class="field-label-row">
								<label class="field-label"
									>Смещение по горизонтали (Offset X %):</label
								>
								<span class="field-val">{{ currentPart.offset.x }}%</span>
							</div>
							<div class="field-range-row">
								<input
									v-model.number="currentPart.offset.x"
									type="range"
									min="-100"
									max="100"
									step="0.5"
									class="studio-range"
								/>
								<input
									v-model.number="currentPart.offset.x"
									type="number"
									step="0.5"
									class="studio-number-input"
								/>
							</div>
						</div>

						<div class="control-field">
							<div class="field-label-row">
								<label class="field-label"
									>Смещение по вертикали (Offset Y %):</label
								>
								<span class="field-val">{{ currentPart.offset.y }}%</span>
							</div>
							<div class="field-range-row">
								<input
									v-model.number="currentPart.offset.y"
									type="range"
									min="-150"
									max="150"
									step="0.5"
									class="studio-range"
								/>
								<input
									v-model.number="currentPart.offset.y"
									type="number"
									step="0.5"
									class="studio-number-input"
								/>
							</div>
						</div>

						<!-- Pivot Point / Anchor -->
						<div class="control-field">
							<div class="field-label-row">
								<label class="field-label">Точка вращения (Pivot X / Y %):</label>
								<div class="field-label-actions">
									<span class="field-val"
										>{{ currentPivot.x }}%, {{ currentPivot.y }}%</span
									>
									<button
										v-if="currentPivot.x !== 50 || currentPivot.y !== 50"
										type="button"
										class="mini-btn"
										title="Сбросить в центр спрайта (50%, 50%)"
										@click="currentPivot.x = 50; currentPivot.y = 50"
									>
										🎯 В центр
									</button>
								</div>
							</div>
							<div class="dual-range-box">
								<div class="dr-item">
									<span class="dr-tag">X:</span>
									<input
										v-model.number="currentPivot.x"
										type="range"
										min="0"
										max="100"
										class="studio-range"
									/>
								</div>
								<div class="dr-item">
									<span class="dr-tag">Y:</span>
									<input
										v-model.number="currentPivot.y"
										type="range"
										min="0"
										max="100"
										class="studio-range"
									/>
								</div>
							</div>
						</div>
					</div>
				</div>

				<!-- TAB 2: POSING & ANIMATIONS -->
				<div v-else-if="activeSidebarTab === 'pose'" class="sidebar-tab-content">
					<!-- Direct Rotation Slider for Selected Part -->
					<div class="sidebar-section-card">
						<div class="ssc-header">
							<span class="ssc-title"
								>Прямой поворот: <strong>{{ selectedPartName }}</strong></span
							>
							<button
								type="button"
								class="mini-btn"
								@click="partRotations[selectedPartName] = 0"
							>
								Сброс 0°
							</button>
						</div>

						<div class="control-field">
							<div class="field-label-row">
								<label class="field-label">Угол вращения (Degrees):</label>
								<span class="field-val"
									>{{ Math.round(partRotations[selectedPartName] || 0) }}°</span
								>
							</div>
							<div class="field-range-row">
								<input
									v-model.number="partRotations[selectedPartName]"
									type="range"
									min="-180"
									max="180"
									step="1"
									class="studio-range"
								/>
								<input
									v-model.number="partRotations[selectedPartName]"
									type="number"
									class="studio-number-input"
								/>
							</div>
						</div>
					</div>

					<!-- Animation Presets Library -->
					<div class="sidebar-section-card">
						<div class="ssc-header">
							<span class="ssc-title">Библиотека анимаций (Presets)</span>
							<button
								v-if="isPlaying"
								type="button"
								class="mini-btn __stop"
								@click="stopAnimation"
							>
								⏹ Остановить
							</button>
						</div>

						<!-- Playback Speed -->
						<div class="speed-control-row">
							<span class="scr-label">Скорость:</span>
							<div class="scr-buttons">
								<button
									v-for="s in [0.5, 1.0, 1.5, 2.0]"
									:key="s"
									type="button"
									class="speed-btn"
									:class="{ __active: animationSpeed === s }"
									@click="animationSpeed = s"
								>
									{{ s }}x
								</button>
							</div>
						</div>

						<div class="animations-grid">
							<div
								v-for="anim in BUILTIN_ANIMATIONS"
								:key="anim.id"
								class="anim-preset-card"
								:class="{ __playing: isPlaying && activeAnimation === anim.id }"
								@click="playAnimation(anim.id)"
							>
								<div class="apc-top">
									<span class="apc-icon">{{ anim.icon }}</span>
									<span class="apc-name">{{ anim.name }}</span>
									<span
										v-if="isPlaying && activeAnimation === anim.id"
										class="apc-badge"
										>ИГРАЕТ</span
									>
								</div>
								<p class="apc-desc">{{ anim.desc }}</p>
							</div>
						</div>

						<div class="anim-footer-actions">
							<button type="button" class="action-btn __secondary" @click="resetPose">
								🔄 Сбросить всю позу
							</button>
							<button
								type="button"
								class="action-btn __primary"
								@click="exportAnimationToJson(selectedPartName)"
							>
								📋 Экспорт шага VN JSON
							</button>
						</div>
					</div>
				</div>

				<!-- TAB 3: EMOTIONS & EYES -->
				<div v-else-if="activeSidebarTab === 'emotions'" class="sidebar-tab-content">
					<!-- Emotion Selector -->
					<div class="sidebar-section-card">
						<div class="ssc-header">
							<span class="ssc-title">Эмоция персонажа:</span>
							<span class="active-emotion-badge">{{ currentEmotion }}</span>
						</div>

						<div class="emotions-pills-grid">
							<button
								v-for="emo in EMOTIONS_LIST"
								:key="emo.id"
								type="button"
								class="emotion-pill-btn"
								:class="{ __active: currentEmotion === emo.id }"
								@click="setEmotion(emo.id)"
							>
								<span class="epb-icon">{{ emo.icon }}</span>
								<span class="epb-label">{{ emo.label }}</span>
							</button>
						</div>

						<!-- Emotion Sprite Overrides for current emotion -->
						<div v-if="currentEmotion !== 'default'" class="emotion-overrides-box">
							<span class="eob-title"
								>Подмена спрайта для [{{ currentEmotion }}]:</span
							>
							<div class="control-field">
								<label class="field-label">Часть для подмены:</label>
								<select v-model="emotionTargetPart" class="studio-select">
									<option
										v-for="name in Object.keys(bodyParts)"
										:key="name"
										:value="name"
									>
										{{ name }}
									</option>
								</select>
							</div>
							<div class="control-field">
								<label class="field-label">Спрайт для этой эмоции:</label>
								<select
									:value="
										emotionOverrides[currentEmotion]?.[emotionTargetPart] || ''
									"
									class="studio-select"
									@change="
										setEmotionOverride(
											currentEmotion,
											emotionTargetPart,
											$event.target.value
										)
									"
								>
									<option value="">Без подмены (дефолтный спрайт)</option>
									<option v-for="img in availableImages" :key="img" :value="img">
										{{ img }}
									</option>
								</select>
							</div>
						</div>
					</div>

					<!-- Eye Direction Circular Sticker Controller -->
					<div class="sidebar-section-card">
						<div class="ssc-header">
							<span class="ssc-title">Направление глаз (2D Стикер)</span>
						</div>

						<EyeDirectionPad
							:model-value-mode="eyeControlMode"
							:linked-offset="eyeLinkedOffset"
							:left-offset="eyeLeftOffset"
							:right-offset="eyeRightOffset"
							:presets="EYE_PRESETS"
							@update:model-value-mode="eyeControlMode = $event"
							@update:linked-offset="updateLinkedEyeOffset($event.x, $event.y)"
							@update:left-offset="onUpdateLeftEyeOffset"
							@update:right-offset="onUpdateRightEyeOffset"
							@select-preset="applyEyePreset"
						/>
					</div>
				</div>

				<!-- TAB 4: VIEW & SCALE -->
				<div v-else-if="activeSidebarTab === 'view'" class="sidebar-tab-content">
					<!-- Facing Direction & Back View -->
					<div class="sidebar-section-card">
						<div class="ssc-header">
							<span class="ssc-title">Направление и Ракурс</span>
						</div>

						<div class="toggle-buttons-group">
							<label class="tbg-label">Сторона взгляда:</label>
							<div class="tbg-buttons">
								<button
									type="button"
									class="mode-btn"
									:class="{ __active: orientation === 'default' }"
									@click="orientation = 'default'"
								>
									➡️ Дефолтная (Вправо)
								</button>
								<button
									type="button"
									class="mode-btn"
									:class="{ __active: orientation === 'inverted' }"
									@click="orientation = 'inverted'"
								>
									⬅️ Инвертная (Влево)
								</button>
							</div>
						</div>

						<div class="toggle-buttons-group __mt">
							<label class="tbg-label">Вид со спины:</label>
							<div class="tbg-buttons">
								<button
									type="button"
									class="mode-btn"
									:class="{ __active: !isBackView }"
									@click="isBackView = false"
								>
									👤 Спереди (Лицо)
								</button>
								<button
									type="button"
									class="mode-btn"
									:class="{ __active: isBackView }"
									@click="isBackView = true"
								>
									🔙 Со спины (Сзади)
								</button>
							</div>
						</div>
					</div>

					<!-- Standing Point & Root Avatar Offset -->
					<div class="sidebar-section-card">
						<div class="ssc-header">
							<span class="ssc-title"
								>Точка стояния и Смещение аватара (Root Offset)</span
							>
						</div>

						<p class="chic-hint">
							Точка стояния (0 см) находится под пятками персонажа. Из-за прозрачных
							отступов в PNG-файлах спрайты требуют индивидуальной калибровки.
							Настройте вертикальное смещение (Y) для касания пола и горизонтальное
							(X) для центровки.
						</p>

						<!-- X Offset (Horizontal centering) -->
						<div class="control-field">
							<div class="field-label-row">
								<label class="field-label">Смещение X (Центровка по оси):</label>
								<span class="field-val __highlight"
									>{{ rootOffset.x > 0 ? '+' : ''
									}}{{ rootOffset.x.toFixed(2) }}%</span
								>
							</div>
							<div class="field-range-row">
								<input
									v-model.number="rootOffset.x"
									type="range"
									min="-25"
									max="25"
									step="0.05"
									class="studio-range"
								/>
								<input
									v-model.number="rootOffset.x"
									type="number"
									step="0.05"
									min="-50"
									max="50"
									class="studio-number-input __precise"
								/>
							</div>
							<!-- X Steppers -->
							<div class="fine-tune-row __compact">
								<div class="ftr-buttons">
									<button
										type="button"
										class="ftr-btn"
										title="Сместить влево на 1.0%"
										@click="adjustRootOffset('x', -1.0)"
									>
										-1%
									</button>
									<button
										type="button"
										class="ftr-btn"
										title="Сместить влево на 0.2%"
										@click="adjustRootOffset('x', -0.2)"
									>
										-0.2%
									</button>
									<button
										type="button"
										class="ftr-btn __fine"
										title="Сместить влево на 0.05%"
										@click="adjustRootOffset('x', -0.05)"
									>
										-0.05%
									</button>
									<button
										type="button"
										class="ftr-btn __reset"
										title="Сбросить X в 0"
										@click="rootOffset.x = 0"
									>
										0%
									</button>
									<button
										type="button"
										class="ftr-btn __fine"
										title="Сместить вправо на 0.05%"
										@click="adjustRootOffset('x', 0.05)"
									>
										+0.05%
									</button>
									<button
										type="button"
										class="ftr-btn"
										title="Сместить вправо на 0.2%"
										@click="adjustRootOffset('x', 0.2)"
									>
										+0.2%
									</button>
									<button
										type="button"
										class="ftr-btn"
										title="Сместить вправо на 1.0%"
										@click="adjustRootOffset('x', 1.0)"
									>
										+1%
									</button>
								</div>
							</div>
						</div>

						<!-- Y Offset (Vertical / Heel to 0 cm ground line) -->
						<div class="control-field __mt">
							<div class="field-label-row">
								<label class="field-label"
									>Смещение Y (Пятка к отметке 0 см):</label
								>
								<span class="field-val __highlight"
									>{{ rootOffset.y > 0 ? '+' : ''
									}}{{ rootOffset.y.toFixed(2) }}%</span
								>
							</div>
							<div class="field-range-row">
								<input
									v-model.number="rootOffset.y"
									type="range"
									min="-25"
									max="25"
									step="0.05"
									class="studio-range"
								/>
								<input
									v-model.number="rootOffset.y"
									type="number"
									step="0.05"
									min="-50"
									max="50"
									class="studio-number-input __precise"
								/>
							</div>
							<!-- Y Steppers -->
							<div class="fine-tune-row __compact">
								<div class="ftr-buttons">
									<button
										type="button"
										class="ftr-btn"
										title="Опустить на 1.0%"
										@click="adjustRootOffset('y', -1.0)"
									>
										-1%
									</button>
									<button
										type="button"
										class="ftr-btn"
										title="Опустить на 0.2%"
										@click="adjustRootOffset('y', -0.2)"
									>
										-0.2%
									</button>
									<button
										type="button"
										class="ftr-btn __fine"
										title="Опустить на 0.05%"
										@click="adjustRootOffset('y', -0.05)"
									>
										-0.05%
									</button>
									<button
										type="button"
										class="ftr-btn __reset"
										title="Сбросить Y в 0"
										@click="rootOffset.y = 0"
									>
										0%
									</button>
									<button
										type="button"
										class="ftr-btn __fine"
										title="Поднять на 0.05%"
										@click="adjustRootOffset('y', 0.05)"
									>
										+0.05%
									</button>
									<button
										type="button"
										class="ftr-btn"
										title="Поднять на 0.2%"
										@click="adjustRootOffset('y', 0.2)"
									>
										+0.2%
									</button>
									<button
										type="button"
										class="ftr-btn"
										title="Поднять на 1.0%"
										@click="adjustRootOffset('y', 1.0)"
									>
										+1%
									</button>
								</div>
							</div>
						</div>

						<div class="offset-actions-row">
							<button
								type="button"
								class="reset-offset-btn"
								title="Сбросить смещения X и Y в (0, 0)"
								@click="resetRootOffset"
							>
								🔄 Сбросить смещение (0, 0)
							</button>
						</div>
					</div>

					<!-- Visual Scale & Target Height Fit -->
					<div class="sidebar-section-card">
						<div class="ssc-header">
							<span class="ssc-title">Масштабирование визуала (Scale)</span>
						</div>

						<!-- Target Height Information Box -->
						<div class="canonical-height-info-card">
							<div class="chic-left">
								<span class="chic-icon">🎯</span>
								<div class="chic-meta">
									<span class="chic-label">Канонический рост персонажа:</span>
									<strong class="chic-val">{{ baseHeightCm }} см</strong>
								</div>
							</div>
							<button
								type="button"
								class="chic-edit-btn"
								title="Редактировать параметры и рост персонажа во вкладке биометрии"
								@click="goToDataEditor"
							>
								✏️ В биометрию
							</button>
						</div>
						<p class="chic-hint">
							Золотая линия на холсте зафиксирована на отметке
							<strong>{{ baseHeightCm }} см</strong>. Подгоните скейл визуала с
							точностью до тысячных, чтобы спрайт персонажа визуально касался этой
							линии.
						</p>

						<!-- Scale Multiplier with 0.001 precision -->
						<div class="control-field">
							<div class="field-label-row">
								<label class="field-label">Скейл визуала (Scale / Size):</label>
								<span class="field-val __highlight"
									>{{ characterScale.toFixed(3) }}x</span
								>
							</div>
							<div class="field-range-row">
								<input
									v-model.number="characterScale"
									type="range"
									min="0.4"
									max="2.5"
									step="0.001"
									class="studio-range"
								/>
								<input
									v-model.number="characterScale"
									type="number"
									step="0.001"
									min="0.2"
									max="3.0"
									class="studio-number-input __precise"
								/>
							</div>
						</div>

						<!-- Quick Fine-Tuning Steppers -->
						<div class="fine-tune-row">
							<span class="ftr-label">Точная подгонка до тысячных:</span>
							<div class="ftr-buttons">
								<button
									type="button"
									class="ftr-btn"
									title="Уменьшить на 0.05"
									@click="adjustScale(-0.05)"
								>
									-0.05
								</button>
								<button
									type="button"
									class="ftr-btn"
									title="Уменьшить на 0.01"
									@click="adjustScale(-0.01)"
								>
									-0.01
								</button>
								<button
									type="button"
									class="ftr-btn __fine"
									title="Уменьшить на 0.001"
									@click="adjustScale(-0.001)"
								>
									-0.001
								</button>
								<button
									type="button"
									class="ftr-btn __reset"
									title="Сбросить в 1.000"
									@click="characterScale = 1.0"
								>
									1.000
								</button>
								<button
									type="button"
									class="ftr-btn __fine"
									title="Увеличить на 0.001"
									@click="adjustScale(0.001)"
								>
									+0.001
								</button>
								<button
									type="button"
									class="ftr-btn"
									title="Увеличить на 0.01"
									@click="adjustScale(0.01)"
								>
									+0.01
								</button>
								<button
									type="button"
									class="ftr-btn"
									title="Увеличить на 0.05"
									@click="adjustScale(0.05)"
								>
									+0.05
								</button>
							</div>
						</div>

						<!-- Save Scale Button -->
						<div class="save-scale-box">
							<button
								type="button"
								class="action-btn __save-alt __w-full"
								title="Сохранить визуальный скейл (size) и смещение аватара (root_offset) в values.json"
								@click="saveValuesJson"
							>
								<span>💾</span>
								<span>Сохранить скейл и смещение в values.json</span>
							</button>
						</div>
					</div>
				</div>
			</aside>
		</div>
	</div>
</template>

<script setup>
import { ref, computed, onMounted, reactive, onUnmounted, watch } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { useCharacterRigStudio } from '@/composables/useCharacterRigStudio'
import EyeDirectionPad from '@/components/game/characters/EyeDirectionPad.vue'
import RigPartNode from '@/components/game/characters/RigPartNode.vue'

const router = useRouter()
const route = useRoute()
const charRigRef = ref(null)
const charBodyCanvasRef = ref(null)
const stageFrameRef = ref(null)
let charResizeObserver = null
let stageResizeObserver = null
const partCenters = ref([])
let updateCentersRafId = null
let animCentersRafId = null

const {
	charactersList,
	selectedCharacterId,
	statusMessage,
	bodyParts,
	availableImages,
	selectedPartName,
	viewMode,
	orientation,
	isBackView,
	characterScale,
	baseHeightCm,
	effectiveHeightCm,
	rootOffset,
	adjustRootOffset,
	resetRootOffset,
	EMOTIONS_LIST,
	currentEmotion,
	emotionOverrides,
	eyeControlMode,
	eyeLinkedOffset,
	eyeLeftOffset,
	eyeRightOffset,
	EYE_PRESETS,
	partRotations,
	partPivots,
	BUILTIN_ANIMATIONS,
	isPlaying,
	activeAnimation,
	animationSpeed,
	loadCharactersList,
	selectCharacter,
	addBodyPart,
	removeBodyPart,
	decomposeSingleBody,
	decomposeArm,
	applyEyePreset,
	updateLinkedEyeOffset,
	setEmotion,
	setEmotionOverride,
	getEffectivePartImage,
	resetPose,
	playAnimation,
	stopAnimation,
	exportAnimationToJson,
	saveBodyJson,
	saveValuesJson
} = useCharacterRigStudio()

// Viewport & Display state
const stageViewportRef = ref(null)
const stagePanOffset = reactive({ x: 0, y: 0 })
const isPanningStage = ref(false)
let panStartX = 0
let panStartY = 0
let initialPanX = 0
let initialPanY = 0
let panBaseSize = 16
let hasMoved = false
let panRafId = null
let pendingPanX = 0
let pendingPanY = 0

const activeSidebarTab = ref('rig')
const showGrid = ref(true)
const showBones = ref(false)
const showSpriteCenter = ref(true)
const showRuler = ref(true)
const stageZoom = ref(1.0)
const isoFlipped = ref(false)

// Center Points Filter Side Drawer State & Actions
const isCenterPartsModalOpen = ref(false)
const visibleCenterParts = ref([])

watch(
	() => Object.keys(bodyParts),
	(newKeys) => {
		if (newKeys && newKeys.length > 0) {
			// Keep checked parts that still exist in the new character, or check all if newly loaded
			const existingValid = visibleCenterParts.value.filter((k) => newKeys.includes(k))
			if (existingValid.length > 0) {
				visibleCenterParts.value = existingValid
			} else {
				visibleCenterParts.value = [...newKeys]
			}
		} else {
			visibleCenterParts.value = []
		}
	},
	{ immediate: true }
)

function toggleCenterPart(name) {
	const idx = visibleCenterParts.value.indexOf(name)
	if (idx >= 0) {
		visibleCenterParts.value.splice(idx, 1)
	} else {
		visibleCenterParts.value.push(name)
	}
}

function selectAllCenterParts() {
	visibleCenterParts.value = Object.keys(bodyParts)
}

function deselectAllCenterParts() {
	visibleCenterParts.value = []
}

function invertCenterParts() {
	const all = Object.keys(bodyParts)
	visibleCenterParts.value = all.filter((k) => !visibleCenterParts.value.includes(k))
}

function updatePartCenters() {
	if (!showSpriteCenter.value || viewMode.value === 'isometric') {
		if (partCenters.value.length > 0) {
			partCenters.value = []
		}
		return
	}
	if (!stageFrameRef.value || !charBodyCanvasRef.value) {
		return
	}

	const stageRect = stageFrameRef.value.getBoundingClientRect()
	const zoom = stageZoom.value || 1.0

	const newCenters = []
	const targetNames =
		visibleCenterParts.value.length > 0 ? visibleCenterParts.value : Object.keys(bodyParts)

	for (const name of targetNames) {
		const part = bodyParts[name]
		if (!part) continue
		const partEl = charBodyCanvasRef.value.querySelector(`._part-${name}`)
		if (!partEl) continue

		const boxEl = partEl.querySelector('.part-sprite-box') || partEl
		const rect = boxEl.getBoundingClientRect()
		if (rect.width === 0 && rect.height === 0) continue

		// Local coordinates inside stageFrame (counteracting stageZoom)
		const x = (rect.left + rect.width / 2 - stageRect.left) / zoom
		const y = (rect.top + rect.height / 2 - stageRect.top) / zoom

		const isRoot = !part.parent || name === 'body'
		const offsetInfo = isRoot
			? ' [Корень]'
			: ` [offset: X=${part.offset?.x ?? 0}%, Y=${part.offset?.y ?? 0}%]`

		newCenters.push({
			name,
			x: Number(x.toFixed(2)),
			y: Number(y.toFixed(2)),
			isRoot,
			title: `Точка центра: ${name}${offsetInfo}`
		})
	}

	partCenters.value = newCenters
}

function scheduleUpdatePartCenters() {
	if (updateCentersRafId) return
	updateCentersRafId = requestAnimationFrame(() => {
		updateCentersRafId = null
		updatePartCenters()
	})
}

function startAnimCentersLoop() {
	if (animCentersRafId) return
	function loop() {
		if (!isPlaying.value) {
			animCentersRafId = null
			return
		}
		updatePartCenters()
		animCentersRafId = requestAnimationFrame(loop)
	}
	animCentersRafId = requestAnimationFrame(loop)
}

function stopAnimCentersLoop() {
	if (animCentersRafId) {
		cancelAnimationFrame(animCentersRafId)
		animCentersRafId = null
	}
	scheduleUpdatePartCenters()
}

watch(visibleCenterParts, scheduleUpdatePartCenters, { deep: true })
watch(showSpriteCenter, (val) => {
	if (val) {
		scheduleUpdatePartCenters()
	} else {
		partCenters.value = []
	}
})
watch(isPlaying, (playing) => {
	if (playing) {
		startAnimCentersLoop()
	} else {
		stopAnimCentersLoop()
	}
})
watch(selectedCharacterId, () => {
	setTimeout(scheduleUpdatePartCenters, 60)
})
watch(characterScale, scheduleUpdatePartCenters)
watch([() => rootOffset.x, () => rootOffset.y], scheduleUpdatePartCenters)
watch([orientation, isBackView], () => {
	setTimeout(scheduleUpdatePartCenters, 60)
})
watch(partRotations, scheduleUpdatePartCenters, { deep: true })
watch(bodyParts, scheduleUpdatePartCenters, { deep: true })
watch(stageZoom, scheduleUpdatePartCenters)
watch(eyeLinkedOffset, scheduleUpdatePartCenters, { deep: true })
watch(viewMode, (mode) => {
	if (mode === 'isometric') {
		partCenters.value = []
	} else {
		scheduleUpdatePartCenters()
	}
})

function onKeyDown(e) {
	if (e.key === 'Escape' && isCenterPartsModalOpen.value) {
		isCenterPartsModalOpen.value = false
	}
}

function getStageFontSize() {
	if (!stageViewportRef.value) return 16
	return parseFloat(getComputedStyle(stageViewportRef.value).fontSize) || 16
}

function onStageMouseDown(e) {
	if (e.button !== 0 && e.button !== 1 && e.button !== 2) return
	if (
		e.target &&
		e.target.closest &&
		e.target.closest(
			'.stage-toolbar, .iso-controls-panel, .rig-part-crosshair, .center-parts-drawer, button, input, select'
		)
	) {
		return
	}

	isPanningStage.value = true
	hasMoved = false
	panStartX = e.clientX
	panStartY = e.clientY
	initialPanX = stagePanOffset.x
	initialPanY = stagePanOffset.y
	pendingPanX = initialPanX
	pendingPanY = initialPanY
	panBaseSize = getStageFontSize()

	window.addEventListener('mousemove', onStageMouseMove)
	window.addEventListener('mouseup', onStageMouseUp)

	e.preventDefault()
}

function onStageMouseMove(e) {
	if (!isPanningStage.value) return
	const dx = (e.clientX - panStartX) / panBaseSize
	const dy = (e.clientY - panStartY) / panBaseSize

	if (Math.hypot(dx, dy) > 0.15) {
		hasMoved = true
	}

	pendingPanX = Number((initialPanX + dx).toFixed(2))
	pendingPanY = Number((initialPanY + dy).toFixed(2))

	if (!panRafId) {
		panRafId = requestAnimationFrame(() => {
			stagePanOffset.x = pendingPanX
			stagePanOffset.y = pendingPanY
			panRafId = null
		})
	}
}

function onStageMouseUp() {
	isPanningStage.value = false
	if (panRafId) {
		cancelAnimationFrame(panRafId)
		panRafId = null
	}
	stagePanOffset.x = pendingPanX
	stagePanOffset.y = pendingPanY
	window.removeEventListener('mousemove', onStageMouseMove)
	window.removeEventListener('mouseup', onStageMouseUp)
}

function onStageTouchStart(e) {
	if (!e.touches[0]) return
	if (
		e.target &&
		e.target.closest &&
		e.target.closest(
			'.stage-toolbar, .iso-controls-panel, .rig-part-crosshair, .center-parts-drawer, button, input, select'
		)
	) {
		return
	}

	isPanningStage.value = true
	hasMoved = false
	panStartX = e.touches[0].clientX
	panStartY = e.touches[0].clientY
	initialPanX = stagePanOffset.x
	initialPanY = stagePanOffset.y
	pendingPanX = initialPanX
	pendingPanY = initialPanY
	panBaseSize = getStageFontSize()

	window.addEventListener('touchmove', onStageTouchMove, { passive: false })
	window.addEventListener('touchend', onStageTouchEnd)
}

function onStageTouchMove(e) {
	if (!isPanningStage.value || !e.touches[0]) return
	const dx = (e.touches[0].clientX - panStartX) / panBaseSize
	const dy = (e.touches[0].clientY - panStartY) / panBaseSize

	if (Math.hypot(dx, dy) > 0.15) {
		hasMoved = true
	}

	pendingPanX = Number((initialPanX + dx).toFixed(2))
	pendingPanY = Number((initialPanY + dy).toFixed(2))

	if (!panRafId) {
		panRafId = requestAnimationFrame(() => {
			stagePanOffset.x = pendingPanX
			stagePanOffset.y = pendingPanY
			panRafId = null
		})
	}
	e.preventDefault()
}

function onStageTouchEnd() {
	isPanningStage.value = false
	if (panRafId) {
		cancelAnimationFrame(panRafId)
		panRafId = null
	}
	stagePanOffset.x = pendingPanX
	stagePanOffset.y = pendingPanY
	window.removeEventListener('touchmove', onStageTouchMove)
	window.removeEventListener('touchend', onStageTouchEnd)
}

function getZoomStep(zoom) {
	if (zoom >= 5.0) return 0.5
	if (zoom >= 2.0) return 0.25
	return 0.1
}

function onStageWheel(e) {
	const step = getZoomStep(stageZoom.value)
	const delta = e.deltaY < 0 ? step : -step
	stageZoom.value = Math.min(15.0, Math.max(0.2, Number((stageZoom.value + delta).toFixed(2))))
	e.preventDefault()
}

function zoomIn() {
	const step = getZoomStep(stageZoom.value)
	stageZoom.value = Math.min(15.0, Number((stageZoom.value + step).toFixed(2)))
}

function zoomOut() {
	const step = getZoomStep(stageZoom.value - 0.05)
	stageZoom.value = Math.max(0.2, Number((stageZoom.value - step).toFixed(2)))
}

function resetView() {
	stageZoom.value = 1.0
	stagePanOffset.x = 0
	stagePanOffset.y = 0
}

function resetPan() {
	stagePanOffset.x = 0
	stagePanOffset.y = 0
}

function onPartClick(name) {
	if (hasMoved) return
	selectedPartName.value = name
}

function onUpdateLeftEyeOffset(val) {
	if (!val) return
	eyeLeftOffset.x = val.x
	eyeLeftOffset.y = val.y
}

function onUpdateRightEyeOffset(val) {
	if (!val) return
	eyeRightOffset.x = val.x
	eyeRightOffset.y = val.y
}

onUnmounted(() => {
	if (panRafId) {
		cancelAnimationFrame(panRafId)
		panRafId = null
	}
	if (updateCentersRafId) {
		cancelAnimationFrame(updateCentersRafId)
		updateCentersRafId = null
	}
	if (animCentersRafId) {
		cancelAnimationFrame(animCentersRafId)
		animCentersRafId = null
	}
	if (charResizeObserver) {
		charResizeObserver.disconnect()
		charResizeObserver = null
	}
	if (stageResizeObserver) {
		stageResizeObserver.disconnect()
		stageResizeObserver = null
	}
	window.removeEventListener('resize', scheduleUpdatePartCenters)
	window.removeEventListener('mousemove', onStageMouseMove)
	window.removeEventListener('mouseup', onStageMouseUp)
	window.removeEventListener('touchmove', onStageTouchMove)
	window.removeEventListener('touchend', onStageTouchEnd)
	window.removeEventListener('keydown', onKeyDown)
})

// New Part inline form state
const isAddingPart = ref(false)
const newPartName = ref('')
const newPartParent = ref('body')
const emotionTargetPart = ref('head')

const rulerMarks = [0, 30, 60, 90, 120, 150, 175, 200, 220, 240]

const scalePresets = [
	{ label: 'Ребёнок / Гном', val: 0.7 },
	{ label: 'Низкий', val: 0.85 },
	{ label: 'Стандарт', val: 1.0 },
	{ label: 'Высокий', val: 1.15 },
	{ label: 'Великан', val: 1.4 }
]

// Current selected part
const currentPart = computed(() => bodyParts[selectedPartName.value] || null)
const currentPivot = computed(() => {
	if (!partPivots[selectedPartName.value]) {
		partPivots[selectedPartName.value] = { x: 50, y: 50 }
	}
	return partPivots[selectedPartName.value]
})

// Group parts by parent for hierarchy
const spritesByParent = computed(() => {
	const grouped = { null: {} }
	if (!bodyParts) return grouped

	for (const spriteName in bodyParts) {
		const sprite = bodyParts[spriteName]
		const parent = sprite.parent || null
		if (!grouped[parent]) {
			grouped[parent] = {}
		}
	}

	for (const spriteName in bodyParts) {
		const sprite = bodyParts[spriteName]
		const parent = sprite.parent || null
		grouped[parent][spriteName] = sprite
	}

	// Fallback if no parts have parent === null, take the first part
	if (Object.keys(grouped[null]).length === 0 && Object.keys(bodyParts).length > 0) {
		const firstKey = Object.keys(bodyParts)[0]
		grouped[null][firstKey] = bodyParts[firstKey]
	}

	return grouped
})

const updateCharHeight = () => {
	if (charBodyCanvasRef.value && charRigRef.value) {
		const height = charBodyCanvasRef.value.offsetHeight
		charRigRef.value.style.setProperty('--char-height', `${height}px`)
	}
}

const isSingleSpriteBody = computed(() => {
	return Object.keys(bodyParts).length <= 1
})

const canDecomposeArms = computed(() => {
	return (
		(bodyParts['arm_left'] && !bodyParts['arm2_left']) ||
		(bodyParts['arm_right'] && !bodyParts['arm2_right'])
	)
})

// Isometric sprite source path
const isometricSpriteSrc = computed(() => {
	const id = selectedCharacterId.value
	return `images/sprites/characters/${id}/isometric/char.png`
})

function onIsoImgError(e) {
	// Fallback to default isometric sprite
	e.target.src = 'images/sprites/characters/default/isometric/char.png'
}

function onPartImgError(e, partName) {
	// Fallback to default part image if exists
	e.target.src = `images/sprites/characters/default/${partName}.png`
}

function handleAddNewPart() {
	if (!newPartName.value.trim()) return
	addBodyPart(newPartName.value, newPartParent.value)
	newPartName.value = ''
	isAddingPart.value = false
}

function returnToTests() {
	router.push('/home')
}

function goToDataEditor() {
	router.push({
		path: '/editor',
		query: {
			tab: 'characters',
			id: selectedCharacterId.value,
			subtab: 'biometrics'
		}
	})
}

function adjustScale(delta) {
	characterScale.value = Number(
		Math.max(0.2, Math.min(3.0, characterScale.value + delta)).toFixed(3)
	)
}

onMounted(async () => {
	await loadCharactersList()
	const targetChar =
		route.query.character && charactersList.value.includes(route.query.character)
			? route.query.character
			: charactersList.value.includes(selectedCharacterId.value)
				? selectedCharacterId.value
				: 'default'
	await selectCharacter(targetChar)
	updateCharHeight()
	if (charBodyCanvasRef.value) {
		charResizeObserver = new ResizeObserver(() => {
			updateCharHeight()
			scheduleUpdatePartCenters()
		})
		charResizeObserver.observe(charBodyCanvasRef.value)
	}
	if (stageFrameRef.value) {
		stageResizeObserver = new ResizeObserver(() => {
			scheduleUpdatePartCenters()
		})
		stageResizeObserver.observe(stageFrameRef.value)
	}
	window.addEventListener('resize', scheduleUpdatePartCenters)
	window.addEventListener('keydown', onKeyDown)
	scheduleUpdatePartCenters()
})
</script>

<style scoped>
.char-tester-view {
	width: 100%;
	height: 100%;
	display: flex;
	flex-direction: column;
	background: #090d16;
	color: #f1f5f9;
	font-family: Kurale, sans-serif;
	font-size: calc(1 * var(--size));
	overflow: hidden;
	position: absolute;
	inset: 0;
}

/* Header */
.tester-header {
	height: 3.5em;
	background: rgba(14, 20, 32, 0.95);
	border-bottom: 1px solid rgba(246, 196, 69, 0.25);
	display: flex;
	align-items: center;
	justify-content: space-between;
	padding: 0 1.2em;
	gap: 1em;
	flex-shrink: 0;
	z-index: 10;
}

.header-left {
	display: flex;
	align-items: center;
	gap: 0.8em;
}

.nav-btn {
	background: rgba(255, 255, 255, 0.08);
	border: 1px solid rgba(255, 255, 255, 0.15);
	color: #cbd5e1;
	border-radius: 0.35em;
	padding: 0.3em 0.7em;
	font-size: 0.85em;
	cursor: pointer;
	display: flex;
	align-items: center;
	gap: 0.3em;
	transition: all 0.2s;
}

.nav-btn:hover {
	background: rgba(246, 196, 69, 0.2);
	border-color: #f6c445;
	color: #f6c445;
}

.nav-btn.__editor-btn {
	background: rgba(59, 130, 246, 0.15);
	border-color: rgba(96, 165, 250, 0.4);
	color: #93c5fd;
}

.nav-btn.__editor-btn:hover {
	background: rgba(59, 130, 246, 0.3);
	border-color: #60a5fa;
	color: #ffffff;
}

.btn-arrow {
	font-size: 1.2em;
	line-height: 1;
}

.header-title-box {
	display: flex;
	align-items: center;
	gap: 0.5em;
}

.header-icon {
	font-size: 1.3em;
}

.header-title {
	font-size: 1.05em;
	font-weight: bold;
	color: #f6c445;
}

.header-char-select {
	display: flex;
	align-items: center;
	gap: 0.5em;
}

.hcs-label {
	font-size: 0.85em;
	color: #94a3b8;
}

.char-select-dropdown {
	background: rgba(20, 28, 45, 0.9);
	border: 1px solid rgba(246, 196, 69, 0.4);
	color: #f6c445;
	border-radius: 0.35em;
	padding: 0.3em 0.8em;
	font-size: 0.88em;
	font-family: inherit;
	cursor: pointer;
}

.header-view-tabs {
	display: flex;
	background: rgba(0, 0, 0, 0.35);
	border: 1px solid rgba(255, 255, 255, 0.1);
	border-radius: 0.4em;
	padding: 0.15em;
	gap: 0.2em;
}

.view-tab-btn {
	background: transparent;
	border: none;
	color: #94a3b8;
	padding: 0.3em 0.8em;
	border-radius: 0.3em;
	font-size: 0.82em;
	cursor: pointer;
	display: flex;
	align-items: center;
	gap: 0.4em;
	transition: all 0.2s;
}

.view-tab-btn:hover {
	color: #fff;
}

.view-tab-btn.__active {
	background: rgba(246, 196, 69, 0.25);
	color: #f6c445;
	font-weight: bold;
}

.header-right {
	display: flex;
	gap: 0.5em;
}

.action-btn {
	border-radius: 0.35em;
	padding: 0.35em 0.8em;
	font-size: 0.85em;
	font-family: inherit;
	cursor: pointer;
	display: flex;
	align-items: center;
	gap: 0.4em;
	transition: all 0.2s;
}

.action-btn.__save {
	background: linear-gradient(135deg, #f6c445 0%, #d49a1d 100%);
	color: #0b111e;
	border: 1px solid #f6c445;
	font-weight: bold;
}

.action-btn.__save:hover {
	filter: brightness(1.1);
	box-shadow: 0 0.2em 0.8em rgba(246, 196, 69, 0.4);
}

.action-btn.__save-alt {
	background: rgba(255, 255, 255, 0.08);
	border: 1px solid rgba(255, 255, 255, 0.2);
	color: #e2e8f0;
}

.action-btn.__save-alt:hover {
	background: rgba(255, 255, 255, 0.15);
}

.action-btn.__primary {
	background: #f6c445;
	color: #0b111e;
	border: none;
	font-weight: bold;
}

.action-btn.__secondary {
	background: rgba(255, 255, 255, 0.08);
	border: 1px solid rgba(255, 255, 255, 0.18);
	color: #e2e8f0;
}

.action-btn.__sm {
	padding: 0.2em 0.6em;
	font-size: 0.8em;
}

/* Status Alert */
.status-banner {
	position: absolute;
	top: 4em;
	left: 50%;
	transform: translateX(-50%);
	z-index: 100;
	background: rgba(14, 20, 32, 0.95);
	border: 1px solid #f6c445;
	border-radius: 0.4em;
	padding: 0.5em 1.2em;
	display: flex;
	align-items: center;
	gap: 0.6em;
	box-shadow: 0 0.4em 1.2em rgba(0, 0, 0, 0.6);
}

.status-banner.__error {
	border-color: #ef4444;
	color: #fca5a5;
}

/* Studio Workspace Layout */
.studio-workspace {
	flex: 1;
	display: flex;
	overflow: hidden;
	position: relative;
}

/* CENTER STAGE */
.stage-viewport {
	flex: 1;
	position: relative;
	background: radial-gradient(circle at center, #141c2e 0%, #080c14 100%);
	display: flex;
	flex-direction: column;
	overflow: hidden;
	cursor: grab;
	user-select: none;
}

.stage-viewport.__is-panning {
	cursor: grabbing;
}

.stage-toolbar {
	height: 2.6em;
	background: rgba(10, 15, 24, 0.6);
	border-bottom: 1px solid rgba(255, 255, 255, 0.07);
	display: flex;
	justify-content: space-between;
	align-items: center;
	padding: 0 1em;
	z-index: 5;
	cursor: default;
}

.stage-toggles {
	display: flex;
	gap: 0.4em;
}

.stage-toggle-btn {
	background: rgba(255, 255, 255, 0.05);
	border: 1px solid rgba(255, 255, 255, 0.12);
	color: #94a3b8;
	border-radius: 0.3em;
	padding: 0.2em 0.6em;
	font-size: 0.78em;
	cursor: pointer;
}

.stage-toggle-btn.__active {
	background: rgba(246, 196, 69, 0.2);
	border-color: #f6c445;
	color: #f6c445;
}

.stage-toggle-btn.__center-filter-btn {
	background: rgba(16, 185, 129, 0.12);
	border-color: rgba(16, 185, 129, 0.4);
	color: #6ee7b7;
	font-family: monospace;
}

.stage-toggle-btn.__center-filter-btn:hover {
	background: rgba(16, 185, 129, 0.25);
	border-color: #10b981;
	color: #ffffff;
}

.stage-toggle-btn.__center-filter-btn.__active {
	background: #047857;
	border-color: #34d399;
	color: #ffffff;
	box-shadow: 0 0 0.5em rgba(52, 211, 153, 0.4);
}

.stage-zoom-controls {
	display: flex;
	align-items: center;
	gap: 0.3em;
}

.zoom-btn {
	background: rgba(255, 255, 255, 0.08);
	border: 1px solid rgba(255, 255, 255, 0.15);
	color: #fff;
	width: 1.8em;
	height: 1.8em;
	border-radius: 0.25em;
	cursor: pointer;
}

.zoom-val {
	font-size: 0.8em;
	color: #94a3b8;
	min-width: 3.6em;
	text-align: center;
}

.zoom-reset-btn {
	background: transparent;
	border: 1px solid rgba(255, 255, 255, 0.15);
	color: #94a3b8;
	border-radius: 0.25em;
	padding: 0.15em 0.4em;
	font-size: 0.72em;
	cursor: pointer;
}

/* Canvas Area */
.stage-canvas-area {
	flex: 1;
	position: relative;
	display: flex;
	align-items: center;
	justify-content: center;
}

.stage-canvas-area.__with-grid {
	background-size: 2em 2em;
	background-image:
		linear-gradient(to right, rgba(255, 255, 255, 0.03) 1px, transparent 1px),
		linear-gradient(to bottom, rgba(255, 255, 255, 0.03) 1px, transparent 1px);
}

/* Stage Frame & Coordinate Reference Guides */
.stage-frame {
	position: absolute;
	inset: 2.5em 2em 3.5em 2em;
	pointer-events: none;
}

/* Height Ruler */
.height-ruler {
	position: absolute;
	left: 0;
	top: 0;
	bottom: 0;
	width: 4.5em;
	border-right: 1px dashed rgba(255, 255, 255, 0.2);
	pointer-events: none;
}

.ruler-mark {
	position: absolute;
	right: 0;
	display: flex;
	align-items: center;
	gap: 0.4em;
	transform: translateY(50%);
}

.mark-line {
	width: 0.8em;
	height: 0.06em;
	background: rgba(255, 255, 255, 0.3);
}

.mark-text {
	font-size: 0.7em;
	color: #94a3b8;
	font-family: monospace;
}

.ruler-mark.__zero .mark-line {
	background: #38bdf8;
	width: 1.2em;
	height: 0.1em;
	box-shadow: 0 0 0.4em rgba(56, 189, 248, 0.6);
}

.ruler-mark.__zero .mark-text {
	color: #38bdf8;
	font-weight: bold;
}

/* Horizontal Center Axis Guide (Vertical Line X: 0) */
.center-axis-guide {
	position: absolute;
	left: 50%;
	top: 0;
	bottom: 0;
	display: flex;
	flex-direction: column;
	align-items: center;
	pointer-events: none;
	z-index: 11;
	transform: translateX(-50%);
}

.cag-line {
	width: 0.06em;
	flex: 1;
	background: linear-gradient(
		to bottom,
		rgba(168, 85, 247, 0.75),
		rgba(168, 85, 247, 0.25) 80%,
		transparent
	);
	box-shadow: 0 0 0.4em rgba(168, 85, 247, 0.4);
}

.cag-badge {
	position: absolute;
	top: -1.6em;
	background: #9333ea;
	color: #ffffff;
	font-size: 0.7em;
	font-weight: bold;
	padding: 0.15em 0.45em;
	border-radius: 0.3em;
	box-shadow: 0 0 0.5em rgba(168, 85, 247, 0.4);
	white-space: nowrap;
}

/* Ground Baseline Guide (0 cm Standing / Feet Line) */
.ground-baseline-guide {
	position: absolute;
	left: 0;
	right: 0;
	bottom: 0;
	display: flex;
	align-items: center;
	pointer-events: none;
	z-index: 12;
	transform: translateY(50%);
}

.gbg-line {
	flex: 1;
	height: 0.08em;
	background: linear-gradient(
		to right,
		rgba(56, 189, 248, 0.9),
		rgba(56, 189, 248, 0.4) 60%,
		rgba(56, 189, 248, 0.1) 90%,
		transparent
	);
	box-shadow: 0 0 0.5em rgba(56, 189, 248, 0.5);
}

.gbg-badge {
	order: -1;
	background: #0284c7;
	color: #ffffff;
	font-size: 0.72em;
	font-weight: bold;
	padding: 0.15em 0.5em;
	border-radius: 0.3em;
	box-shadow: 0 0 0.6em rgba(56, 189, 248, 0.4);
	white-space: nowrap;
	margin-right: 0.5em;
	letter-spacing: 0.02em;
}

/* Target Canonical Height Guide */
.target-height-guide {
	position: absolute;
	left: 0;
	right: 0;
	display: flex;
	align-items: center;
	pointer-events: none;
	z-index: 10;
	transform: translateY(50%);
}

.thg-line {
	flex: 1;
	height: 0.06em;
	background: linear-gradient(
		to right,
		rgba(246, 196, 69, 0.85),
		rgba(246, 196, 69, 0.2) 80%,
		transparent
	);
	box-shadow: 0 0 0.4em rgba(246, 196, 69, 0.4);
}

.thg-badge {
	order: -1;
	background: #f6c445;
	color: #0b111e;
	font-size: 0.72em;
	font-weight: bold;
	padding: 0.15em 0.5em;
	border-radius: 0.3em;
	box-shadow: 0 0 0.6em rgba(246, 196, 69, 0.5);
	white-space: nowrap;
	margin-right: 0.5em;
}

/* Character 2D Rigging Hierarchy Rendering */
.character-rig-root {
	position: absolute !important;
	bottom: 0 !important;
	left: 50% !important;
	height: 72.917% !important;
	width: fit-content !important;
	right: auto !important;
	top: auto !important;
	margin: 0 !important;
	display: flex;
	align-items: flex-end;
	justify-content: center;
	pointer-events: auto;
}

.char-body-canvas {
	position: relative;
	height: 100%;
	width: fit-content;
}

/* Sprite Centers Crosshair Overlay */
.stage-sprite-centers-layer {
	position: absolute;
	inset: 0;
	pointer-events: none;
	z-index: 50;
}

.rig-part-crosshair {
	position: absolute;
	width: 0.9em;
	height: 0.9em;
	pointer-events: auto;
	cursor: pointer;
	display: flex;
	align-items: center;
	justify-content: center;
	transition: filter 0.15s ease;
}

.crosshair-h {
	position: absolute;
	left: 0;
	right: 0;
	top: 50%;
	border-top: 1px solid #10b981;
	transform: translateY(-50%);
	pointer-events: none;
	filter: drop-shadow(0 0 0.06em rgba(0, 0, 0, 0.95));
	transition:
		border-color 0.15s ease,
		box-shadow 0.15s ease;
}

.crosshair-v {
	position: absolute;
	top: 0;
	bottom: 0;
	left: 50%;
	border-left: 1px solid #10b981;
	transform: translateX(-50%);
	pointer-events: none;
	filter: drop-shadow(0 0 0.06em rgba(0, 0, 0, 0.95));
	transition:
		border-color 0.15s ease,
		box-shadow 0.15s ease;
}

.rig-part-crosshair:hover .crosshair-h,
.rig-part-crosshair:hover .crosshair-v {
	border-color: #f6c445;
	filter: drop-shadow(0 0 0.08em rgba(246, 196, 69, 0.9)) drop-shadow(0 0 0.04em #000000);
}

.rig-part-crosshair.__selected .crosshair-h,
.rig-part-crosshair.__selected .crosshair-v {
	border-color: #06b6d4;
	filter: drop-shadow(0 0 0.08em rgba(6, 182, 212, 0.95)) drop-shadow(0 0 0.04em #000000);
}

/* Isometric Stage */
.isometric-stage-canvas {
	flex: 1;
	display: flex;
	flex-direction: column;
	align-items: center;
	justify-content: center;
	position: relative;
}

.iso-tile-ground {
	width: 14em;
	height: 7em;
	position: relative;
	display: flex;
	align-items: center;
	justify-content: center;
}

.iso-diamond-grid {
	position: absolute;
	inset: 0;
	border: 2px solid rgba(246, 196, 69, 0.4);
	background: radial-gradient(circle, rgba(246, 196, 69, 0.1) 0%, rgba(30, 41, 59, 0.4) 100%);
	transform: rotateX(60deg) rotateZ(45deg);
	border-radius: 0.4em;
	box-shadow: 0 1em 2em rgba(0, 0, 0, 0.6);
}

.iso-sprite-wrap {
	position: absolute;
	bottom: 2.5em;
	display: flex;
	align-items: flex-end;
	justify-content: center;
	transform-origin: bottom center;
}

.iso-sprite-wrap.__flip-x {
	transform: scaleX(-1);
}

.iso-sprite-img {
	height: 10em;
	width: auto;
	filter: drop-shadow(0 0.4em 0.8em rgba(0, 0, 0, 0.7));
	pointer-events: none;
	-webkit-user-drag: none;
	user-select: none;
}

.iso-controls-panel {
	position: absolute;
	bottom: 2em;
	background: rgba(14, 20, 32, 0.85);
	border: 1px solid rgba(255, 255, 255, 0.12);
	border-radius: 0.5em;
	padding: 0.8em 1.2em;
	display: flex;
	flex-direction: column;
	align-items: center;
	gap: 0.5em;
}

.icp-label {
	font-size: 0.8em;
	color: #94a3b8;
}

.icp-path {
	font-size: 0.75em;
	color: #f6c445;
	background: rgba(0, 0, 0, 0.4);
	padding: 0.2em 0.5em;
	border-radius: 0.3em;
}

.iso-flip-btn {
	background: rgba(255, 255, 255, 0.08);
	border: 1px solid rgba(255, 255, 255, 0.18);
	color: #cbd5e1;
	border-radius: 0.3em;
	padding: 0.3em 0.8em;
	font-size: 0.8em;
	cursor: pointer;
}

.iso-flip-btn.__active {
	border-color: #f6c445;
	color: #f6c445;
}

/* SIDEBAR */
.studio-sidebar {
	width: 25em;
	background: rgba(14, 20, 32, 0.96);
	border-left: 1px solid rgba(255, 255, 255, 0.1);
	display: flex;
	flex-direction: column;
	flex-shrink: 0;
	z-index: 10;
}

.sidebar-tabs-nav {
	display: grid;
	grid-template-columns: repeat(4, 1fr);
	background: rgba(10, 14, 22, 0.8);
	border-bottom: 1px solid rgba(255, 255, 255, 0.08);
}

.sidebar-tab-btn {
	background: transparent;
	border: none;
	border-bottom: 2px solid transparent;
	color: #94a3b8;
	padding: 0.7em 0.3em;
	display: flex;
	flex-direction: column;
	align-items: center;
	gap: 0.25em;
	cursor: pointer;
	transition: all 0.2s;
}

.sidebar-tab-btn:hover {
	color: #cbd5e1;
	background: rgba(255, 255, 255, 0.03);
}

.sidebar-tab-btn.__active {
	color: #f6c445;
	border-bottom-color: #f6c445;
	background: rgba(246, 196, 69, 0.06);
	font-weight: bold;
}

.stb-icon {
	font-size: 1.1em;
}

.stb-name {
	font-size: 0.7em;
	white-space: nowrap;
}

.sidebar-tab-content {
	flex: 1;
	overflow-y: auto;
	padding: 0.9em;
	display: flex;
	flex-direction: column;
	gap: 0.9em;
}

/* Section Cards */
.sidebar-section-card {
	background: rgba(20, 28, 44, 0.75);
	border: 1px solid rgba(255, 255, 255, 0.1);
	border-radius: 0.5em;
	padding: 0.8em;
	display: flex;
	flex-direction: column;
	gap: 0.7em;
}

.ssc-header {
	display: flex;
	justify-content: space-between;
	align-items: center;
	border-bottom: 1px solid rgba(255, 255, 255, 0.06);
	padding-bottom: 0.4em;
}

.ssc-title {
	font-size: 0.85em;
	color: #cbd5e1;
}

.mini-btn {
	background: rgba(255, 255, 255, 0.08);
	border: 1px solid rgba(255, 255, 255, 0.15);
	color: #cbd5e1;
	border-radius: 0.25em;
	padding: 0.2em 0.5em;
	font-size: 0.72em;
	cursor: pointer;
}

.mini-btn:hover {
	background: rgba(246, 196, 69, 0.2);
	border-color: #f6c445;
	color: #f6c445;
}

.mini-btn.__stop {
	border-color: #ef4444;
	color: #ef4444;
}

/* Decomposition cards */
.decompose-callout-card {
	background: linear-gradient(135deg, rgba(246, 196, 69, 0.12) 0%, rgba(20, 28, 44, 0.85) 100%);
	border: 1px solid rgba(246, 196, 69, 0.35);
	border-radius: 0.5em;
	padding: 0.8em;
	display: flex;
	flex-direction: column;
	gap: 0.5em;
}

.dcc-header {
	display: flex;
	align-items: center;
	gap: 0.4em;
	color: #f6c445;
	font-size: 0.88em;
	font-weight: bold;
}

.dcc-desc {
	font-size: 0.78em;
	color: #cbd5e1;
	line-height: 1.4;
	margin: 0;
}

.arm-decompose-box {
	background: rgba(255, 255, 255, 0.04);
	border: 1px dashed rgba(255, 255, 255, 0.15);
	border-radius: 0.4em;
	padding: 0.6em;
	display: flex;
	flex-direction: column;
	gap: 0.4em;
}

.adb-label {
	font-size: 0.78em;
	color: #94a3b8;
}

.adb-buttons {
	display: flex;
	gap: 0.4em;
}

.split-btn {
	background: rgba(246, 196, 69, 0.15);
	border: 1px solid rgba(246, 196, 69, 0.3);
	color: #f6c445;
	border-radius: 0.3em;
	padding: 0.3em 0.6em;
	font-size: 0.75em;
	cursor: pointer;
}

/* Parts Hierarchy List */
.parts-hierarchy-list {
	display: flex;
	flex-direction: column;
	gap: 0.3em;
	max-height: 12em;
	overflow-y: auto;
}

.part-list-item {
	display: flex;
	align-items: center;
	gap: 0.4em;
	background: rgba(255, 255, 255, 0.04);
	border: 1px solid rgba(255, 255, 255, 0.08);
	border-radius: 0.3em;
	padding: 0.3em 0.5em;
	cursor: pointer;
	font-size: 0.8em;
	transition: all 0.15s;
}

.part-list-item:hover {
	background: rgba(255, 255, 255, 0.08);
}

.part-list-item.__active {
	background: rgba(246, 196, 69, 0.2);
	border-color: #f6c445;
	color: #f6c445;
}

.part-list-item.__is-child {
	margin-left: 0.8em;
}

.pli-tree-indent {
	color: #94a3b8;
}

.pli-name {
	font-weight: bold;
	flex: 1;
}

.pli-parent-tag {
	font-size: 0.75em;
	color: #94a3b8;
}

.pli-zindex {
	font-size: 0.75em;
	color: #94a3b8;
	font-family: monospace;
}

.pli-delete-btn {
	background: transparent;
	border: none;
	color: #ef4444;
	cursor: pointer;
	font-size: 0.8em;
	padding: 0 0.2em;
}

/* Form Controls */
.control-field {
	display: flex;
	flex-direction: column;
	gap: 0.3em;
}

.field-label {
	font-size: 0.78em;
	color: #94a3b8;
}

.field-label-row {
	display: flex;
	justify-content: space-between;
	align-items: center;
}

.field-val {
	font-size: 0.78em;
	color: #f6c445;
	font-family: monospace;
}

.field-label-actions {
	display: flex;
	align-items: center;
	gap: 0.5em;
}

.field-range-row {
	display: flex;
	align-items: center;
	gap: 0.5em;
}

.studio-input,
.studio-select {
	background: rgba(12, 17, 27, 0.85);
	border: 1px solid rgba(255, 255, 255, 0.15);
	color: #e2e8f0;
	border-radius: 0.3em;
	padding: 0.35em 0.6em;
	font-size: 0.82em;
	font-family: inherit;
	width: 100%;
}

.studio-input.__mt {
	margin-top: 0.3em;
}

.studio-input:focus,
.studio-select:focus {
	outline: none;
	border-color: #f6c445;
}

.studio-range {
	flex: 1;
	accent-color: #f6c445;
}

.studio-number-input {
	width: 4em;
	background: rgba(12, 17, 27, 0.85);
	border: 1px solid rgba(255, 255, 255, 0.15);
	color: #f6c445;
	border-radius: 0.3em;
	padding: 0.2em 0.4em;
	font-size: 0.8em;
	text-align: right;
}

.dual-range-box {
	display: flex;
	gap: 0.6em;
}

.dr-item {
	flex: 1;
	display: flex;
	align-items: center;
	gap: 0.3em;
}

.dr-tag {
	font-size: 0.75em;
	color: #94a3b8;
}

/* Animations List */
.speed-control-row {
	display: flex;
	align-items: center;
	justify-content: space-between;
}

.scr-label {
	font-size: 0.78em;
	color: #94a3b8;
}

.scr-buttons {
	display: flex;
	gap: 0.3em;
}

.speed-btn {
	background: rgba(255, 255, 255, 0.06);
	border: 1px solid rgba(255, 255, 255, 0.12);
	color: #cbd5e1;
	border-radius: 0.25em;
	padding: 0.15em 0.5em;
	font-size: 0.75em;
	cursor: pointer;
}

.speed-btn.__active {
	background: rgba(246, 196, 69, 0.25);
	border-color: #f6c445;
	color: #f6c445;
	font-weight: bold;
}

.animations-grid {
	display: grid;
	grid-template-columns: 1fr;
	gap: 0.4em;
}

.anim-preset-card {
	background: rgba(255, 255, 255, 0.04);
	border: 1px solid rgba(255, 255, 255, 0.08);
	border-radius: 0.35em;
	padding: 0.5em 0.7em;
	cursor: pointer;
	transition: all 0.2s;
}

.anim-preset-card:hover {
	background: rgba(255, 255, 255, 0.08);
	border-color: rgba(246, 196, 69, 0.3);
}

.anim-preset-card.__playing {
	background: rgba(246, 196, 69, 0.15);
	border-color: #f6c445;
}

.apc-top {
	display: flex;
	align-items: center;
	gap: 0.4em;
}

.apc-icon {
	font-size: 1.1em;
}

.apc-name {
	font-size: 0.82em;
	font-weight: bold;
	color: #e2e8f0;
	flex: 1;
}

.apc-badge {
	font-size: 0.65em;
	background: #f6c445;
	color: #0b111e;
	padding: 0.1em 0.4em;
	border-radius: 0.2em;
	font-weight: bold;
}

.apc-desc {
	font-size: 0.72em;
	color: #94a3b8;
	margin: 0.2em 0 0 0;
}

.anim-footer-actions {
	display: flex;
	gap: 0.5em;
	margin-top: 0.4em;
}

/* Emotions */
.emotions-pills-grid {
	display: grid;
	grid-template-columns: repeat(2, 1fr);
	gap: 0.4em;
}

.emotion-pill-btn {
	display: flex;
	align-items: center;
	gap: 0.4em;
	background: rgba(255, 255, 255, 0.04);
	border: 1px solid rgba(255, 255, 255, 0.1);
	border-radius: 0.35em;
	padding: 0.35em 0.5em;
	cursor: pointer;
	font-size: 0.75em;
	color: #cbd5e1;
	transition: all 0.15s;
}

.emotion-pill-btn:hover {
	background: rgba(255, 255, 255, 0.08);
}

.emotion-pill-btn.__active {
	background: rgba(246, 196, 69, 0.2);
	border-color: #f6c445;
	color: #f6c445;
	font-weight: bold;
}

.active-emotion-badge {
	font-size: 0.75em;
	color: #f6c445;
	background: rgba(246, 196, 69, 0.15);
	padding: 0.1em 0.5em;
	border-radius: 0.3em;
}

.emotion-overrides-box {
	background: rgba(255, 255, 255, 0.03);
	border: 1px dashed rgba(246, 196, 69, 0.3);
	border-radius: 0.4em;
	padding: 0.6em;
	display: flex;
	flex-direction: column;
	gap: 0.4em;
}

.eob-title {
	font-size: 0.78em;
	color: #f6c445;
}

/* View & Scale Tools */
.toggle-buttons-group {
	display: flex;
	flex-direction: column;
	gap: 0.3em;
}

.toggle-buttons-group.__mt {
	margin-top: 0.6em;
}

.tbg-label {
	font-size: 0.78em;
	color: #94a3b8;
}

.tbg-buttons {
	display: grid;
	grid-template-columns: repeat(2, 1fr);
	gap: 0.4em;
}

.mode-btn {
	background: rgba(255, 255, 255, 0.05);
	border: 1px solid rgba(255, 255, 255, 0.12);
	color: #cbd5e1;
	border-radius: 0.35em;
	padding: 0.4em 0.5em;
	font-size: 0.78em;
	cursor: pointer;
	transition: all 0.15s;
}

.mode-btn:hover {
	background: rgba(255, 255, 255, 0.1);
}

.mode-btn.__active {
	background: rgba(246, 196, 69, 0.2);
	border-color: #f6c445;
	color: #f6c445;
	font-weight: bold;
}

.scale-presets-box {
	display: flex;
	flex-direction: column;
	gap: 0.3em;
}

.spb-label {
	font-size: 0.75em;
	color: #94a3b8;
}

.spb-grid {
	display: flex;
	flex-wrap: wrap;
	gap: 0.3em;
}

.spb-btn {
	background: rgba(255, 255, 255, 0.05);
	border: 1px solid rgba(255, 255, 255, 0.12);
	color: #cbd5e1;
	border-radius: 0.25em;
	padding: 0.2em 0.5em;
	font-size: 0.72em;
	cursor: pointer;
}

.spb-btn.__active {
	background: rgba(246, 196, 69, 0.2);
	border-color: #f6c445;
	color: #f6c445;
}

.canonical-height-info-card {
	background: linear-gradient(135deg, rgba(246, 196, 69, 0.12) 0%, rgba(20, 28, 44, 0.8) 100%);
	border: 1px solid rgba(246, 196, 69, 0.35);
	border-radius: 0.4em;
	padding: 0.6em 0.8em;
	display: flex;
	align-items: center;
	justify-content: space-between;
	gap: 0.6em;
}

.chic-left {
	display: flex;
	align-items: center;
	gap: 0.5em;
}

.chic-icon {
	font-size: 1.3em;
}

.chic-meta {
	display: flex;
	flex-direction: column;
	gap: 0.1em;
}

.chic-label {
	font-size: 0.72em;
	color: #94a3b8;
}

.chic-val {
	font-size: 1.05em;
	color: #f6c445;
}

.chic-edit-btn {
	background: rgba(246, 196, 69, 0.15);
	border: 1px solid rgba(246, 196, 69, 0.4);
	color: #f6c445;
	border-radius: 0.3em;
	padding: 0.3em 0.6em;
	font-size: 0.75em;
	cursor: pointer;
	white-space: nowrap;
	transition: all 0.2s;
}

.chic-edit-btn:hover {
	background: rgba(246, 196, 69, 0.3);
	color: #ffffff;
}

.chic-hint {
	font-size: 0.72em;
	color: #94a3b8;
	line-height: 1.35;
	margin: 0;
}

.chic-hint strong {
	color: #f6c445;
}

.field-val.__highlight {
	color: #f6c445;
	font-weight: bold;
	font-family: monospace;
}

.studio-number-input.__precise {
	min-width: 4.8em;
	font-family: monospace;
}

.fine-tune-row {
	display: flex;
	flex-direction: column;
	gap: 0.3em;
}

.ftr-label {
	font-size: 0.75em;
	color: #94a3b8;
}

.ftr-buttons {
	display: grid;
	grid-template-columns: repeat(7, 1fr);
	gap: 0.25em;
}

.ftr-btn {
	background: rgba(255, 255, 255, 0.05);
	border: 1px solid rgba(255, 255, 255, 0.12);
	color: #cbd5e1;
	border-radius: 0.25em;
	padding: 0.3em 0.1em;
	font-size: 0.68em;
	font-family: monospace;
	text-align: center;
	cursor: pointer;
	transition: all 0.15s;
}

.ftr-btn:hover {
	background: rgba(255, 255, 255, 0.12);
	color: #ffffff;
}

.ftr-btn.__fine {
	color: #67e8f9;
	border-color: rgba(103, 232, 249, 0.3);
}

.ftr-btn.__fine:hover {
	background: rgba(103, 232, 249, 0.2);
}

.ftr-btn.__reset {
	color: #f6c445;
	border-color: rgba(246, 196, 69, 0.3);
}

.ftr-btn.__reset:hover {
	background: rgba(246, 196, 69, 0.2);
}

.fine-tune-row.__compact {
	margin-top: 0.35em;
}

.offset-actions-row {
	margin-top: 0.75em;
	display: flex;
	justify-content: flex-end;
}

.reset-offset-btn {
	background: rgba(255, 255, 255, 0.06);
	border: 1px solid rgba(255, 255, 255, 0.15);
	color: #94a3b8;
	font-size: 0.75em;
	padding: 0.35em 0.7em;
	border-radius: 0.3em;
	cursor: pointer;
	transition: all 0.2s;
}

.reset-offset-btn:hover {
	background: rgba(255, 255, 255, 0.12);
	color: #f1f5f9;
	border-color: rgba(255, 255, 255, 0.3);
}

.save-scale-box {
	margin-top: 0.4em;
}

.action-btn.__save-alt {
	background: linear-gradient(135deg, rgba(34, 197, 94, 0.2) 0%, rgba(16, 185, 129, 0.1) 100%);
	border: 1px solid rgba(34, 197, 94, 0.4);
	color: #86efac;
	display: flex;
	align-items: center;
	justify-content: center;
	gap: 0.5em;
	font-weight: 500;
	padding: 0.6em;
	border-radius: 0.4em;
	cursor: pointer;
	transition: all 0.2s;
}

.action-btn.__save-alt:hover {
	background: linear-gradient(135deg, rgba(34, 197, 94, 0.35) 0%, rgba(16, 185, 129, 0.25) 100%);
	border-color: #22c55e;
	color: #ffffff;
	box-shadow: 0 0 0.8em rgba(34, 197, 94, 0.3);
}

.__w-full {
	width: 100%;
}

.fade-enter-active,
.fade-leave-active {
	transition: opacity 0.3s;
}

.fade-enter-from,
.fade-leave-to {
	opacity: 0;
}

/* Center Parts Side Drawer Modal */
.center-parts-drawer {
	position: absolute;
	top: 2.6em;
	bottom: 0;
	left: 0;
	width: 19em;
	background: rgba(11, 17, 30, 0.95);
	backdrop-filter: blur(0.5em);
	border-right: 1px solid rgba(255, 255, 255, 0.15);
	box-shadow: 0.5em 0 1.5em rgba(0, 0, 0, 0.5);
	z-index: 40;
	display: flex;
	flex-direction: column;
	cursor: default;
}

.cpd-header {
	display: flex;
	align-items: center;
	justify-content: space-between;
	padding: 0.8em 1em;
	border-bottom: 1px solid rgba(255, 255, 255, 0.1);
	background: rgba(0, 0, 0, 0.25);
}

.cpd-title-box {
	display: flex;
	align-items: center;
	gap: 0.5em;
}

.cpd-icon {
	font-size: 1.2em;
}

.cpd-title-meta {
	display: flex;
	flex-direction: column;
	gap: 0.1em;
}

.cpd-title {
	margin: 0;
	font-size: 0.85em;
	color: #f1f5f9;
	font-weight: 600;
}

.cpd-subtitle {
	font-size: 0.68em;
	color: #94a3b8;
}

.cpd-close-btn {
	background: transparent;
	border: 1px solid rgba(255, 255, 255, 0.15);
	color: #94a3b8;
	font-size: 0.8em;
	width: 1.8em;
	height: 1.8em;
	border-radius: 0.25em;
	cursor: pointer;
	display: flex;
	align-items: center;
	justify-content: center;
	transition: all 0.15s;
}

.cpd-close-btn:hover {
	background: rgba(239, 68, 68, 0.2);
	border-color: #ef4444;
	color: #ef4444;
}

.cpd-actions-row {
	display: grid;
	grid-template-columns: repeat(3, 1fr);
	gap: 0.4em;
	padding: 0.6em 1em;
	border-bottom: 1px solid rgba(255, 255, 255, 0.07);
	background: rgba(255, 255, 255, 0.02);
}

.cpd-action-btn {
	background: rgba(255, 255, 255, 0.06);
	border: 1px solid rgba(255, 255, 255, 0.12);
	color: #cbd5e1;
	border-radius: 0.25em;
	padding: 0.3em 0.2em;
	font-size: 0.72em;
	cursor: pointer;
	text-align: center;
	transition: all 0.15s;
}

.cpd-action-btn:hover {
	background: rgba(16, 185, 129, 0.2);
	border-color: #10b981;
	color: #34d399;
}

.cpd-parts-list {
	flex: 1;
	overflow-y: auto;
	padding: 0.5em;
	display: flex;
	flex-direction: column;
	gap: 0.3em;
}

.cpd-part-item {
	display: flex;
	align-items: center;
	gap: 0.6em;
	padding: 0.45em 0.6em;
	border-radius: 0.3em;
	background: rgba(255, 255, 255, 0.03);
	border: 1px solid rgba(255, 255, 255, 0.06);
	cursor: pointer;
	transition: all 0.15s;
}

.cpd-part-item:hover {
	background: rgba(255, 255, 255, 0.07);
	border-color: rgba(255, 255, 255, 0.15);
}

.cpd-part-item.__checked {
	border-color: rgba(16, 185, 129, 0.3);
	background: rgba(16, 185, 129, 0.06);
}

.cpd-part-item.__selected {
	box-shadow: 0 0 0.4em rgba(246, 196, 69, 0.35);
	border-color: rgba(246, 196, 69, 0.6);
}

.cpd-checkbox {
	cursor: pointer;
	accent-color: #10b981;
	width: 1em;
	height: 1em;
}

.cpd-part-info {
	flex: 1;
	display: flex;
	flex-direction: column;
	gap: 0.1em;
	overflow: hidden;
}

.cpd-part-name {
	font-size: 0.78em;
	color: #f1f5f9;
	font-family: monospace;
	font-weight: 500;
	white-space: nowrap;
	overflow: hidden;
	text-overflow: ellipsis;
}

.cpd-part-parent {
	font-size: 0.65em;
	color: #94a3b8;
}

.cpd-part-parent em {
	color: #cbd5e1;
	font-style: normal;
}

.cpd-part-root-tag {
	font-size: 0.65em;
	color: #f6c445;
}

.cpd-inspect-btn {
	background: transparent;
	border: 1px solid rgba(255, 255, 255, 0.1);
	color: #94a3b8;
	border-radius: 0.2em;
	padding: 0.15em 0.35em;
	font-size: 0.7em;
	cursor: pointer;
	transition: all 0.15s;
}

.cpd-inspect-btn:hover {
	background: rgba(255, 255, 255, 0.15);
	color: #ffffff;
}

.cpd-footer {
	padding: 0.6em 1em;
	border-top: 1px solid rgba(255, 255, 255, 0.08);
	background: rgba(0, 0, 0, 0.3);
	font-size: 0.72em;
	color: #94a3b8;
	display: flex;
	justify-content: space-between;
	align-items: center;
}

.cpd-footer strong {
	color: #10b981;
}

.slide-left-enter-active,
.slide-left-leave-active {
	transition:
		transform 0.22s cubic-bezier(0.16, 1, 0.3, 1),
		opacity 0.22s ease;
}

.slide-left-enter-from,
.slide-left-leave-to {
	transform: translateX(-100%);
	opacity: 0;
}
</style>
