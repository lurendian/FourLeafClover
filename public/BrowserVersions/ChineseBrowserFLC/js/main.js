//=============================================================================
// main.js
//=============================================================================

PluginManager.setup($plugins);

//=============================================================================
// Audio Preloader - MOBILE-FIXED VERSION
//=============================================================================
(function() {
    'use strict';

    var CRITICAL_BGM = ['MainTitle','Battle3','Ship1','Ship2','Ship3'];
    var CRITICAL_ME  = ['Victory1','Defeat1','Gameover2'];
    var CRITICAL_SE  = ['Cursor2','Decision1','Cancel2','Buzzer1','Equip1',
                        'Save','Load','Battle1','Run','Attack3','Damage4',
                        'Collapse1','Collapse2','Collapse3','Damage5',
                        'Recovery','Miss','Evasion1','Evasion2','Reflection',
                        'Shop1','Item3'];

    var _ctx = null;
    var _cache = {};
    var _fetching = {};
    var _total = 0;
    var _loaded = 0;
    var _audioUnlocked = false;

    function getCtx() {
        if (_ctx) return _ctx;
        var AC = window.AudioContext || window.webkitAudioContext;
        if (!AC) return null;
        try { 
            _ctx = new AC(); 
            if (_ctx.state === 'suspended') {
                _ctx.resume().catch(function(){});
            }
        } catch(e) {}
        return _ctx;
    }

    function unlockAudio() {
        if (_audioUnlocked) return;
        var ctx = getCtx();
        if (ctx && ctx.state === 'suspended') {
            ctx.resume().then(function() {
                _audioUnlocked = true;
                startPreloading();
            }).catch(function(){});
        } else if (ctx) {
            _audioUnlocked = true;
            startPreloading();
        }
        document.removeEventListener('touchstart', unlockAudio);
        document.removeEventListener('mousedown', unlockAudio);
        document.removeEventListener('keydown', unlockAudio);
    }

    // Attach unlock listeners immediately
    document.addEventListener('touchstart', unlockAudio, {once: true, passive: true});
    document.addEventListener('mousedown', unlockAudio, {once: true});
    document.addEventListener('keydown', unlockAudio, {once: true});

    function getExt() {
        var a = document.createElement('audio');
        return a.canPlayType('audio/ogg; codecs="vorbis"') ? '.rpgmvo' : '.rpgmvm';
    }

    function sendProgress() {
        try {
            if (window.parent && window.parent !== window) {
                window.parent.postMessage({
                    type: 'flc_audio_progress',
                    loaded: _loaded,
                    total: _total,
                    unlocked: _audioUnlocked
                }, '*');
            }
        } catch(e) {}
    }

    function preload(path) {
        if (_cache[path] || _fetching[path]) return;
        
        var ctx = getCtx();
        if (!ctx || (ctx.state !== 'running' && !_audioUnlocked)) {
            if (!_fetching[path]) {
                _fetching[path] = 'pending';
                _total++;
                sendProgress();
            }
            return;
        }
        
        if (_fetching[path] === true) return;
        _fetching[path] = true;
        _total++;
        sendProgress();

        var xhr = new XMLHttpRequest();
        xhr.open('GET', path, true);
        xhr.responseType = 'arraybuffer';
        xhr.onload = function() {
            if (xhr.status !== 200) { cleanup(); return; }
            var context = getCtx();
            if (!context) { cleanup(); return; }
            
            context.decodeAudioData(xhr.response,
                function(buf) { 
                    _cache[path] = buf; 
                    _loaded++; 
                    sendProgress(); 
                },
                function(err) { 
                    console.warn('Decode failed for ' + path, err);
                    cleanup(); 
                }
            );
        };
        xhr.onerror = function() { cleanup(); };
        xhr.ontimeout = function() { cleanup(); };
        xhr.timeout = 10000;
        
        try { 
            xhr.send(); 
        } catch(e) { 
            cleanup(); 
        }
        
        function cleanup() {
            _loaded++;
            sendProgress();
        }
    }

    function preloadList(folder, names, ext) {
        names.forEach(function(n) { 
            if (n) preload(folder + '/' + n + ext); 
        });
    }

    function startPreloading() {
        var ext = getExt();
        preloadList('audio/bgm', CRITICAL_BGM, ext);
        preloadList('audio/me',  CRITICAL_ME,  ext);
        preloadList('audio/se',  CRITICAL_SE,  ext);
    }
    
    var ctx = getCtx();
    if (ctx && ctx.state === 'running') {
        startPreloading();
    }

    var _hookInstalled = false;
    var _hookInterval = setInterval(function() {
        if (typeof AudioManager === 'undefined') return;
        clearInterval(_hookInterval);
        if (_hookInstalled) return;
        _hookInstalled = true;

        var _origCreate = AudioManager.createBuffer;
        AudioManager.createBuffer = function(folder, name) {
            if (name) {
                var path = folder + '/' + name + getExt();
                if (_audioUnlocked || (getCtx() && getCtx().state === 'running')) {
                    preload(path);
                }
            }
            return _origCreate.apply(this, arguments);
        };

        if (typeof WebAudio !== 'undefined' && WebAudio.prototype) {
            var _origLoad = WebAudio.prototype._load;
            if (_origLoad) {
                WebAudio.prototype._load = function(url) {
                    var lookupUrl = url;
                    if (url.indexOf('://') === -1 && url[0] !== '/') {
                        lookupUrl = url;
                    }
                    
                    var cached = _cache[lookupUrl] || _cache[url.replace(/^\.\//, '')];
                    
                    if (cached && this._context) {
                        try {
                            this._buffer = cached;
                            this._totalTime = cached.duration;
                            if (typeof this._onLoad === 'function') {
                                this._onLoad();
                            }
                            return true;
                        } catch(e) {
                            console.warn('Cache playback failed', e);
                        }
                    }
                    return _origLoad.apply(this, arguments);
                };
            }
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