//=============================================================================
// main.js
//=============================================================================

PluginManager.setup($plugins);

//=============================================================================
// Mobile Audio Fix - RPG Maker Native Approach
//=============================================================================
(function() {
    'use strict';

    // Critical sounds to preload (RPG Maker will handle decryption)
    var CRITICAL_BGM = ['MainTitle','Battle3','Ship1','Ship2','Ship3'];
    var CRITICAL_ME  = ['Victory1','Defeat1','Gameover2'];
    var CRITICAL_SE  = ['Cursor2','Decision1','Cancel2','Buzzer1','Equip1',
                        'Save','Load','Battle1','Run','Attack3','Damage4',
                        'Collapse1','Collapse2','Collapse3','Damage5',
                        'Recovery','Miss','Evasion1','Evasion2','Reflection',
                        'Shop1','Item3'];

    var _audioUnlocked = false;
    var _preloadQueue = [];

    // Unlock audio on first user gesture (required for mobile)
    function unlockAudio() {
        if (_audioUnlocked) return;
        
        // Resume AudioContext if it exists
        var ctx = window.AudioContext && (new (window.AudioContext || window.webkitAudioContext)());
        if (ctx && ctx.state === 'suspended') {
            ctx.resume().catch(function(){});
        }
        
        _audioUnlocked = true;
        
        // Process any queued preloads
        _preloadQueue.forEach(function(item) {
            preloadFile(item.folder, item.name);
        });
        _preloadQueue = [];
        
        // Remove listeners after first trigger
        document.removeEventListener('touchstart', unlockAudio);
        document.removeEventListener('mousedown', unlockAudio);
        document.removeEventListener('keydown', unlockAudio);
    }
// DEBUG: Console logging for audio preloader
window.addEventListener('message', function(e) {
    if (e.data && e.data.type === 'flc_audio_progress') {
        console.log('🎵 Audio Progress:', e.data.loaded + '/' + e.data.total, 
                   '| Unlocked:', e.data.unlocked);
    }
});
    // Attach unlock listeners immediately
    document.addEventListener('touchstart', unlockAudio, {once: true, passive: true});
    document.addEventListener('mousedown', unlockAudio, {once: true});
    document.addEventListener('keydown', unlockAudio, {once: true});

    // Preload a single file using RPG Maker's native system
    function preloadFile(folder, name) {
        if (!name) return;
        
        // Only preload if audio is unlocked OR we're on desktop
        if (!_audioUnlocked && !('ontouchstart' in window === false)) {
            // Queue for later on mobile
            _preloadQueue.push({folder: folder, name: name});
            return;
        }
        
        // Use RPG Maker's built-in preloading (handles encryption!)
        if (typeof AudioManager !== 'undefined' && typeof AudioManager.preloadImportantSounds === 'function') {
            // Create a temporary list for this single file
            var sounds = [{name: name, volume: 100, pitch: 100, pan: 0}];
            AudioManager.preloadImportantSounds(sounds, folder);
        } else {
            // Fallback: just fetch the file to prime browser cache
            var ext = getAudioExtension();
            var path = folder + '/' + name + ext;
            fetch(path, {method: 'HEAD', mode: 'no-cors'}).catch(function(){});
        }
    }

    function getAudioExtension() {
        var a = document.createElement('audio');
        return a.canPlayType('audio/ogg; codecs="vorbis"') ? '.rpgmvo' : '.rpgmvm';
    }

    function preloadList(folder, names) {
        names.forEach(function(n) { preloadFile(folder, n); });
    }

    // Hook into RPG Maker startup to preload critical sounds
    var _origSetup = SceneManager.setup;
    SceneManager.setup = function() {
        // Preload critical sounds on game start (after audio unlock)
        if (_audioUnlocked) {
            preloadList('audio/bgm', CRITICAL_BGM);
            preloadList('audio/me', CRITICAL_ME);
            preloadList('audio/se', CRITICAL_SE);
        }
        if (_origSetup) _origSetup.apply(this, arguments);
    };

    // Also hook AudioManager.createBuffer for dynamic preloading
    var _hookInstalled = false;
    var _hookCheck = setInterval(function() {
        if (typeof AudioManager === 'undefined') return;
        clearInterval(_hookCheck);
        if (_hookInstalled) return;
        _hookInstalled = true;

        var _origCreate = AudioManager.createBuffer;
        AudioManager.createBuffer = function(folder, name) {
            // Preload this file if not already cached
            if (name && _audioUnlocked) {
                preloadFile(folder, name);
            }
            return _origCreate.apply(this, arguments);
        };
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