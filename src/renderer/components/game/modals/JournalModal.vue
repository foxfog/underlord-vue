<template>
	<div v-if="isVisible" class="modal journal-modal" @click="closeOnBackground">
		<div class="modal-content journal-modal__content" @click.stop>
			<div class="modal-header">
				<h2 class="modal-title">Журнал</h2>
				<button class="btn-close" @click="$emit('close')">✖</button>
			</div>

			<div class="modal-tabs">
				<button
					class="modal-tab"
					:class="{ active: activeTab === 'tasks' }"
					@click="activeTab = 'tasks'"
				>
					Задания
				</button>
				<button
					class="modal-tab"
					:class="{ active: activeTab === 'characters' }"
					@click="activeTab = 'characters'"
				>
					Персонажи
				</button>
				<button
					class="modal-tab"
					:class="{ active: activeTab === 'encyclopedia' }"
					@click="activeTab = 'encyclopedia'"
				>
					Энциклопедия
				</button>
			</div>

			<div class="modal-body journal-body">
				<div v-if="activeTab === 'tasks'" class="tab-content-item">
					<div class="section-title">Текущие задания</div>
					<ul class="journal-list">
						<li>Задание 1. Сразиться с охраной в городе.</li>
						<li>Задание 2. Найти вход в подземелье.</li>
						<li>Задание 3. Вернуться к Электре за наградой.</li>
					</ul>
				</div>

				<div v-if="activeTab === 'characters'" class="tab-content-item">
					<div class="section-title">Персонажи</div>
					<ul class="journal-list">
						<li>Электра — информатор и союзник.</li>
						<li>Морг — капитан стражи.</li>
						<li>Кроу — таинственный торговец.</li>
					</ul>
				</div>

				<div v-if="activeTab === 'encyclopedia'" class="tab-content-item">
					<div class="section-title">Энциклопедия</div>
					<ul class="journal-list">
						<li>Расы: люди, эльфы, карлики.</li>
						<li>Фракции: Гильдия, Орден, Охрана.</li>
						<li>Магия: элементальная и ритуальная.</li>
					</ul>
				</div>
			</div>
		</div>
	</div>
</template>

<script setup>
import { ref } from 'vue'

const props = defineProps({
	isVisible: { type: Boolean, default: false }
})

const emit = defineEmits(['close'])
const activeTab = ref('tasks')

function closeOnBackground() {
	emit('close')
}
</script>
