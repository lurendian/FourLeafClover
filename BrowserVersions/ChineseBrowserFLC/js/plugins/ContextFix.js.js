(function() {
    const _onMouseDown = TouchInput._onMouseDown;
    TouchInput._onMouseDown = function(event) {
        _onMouseDown.call(this, event);
    };

    const _onMouseUp = TouchInput._onMouseUp;
    TouchInput._onMouseUp = function(event) {
        _onMouseUp.call(this, event);
    };
})();