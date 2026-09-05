// src/renderer/constants/yggdrasilConfig.js

/**
 * Зарезервированные имена из Вселенной Overlord (недоступные для обычных игроков).
 * Имена проверяются без учета регистра.
 */
export const RESERVED_YGGDRASIL_NAMES = [
	'momonga',
	'момонга',
	'ainz',
	'аинз',
	'ainz ooal gown',
	'аинз оал гоун',
	'touch me',
	'тач ми',
	'ulbert',
	'ульберт',
	'herohero',
	'херохеро',
	'peroroncino',
	'перорончино',
	'bukubukuchagama',
	'букубукучагама',
	'takemikazuchi',
	'тамикиказучи',
	'nishikienrai',
	'нишикиенрай',
	'albedo',
	'альбедо',
	'shalltear',
	'шаллтир',
	'демиург',
	'demiurge',
	'себас',
	'sebas'
]

/**
 * Проверка занятости никнейма
 */
export function isNicknameReserved(name) {
	if (!name || typeof name !== 'string') return false
	const clean = name.trim().toLowerCase()
	return RESERVED_YGGDRASIL_NAMES.some((reserved) => reserved.toLowerCase() === clean)
}

/**
 * Учетные записи для экрана авторизации
 */
export const EASTER_EGG_ACCOUNTS = [
	{
		login: 'momonga',
		password: '123',
		message: 'Вход заблокирован: данный аккаунт уже находится в сети (Тронный зал Назарика)!'
	},
	{
		login: 'player',
		password: '123',
		message: 'Срок действия подписки аккаунта истек в 2135 году. Пожалуйста, зарегистрируйтесь заново.'
	}
]

/**
 * Данные для автоматической регистрации
 */
export const AUTO_REGISTRATION_DATA = {
	login: 'Anon_2138',
	password: 'Password2138!',
	email: 'worker_2138@factory.corp'
}
