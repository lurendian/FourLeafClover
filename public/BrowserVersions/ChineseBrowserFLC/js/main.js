//=============================================================================
// main.js
//=============================================================================

PluginManager.setup($plugins);

//=============================================================================
// Audio Preloader
//
// Hooks into RPG Maker's AudioManager to intercept every audio file it loads
// and pre-fetches + decodes it via Web Audio immediately, so subsequent plays
// are instant. Reports progress to the parent page via postMessage.
//=============================================================================
(function() {
    'use strict';

    var _preloadCtx = null;
    var _preloaded  = {};
    var _total      = 0;
    var _loaded     = 0;

    function sendProgress() {
        try {
            if (window.parent && window.parent !== window) {
                window.parent.postMessage({
                    type: 'flc_audio_progress',
                    loaded: _loaded,
                    total: _total
                }, '*');
            }
        } catch(e) {}
    }

    function getAudioContext() {
        if (_preloadCtx) return _preloadCtx;
        var AC = window.AudioContext || window.webkitAudioContext;
        if (!AC) return null;
        _preloadCtx = new AC();
        return _preloadCtx;
    }

    function preloadFile(path) {
        if (_preloaded[path]) return;
        _preloaded[path] = true;
        _total++;
        sendProgress();

        var xhr = new XMLHttpRequest();
        xhr.open('GET', path, true);
        xhr.responseType = 'arraybuffer';
        xhr.onload = function() {
            var ctx = getAudioContext();
            if (xhr.status === 200 && ctx) {
                ctx.decodeAudioData(xhr.response,
                    function(buf) {
                        // Store decoded buffer so WebAudio can reuse it
                        try {
                            if (WebAudio && WebAudio._masterVolume !== undefined) {
                                // RPG Maker will load it fresh anyway; we just
                                // wanted the browser to cache the decoded bytes
                            }
                        } catch(e) {}
                        _loaded++; sendProgress();
                    },
                    function() { _loaded++; sendProgress(); }
                );
            } else {
                _loaded++; sendProgress();
            }
        };
        xhr.onerror = function() { _loaded++; sendProgress(); };
        try { xhr.send(); } catch(e) { _loaded++; sendProgress(); }
    }

    // Hook AudioManager.createBuffer — called every time RPG Maker loads audio
    var _hookInstalled = false;
    function installHook() {
        if (_hookInstalled || typeof AudioManager === 'undefined') return;
        _hookInstalled = true;

        var _orig = AudioManager.createBuffer;
        AudioManager.createBuffer = function(folder, name) {
            if (name) {
                // Determine extension the same way RPG Maker does
                var audio = document.createElement('audio');
                var ext = audio.canPlayType('audio/ogg') ? '.rpgmvo' : '.rpgmvm';
                preloadFile(folder + '/' + name + ext);
            }
            return _orig.apply(this, arguments);
        };

        // Also preload title BGM/BGS immediately from System data
        var trySystem = function() {
            if (window.$dataSystem) {
                var audio = document.createElement('audio');
                var ext = audio.canPlayType('audio/ogg') ? '.rpgmvo' : '.rpgmvm';
                var s = window.$dataSystem;
                if (s.titleBgm && s.titleBgm.name) preloadFile('audio/bgm/' + s.titleBgm.name + ext);
                if (s.titleBgs && s.titleBgs.name) preloadFile('audio/bgs/' + s.titleBgs.name + ext);
                if (s.battleBgm && s.battleBgm.name) preloadFile('audio/bgm/' + s.battleBgm.name + ext);
                if (s.defeatMe  && s.defeatMe.name)  preloadFile('audio/me/'  + s.defeatMe.name  + ext);
                if (s.victoryMe && s.victoryMe.name) preloadFile('audio/me/'  + s.victoryMe.name + ext);
                if (s.gameoverMe && s.gameoverMe.name) preloadFile('audio/me/' + s.gameoverMe.name + ext);
            } else {
                setTimeout(trySystem, 200);
            }
        };
        setTimeout(trySystem, 200);
    }

    // Poll until AudioManager is available then install the hook
    var _poll = setInterval(function() {
        if (typeof AudioManager !== 'undefined') {
            clearInterval(_poll);
            installHook();
        }
    }, 100);

})();



