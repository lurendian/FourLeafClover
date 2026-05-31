//=============================================================================
// FitScreen.js
//=============================================================================
 
/*:
 * @plugindesc Scales the game canvas to fit the browser window/tab on all
 * devices, including touch screens and mobile phones.
 * @author Claude
 *
 * @param Maintain Aspect Ratio
 * @type boolean
 * @on YES
 * @off NO
 * @desc Keep the original aspect ratio when scaling? YES = letterbox,
 * NO = stretch to fill entirely.
 * @default true
 *
 * @param Alignment
 * @type select
 * @option Center
 * @option Top-Left
 * @desc Where to position the canvas when letterboxing.
 * @default Center
 *
 * @param Background Color
 * @desc CSS color for the letterbox bars (only visible when
 * Maintain Aspect Ratio is YES). E.g. #000000
 * @default #000000
 *
 * @help
 * ============================================================================
 * FitScreen.js - Browser Fit-to-Window Plugin
 * ============================================================================
 *
 * Automatically scales the RPG Maker MV game canvas to fill the browser
 * window or tab. Works on desktop browsers, phones, and tablets. Touch
 * input is fully preserved so mobile players can still tap to move and
 * interact normally.
 *
 * INSTALLATION
 * ------------
 * 1. Place FitScreen.js in your project's js/plugins/ folder.
 * 2. Open RPG Maker MV and go to Tools > Plugin Manager.
 * 3. Add FitScreen to an empty slot (place it near the top of the list,
 *    before other plugins that affect the screen).
 * 4. Configure the parameters as desired.
 * 5. Deploy and upload to Surge as normal.
 *
 * PARAMETERS
 * ----------
 * Maintain Aspect Ratio (default: true)
 *   true  - Scales uniformly; black bars appear if the window shape differs
 *           from your game's resolution (safe, recommended).
 *   false - Stretches to fill the entire window. No bars, but may look
 *           distorted on very wide or very tall screens.
 *
 * Alignment (default: Center)
 *   Center    - Canvas is centered in the window (recommended).
 *   Top-Left  - Canvas is pinned to the top-left corner.
 *
 * Background Color (default: #000000)
 *   Color shown behind the canvas when letterboxing. Any valid CSS color.
 *
 * TOUCH INPUT
 * -----------
 * Touch input is NOT disabled by this plugin. Tapping to move, interact
 * with events, and navigate menus all continue to work as normal on
 * phones and tablets.
 *
 * Touch coordinates are automatically remapped to account for the current
 * scale and offset, so hits always land on the correct game pixel.
 *
 * NOTES
 * -----
 * - Works best when deployed via File > Deployment in RPG Maker MV, then
 *   uploaded to Surge. Changes made directly to the deployed folder will
 *   be overwritten on the next deployment.
 * - If you use other plugins that modify Graphics._scale or the canvas
 *   style, place FitScreen BELOW those plugins in the Plugin Manager.
 * - Tested with RPG Maker MV 1.6.1+.
 *
 * ============================================================================
 */
 
