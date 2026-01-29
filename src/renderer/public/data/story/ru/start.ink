label start:
    scene mc_apartment

    "Вы находитесь в своей квартире."
    "Вы видите свою квартиру."

    show momonga
    momonga "Вы создали новую игру Ren'Py."

    show albedo
    albedo "Добавьте сюжет, изображения и музыку и отправьте её в мир!"

    hide albedo
    hide momonga

    scene mc_appartment_door
    show albedo

    menu:
        albedo "Вы хотите продолжить?"

        "Да":
            mc "Хорошо"
            -> second
        "Нет":
            mc "Нехорошо"

    momonga "Спасибо за игру!"

    -> END