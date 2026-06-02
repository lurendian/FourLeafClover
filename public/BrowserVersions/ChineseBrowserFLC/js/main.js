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
    'bgm/MainTitle', 'bgm/Sword', 'bgm/Sword1', 'bgm/Sword2', 'bgm/antique',
    'bgm/alonetime', 'bgm/Ship1', 'bgm/Ship2', 'bgm/Ship3', 'bgm/Battle3',
    'bgm/fenghuang', 'bgm/forest', 'bgm/forest2', 'bgm/fuzai', 'bgm/havewemet',
    'bgm/heartdoor', 'bgm/justaadream', 'bgm/justafairy', 'bgm/justfairy2', 'bgm/mountaingod',
    'bgm/ourfriends', 'bgm/pastmemories', 'bgm/pigs', 'bgm/secondlayer', 'bgm/sikbuxiang',
    'bgm/snow2', 'bgm/snow3', 'bgm/snow4', 'bgm/snowmountain', 'bgm/starsky',
    'bgm/taotie', 'bgm/taotie2', 'bgm/tianlu', 'bgm/tianlu2', 'bgm/tiger',
    'bgm/train', 'bgm/trainstation', 'bgm/tutuoni', 'bgm/tutuoni2', 'bgm/yinglong',
    'bgm/yinglong2', 'bgs/City', 'bgs/Darkness', 'bgs/Drips', 'bgs/Night',
    'bgs/Quake', 'bgs/River', 'bgs/Sea', 'bgs/Storm1', 'bgs/Storm2',
    'bgs/Wind', 'bgs/avalanche', 'bgs/beach', 'bgs/citynight', 'bgs/clock',
    'bgs/factory', 'bgs/heart', 'bgs/snow1', 'bgs/snow2', 'bgs/trainBGS',
    'bgs/youshouyan', 'me/Curse1', 'me/Curse2', 'me/Defeat1', 'me/Defeat2',
    'me/Fanfare1', 'me/Fanfare2', 'me/Gameover1', 'me/Gameover2', 'me/Inn',
    'me/Musical1', 'me/Musical2', 'me/Musical3', 'me/Mystery', 'me/Organ',
    'me/Shock1', 'me/Shock2', 'me/Victory1', 'me/Victory2', 'se/Absorb1',
    'se/Absorb2', 'se/Applause1', 'se/Applause2', 'se/Attack1', 'se/Attack2',
    'se/Attack3', 'se/Battle1', 'se/Battle2', 'se/Battle3', 'se/Bell1',
    'se/Bell2', 'se/Bell3', 'se/Blind', 'se/Blow1', 'se/Blow2',
    'se/Blow3', 'se/Book1', 'se/Book2', 'se/Break', 'se/Buzzer1',
    'se/Buzzer2', 'se/CD', 'se/Cancel1', 'se/Cancel2', 'se/Cat',
    'se/Chest1', 'se/Chest2', 'se/Close1', 'se/Close2', 'se/Close3',
    'se/Coin', 'se/Collapse1', 'se/Collapse2', 'se/Collapse3', 'se/Collapse4',
    'se/Computer', 'se/Cow', 'se/Crash', 'se/Crossbow', 'se/Crow',
    'se/Cursor1', 'se/Cursor2', 'se/Damage1', 'se/Damage2', 'se/Damage3',
    'se/Damage4', 'se/Damage5', 'se/Darkness1', 'se/Darkness2', 'se/Darkness3',
    'se/Darkness4', 'se/Darkness5', 'se/Decision1', 'se/Decision2', 'se/Devil1',
    'se/Devil2', 'se/Disappointment', 'se/Dive', 'se/Dog', 'se/Door1',
    'se/Door2', 'se/Door3', 'se/Door4', 'se/Down1', 'se/Down2',
    'se/Earth1', 'se/Earth2', 'se/Earth3', 'se/Earth4', 'se/Earth5',
    'se/Electrocardiogram', 'se/Equip1', 'se/Equip2', 'se/Evasion1', 'se/Evasion2',
    'se/Explosion1', 'se/Explosion2', 'se/Fall', 'se/Fire1', 'se/Fire2',
    'se/Fire3', 'se/Flash1', 'se/Flash2', 'se/Frog', 'se/GAMEOVER_M',
    'se/GAMEOVER_R', 'se/Growl', 'se/Gun1', 'se/Gun2', 'se/Hammer',
    'se/Heal1', 'se/Heal2', 'se/Heal3', 'se/Horn', 'se/Horse',
    'se/Ice1', 'se/Ice2', 'se/Ice3', 'se/Ice4', 'se/Ice5',
    'se/Item1', 'se/Item2', 'se/Item3', 'se/Jump1', 'se/Jump2',
    'se/Key', 'se/Knock', 'se/Laser1', 'se/Laser2', 'se/Laugh',
    'se/Launch', 'se/Leakage', 'se/Liquid', 'se/Load', 'se/Machine',
    'se/Magic1', 'se/Magic2', 'se/Magic3', 'se/Magic4', 'se/Miss',
    'se/Monster1', 'se/Monster2', 'se/Monster3', 'se/Monster4', 'se/Monster5',
    'se/Move1', 'se/Move2', 'se/Move3', 'se/Move4', 'se/Move5',
    'se/Neon', 'se/Noise', 'se/Open1', 'se/Open2', 'se/Open3',
    'se/Open4', 'se/Open5', 'se/Paralyze1', 'se/Paralyze2', 'se/Paralyze3',
    'se/Parry', 'se/Phone', 'se/Poison', 'se/Pollen', 'se/Powerup',
    'se/Push', 'se/Raise1', 'se/Raise2', 'se/Recovery', 'se/Reflection',
    'se/Run', 'se/Saint1', 'se/Saint2', 'se/Saint3', 'se/Saint4',
    'se/Saint5', 'se/Sand', 'se/Save', 'se/Scream', 'se/Sheep',
    'se/Shop1', 'se/Shop2', 'se/Shot1', 'se/Shot2', 'se/Shot3',
    'se/Silence', 'se/Siren', 'se/Skill1', 'se/Skill2', 'se/Skill3',
    'se/Slash1', 'se/Slash2', 'se/Slash3', 'se/Slash4', 'se/Slash5',
    'se/Sleep', 'se/Sound1', 'se/Sound2', 'se/Sound3', 'se/Splash',
    'se/Stare', 'se/Starlight', 'se/Switch1', 'se/Switch2', 'se/Switch3',
    'se/Sword1', 'se/Sword2', 'se/Sword3', 'se/Sword4', 'se/Sword5',
    'se/Teleport', 'se/Thunder1', 'se/Thunder10', 'se/Thunder2', 'se/Thunder3',
    'se/Thunder4', 'se/Thunder5', 'se/Thunder6', 'se/Thunder7', 'se/Thunder8',
    'se/Thunder9', 'se/Transceiver', 'se/Twine', 'se/Up1', 'se/Up2',
    'se/Up3', 'se/Up4', 'se/Water1', 'se/Water2', 'se/Water3',
    'se/Water4', 'se/Water5', 'se/Wind1', 'se/Wind2', 'se/Wind3',
    'se/Wind4', 'se/Wind5', 'se/Wind6', 'se/Wind7', 'se/Wolf',
    'se/chew', 'se/click', 'se/cook', 'se/crash2', 'se/cut',
    'se/deerrecovery', 'se/dig', 'se/ding', 'se/ducktoy', 'se/fenghuang',
    'se/fenghuang2', 'se/fenghuang3', 'se/freeze', 'se/gameover_3', 'se/gather',
    'se/get1', 'se/ink', 'se/inkloong', 'se/key2', 'se/money',
    'se/pill', 'se/pill2', 'se/starsand', 'se/stick', 'se/suck1',
    'se/suck2', 'se/taotaotun', 'se/tiger', 'se/tiger2', 'se/trainSE',
    'se/water', 'se/wine', 'se/wirte',
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