//=============================================================================
// main.js
//=============================================================================

PluginManager.setup($plugins);

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

(function() {
    var _audioUnlocked = false;

    // 1. AUDIO UNLOCK (Satisfies mobile browser gesture requirements)
    function unlockAudio() {
        if (_audioUnlocked) return;
        var AC = window.AudioContext || window.webkitAudioContext;
        if (AC) {
            try {
                var ctx = new AC();
                if (ctx.state === 'suspended') ctx.resume().catch(function(){});
            } catch(e) {}
        }
        _audioUnlocked = true;
    }

    // Listen for local screen taps/clicks
    document.addEventListener('touchstart', unlockAudio, {once: true, passive: true});
    document.addEventListener('mousedown', unlockAudio, {once: true});
    document.addEventListener('keydown', unlockAudio, {once: true});

    // Listen for the "Unlock" signal from your wrapper page (index.html)
    window.addEventListener('message', function(e) {
        if (e.data && e.data.type === 'flc_unlock_audio') unlockAudio();
    });

    // 2. WAIT FOR RPG MAKER TO BOOT, THEN APPLY ALL FIXES
    var _masterInit = setInterval(function() {
        if (typeof AudioManager !== 'undefined') {
            clearInterval(_masterInit);

            // --- A. NUCLEAR OPTION: Force .m4a and Kill Encryption Flags ---
            AudioManager.audioFileExt = function() { return ".m4a"; };
            AudioManager._canPlayOgg = false;
            AudioManager._canPlayM4a = true;
            
            if (typeof Decrypter !== 'undefined') {
                Decrypter.hasEncryptedAudio = false;
                Decrypter.hasEncryptedImages = false;
            }
            if (typeof WebAudio !== 'undefined' && WebAudio._extension !== undefined) {
                WebAudio._extension = ".m4a";
            }

            // --- B. SILVER BULLET: Force HTML5 Audio Streaming ---
            // This forces the browser to use the native <audio> tag, which streams
            // instantly on mobile instead of waiting to download the whole file into RAM.
            AudioManager.shouldUseHtml5Audio = function() { return true; };
            AudioManager._shouldUseHtml5 = true; 

            // --- C. XHR CACHE WARMER (Backup for WebAudio fallback) ---
            // 👇 PASTE YOUR PYTHON SCRIPT OUTPUT INSIDE THESE BRACKETS 👇
            var FILES_TO_PRELOAD = [
                'bgm/MainTitle', 'bgm/Battle1', 'bgm/Town1', 
                'se/Cursor2', 'se/Decision1', 'me/Victory1'
                // ... paste the rest of your python script list here ...
            ];

            var ext = '.m4a'; 

            // Start downloading 2 seconds after boot (while user is on Title Screen)
            setTimeout(function() {
                FILES_TO_PRELOAD.forEach(function(file) {
                    var xhr = new XMLHttpRequest();
                    xhr.open('GET', 'audio/' + file + ext, true);
                    xhr.responseType = 'arraybuffer';
                    xhr.send(); 
                });
                console.log("🔥 Cache warmer started for " + FILES_TO_PRELOAD.length + " files");
            }, 2000);

            console.log("🔊 MASTER FIX APPLIED: .m4a forced, HTML5 streaming enabled.");
        }
    }, 100); 
})();