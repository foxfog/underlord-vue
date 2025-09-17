$(document).on("click", ".ui-dropdown-toggle", function (e) {
    e.stopPropagation();

    const $dropdown = $(this).closest(".ui-dropdown");
    const $menu = $dropdown.find(".ui-dropdown-menu");

    // Закрыть все остальные
    $(".ui-dropdown").not($dropdown).removeClass("_active");

    // Переключить текущий
    $dropdown.toggleClass("_active");

    if ($dropdown.hasClass("_active")) {
        // Проверка, влезает ли меню вниз
        const menuHeight = $menu.outerHeight();
        const menuOffset = $menu.offset().top;
        const windowHeight = $(window).height();

        if (menuOffset + menuHeight > windowHeight) {
            $dropdown.addClass("_bot");
        } else {
            $dropdown.removeClass("_bot");
        }
    } else {
        $dropdown.removeClass("_bot");
    }
});

// Клик вне dropdown → закрыть все
$(document).on("click", function () {
    $(".ui-dropdown").removeClass("_active _bot");
});

// Чтобы пересчитывать при ресайзе или скролле
$(window).on("resize scroll", function () {
    $(".ui-dropdown._active").each(function () {
        const $dropdown = $(this);
        const $menu = $dropdown.find(".ui-dropdown-menu");

        const menuHeight = $menu.outerHeight();
        const menuOffset = $menu.offset().top;
        const windowHeight = $(window).height();

        if (menuOffset + menuHeight > windowHeight) {
            $dropdown.addClass("_bot");
        } else {
            $dropdown.removeClass("_bot");
        }
    });
});