window.onload = function() {
    SceneManager.run(Scene_Boot);
    // Prevent the game page from scrolling on mobile when touched
    document.documentElement.style.touchAction = 'none';
    document.body.style.touchAction = 'none';
    document.addEventListener('touchmove', function(e) {
        e.preventDefault();
    }, { passive: false });
};

//=============================================================================
// Background Render Fix
//
// Problem: On refresh (cached assets), SceneManager.renderScene fires during
// Scene_Boot and counts up to FRAMES_BEFORE_REVEAL before Scene_Title even
// starts — so the overlay is gone by the time the title canvas renders.
//
// Fix: Only count frames once Scene_Title is the active started scene,
// then wait for FRAMES_BEFORE_REVEAL renders before fading out the overlay.
//=============================================================================
(function() {
    'use strict';

    var FRAMES_BEFORE_REVEAL = 6;

    var overlay = document.createElement('div');
    overlay.id = '_bg_reveal_overlay';
    overlay.style.cssText = [
        'position:fixed',
        'top:0','left:0','width:100%','height:100%',
        'background:#000000',
        'z-index:2147483647',
        'transition:opacity 0.5s ease',
        'opacity:1',
        'pointer-events:none'
    ].join(';');
    document.body.appendChild(overlay);

    var _renderCount = 0;
    var _revealed    = false;

    // Cache-bust all video sources on every load so the browser never serves
    // a stale/partial cached response for the title screen background video.
    (function bustVideoCache() {
        var _origCreateElement = document.createElement.bind(document);
        document.createElement = function(tag) {
            var el = _origCreateElement(tag);
            if (typeof tag === 'string' && tag.toLowerCase() === 'video') {
                var _origSetAttribute = el.setAttribute.bind(el);
                el.setAttribute = function(name, value) {
                    if (name === 'src' && value && !/[?&]_t=/.test(value)) {
                        value = value + (value.indexOf('?') >= 0 ? '&' : '?') + '_t=' + Date.now();
                    }
                    return _origSetAttribute(name, value);
                };
                Object.defineProperty(el, 'src', {
                    set: function(value) {
                        if (value && !/[?&]_t=/.test(value)) {
                            value = value + (value.indexOf('?') >= 0 ? '&' : '?') + '_t=' + Date.now();
                        }
                        _origSetAttribute('src', value);
                    },
                    get: function() { return el.getAttribute('src') || ''; }
                });
            }
            return el;
        };
    })();

    function revealCanvas() {
        if (_revealed) return;
        _revealed = true;
        overlay.style.opacity = '0';
        setTimeout(function() {
            if (overlay.parentNode) overlay.parentNode.removeChild(overlay);
        }, 600);
        // Tell the parent wrapper the title screen is ready
        try {
            if (window.parent && window.parent !== window) {
                window.parent.postMessage({ type: 'flc_scene_ready' }, '*');
            }
        } catch(e) {}
    }

    var _origRenderScene = SceneManager.renderScene;
    SceneManager.renderScene = function() {
        _origRenderScene.call(this);
        if (_revealed) return;

        // Only count frames once Scene_Title is active and started.
        // This prevents the overlay being removed during Scene_Boot
        // on cached/fast loads.
        var scene = this._scene;
        if (!this._sceneStarted) return;
        if (typeof Scene_Title === 'undefined') return;
        if (!(scene instanceof Scene_Title)) return;

        _renderCount++;
        if (_renderCount >= FRAMES_BEFORE_REVEAL) {
            revealCanvas();
        }
    };

})();