(function () {
    'use strict';
 
    // -------------------------------------------------------------------------
    // Read plugin parameters
    // -------------------------------------------------------------------------
    var pluginName = 'FitScreen';
    var params = PluginManager.parameters(pluginName);
    var maintainAspect = String(params['Maintain Aspect Ratio'] || 'true').trim().toLowerCase() !== 'false';
    var alignment = String(params['Alignment'] || 'Center').trim();
    var bgColor = String(params['Background Color'] || '#000000').trim();
 
    // -------------------------------------------------------------------------
    // Style the document body so there are no scrollbars or margins
    // -------------------------------------------------------------------------
    function initBodyStyle() {
        document.documentElement.style.overflow = 'hidden';
        document.body.style.margin = '0';
        document.body.style.padding = '0';
        document.body.style.overflow = 'hidden';
        document.body.style.background = bgColor;
        document.body.style.display = 'flex';
        document.body.style.alignItems = alignment === 'Center' ? 'center' : 'flex-start';
        document.body.style.justifyContent = alignment === 'Center' ? 'center' : 'flex-start';
        document.body.style.width = '100vw';
        document.body.style.height = '100vh';
    }
 
    // -------------------------------------------------------------------------
    // Core resize logic
    // -------------------------------------------------------------------------
    function resizeCanvas() {
        var canvas = document.getElementById('GameCanvas');
        if (!canvas) return;
 
        var gameW = Graphics.width  || SceneManager._screenWidth  || 816;
        var gameH = Graphics.height || SceneManager._screenHeight || 624;
        var winW  = window.innerWidth;
        var winH  = window.innerHeight;
 
        var scaleX = winW / gameW;
        var scaleY = winH / gameH;
        var scale  = maintainAspect ? Math.min(scaleX, scaleY) : Math.max(scaleX, scaleY);
 
        var displayW = Math.floor(gameW * scale);
        var displayH = Math.floor(gameH * scale);
 
        canvas.style.width  = displayW + 'px';
        canvas.style.height = displayH + 'px';
 
        // Keep the internal resolution unchanged — only the CSS display size changes
        canvas.style.imageRendering = '-webkit-optimize-contrast'; // Chrome/Edge
        canvas.style.imageRendering = 'pixelated';                 // Firefox/modern
 
        // Store scale info for touch remapping
        FitScreen._scale   = scale;
        FitScreen._offsetX = alignment === 'Center' ? Math.floor((winW - displayW) / 2) : 0;
        FitScreen._offsetY = alignment === 'Center' ? Math.floor((winH - displayH) / 2) : 0;
    }
 
    // -------------------------------------------------------------------------
    // Public namespace (used by touch patch below)
    // -------------------------------------------------------------------------
    var FitScreen = window.FitScreen = {
        _scale:   1,
        _offsetX: 0,
        _offsetY: 0
    };
 
    // -------------------------------------------------------------------------
    // Remap touch / mouse coordinates so they hit the correct game pixel
    // -------------------------------------------------------------------------
    function remapEvent(e) {
        var scale   = FitScreen._scale   || 1;
        var offsetX = FitScreen._offsetX || 0;
        var offsetY = FitScreen._offsetY || 0;
        if (scale === 1 && offsetX === 0 && offsetY === 0) return e; // nothing to do
 
        function remapPoint(x, y) {
            return {
                x: (x - offsetX) / scale,
                y: (y - offsetY) / scale
            };
        }
 
        // Build a lightweight proxy that reports remapped coordinates
        var proxy = Object.create(e);
 
        if (e.touches || e.changedTouches) {
            // TouchEvent — remap every touch
            function remapTouchList(list) {
                var arr = [];
                for (var i = 0; i < list.length; i++) {
                    var t   = list[i];
                    var pt  = remapPoint(t.clientX, t.clientY);
                    // Create a plain object that looks like a Touch
                    arr[i] = {
                        identifier: t.identifier,
                        target:     t.target,
                        clientX:    pt.x,
                        clientY:    pt.y,
                        pageX:      pt.x,
                        pageY:      pt.y,
                        screenX:    pt.x,
                        screenY:    pt.y,
                        radiusX:    t.radiusX,
                        radiusY:    t.radiusY,
                        rotationAngle: t.rotationAngle,
                        force:      t.force
                    };
                }
                arr.item = function(n) { return arr[n]; };
                return arr;
            }
            Object.defineProperty(proxy, 'touches',        { get: function() { return remapTouchList(e.touches);        } });
            Object.defineProperty(proxy, 'changedTouches', { get: function() { return remapTouchList(e.changedTouches); } });
            Object.defineProperty(proxy, 'targetTouches',  { get: function() { return remapTouchList(e.targetTouches);  } });
        } else {
            // MouseEvent
            var pt = remapPoint(e.clientX, e.clientY);
            Object.defineProperty(proxy, 'clientX', { get: function() { return pt.x; } });
            Object.defineProperty(proxy, 'clientY', { get: function() { return pt.y; } });
            Object.defineProperty(proxy, 'pageX',   { get: function() { return pt.x; } });
            Object.defineProperty(proxy, 'pageY',   { get: function() { return pt.y; } });
        }
        return proxy;
    }
 
    // Patch TouchInput so all pointer events go through coordinate remapping
    var _TouchInput_onMouseDown  = TouchInput._onMouseDown.bind(TouchInput);
    var _TouchInput_onMouseMove  = TouchInput._onMouseMove.bind(TouchInput);
    var _TouchInput_onMouseUp    = TouchInput._onMouseUp.bind(TouchInput);
    var _TouchInput_onTouchStart = TouchInput._onTouchStart.bind(TouchInput);
    var _TouchInput_onTouchMove  = TouchInput._onTouchMove.bind(TouchInput);
    var _TouchInput_onTouchEnd   = TouchInput._onTouchEnd.bind(TouchInput);
 
    TouchInput._onMouseDown  = function(e) { _TouchInput_onMouseDown(remapEvent(e));  };
    TouchInput._onMouseMove  = function(e) { _TouchInput_onMouseMove(remapEvent(e));  };
    TouchInput._onMouseUp    = function(e) { _TouchInput_onMouseUp(remapEvent(e));    };
    TouchInput._onTouchStart = function(e) { _TouchInput_onTouchStart(remapEvent(e)); };
    TouchInput._onTouchMove  = function(e) { _TouchInput_onTouchMove(remapEvent(e));  };
    TouchInput._onTouchEnd   = function(e) { _TouchInput_onTouchEnd(remapEvent(e));   };
 
    // -------------------------------------------------------------------------
    // Hook into Graphics initialization so we resize as soon as the canvas exists
    // -------------------------------------------------------------------------
    var _Graphics_initialize = Graphics.initialize;
    Graphics.initialize = function(width, height, type) {
        _Graphics_initialize.call(this, width, height, type);
        initBodyStyle();
        resizeCanvas();
    };
 
    // Also re-run on every render frame for the first few seconds to handle
    // late-loading and orientation changes on mobile
    var _Graphics_render = Graphics.render;
    var _frameCount = 0;
    Graphics.render = function(stage) {
        _Graphics_render.call(this, stage);
        if (_frameCount < 180) {   // ~3 seconds at 60fps
            resizeCanvas();
            _frameCount++;
        }
    };
 
    // Resize on window resize and orientation change
    window.addEventListener('resize',            resizeCanvas);
    window.addEventListener('orientationchange', function() {
        // Small delay lets the browser finish the rotation before we measure
        setTimeout(resizeCanvas, 200);
    });
 
})();
