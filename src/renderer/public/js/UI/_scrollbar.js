(function($) {
    function updateScrollState($el) {
        const hasY = $el[0].scrollHeight > $el[0].clientHeight;
        const hasX = $el[0].scrollWidth > $el[0].clientWidth;

        $el.toggleClass("ui-scrollable-y", hasY);
        $el.toggleClass("ui-scrollable-x", hasX);
    }

    function observeScrollables($els) {
        $els.each(function() {
            const $el = $(this);

            // первичная проверка
            updateScrollState($el);

            // следим за изменениями размера
            const resizeObserver = new ResizeObserver(() => updateScrollState($el));
            resizeObserver.observe(this);

            // следим за изменением DOM внутри
            const mutationObserver = new MutationObserver(() => updateScrollState($el));
            mutationObserver.observe(this, {
                childList: true,
                subtree: true,
                characterData: true
            });

            // при скролле тоже иногда полезно проверять
            $el.on("scroll", () => updateScrollState($el));
        });
    }

    // следим за появлением новых элементов .ui-scrollable
    const rootObserver = new MutationObserver(() => {
        observeScrollables($(".ui-scrollable").not("[data-scroll-observed]"));
    });
    rootObserver.observe(document.body, { childList: true, subtree: true });

    // обработка уже существующих при загрузке
    $(function() {
        observeScrollables($(".ui-scrollable").not("[data-scroll-observed]"));
    });
})(jQuery);
